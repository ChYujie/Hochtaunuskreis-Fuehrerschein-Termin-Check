import crypto from "node:crypto";
import { URL } from "node:url";
import { config } from "./config.js";
import { getVapidStore, saveVapidStore } from "./storage.js";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unbase64url(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hkdfExtract(salt, ikm) {
  return crypto.createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk, info, length) {
  const infoBuffer = Buffer.isBuffer(info) ? info : Buffer.from(info);
  let previous = Buffer.alloc(0);
  let output = Buffer.alloc(0);
  let counter = 1;
  while (output.length < length) {
    previous = crypto
      .createHmac("sha256", prk)
      .update(previous)
      .update(infoBuffer)
      .update(Buffer.from([counter++]))
      .digest();
    output = Buffer.concat([output, previous]);
  }
  return output.subarray(0, length);
}

function derToJose(signature) {
  const offset = signature[1] > 0x80 ? 3 : 2;
  let rLength = signature[offset + 1];
  let r = signature.subarray(offset + 2, offset + 2 + rLength);
  let sLength = signature[offset + 2 + rLength + 1];
  let s = signature.subarray(offset + 2 + rLength + 2, offset + 2 + rLength + 2 + sLength);
  if (r[0] === 0) r = r.subarray(1);
  if (s[0] === 0) s = s.subarray(1);
  return Buffer.concat([Buffer.concat([Buffer.alloc(32 - r.length), r]), Buffer.concat([Buffer.alloc(32 - s.length), s])]);
}

function publicKeyFromJwk(jwk) {
  return Buffer.concat([Buffer.from([0x04]), unbase64url(jwk.x), unbase64url(jwk.y)]);
}

function mailAddress(value) {
  const match = value.match(/<([^>]+)>/);
  return match ? match[1] : value;
}

export async function getVapidKeys() {
  const store = await getVapidStore();
  if (store.publicKey && store.privateJwk) return store;

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });
  const next = {
    publicKey: base64url(publicKeyFromJwk(publicJwk)),
    privateJwk,
    createdAt: new Date().toISOString()
  };
  await saveVapidStore(next);
  return next;
}

function vapidAuthorization(subscription, keys) {
  const endpoint = new URL(subscription.endpoint);
  const aud = `${endpoint.protocol}//${endpoint.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64url(JSON.stringify({ aud, exp, sub: `mailto:${mailAddress(config.smtp.from)}` }));
  const signingInput = `${header}.${payload}`;
  const privateKey = crypto.createPrivateKey({ key: keys.privateJwk, format: "jwk" });
  const der = crypto.sign("sha256", Buffer.from(signingInput), privateKey);
  return `vapid t=${signingInput}.${base64url(derToJose(der))}, k=${keys.publicKey}`;
}

function encryptPayload(subscription, payload) {
  const userPublicKey = unbase64url(subscription.keys.p256dh);
  const authSecret = unbase64url(subscription.keys.auth);
  const salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(userPublicKey);

  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    userPublicKey,
    serverPublicKey
  ]);
  const ikm = hkdfExpand(hkdfExtract(authSecret, sharedSecret), keyInfo, 32);
  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdfExpand(prk, "Content-Encoding: nonce\0", 12);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  return Buffer.concat([salt, recordSize, Buffer.from([serverPublicKey.length]), serverPublicKey, ciphertext]);
}

export async function sendWebPush(subscription, notification) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return;
  const keys = await getVapidKeys();
  const body = encryptPayload(subscription, JSON.stringify(notification));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: vapidAuthorization(subscription, keys)
    },
    body
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Web push failed with HTTP ${response.status}`);
  }
}

export function publicKeyToUint8Array(publicKey) {
  return unbase64url(publicKey);
}

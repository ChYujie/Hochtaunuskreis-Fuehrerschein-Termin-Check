import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const subscribersFile = new URL("../data/subscribers.json", import.meta.url);
const stateFile = new URL("../data/state.json", import.meta.url);
const vapidFile = new URL("../data/vapid.json", import.meta.url);

async function ensureFile(fileUrl, fallback) {
  await mkdir(dirname(fileURLToPath(fileUrl)), { recursive: true });
  try {
    await readFile(fileUrl, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeJson(fileUrl, fallback);
  }
}

export async function readJson(fileUrl, fallback) {
  await ensureFile(fileUrl, fallback);
  return JSON.parse(await readFile(fileUrl, "utf8"));
}

export async function writeJson(fileUrl, value) {
  await mkdir(dirname(fileURLToPath(fileUrl)), { recursive: true });
  await writeFile(fileUrl, `${JSON.stringify(value, null, 2)}\n`);
}

export async function getSubscribers() {
  return readJson(subscribersFile, []);
}

export async function saveSubscribers(subscribers) {
  await writeJson(subscribersFile, subscribers);
}

export async function upsertSubscriber(email, pushSubscription) {
  const subscribers = await getSubscribers();
  const existing = subscribers.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    existing.pushSubscription = pushSubscription || existing.pushSubscription;
    existing.updatedAt = new Date().toISOString();
  } else {
    subscribers.push({
      email,
      pushSubscription: pushSubscription || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  await saveSubscribers(subscribers);
}

export async function unsubscribe(email) {
  const subscribers = await getSubscribers();
  await saveSubscribers(subscribers.filter((item) => item.email.toLowerCase() !== email.toLowerCase()));
}

export async function getState() {
  return readJson(stateFile, {
    lastCheckAt: null,
    lastResult: null,
    lastNotifiedKey: null,
    error: null
  });
}

export async function saveState(state) {
  await writeJson(stateFile, state);
}

export async function getVapidStore() {
  return readJson(vapidFile, {});
}

export async function saveVapidStore(store) {
  await writeJson(vapidFile, store);
}

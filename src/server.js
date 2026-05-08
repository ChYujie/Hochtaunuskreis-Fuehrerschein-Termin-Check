import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { runCheck, startChecker } from "./checker.js";
import { getState, upsertSubscriber, unsubscribe } from "./storage.js";
import { getVapidKeys } from "./webpush.js";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(request, response) {
  const url = new URL(request.url, config.baseUrl);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(publicDir, pathname));
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[extname(filePath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, config.baseUrl);

    if (request.method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, await getState());
      return;
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/push-key") {
      const keys = await getVapidKeys();
      sendJson(response, 200, { publicKey: keys.publicKey });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/subscribe") {
      const body = await readBody(request);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) {
        sendJson(response, 400, { error: "Valid email is required." });
        return;
      }
      await upsertSubscriber(body.email, body.pushSubscription || null);
      const state = await runCheck({ forceNotify: true });
      sendJson(response, 200, { ok: true, state });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/unsubscribe") {
      const body = await readBody(request);
      await unsubscribe(body.email || "");
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/check-now") {
      sendJson(response, 200, await runCheck({ forceNotify: true }));
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response);
      return;
    }

    response.writeHead(405);
    response.end("Method not allowed");
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message });
  }
});

startChecker(config.checkIntervalMs);

server.listen(config.port, () => {
  console.log(`Appointment watcher running at http://localhost:${config.port}`);
});

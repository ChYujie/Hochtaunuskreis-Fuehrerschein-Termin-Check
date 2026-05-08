import { Buffer } from "node:buffer";
import tls from "node:tls";
import { config } from "./config.js";

function smtpConfigured() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      if (/\r?\n$/.test(buffer)) {
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

async function expect(socket, code) {
  const lines = [];
  while (true) {
    const line = await readLine(socket);
    lines.push(line);
    if (line.startsWith(`${code} `)) break;
    if (!line.startsWith(`${code}-`) && !line.startsWith(String(code))) {
      throw new Error(`SMTP expected ${code}, got ${line.trim()}`);
    }
  }
  return lines.join("");
}

async function sendCommand(socket, command, expectedCode) {
  socket.write(`${command}\r\n`);
  return expect(socket, expectedCode);
}

function addressOnly(value) {
  const match = value.match(/<([^>]+)>/);
  return match ? match[1] : value;
}

export async function sendAppointmentEmail(to, result) {
  if (!smtpConfigured()) {
    console.log(`[email disabled] ${to}: ${formatAppointmentSubject(result)}`);
    return;
  }

  const socket = tls.connect({
    host: config.smtp.host,
    port: config.smtp.port,
    servername: config.smtp.host
  });

  await expect(socket, 220);
  await sendCommand(socket, "EHLO localhost", 250);
  await sendCommand(socket, "AUTH LOGIN", 334);
  await sendCommand(socket, Buffer.from(config.smtp.user).toString("base64"), 334);
  await sendCommand(socket, Buffer.from(config.smtp.pass).toString("base64"), 235);
  await sendCommand(socket, `MAIL FROM:<${addressOnly(config.smtp.from)}>`, 250);
  await sendCommand(socket, `RCPT TO:<${to}>`, 250);
  await sendCommand(socket, "DATA", 354);

  const subject = formatAppointmentSubject(result);
  const text = formatAppointmentText(result);
  socket.write(
    [
      `From: ${config.smtp.from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      "."
    ].join("\r\n") + "\r\n"
  );
  await expect(socket, 250);
  await sendCommand(socket, "QUIT", 221);
  socket.end();
}

export function formatAppointmentSubject(result) {
  if (!result?.earliest) return "No Hochtaunuskreis appointment currently available";
  return `Hochtaunuskreis appointment: ${result.earliest.label}`;
}

export function formatAppointmentText(result) {
  if (!result?.earliest) {
    return `No appointment is currently available.\n\nChecked: ${result?.checkedAt || new Date().toISOString()}\nSource: ${config.terminlandUrl}`;
  }

  const topTimes = result.appointments
    .slice(0, 12)
    .map((item) => `- ${item.label}`)
    .join("\n");

  return [
    `Latest earliest appointment: ${result.earliest.label}`,
    "",
    "Available times:",
    topTimes,
    "",
    `Checked: ${result.checkedAt}`,
    `Source: ${config.terminlandUrl}`
  ].join("\n");
}

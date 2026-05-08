import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAppointments } from "./terminland.js";
import { formatAppointmentSubject, formatAppointmentText } from "./email.js";

const statusFile = new URL("../public/status.json", import.meta.url);

async function writeStatus(status) {
  await mkdir(dirname(fileURLToPath(statusFile)), { recursive: true });
  await writeFile(statusFile, `${JSON.stringify(status, null, 2)}\n`);
}

async function sendResendEmail(result) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  const from = process.env.EMAIL_FROM || "Appointment Watch <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.log("Email skipped. Set RESEND_API_KEY and ALERT_EMAIL repository secrets to enable alerts.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: formatAppointmentSubject(result),
      text: formatAppointmentText(result)
    })
  });

  if (!response.ok) {
    throw new Error(`Resend email failed: HTTP ${response.status} ${await response.text()}`);
  }
}

try {
  const result = await fetchAppointments();
  await writeStatus({
    ok: true,
    mode: "github-actions",
    updatedAt: new Date().toISOString(),
    result,
    error: null
  });
  await sendResendEmail(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeStatus({
    ok: false,
    mode: "github-actions",
    updatedAt: new Date().toISOString(),
    result: null,
    error: {
      message: error.message
    }
  });
  throw error;
}

import { createRequire } from "node:module";
import { config } from "./config.js";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const require = createRequire(import.meta.url);
    return require(`${config.playwrightNodeModules}/playwright`);
  }
}

async function clickNext(page) {
  await page.getByRole("button", { name: /Weiter/i }).click();
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function clickChoice(page, text) {
  await page.locator("label").filter({ hasText: text }).first().click();
}

function normalizeDate(text) {
  const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function fetchAppointments({ visible = false } = {}) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: !visible });
  const page = await browser.newPage({ locale: "de-DE" });

  try {
    await page.goto(config.terminlandUrl, { waitUntil: "networkidle", timeout: 45_000 });

    await clickChoice(page, "Führerschein");
    await clickNext(page);

    await clickChoice(page, /Abholung Führerschein nach Prüfung oder Umschreibung/i);
    await clickNext(page);

    await page.locator("label").filter({ has: page.locator("input[type='radio'], input[type='checkbox']") }).first().click();
    await clickNext(page);

    await page.waitForFunction(
      () => /Terminauswahl|Freie Termine|Keine freien Termine|keine freien Termine/i.test(document.body.innerText),
      { timeout: 45_000 }
    );
    await page.waitForTimeout(1_000);

    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const heading =
        bodyText.match(/Freie Termine für[^\n]*\d{1,2}\.\d{1,2}\.\d{4}/)?.[0] || "";

      const timeNodes = [...document.querySelectorAll("label,input,span,div")]
        .map((node) => node.textContent?.trim() || "")
        .filter((text) => /^\d{1,2}:\d{2}$/.test(text));

      const calendarDays = [...document.querySelectorAll("td,button,a,div,span")]
        .map((node) => ({
          text: node.textContent?.trim() || "",
          className: String(node.className || "")
        }))
        .filter((node) => /^\d{1,2}$/.test(node.text) && /frei|free|available|success|select/i.test(node.className));

      return {
        bodyText,
        heading: heading || "",
        times: [...new Set(timeNodes)],
        availableDayHints: calendarDays.map((node) => node.text)
      };
    });

    const appointmentDate = normalizeDate(result.heading) || normalizeDate(result.bodyText);
    const appointments = result.times.map((time) => ({
      date: appointmentDate,
      time,
      label: appointmentDate ? `${appointmentDate} ${time}` : time
    }));

    return {
      checkedAt: new Date().toISOString(),
      sourceUrl: config.terminlandUrl,
      hasAppointments: appointments.length > 0,
      earliest: appointments[0] || null,
      appointments,
      selectedDateLabel: result.heading,
      availableDayHints: result.availableDayHints
    };
  } finally {
    await browser.close();
  }
}

export function appointmentKey(result) {
  if (!result?.earliest) return "none";
  return `${result.earliest.date || "unknown-date"}T${result.earliest.time}`;
}

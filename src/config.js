export const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  checkIntervalMs: Number(process.env.CHECK_INTERVAL_MS || 60_000),
  notifyEveryCheck: process.env.NOTIFY_EVERY_CHECK !== "false",
  terminlandUrl: "https://www.terminland.de/hochtaunuskreis/",
  dataDir: new URL("../data/", import.meta.url),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 465),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Appointment Watch <no-reply@localhost>"
  },
  playwrightNodeModules:
    process.env.PLAYWRIGHT_NODE_MODULES ||
    "/Users/yujie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"
};

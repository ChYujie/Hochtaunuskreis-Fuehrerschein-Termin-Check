# Hochtaunuskreis Führerschein Termin Check

Small web app that checks the Hochtaunuskreis Terminland flow once per minute:

1. `Führerschein`
2. `Abholung Führerschein nach Prüfung oder Umschreibung`
3. first quantity/person option
4. appointment list

Visitors enter an email address in the web UI. The app stores the subscriber locally, checks Terminland in the background, and sends email plus browser push notifications every check with the latest earliest appointment.

## Run

```bash
node src/server.js
```

Open `http://localhost:3000`.

For a normal Node setup with npm available:

```bash
npm install
npx playwright install chromium
npm start
```

## Email

Copy `.env.example` values into your environment and provide SMTP credentials. The built-in sender expects TLS SMTP on port `465`.

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM="Appointment Watch <alerts@example.com>"
```

If SMTP is not configured, the app still runs and logs email notifications to the server console.

To avoid repeated notifications when the earliest appointment has not changed, set:

```bash
NOTIFY_EVERY_CHECK=false
```

## Deploy On Koyeb

This repo includes a `Dockerfile` based on Microsoft's Playwright image, so Chromium and the system libraries needed by the Terminland checker are available in production.

1. Push this repo to GitHub.
2. In Koyeb, create a new Web Service.
3. Choose GitHub as the source and select this repository.
4. Choose Dockerfile deployment.
5. Use port `3000`.
6. Set the health check path to `/healthz`.
7. Add environment variables:

```bash
PORT=3000
BASE_URL=https://your-koyeb-app-url.koyeb.app
CHECK_INTERVAL_MS=60000
NOTIFY_EVERY_CHECK=true
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM="Appointment Watch <alerts@example.com>"
```

After deploy, open the Koyeb URL, enter your email, and allow browser notifications.

## Data

Local runtime data is stored in `data/`:

- `subscribers.json`
- `state.json`
- `vapid.json` after the first browser push setup

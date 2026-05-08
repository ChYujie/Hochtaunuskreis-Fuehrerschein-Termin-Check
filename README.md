# Hochtaunuskreis Führerschein Termin Check

Checks the Hochtaunuskreis Terminland flow:

1. `Führerschein`
2. `Abholung Führerschein nach Prüfung oder Umschreibung`
3. first quantity/person option
4. appointment list

## Free GitHub Hosting

This repo now supports a GitHub-only free setup:

- GitHub Pages hosts the web page.
- GitHub Actions checks appointments on a schedule.
- The latest result is published to `public/status.json`.
- Email alerts can be sent with the Resend free tier.

Limitations:

- GitHub Actions schedules are every 5 minutes here, not every minute.
- Browser push notifications are not available in the free GitHub-only version because there is no always-running backend.
- The GitHub Pages form cannot save subscribers. Put the alert email in the repository secret `ALERT_EMAIL`.

## Enable GitHub Pages

In the GitHub repository:

1. Go to `Settings` -> `Pages`.
2. Under `Build and deployment`, choose `GitHub Actions`.
3. Go to `Actions`.
4. Run the `Appointment monitor` workflow once manually.

After the workflow finishes, GitHub will show the Pages URL.

## Email Alerts

For free email alerts, create a Resend API key and add these repository secrets:

```bash
RESEND_API_KEY=your-resend-api-key
ALERT_EMAIL=your-email@example.com
EMAIL_FROM=Appointment Watch <onboarding@resend.dev>
```

`EMAIL_FROM` is optional. The default is Resend's onboarding sender. For production use, Resend may ask you to verify a sender/domain.

## Local Run

The original local web app still works:

```bash
npm install
npx playwright install chromium
npm start
```

Open `http://localhost:3000`.

For local SMTP email, copy `.env.example` values into your environment and provide SMTP credentials:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM="Appointment Watch <alerts@example.com>"
```

Local runtime data is stored in `data/` and ignored by Git.

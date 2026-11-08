# Hosting Fieldnote

This is a single Next.js Node application backed by a separate Neon PostgreSQL database. Customer pages, the business dashboard and the platform dashboard run in the same service.

## Before deployment

1. Use an isolated Neon project in the same region as the web service where available. Never reuse another product's database.
2. Apply the numbered SQL migrations with a direct owner connection. The migration command requires APP_MODE=pilot and CONFIRM_NEW_REVIEW_DATABASE=yes. Do not run the seed command on the hosted database.
3. Create a restricted runtime role with access to the app tables and use its pooled TLS connection for DATABASE_URL.
4. Configure the server values listed in .env.pilot.example. Use the exact HTTPS service origin, a new authentication secret, your tested Gemini model and an explicit daily attempt limit.
5. Provision a real platform operator using the create-owner script and its temporary ALLOW_OWNER_PROVISIONING=yes flag. Supply account details through private stdin, not command arguments, logs or committed files. Public signup is disabled. Remove the provisioning flag afterward.
6. Run npm run pilot:check before starting the service.

Keep .env.local, local-access.txt, .data, update-backups, node_modules and .next out of Git. The example environment files contain placeholders only. Never put credentials in variables prefixed NEXT_PUBLIC_.

## Render service settings

| Setting | Value |
| --- | --- |
| Service type | Web Service |
| Runtime | Node |
| Build | npm ci && npm run build |
| Start | npm run pilot:check && npm start |
| Health path | /api/health |
| Region | Match the database where possible |
| Automatic deployment | Off during the initial pilot |

Do not deploy as a Static Site. No Redis, worker, media bucket or Render PostgreSQL service is required. Database migrations and the operator account must exist before the startup check can pass. Free Render services do not provide Shell or one-off jobs, so perform initial account provisioning from a private local operator environment.

Render's free compute is intended for testing. It sleeps after 15 minutes without traffic and may take about one minute to wake. Shared workspace bandwidth and build allowances can incur overages when a payment method is present. Review the current plan and spending controls before deployment. Gemini attempt limits do not guarantee a currency spending cap.

References checked on 8 November 2026:
- https://render.com/docs/free
- https://render.com/docs/deploy-nextjs-app

## Before customer use

Create the real business, owner access, subscription expiry and allowance in the platform dashboard. Configure branding, questionnaire choices, locations and exact Google destinations in the business dashboard. Use each location's QR code to enter its customer page directly.

Test all four languages, positive and negative experiences, real Gemini generation, editing and confirmation, copy and destination handoff on iPhone Safari and Android Chrome. Verify owner isolation, HTTPS sessions, usage limits, errors and simultaneous requests against Neon. Review account recovery, backups and retention. Photos remain local and nothing is automatically published.

See PILOT_SETUP.md for the detailed acceptance checklist. The presence of source code in GitHub does not mean a hosted deployment has passed these checks.

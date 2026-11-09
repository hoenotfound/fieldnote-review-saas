# Fieldnote: lean independent review MVP

Working name only. Local customer-experience update, 8 November 2026. This is a new application. It does not depend on or access DA AI Chatbot, BrandWriter code, or BrandWriter APIs.

For an existing installation, follow `CUSTOMER_EXPERIENCE_UPDATE.md`. Do not rerun setup or seed. Pilot preparation is in `PILOT_SETUP.md`.

## Run locally (new installation only)

Use Node.js 22 or newer. Unzip the project, open its folder, and run:

```sh
npm ci
npm run setup
npm run dev
```

Open http://localhost:3000. Setup creates a unique local secret, local PostgreSQL-compatible database and three randomly passworded fictional accounts. Read `local-access.txt` in your own checkout for sign-in details. It is intentionally excluded from this package. Do not deploy those accounts or data.

The customer routes are `/r/juniper-town-centre`, `/r/juniper-park-side` and `/r/tide-riverside`. `/login`, `/dashboard` and `/platform` provide sign-in, business management and platform management. The platform operator account redirects to `/platform` after sign-in. The two business owners can only manage their own business.

Local mode uses PGlite, an embedded PostgreSQL build. Run only one app process against a local data directory. Stop the dev server before running seed or operator scripts. The test suite uses separate disposable databases.

## What is implemented

- One Next.js application with server routes. No Redis, worker service, automated billing or separate AI extraction stage.
- Two fictional businesses, three locations, persistent branding initials/colour/name, location creation/editing and stable unique QR routes with PNG downloads.
- English, Simplified Chinese, Traditional Chinese and Malay customer interfaces and independent output-language choices. Business and platform screens are English in this milestone.
- Three-step customer journey, configurable service choices, balanced detailed-feedback pairs, optional visit details, local photo previews, editable draft, confirmation before copying, Google link handoff and manual Xiaohongshu copying.
- Real Better Auth email/password sign-in, hashed passwords, cookie sessions, disabled public registration and server-side membership/operator checks. Initial staff accounts are provisioned locally, not through public signup.
- Admin-controlled access expiry, business enable/disable, allowance and explicit usage reset. Expired AI access leaves manual customer writing available; disabling a business hides its public pages.
- Generation metadata, successful-draft allowance, reservation tracking, duplicate-request protection, per-session attempts, two concurrent calls per business and a global daily attempt cap.
- One-call Gemini adapter behind explicit server settings. Default demo mode returns selected notes and original text without AI rewriting. It does not translate or call an AI provider and is clearly labelled in the UI.

Branding supports a processed public logo, initials, name and colour. Independent branch brand overrides, self-service registration, team roles, automated billing and expanded analytics are not implemented.

## AI and spending controls

Set `AI_MODE=gemini`, a new project-specific `GEMINI_API_KEY`, and a tested `GEMINI_MODEL` only after approving live tests. Never reuse DA Chatbot credentials. No live Gemini call was made during this milestone.

Each generation makes at most one provider attempt. SDK retries are disabled. Customer input is capped at 2,000 characters, output at 512 tokens, and the provider call at 25 seconds. The daily attempt cap is 100 by default, including demo/failed attempts. This is a call-count cap, not a guaranteed dollar ceiling. Confirm the chosen model's token prices, thinking behavior and provider billing safeguards before enabling live calls. The owner has tested live Chinese and Malay examples locally. Broader model quality, especially with detailed feedback, still needs evaluation.

The prompt requires genuine supplied experiences and preserves criticism. It does not guarantee factual accuracy. Customers must review, edit and confirm the current draft before exporting. Any edit resets confirmation. There is no automatic posting, review incentive or positive-only flow.

Successful persisted drafts consume one business credit. Failed calls release their reservation but still count against the daily/session attempt caps. Internal network retries use the same idempotency key and cannot consume another successful-draft credit. A deliberate new generation uses a new key. A provider may still bill a timed-out request; the app does not automatically retry it.

## Additional November pilot safeguards

The 9 November patch adds PostgreSQL-backed guest issuance/network/browser limits and per-business AI attempt budgets, optional Cloudflare Turnstile human verification for higher usage, local-first Finish clearing during network outages, opt-in kiosk inactivity reset (`?kiosk=1`), a pilot privacy-information page and a protected daily retention-cleanup workflow. It is **not automatically ready to deploy**: apply migration 004 to the verified separate Fieldnote database, configure the retention secret, run tests and a real-device acceptance check, and confirm sensible limits for shared clinic Wi-Fi. See `PILOT_SETUP.md` for current migration instructions and unresolved privacy/contact details. This does not modify DA AI Chatbot.

## Privacy and security boundaries

Original experience text is sent to the generator but not stored in the server database or application logs. A hash of generation input and minimal metadata are stored. The duplicate-response cache contains an encrypted output, accessible only through the owning location-bound browser session. Sessions last two hours. Finish revokes the session and clears cached outputs, including in-flight results. Expired encrypted outputs are purged when generation cleanup runs; an idle process is not a guaranteed deletion timer. Before a paid pilot, choose and verify the cleanup schedule and backup retention.

Personal-phone drafts persist in the current browser tab's sessionStorage, with a two-hour restoration limit, and are cleared by Finish. Kiosk mode disables draft restoration and browser storage. Photo previews use local object URLs only; there is no customer media upload endpoint. Closing/removing previews releases the object URLs.

Merchants see usage, not customer draft text. Cookie mutations require the configured exact Origin. SQL is parameterized. Business and operator actions check server-side access. QR downloads are authenticated. Google destinations accept a small HTTPS host allowlist; redirects and real branch ownership still need manual verification before pilot use.

This local milestone is not a completed security audit. Operator MFA, recovery procedures, account provisioning for real merchants, production CSP, Postgres least-privilege roles, request-rate policy beyond the present application limits, privacy notices and restore/deletion drills remain pilot work. Production credentials must never be placed in client variables or included in a source archive.

## Separate Neon and Render pilot

The source is ready for hosting configuration. Database setup, runtime credentials, a real operator account and hosted acceptance checks are required before client use. See `HOSTING_STEPS.md`, `PILOT_SETUP.md` and `.env.pilot.example`. Keep your existing local demo settings separate from the hosted environment.

## Verification

The latest pull-request CI runs tests, TypeScript checks and the production build. The production dependency audit reported no known vulnerabilities. The sign-in test emitted a warning about missing proxy IP headers; configure trusted client-IP forwarding correctly on Render before a pilot.

Run `npm test` and `npm run build`. See `MILESTONE_STATUS.md` for actual results and limitations. UI tests use a DOM simulation; they are not real-browser or real-device evidence.

The managed browser preview returned a connection error and then reported its server stopped. No completed visual browser journey or mobile screenshot is claimed. The source can be run in a normal local Node environment using the commands above.

## Next work and timing

The 1–3 week target remains plausible for a controlled pilot, not a fully self-service subscription business. Priorities are: get a stable browser preview, real-device testing, real Gemini evaluation in four languages, isolated Neon integration, operator account security, cleanup/backup behavior and private pilot acceptance. Unexpected model quality or provider setup issues can extend that window.

The architecture intentionally stays one app and one database. Add queues, workers or automated payments only when measured needs justify them.

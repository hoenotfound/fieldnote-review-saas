# Independent Fieldnote pilot preparation

Hosting checklist updated on 8 November 2026. Provision an isolated database and validate the actual deployment before inviting customers. The three versioned migrations have been exercised on an empty Neon database; complete application integration still requires verification.

## Guest abuse controls and retention (9 November 2026 patch)

**Migration is mandatory before deploying this patch.** It adds `guest_session.network_key`, `guest_rate_counter` and `business_daily_budget` without deleting existing records. For the current separate Fieldnote Neon database, confirm its identity and marker, then run `npm run migrate` with `CONFIRM_EXISTING_FIELDNOTE_MIGRATION=yes` and an approved migration database role. The original `CONFIRM_NEW_REVIEW_DATABASE=yes` is only for an empty new Fieldnote database. Back up the database first and test the migration on a disposable copy. Do not run against DA AI Chatbot's Neon project.

New sessions are bounded using hashed network identifiers and per-business issuance counters in PostgreSQL. Existing two-hour sessions created before the migration temporarily lack the network key, but still use the per-business AI cap. The rightmost `X-Forwarded-For` address is considered only when hosted on Render or in local mode. Confirm Render's current proxy behavior and try spoofed headers before treating it as trusted. Shared public Wi-Fi can group multiple legitimate customers; evaluate real traffic and adjust the limits rather than setting one-request-per-IP. The controls reduce abuse; they are not proof against distributed attackers or address changes.

Default limits (overridable by server-only environment variables) are 20 new sessions per network/hour, 60/network/day, and 200/business/day. AI calls are capped at 8/network/hour and 12/network/day. The business daily AI cap defaults to the smaller of 20 or 60% of the global daily attempt cap, with a minimum of one, and can be explicitly overridden via `AI_BUSINESS_DAILY_ATTEMPT_LIMIT`. An override may exceed the global cap, but the global cap remains enforced separately. With a 10-attempt global cap the default business cap is **6**, so set client expectations accordingly. Rejected attempts never call Gemini or consume a global attempt. Session finishing and reuse of still-valid sessions are not subject to issuance counters.

Daily retention is implemented through a protected `POST /api/maintenance` endpoint and a scheduled GitHub Actions workflow at 03:23 UTC. **It remains inactive until configured.** Create an independent `MAINTENANCE_SECRET` (at least 32 characters) in the Fieldnote Render environment and set GitHub Actions repository secret `FIELDNOTE_MAINTENANCE_TOKEN` to the same value. Never commit either value. Check the first workflow run and its result, then monitor later runs; scheduled GitHub Actions can be delayed or missed. This is periodic cleanup, not a contractual deletion deadline. It removes expired encrypted output caches, generation metadata older than 30 days, old guest sessions without generation records, hashed rate counters older than three days, and summary attempt counters older than 90 days. Backup and Google Gemini provider retention are separate and need approved, accurately disclosed policies.

Finish & clear now erases text and photo previews locally even if network cleanup fails, displaying a warning when server erasure cannot be confirmed. For supervised shared kiosks, append `?kiosk=1` to the location QR URL (or `&kiosk=1` if it already has query parameters) to enable the five-minute inactivity reset; test this on the actual device and ensure the kiosk link, not a personal-phone link, carries the parameter. Do not claim the kiosk mode is secure merely from DOM tests. The public `/privacy` page is a **pilot information notice**, not final legal approval. Add the real operator's support contact and confirm backup/provider retention before a broad rollout.

## Decisions before provisioning

- Hosting preparation and a separate test deployment are authorized. Confirm the Render workspace before creation. Any paid plan or purchase still requires approval.
- Identify one real pilot business, its owner and locations, the intended Google destinations, and an initial allowance.
- Approve the Gemini project/model, daily attempt cap and spending controls. Existing caps limit attempts, not guaranteed currency spend.
- Agree on retention, account recovery and operator access protections. Do not use shared demo credentials. Consider MFA for the operator before wider public access.

## Prepared configuration

Use `.env.pilot.example` as a list of server settings. Do not overwrite `.env.local` or copy DA Chatbot settings. Set `APP_MODE=pilot`, the exact HTTPS `APP_ORIGIN`, an independent Neon TLS connection string, a new authentication secret and the review application's Gemini settings. `REVIEW_DATABASE_APPROVED=yes` is a deliberate acknowledgement that the supplied database belongs only to this app.

Runtime connections refuse incomplete pilot configuration and require the independent app database marker plus current schema. This reduces accidental reuse; it is not proof that a project is separate. Verify the actual Neon project identity before inserting credentials.

## Database and account setup, only after approval

1. Create the independent Neon database. Never copy or point at DA Chatbot's database. Do not seed fictional businesses into the pilot.
2. Use an explicit migration connection and run the supplied `npm run migrate` with `CONFIRM_NEW_REVIEW_DATABASE=yes`. It applies all numbered migrations in order and rejects unrelated tables. No production migration happens automatically on app requests.
3. Use a least-privilege runtime role with the required app-table access. Test permissions and the real PostgreSQL path, not only the local embedded database.
4. On an empty account database, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` privately in Render for the first startup. The normal pilot check creates the first platform operator in one transaction, with Better Auth password hashing. Existing accounts cannot be promoted by this path and existing admins or passwords are never replaced. Remove both variables after verifying sign-in, then deploy to remove them from the running process. Alternatively, use the server-side `create-owner` script with the temporary `ALLOW_OWNER_PROVISIONING=yes` flag. Its private JSON stdin supports `email`, `name`, `password` and optional `platformAdmin: true`. Keep passwords out of shell command arguments, history, source files and logs. Public registration stays disabled.
5. Provision the real business owner through the same operator script without `platformAdmin`, then assign the business through the platform dashboard. Confirm a fresh operator sign-in and the owner's restricted access.
6. Run `npm run pilot:check`. It validates key configuration, the initialized schema, an operator account and absence of known fictional seed records. It does not replace security, model-quality or real-device testing.

The migrations have now been applied to the isolated Neon database. Application connections, least-privilege runtime access, account provisioning and the complete customer workflow against Neon remain acceptance tests.

## One Render application, only after approval

- Create one Node web service from this independent project's source.
- Install/build: `npm ci && npm run build`.
- Start: `npm run pilot:check && npm start` after the database and operator are initialized.
- Health check: `/api/health`. This checks app liveness only and deliberately avoids database polling that would keep Neon awake. Startup checks cover database initialization; arrange separate occasional failure monitoring before a paid service.
- Add the server environment variables from the example. Keep credentials out of client-exposed variables.
- Turn automatic deployments off initially. No background workers, Redis, R2 or payment billing are needed for this scope.
- Do not upload the local `.data` directory, `.env.local`, demo access file or updater backups.

## Acceptance before inviting customers

- Real iPhone Safari and Android Chrome: language entry, long translated labels, logo layout, keyboard open, 200% text zoom, photo preview, draft editing, copying and destination handoff. Test widths around 360, 390 and 768 pixels as well as desktop.
- Positive, negative and mixed examples in all four output languages, including sparse input, selected feedback and conflicting comments. Check meaning and unwanted invented detail. Confirm actual latency, provider token usage and quotas.
- Cross-business access denial, real HTTPS cookie behaviour, sign-out/expiry and correct proxy/client-IP handling for authentication rate limits. Review production CSP and operator recovery.
- Concurrent generation, repeated requests, exhaustion, timeout and failure behaviour against real Neon. Check expired subscriptions still allow manual writing.
- Verify the real Google destination for each branch. Copying/opening a platform must never be counted as a published review.
- Approve retention and a cleanup schedule. Current encrypted draft-cache cleanup runs during generation, so it is not a time-guaranteed deletion service. Agree on database backup retention and perform a restore test.
- Do not leave an unattended shared kiosk running without a tested idle reset. Current explicit Finish clears state; session restoration has a two-hour age check, not an automatic on-screen inactivity reset.

Automated billing, richer analytics, discovery-source reporting, voice input, regional writing styles, branch-specific questionnaires and currencies beyond RM remain outside this update.

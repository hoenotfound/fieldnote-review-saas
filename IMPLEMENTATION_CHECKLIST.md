# Lean MVP checklist

7 November 2026. This supersedes the scope and architecture in specification v2.

- [x] One independent Next.js application; fictional businesses; local PostgreSQL-compatible data.
- [x] Four-language customer form, one generation call, editable draft, confirmation before copy, Google link and manual Xiaohongshu workflow.
- [x] Optional local photo preview, no photo uploads.
- [x] Secure sign-in; business branding, multiple locations, unique downloadable QR codes.
- [x] Basic platform dashboard: enable/disable businesses, expiry, usage allowance.
- [x] Tenant checks, anonymous browser sessions, idempotency, atomic usage reservation, bounded AI requests, no automatic retries.
- [x] Backend and simulated-DOM tests: isolation, limits, confirmation reset and production build.
- [ ] Complete a real browser/mobile journey. Managed preview stopped unexpectedly.
- [x] Prepare separate Neon/Render setup instructions; no provider creation, purchase or public deployment yet.

Milestone 1: working local app with persistent fictional data, real authentication and simulated generation; Gemini adapter available behind explicit server configuration.
Pilot follow-up: isolated Neon credentials, paid Gemini key/model evaluation, operator MFA, device testing, privacy notices, backups and Render approval.
Target: 1–3 weeks for a controlled pilot, assuming timely testing and configuration. Production readiness is not claimed from the local milestone.

# Customer-experience milestone

8 November 2026. Local implementation; no cloud resources or public deployment.

Added: three-step customer interface, business-logo upload/removal with server-side image validation and resizing, balanced translated feedback pairs, preservation of questionnaire answers, separate draft/share screen, restoration without approval, pilot configuration/schema checks, operator CLI preparation and liveness endpoint.

Preserved: one Next.js app, one-call Gemini generation, existing quotas, real password sign-in, business isolation, manual subscriptions, four languages, local-only customer photos and explicit confirmation before export. DA AI Chatbot is untouched.

Verification: 35 automated tests passed, including real authentication, cross-business denial, validated logo upload/removal and caching, selected-feedback handling, cost limits, duplicate-request handling, migration preservation and customer navigation. Production build passed. The updater is separately tested to preserve private environment settings and local data and to reject unrelated projects.

Browser preview infrastructure stopped before serving. No screenshot-based visual verification or real-device QA is claimed. No live Gemini calls were made in this update. The owner previously confirmed the old live-generation and questionnaire flows work locally.

Hosting preparation on 8 November 2026: the three migrations were applied to an isolated Neon database. Verified 14 tables and zero businesses, users or generations. No public service is deployed.

Pending: Render workspace confirmation, private credentials and operator setup, real-device layout/clipboard checks, detailed-feedback Gemini evaluation, application integration with Neon, production cookie/proxy/recovery review and retention/backup checks. Any paid service still requires approval. See HOSTING_STEPS.md and PILOT_SETUP.md.

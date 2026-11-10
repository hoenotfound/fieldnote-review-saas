# HD Review production-mode rollout

Current live site: `https://fieldnote-review.netlify.app` on GitHub `main`.
Existing Neon: project `morning-cloud-02172364`, branch `main`, database `fieldnote_trial`.
This rollout reuses the SAME database and data. The database name is intentionally unchanged.

## Safe order

1. Back up the Neon project. Available restore point: `backup-before-hd-review-production-20261110`. Keep it until the new mode is verified.
2. Deploy this **backward-compatible** code while Netlify's existing `APP_MODE=pilot` and old trial-named environment variables stay unchanged. Pilot behaviour remains the same.
3. In Netlify > Project configuration > Environment variables, for **Production** / **Builds and Functions**, add:
   - `HD_REVIEW_DATABASE_URL`: set to the **same existing secret value** as `FIELDNOTE_TRIAL_DATABASE_URL`. Copy within Netlify; never paste it into GitHub/chat. It must still connect to `fieldnote_trial` through a pooled Neon host.
   - `HD_REVIEW_DATABASE_MARKER=hd-review-production-morning-cloud-02172364`.
4. Confirm these existing values remain in place: `HOSTING_PROVIDER=netlify`, `REVIEW_DATABASE_APPROVED=yes`, `APP_ORIGIN=https://fieldnote-review.netlify.app`, authentication secret, maintenance secret, Gemini settings, Turnstile keys and usage limits. Remove `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` if present, **after confirming admin login works**.
5. Only after step 3, change `APP_MODE` from `pilot` to `production`. Do not change the hostname, the Neon database, or its role. Trigger a production deploy if Netlify does not rebuild automatically.
6. Confirm Netlify shows **Published** from `main`. Check admin login, both real Beleco branches, languages, generating/copying genuine review drafts, the Google review handoff, and the scheduled retention function. Verify no demo customer route is available.
7. Once stable, the two legacy variables `FIELDNOTE_TRIAL_DATABASE_URL` and `NETLIFY_TRIAL_MARKER` can be removed in a separate change. Do not remove them before the production deploy is confirmed.

## Critical safeguards

- Both modes ignore generic `DATABASE_URL` on Netlify.
- The production mode **only** accepts `HD_REVIEW_DATABASE_URL`; it does not fall back to the trial URL.
- The app requires the distinct `HD_REVIEW_DATABASE_MARKER` row and the normal `independent-review-mvp-v1` marker at every cold start.
- `sslmode=verify-full`, Neon pooled host, and the existing `/fieldnote_trial` database remain enforced.
- **Never** set `APP_MODE=production` on the existing deployed code before the backward-compatible release is published.
- This is an **environment promotion**, not a migration of historic Render/older Neon review records, a payment/plan change, or a claim of completed end-to-end security testing.
- If production deploy fails, restore `APP_MODE=pilot` and rebuild using the unchanged old variables. Do not delete Neon data or restore the backup unless data are actually damaged.

## Other launch checks

- Confirm Google Business Profile review forms on actual mobile devices (already user-verified).
- Check admin login and two network guest flows.
- Confirm Beleco Clinic allowance and subscription expiry with the customer rather than assigning new commercial terms.
- Check email verification/recovery and Turnstile challenge behavior before opening to unrelated customers.

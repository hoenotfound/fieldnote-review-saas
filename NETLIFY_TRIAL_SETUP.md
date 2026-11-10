# Fieldnote isolated Netlify Free trial

**Status (10 November 2026):** The HD Review site is live on Netlify from `test/netlify-fieldnote-trial-20261109` at commit `ae44be9`. The Netlify application still uses a deliberately isolated Neon trial database and trial marker. Its successful deployment does not mean production customer data have been migrated.

## Resources (do not confuse with production)

- GitHub repository: `hoenotfound/fieldnote-review-saas`
- Netlify source branch: `test/netlify-fieldnote-trial-20261109` until a controlled switch to `main`; both branches must contain the same tested application code before changing the Netlify project setting.
- Neon trial project: `fieldnote-netlify-trial` (`morning-cloud-02172364`), Singapore, PostgreSQL 17
- Neon trial database: `fieldnote_trial`, original role `fieldnote_trial_app`
- Trial-only marker in `review_app_meta`: `fieldnote-netlify-trial-morning-cloud-02172364`
- Trial-only customer route: `/r/netlify-demo`, or QR redirect `/q/netlify-test-qr-only`
- This database contains one **fictional** business/location and initially zero accounts, guest sessions, or reviews; no production records were copied.
- Live Render production project: `square-king-93239719`. **NEVER use its connection string.**

## 1. Create the Netlify site

1. Log in to Netlify. Choose **Add new project > Import an existing project** and connect your GitHub account.
2. Select `hoenotfound/fieldnote-review-saas`. Existing site `fieldnote-review.netlify.app` currently uses the `test/netlify-fieldnote-trial-20261109` production branch. Keep the isolated site database and verify the Render deployment connection before syncing the application to `main`.
3. Set the build command to `npm run netlify:build` and publish directory to `.next` (from `netlify.toml`); Node 24.
4. Note the exact `https://YOUR-SITE.netlify.app` URL. Add the environment variables below **before publishing**. If the first deploy fails because the variables aren't configured yet, configure them and redeploy. Keep automatic deploys off after the first successful trial to save Free credits.

Netlify's maintained OpenNext adapter handles Next.js App Router, route handlers and SSR. No custom adapter package is necessary. Netlify Free functions default to Ohio, while the trial database is in Singapore; real latency must be measured.

## 2. Configure private Netlify environment variables

Use `.env.netlify-trial.example` as a checklist. Enter values in **Netlify's Environment variables UI**, with runtime availability for Functions and build availability (Netlify Free variables generally apply to all scopes). **Never commit or paste secrets in GitHub issues, PRs, or ChatGPT.**

- `HOSTING_PROVIDER=netlify`
- `APP_MODE=pilot`
- `APP_ORIGIN=https://YOUR-SITE.netlify.app` (exact Netlify primary URL; no trailing path)
- `REVIEW_DATABASE_APPROVED=yes`
- `NETLIFY_TRIAL_MARKER=fieldnote-netlify-trial-morning-cloud-02172364`
- `FIELDNOTE_TRIAL_DATABASE_URL`: Copy a **pooled** PostgreSQL connection string from the dedicated Neon trial project, **database fieldnote_trial**, using the normal Neon `sslmode=require` or `sslmode=verify-full` parameter (an omitted mode is also secured automatically). The app explicitly upgrades the trial connection to `sslmode=verify-full` before connecting; do not copy Fieldnote or DA Chatbot production URLs. Set the Netlify variable's scope to include **Builds and Functions**. The trial intentionally ignores any generic `DATABASE_URL` (including one from an extension).
- `BETTER_AUTH_SECRET`: new random secret, at least 32 characters, **different from Render**.
- `MAINTENANCE_SECRET`: another new random secret, at least 32 characters, **different from Render**.
- `AI_MODE=gemini`, `GEMINI_API_KEY` (prefer separate trial key), `GEMINI_MODEL` (supported tested model)
- `AI_DAILY_ATTEMPT_LIMIT=5`, `AI_BUSINESS_DAILY_ATTEMPT_LIMIT=3`
- `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`: first-deployment-only account creation; choose a real email and a unique password of 12–128 characters. **Remove both values and redeploy after verifying sign-in.**
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: create a **new** Cloudflare Turnstile widget for this exact Netlify hostname. Never reuse the widget restricted to Render. Set both together.

Netlify forwards `x-nf-client-connection-ip` and `x-nf-request-id` to its functions. The application requires both to identify each visitor network, hashes the IP using `BETTER_AUTH_SECRET` and business ID, and never stores raw IPs. Do **not** add `x-nf-site-id`: Netlify does not document this header for Functions. If the trusted headers are unavailable, the app fails closed to a shared network bucket while independent per-browser and per-business daily caps still apply. Before serving customers, verify live CDN headers cannot be spoofed; passing unit tests is not a substitute for an edge-header test.

Two-device acceptance check: open `/r/netlify-demo` on Phone A (Wi-Fi) and Phone B (mobile data, Wi-Fi off) in separate browsers; submit one real, independently written review from each. Verify both succeed. Check Neon `guest_session` for the two new rows: `network_key` values must differ, while the two `client_key` values are also distinct. Never log or display raw IP addresses. This consumes two AI attempts, so the trial daily cap may be exhausted after this check.

The build performs three checks in this order: trial configuration, `npm run pilot:check` (including separate database marker and initial admin), then the Next.js production build. It will intentionally fail without the correct isolated credentials.

## 3. Check the working trial

Only use the new Netlify site's URLs, such as `https://YOUR-SITE.netlify.app/r/netlify-demo`.

1. Check welcome, four languages, optional spend slider, local photo preview, Xiaohongshu copy, reset and kiosk timeout.
2. Test guest cookie creation and one real Gemini generation with a **fictional review**, then confirm the edited text is preserved. This will cost a small amount in Gemini API usage.
3. Test 2 unverified AI attempts and the challenge threshold. With daily cap 5 the default business daily cap is 3; don't stress-test beyond the small trial budget.
4. Inspect Netlify function logs and safe counters for shared clinic Wi-Fi and two different networks. **Never log raw visitor IP addresses, cookie tokens or review content.** The IP integration uses `x-nf-client-connection-ip`, `x-nf-request-id` and a matching site ID, with a safe shared fallback if metadata is unavailable. This header provenance has **not yet been verified in a live Netlify deployment**.
5. Sign in using your trial admin account and verify business/dashboard actions against the trial database only.
6. Run scheduled `fieldnote-retention` once from Netlify Functions > Run now, then verify it reports success. Its normal schedule is 03:23 UTC daily. The existing GitHub retention job continues to serve Render and must **not** be repointed to Netlify.
7. Check startup after an idle period and compare against Render Free. Confirm Netlify Free credits and Ohio-to-Singapore latency.
8. Test real iPhone Safari and Android Chrome with Turnstile and QR. Do not assume the automated tests prove platform behaviour.

The demo location deliberately has **no real Google review destination**. Add a permitted test link only if you can test without posting fake or promotional reviews. No customer photo is uploaded by Fieldnote.

## 4. Release boundaries and rollback

- Before merging trial application changes into `main`, verify whether any Render service auto-deploys from `main`. The Netlify build and database guards were designed for the isolated Netlify setup; publishing changes to Render must be considered separately.
- Production Render environment variables, database, domain, and QR links remain unchanged.
- A failed Netlify deploy cannot disable Render. Remove the Netlify site/project to stop further hosting usage, and decommission its isolated Neon project later if no longer needed.
- No live customer data should be entered on this trial URL.
- Netlify Free is capped by the monthly credit allowance and may pause the site if exhausted. A warm function is not a guaranteed latency SLA.

## Sources

- Netlify Next.js support: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- Netlify function limits/region: https://docs.netlify.com/build/functions/configuration/
- Netlify environment variables: https://docs.netlify.com/build/functions/environment-variables/
- Netlify scheduled functions: https://docs.netlify.com/build/functions/scheduled-functions/

## 5. Controlled migration of the Netlify production branch to `main`

1. Ensure the latest working Netlify commit is incorporated into `main` through a reviewed, successful PR. **Do not switch Netlify to `main` while it still contains the older implementation.**
2. Confirm that any other hosting service connected to GitHub `main`, particularly the earlier Render project, will not receive an unintended production deployment. Disable its auto-deploy if no longer needed or deliberately approve the additional release.
3. In the Netlify project, check Environment variables. Confirm that the existing **Production** context exposes `HOSTING_PROVIDER=netlify`, `APP_MODE=pilot`, `APP_ORIGIN=https://fieldnote-review.netlify.app`, `REVIEW_DATABASE_APPROVED=yes`, `NETLIFY_TRIAL_MARKER`, the **isolated** `FIELDNOTE_TRIAL_DATABASE_URL` for Builds and Functions, and required auth/Gemini/Turnstile variables. Check whether any secret is restricted specifically to the old trial branch. Never copy credentials into GitHub.
4. In Netlify, go to **Project configuration > Developer settings > Continuous deployment > Branches and deploy contexts > Configure**, change the production branch to `main` and save. Keep the same Netlify project and public hostname. Make a production deploy from the updated `main` branch if needed.
5. Confirm the deploy is **Published** from `main`, the source SHA is as expected, all four languages work, AI generates correctly, the dashboard signs in, and the isolated database marker check passes. Existing QR routes remain unchanged.
6. Keep the old trial branch as a rollback reference until these checks pass. If the new branch fails, return Netlify's production branch selection to the previously working trial branch and redeploy. Do not delete either database.

**Boundary:** Changing a Git production branch does **not** turn trial Neon data into a commercial production database, rename the `.netlify.app` hostname, or replace demo business details. Those require separate work and explicit approval.

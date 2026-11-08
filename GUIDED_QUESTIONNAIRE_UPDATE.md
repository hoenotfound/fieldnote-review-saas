# Guided customer questionnaire update

8 November 2026. Local update for the independent Fieldnote application.

## Install on your computer

1. In the terminal running Fieldnote, press **Ctrl+C** to stop the development server. Close any other terminal running the same app.
2. Back up your existing project folder, including `.env.local`, `.data` and `local-access.txt`. Keep this backup private.
3. Extract **Fieldnote_Guided_Questionnaire_Update.zip**. Put the extracted **questionnaire-update** folder inside your existing **lean-review-mvp** project folder, beside `package.json`. Do not replace or delete the project folder.
4. In a terminal opened in your existing **lean-review-mvp** folder, run:

```sh
node questionnaire-update/apply-update.mjs
npm run dev
```

No new dependencies or API keys are needed. Do not run `npm run setup` or `npm run seed` again.

The updater validates that it is inside Fieldnote, checks the supplied files and backs up overwritten source files under `update-backups`. It copies source only. It does not change `.env.local`, `.data`, `local-access.txt`, package files or your Gemini model. When the app next opens its local database, an additive migration creates the questionnaire settings field. Existing accounts, passwords, branding, locations, QR links, usage and subscriptions remain.

If the browser still shows the old form, refresh the page. If startup fails, stop and retain the error message and backup. Do not delete the database or reset your project.

## Set up choices

1. Open http://localhost:3000/dashboard and sign in with your existing business owner account.
2. Find **Customer questionnaire** below **Business branding**.
3. Click **Add item or service**. Enter an actual item or service name, such as Coffee for the fictional cafe. Add its Simplified Chinese, Traditional Chinese and Malay names if available.
4. Click **Save questionnaire**, then use **Open customer page** for a location.

Up to 12 choices are supported per business and shared across that business's locations. English is required; missing translations use the English name. New questionnaire item lists start empty so the update cannot invent services or alter existing branding. The feedback questions work immediately, even without configured items. An empty item list hides the item question.

## Customer flow

- Choose page language and Google Reviews or Xiaohongshu.
- Select only items actually tried. Nothing starts selected.
- Give feedback on any relevant aspect: product/service quality, staff/service, value or environment. Each supports Good, Mixed and Could improve. Tap a chosen answer again to clear it. Every sentiment follows the same flow.
- Optionally add first/repeat visit and total spend in RM. Amount means total for the visit, not per person. Skip irrelevant fields.
- Add personal comments if desired. At least one explicit aspect assessment, or eight characters of comments, is needed for generation. Choosing an item alone is insufficient.
- Choose output language, consent to sending text and answers to the AI provider, and generate.
- Edit and confirm the draft before copying or opening Google. Xiaohongshu remains manual title/body copying and manual photo selection.

The one Gemini request receives selected details plus the customer's comments. Unselected items and skipped aspects are excluded. Instructions preserve positive, mixed and negative meaning, avoid invented explanations, and request a short factual Xiaohongshu title based on the experience. Quality still depends on the model and customer checking the output.

Changing source answers clears the old draft and its approval. Editing the draft clears approval. Language changes preserve selections. Finish & clear resets answers, text, draft and local photo previews. Manual mode shows editable notes and comments in the page language without calling AI or translating free text. Demo mode labels its unrewritten notes explicitly.

## Quick check on your laptop

1. Configure Coffee / 咖啡 / 咖啡 / Kopi in the dashboard and save.
2. Open the customer page, select Coffee, choose quality Good and service Could improve. Add: “The coffee was nice, but I waited 20 minutes.”
3. Select Simplified Chinese output and generate once. Check that coffee and the wait are preserved and no unsupported details appear.
4. Confirm the draft, then edit it. Copy should become disabled until you confirm again.
5. Switch the page language and verify the selected answers remain. For Xiaohongshu, check that title and body are editable and nothing is posted automatically.

Each successful AI draft counts toward the existing allowance. Testing another language or regenerating uses another call. Existing daily, session and business limits remain in place. No paid calls were made while implementing this update.

## Validation and limits

28 automated tests passed, including tenant access checks, structured-answer validation, selected-fact handling, request deduplication, usage limits, four-language controls, editing/confirmation, photo privacy, decimal amounts, Finish clearing, and an upgrade from the old local database followed by reopening. Production build passed.

The browser preview connection in the development environment was unavailable. Visual layout and real Gemini responses with the new questionnaire still need the short local check above. Existing live-generation tests from your laptop remain useful but do not establish the quality of the new prompt for every input.

This update does not deploy publicly, provision Neon or Render, change DA AI Chatbot, add billing, store customer photos, or submit reviews. Separate branch-specific questionnaires and currencies other than RM are deferred.

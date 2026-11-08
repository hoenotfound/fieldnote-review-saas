# Customer experience update

8 November 2026. Independent Fieldnote app. This updates your existing local application.

## Install

1. Stop the app with **Ctrl+C**. Back up your project folder, including `.env.local`, `.data` and `local-access.txt`. Keep this backup private.
2. Extract **Fieldnote_Customer_Experience_Update.zip**.
3. Place its **customer-experience-update** folder inside your existing **lean-review-mvp** project, beside `package.json`.
4. Open a terminal in your existing project folder and run these commands one at a time:

```sh
node customer-experience-update/apply-update.mjs
npm ci
npm run dev
```

`npm ci` installs the pinned image-processing dependency. It does not reset your local database. The updater checks the target project, backs up overwritten source files and copies only the supplied files. Your `.env.local`, `.data` and `local-access.txt` are not included in the update and are not replaced. Your Gemini model/key and business settings stay as they are. Do not run setup or seed again.

The database upgrade is automatic in local mode. It adds a table for small business logos and preserves existing data. Existing questionnaires remain valid. Feedback pairs start empty until you configure them.

## What changed

### Customer page

- Original cream-and-green design with a centred card, subtle background, prominent business identity and uploaded shop logo.
- Three steps: language welcome screen, visit questionnaire, editable draft and sharing.
- Four large language choices. The initial selection also sets the default writing language.
- Clear step indicator, keyboard focus on each new screen, accessible selection buttons and layouts for narrow screens. Browser zoom remains available. Reduced-motion preferences are respected.
- Optional photo previews tucked into an expandable section. Photos stay on the device and are not sent to Gemini or stored on the server.
- Dedicated draft screen with platform/language labels, editing, confirmation, copying and manual platform handoff.
- Back navigation preserves answers. Source changes discard stale drafts; draft edits clear approval. Reload can restore a recent draft but never its approval.
- Finish clears the draft and shows a completion screen. It does not claim a review was published.
- The business dashboard link and large marketing introduction are removed from customer review pages.

### Business logo

Open http://localhost:3000/dashboard and sign in with your existing business owner account. Under **Business branding**, use **Business logo → Choose a logo → Upload logo**.

Choose a non-animated PNG, JPEG or WebP up to 2 MB and 16 megapixels. SVG, GIF and HEIC are not supported for logos. The server validates, resizes to at most 256×256 and re-encodes the image as WebP, stripping original metadata. Only one processed image, capped at 96 KiB, is stored per business. It is a public branding image. No R2 account is needed for this pilot approach.

A logo appears across that business's customer locations. Removing it restores the initials. Existing initials and colours still work. Customer photo previews are separate and never use this upload endpoint.

### Detailed feedback choices

In **Customer questionnaire → Detailed feedback choices**, click **Add feedback pair**. Enter both sides of a real, balanced observation, for example:

| What went well | What could improve |
| --- | --- |
| Service was quick | The wait was long |
| The staff were helpful | I needed more help from the staff |
| The space was comfortable | The space felt uncomfortable |

Add the Chinese and Malay translations if available; blank translations fall back to English. Click **Save questionnaire**. Up to six pairs are supported, alongside your existing item/service choices. Every customer sees both sides. Nothing is selected automatically, and a customer can select only one side of each pair. Free text and the general positive/mixed/negative feedback controls remain available.

Only selected details are passed into the existing single Gemini call. Unselected choices are excluded. Customer confirmation is still required before export. The model still needs real-world evaluation; selected statements must be checked by the customer.

## Check the update locally

1. Upload a test logo and add one balanced feedback pair in the dashboard.
2. Open a location's customer page. Confirm the logo, language welcome screen and three-step layout appear.
3. Select a service and “The wait was long,” then add a real or clearly fictional test detail. Generate once and check that the draft preserves the negative detail without inventing facts.
4. Edit the draft and verify copying stays disabled until you confirm. Return to the questionnaire and change an answer; the old draft should be discarded.
5. Check Google and Xiaohongshu separately, without posting test reviews. Google needs a configured link. Xiaohongshu remains manual title/body copying.
6. Use your browser's narrow-screen view, then test on an actual phone before a public pilot. On a phone, `localhost` means the phone itself. Public QR testing will need an approved hosted pilot or a deliberately configured local test connection.

Thirty-five automated tests and the production build passed. Tests include authenticated logo upload/removal, image validation, database migration, business isolation, detailed-answer selection, language entry, back navigation and restoration without approval. The managed preview service stopped before serving the page, so desktop screenshots and real-device visual/clipboard behaviour were not verified here. Your local visual check is still needed. No live Gemini calls were made during this update.

## Pilot preparation

`PILOT_SETUP.md`, `.env.pilot.example`, a readiness command and a lightweight health endpoint are included. They do not create services or deploy anything. Keep using your existing local settings for now.

No GitHub repository, Neon project or Render service was created or modified. No paid services were purchased. DA AI Chatbot is untouched.

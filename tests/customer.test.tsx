import { before, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
let testing: typeof import("@testing-library/react");
let userEvent: (typeof import("@testing-library/user-event"))["default"];
let ReviewForm: (typeof import("../src/components/review-form"))["ReviewForm"];
const loc = {
  id: "demo",
  business_id: "a",
  slug: "demo",
  name: "Town Centre",
  address: "Fictional address",
  google_url: null,
  business_name: "Juniper Table",
  accent: "#35664f",
  initials: "JT",
  qr_code: "demo",
};
before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3000",
  });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true },
    document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true },
    HTMLElement: { value: dom.window.HTMLElement, configurable: true },
    sessionStorage: { value: dom.window.sessionStorage, configurable: true },
  });
  dom.window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  testing = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).default;
  ReviewForm = (await import("../src/components/review-form")).ReviewForm;
});
afterEach(() => {
  testing.cleanup();
  sessionStorage.clear();
});
test("manual draft requires confirmation; editing resets approval", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(
    r.getByLabelText("What stood out?"),
    "The soup was tasty but the wait was long.",
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  const copy = r.getByRole("button", {
    name: "Copy review",
  }) as HTMLButtonElement;
  assert.equal(copy.disabled, true);
  await u.click(
    r.getByLabelText(
      "I have checked this version and it accurately reflects my own experience.",
    ),
  );
  assert.equal(copy.disabled, false);
  await u.type(r.getByLabelText("Review"), " I would prefer faster service.");
  assert.equal(copy.disabled, true);
});
test("switching interface language preserves original text and shows translated controls", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(
    r.getByLabelText("What stood out?"),
    "Food was good but service was slow.",
  );
  await u.selectOptions(r.getByLabelText("Page language"), "zh-CN");
  assert.equal(
    (r.getByLabelText("哪些地方让你印象深刻？") as HTMLTextAreaElement).value,
    "Food was good but service was slow.",
  );
  assert.ok(r.getByRole("button", { name: "不使用 AI，自己写" }));
});
test("one generation request returns editable draft with explicit simulated label", async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/guest") return Response.json({ ok: true });
    assert.equal(String(input), "/api/generate");
    calls++;
    const body = JSON.parse(String(init?.body));
    return Response.json({ title: "", body: body.experience, demo: true });
  };
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.click(r.getByRole("button", { name: "Try a sample" }));
  await u.click(r.getByLabelText(/Use AI to help/));
  await u.click(r.getByRole("button", { name: "Generate my review draft" }));
  await testing.waitFor(() =>
    assert.ok(r.getByText(/Local demo: no AI call or translation/)),
  );
  assert.equal(calls, 1);
  assert.match(
    (r.getByLabelText("Review") as HTMLTextAreaElement).value,
    /20 minutes/,
  );
  assert.equal(
    (r.getByRole("button", { name: "Copy review" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});
test("Xiaohongshu manual route has separate title and review with no auto-post action", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.click(r.getByRole("button", { name: "Xiaohongshu" }));
  await u.type(
    r.getByLabelText("What stood out?"),
    "Friendly staff but my meal arrived cold.",
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.ok(r.getByLabelText("Title"));
  assert.ok(r.getByRole("button", { name: "Copy title" }));
  assert.ok(r.getByText(/open Xiaohongshu yourself/));
  assert.equal(r.queryByRole("button", { name: /publish|post review/i }), null);
});

test("photo preview stays local and is removable without a network upload", async () => {
  const u = userEvent.setup();
  let requests = 0;
  const revoked: string[] = [];
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ ok: true });
  };
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:local-test";
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const r = testing.render(<ReviewForm location={loc} local />);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.click(r.getByText("Add photos (optional)"));
    const file = new window.File(["photo"], "test.png", { type: "image/png" });
    await u.upload(r.getByLabelText(/Add a photo preview/), file);
    assert.ok(r.getByAltText("test.png"));
    assert.equal(requests, 0);
    await u.click(r.getByRole("button", { name: "Remove test.png" }));
    assert.equal(r.queryByAltText("test.png"), null);
    assert.deepEqual(revoked, ["blob:local-test"]);
  } finally {
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
  }
});

test("questionnaire starts neutral, supports feedback-only generation and clears stale approval", async () => {
  const u = userEvent.setup();
  let calls = 0;
  let payload: any;
  globalThis.fetch = async (url, init) => {
    if (String(url) === "/api/guest") return Response.json({ ok: true });
    calls++;
    payload = JSON.parse(String(init?.body));
    return Response.json({
      title: "",
      body: "The service could improve.",
      demo: false,
    });
  };
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  const group = r.getByRole("group", { name: "Staff and service" });
  assert.equal(
    testing.within(group).queryAllByRole("button", { pressed: true }).length,
    0,
  );
  await u.click(r.getByLabelText(/Use AI to help/));
  const button = r.getByRole("button", {
    name: "Generate my review draft",
  }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
  await u.click(
    testing.within(group).getByRole("button", { name: "Could improve" }),
  );
  assert.equal(button.disabled, false);
  await u.click(button);
  await testing.waitFor(() => assert.ok(r.getByLabelText("Review")));
  assert.equal(calls, 1);
  assert.equal(payload.experience, "");
  assert.deepEqual(payload.answers.ratings, { service: "poor" });
  await u.click(r.getByLabelText(/I have checked this version/));
  assert.equal(
    (r.getByRole("button", { name: "Copy review" }) as HTMLButtonElement)
      .disabled,
    false,
  );
  await u.click(r.getByRole("button", { name: "Edit my answers" }));
  await u.click(
    testing
      .within(r.getByRole("group", { name: "Staff and service" }))
      .getByRole("button", { name: "Mixed" }),
  );
  assert.equal(r.queryByLabelText("Review"), null);
});

test("configured choices translate without losing answers; manual notes include only selected details", async () => {
  const u = userEvent.setup();
  const r = testing.render(
    <ReviewForm
      location={{
        ...loc,
        questionnaire: {
          items: [
            {
              id: "coffee",
              labels: {
                en: "Coffee",
                "zh-CN": "咖啡",
                "zh-TW": "咖啡",
                ms: "Kopi",
              },
            },
            {
              id: "cake",
              labels: {
                en: "Cake",
                "zh-CN": "蛋糕",
                "zh-TW": "蛋糕",
                ms: "Kek",
              },
            },
          ],
        },
      }}
      local
    />,
  );
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.click(r.getByRole("button", { name: "Coffee" }));
  await u.click(
    testing
      .within(r.getByRole("group", { name: "Staff and service" }))
      .getByRole("button", { name: "Mixed" }),
  );
  await u.selectOptions(r.getByLabelText("Page language"), "zh-TW");
  assert.ok(r.getByRole("button", { name: "咖啡", pressed: true }));
  await u.click(r.getByRole("button", { name: "不使用 AI，自己寫" }));
  const text = (r.getByLabelText("評價內容") as HTMLTextAreaElement).value;
  assert.match(text, /咖啡/);
  assert.match(text, /有好有壞/);
  assert.doesNotMatch(text, /蛋糕/);
});

test("optional spending starts blank, slider syncs with exact amount and Clear removes it", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  const amount = r.getByRole("spinbutton", { name: "Amount spent (RM)" }) as HTMLInputElement;
  const slider = r.getByRole("slider", { name: "Spending amount slider" }) as HTMLInputElement;
  assert.equal(amount.value, "");
  assert.equal(slider.value, "0");
  assert.equal(r.queryByRole("button", { name: "Clear amount" }), null);
  testing.fireEvent.change(slider, { target: { value: "420" } });
  assert.equal(amount.value, "420");
  await u.clear(amount);
  await u.type(amount, "6500.25");
  assert.equal(Number(amount.value), 6500.25);
  assert.equal(slider.value, "5000");
  await u.click(r.getByRole("button", { name: "Clear amount" }));
  assert.equal(amount.value, "");
  assert.equal(slider.value, "0");
  await u.click(testing.within(r.getByRole("group", { name: "Staff and service" })).getByRole("button", { name: "Could improve" }));
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  const review = (r.getByLabelText("Review") as HTMLTextAreaElement).value;
  assert.doesNotMatch(review, /Total spent: RM/);
});
test("old first-visit question is removed while optional spend remains visible", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  assert.equal(r.queryByText("Visit details (optional)"), null);
  assert.equal(r.queryByLabelText("Was this your first visit?"), null);
  assert.equal(r.queryByRole("combobox", { name: "Was this your first visit?" }), null);
  assert.ok(r.getByRole("slider", { name: "Spending amount slider" }));
  assert.equal((r.getByRole("spinbutton", { name: "Amount spent (RM)" }) as HTMLInputElement).value, "");
});
test("restored legacy first-visit value is not silently included in a new review", async () => {
  sessionStorage.setItem("fieldnote:demo", JSON.stringify({
    saved: Date.now(),
    started: true,
    configVersion: JSON.stringify({ items: [] }),
    experience: "The staff were helpful.",
    answers: { items: [], ratings: {}, visit: "first", spend: null },
    locale: "en",
    output: "en",
    platform: "google",
  }));
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await testing.waitFor(() => assert.ok(r.getByRole("spinbutton", { name: "Amount spent (RM)" })));
  assert.equal(r.queryByText("Visit details (optional)"), null);
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.doesNotMatch((r.getByLabelText("Review") as HTMLTextAreaElement).value, /First visit/);
});
test("customer destination buttons use recognizable brand assets", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  const google = r.getByRole("button", { name: "Google Reviews" });
  const red = r.getByRole("button", { name: "Xiaohongshu" });
  assert.match(google.querySelector("img")?.getAttribute("src") || "", /Google_Maps_icon_%282026%29/);
  assert.equal(red.querySelector("img")?.getAttribute("src"), "/brands/xiaohongshu.svg");
});
test("optional amount accepts cents and Finish clears guided answers", async () => {
  const u = userEvent.setup();
  globalThis.fetch = async () => Response.json({ ok: true });
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(r.getByLabelText("Amount spent (RM)"), "25.50");
  assert.equal(
    Number((r.getByLabelText("Amount spent (RM)") as HTMLInputElement).value),
    25.5,
  );
  await u.click(
    testing
      .within(r.getByRole("group", { name: "Staff and service" }))
      .getByRole("button", { name: "Could improve" }),
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.match(
    (r.getByLabelText("Review") as HTMLTextAreaElement).value,
    /RM 25.50/,
  );
  await u.click(r.getByRole("button", { name: "Finish & clear" }));
  await testing.waitFor(() => assert.equal(r.queryByLabelText("Review"), null));
  await u.click(r.getByRole("button", { name: "Start another review" }));
  await u.click(r.getByRole("button", { name: "Write my review" }));
  assert.equal(
    r.queryAllByRole("button", { name: "Could improve", pressed: true }).length,
    0,
  );
  assert.equal(
    (r.getByLabelText("Amount spent (RM)") as HTMLInputElement).value,
    "",
  );
});

test("welcome screen selects a language and keeps the customer journey free of dashboard links", async () => {
  const u = userEvent.setup();
  const r = testing.render(<ReviewForm location={loc} local />);
  assert.ok(
    r.getByRole("heading", { name: "Your visit, in your words." }),
  );
  assert.equal(r.queryByLabelText("What stood out?"), null);
  assert.equal(r.queryByRole("link", { name: /dashboard/i }), null);
  await u.click(r.getByRole("button", { name: "Bahasa Melayu" }));
  await u.click(r.getByRole("button", { name: "Tulis ulasan saya" }));
  assert.equal(
    (r.getByLabelText("Bahasa ulasan") as HTMLSelectElement).value,
    "ms",
  );
});

test("detailed feedback is optional, mutually exclusive per pair and preserved when editing a draft", async () => {
  const u = userEvent.setup();
  const labels = (en: string) => ({ en, "zh-CN": "", "zh-TW": "", ms: "" });
  const r = testing.render(
    <ReviewForm
      location={{
        ...loc,
        questionnaire: {
          items: [],
          feedback: [
            {
              id: "speed",
              positive: labels("Service was quick"),
              negative: labels("The wait was long"),
            },
          ],
        },
      }}
      local
    />,
  );
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.click(r.getByRole("button", { name: "Service was quick" }));
  await u.click(r.getByRole("button", { name: "The wait was long" }));
  assert.ok(
    r.getByRole("button", { name: "Service was quick", pressed: false }),
  );
  assert.ok(
    r.getByRole("button", { name: "The wait was long", pressed: true }),
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.equal(
    (r.getByLabelText("Review") as HTMLTextAreaElement).value,
    "The wait was long",
  );
  await u.click(r.getByLabelText(/I have checked this version/));
  await u.click(r.getByRole("button", { name: "Edit my answers" }));
  assert.ok(
    r.getByRole("button", { name: "The wait was long", pressed: true }),
  );
  await u.click(r.getByRole("button", { name: "Service was quick" }));
  assert.equal(r.queryByRole("button", { name: "Back to my draft" }), null);
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.equal(
    (r.getByRole("button", { name: "Copy review" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("reloading restores the draft but never restores export approval", async () => {
  const u = userEvent.setup();
  let r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(
    r.getByLabelText("What stood out?"),
    "Helpful staff and a quiet room.",
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  await u.click(r.getByLabelText(/I have checked this version/));
  r.unmount();
  r = testing.render(<ReviewForm location={loc} local />);
  await testing.waitFor(() =>
    assert.equal(
      (r.getByLabelText("Review") as HTMLTextAreaElement).value,
      "Helpful staff and a quiet room.",
    ),
  );
  assert.equal(
    (r.getByRole("button", { name: "Copy review" }) as HTMLButtonElement)
      .disabled,
    true,
  );
});

test("Finish removes browser draft even when the cleanup request fails", async () => {
  const u = userEvent.setup();
  globalThis.fetch = async () => { throw new Error("offline"); };
  const r = testing.render(<ReviewForm location={loc} local />);
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(r.getByLabelText("What stood out?"), "A draft to erase offline.");
  assert.ok(sessionStorage.getItem("fieldnote:demo"));
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  await u.click(r.getByRole("button", { name: "Finish & clear" }));
  await testing.waitFor(() => {
    assert.equal(r.queryByLabelText("Review"), null);
    assert.equal(sessionStorage.getItem("fieldnote:demo"), null);
    assert.match(r.getByRole("alert").textContent || "", /This device has been cleared/);
  });
});

test("expired saved browser draft is deleted rather than kept in storage", async () => {
  sessionStorage.setItem("fieldnote:demo", JSON.stringify({
    saved: Date.now() - 3 * 60 * 60 * 1000,
    started: true,
    experience: "Private details that must expire.",
  }));
  const r = testing.render(<ReviewForm location={loc} local />);
  await testing.waitFor(() => {
    assert.equal(sessionStorage.getItem("fieldnote:demo"), null);
  });
  assert.equal(r.queryByLabelText("What stood out?"), null);
});

test("kiosk mode deletes the previous visitor's saved draft and never persists a new one", async () => {
  window.history.replaceState({}, "", "/r/demo?kiosk=1");
  sessionStorage.setItem("fieldnote:demo", JSON.stringify({
    saved: Date.now(),
    started: true,
    experience: "Private experience from an earlier customer.",
  }));
  try {
    const u = userEvent.setup();
    const r = testing.render(<ReviewForm location={loc} local />);
    await testing.waitFor(() => assert.equal(sessionStorage.getItem("fieldnote:demo"), null));
    assert.equal(r.queryByLabelText("What stood out?"), null);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.type(r.getByLabelText("What stood out?"), "A new kiosk visitor");
    assert.equal(sessionStorage.getItem("fieldnote:demo"), null);
  } finally {
    window.history.replaceState({}, "", "/");
  }
});

test("kiosk inactivity resets the form, and a delayed AI response cannot revive it", async () => {
  window.history.replaceState({}, "", "/r/demo?kiosk=1");
  const realNow = Date.now;
  let time = realNow();
  Date.now = () => time;
  let release!: (value: Response) => void;
  let started!: () => void;
  const generationStarted = new Promise<void>(r => { started = r; });
  globalThis.fetch = async url => {
    if (String(url) === "/api/guest") return Response.json({ ok: true });
    started();
    return new Promise<Response>(r => { release = r; });
  };
  try {
    const u = userEvent.setup();
    const r = testing.render(<ReviewForm location={loc} local />);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.type(r.getByLabelText("What stood out?"), "Private details to clear");
    await u.click(r.getByLabelText(/Use AI to help/));
    await u.click(r.getByRole("button", { name: "Generate my review draft" }));
    await generationStarted;
    time += 5 * 60 * 1000 + 1;
    window.dispatchEvent(new window.Event("focus"));
    await testing.waitFor(() =>
      assert.ok(r.getByRole("heading", { name: "Your visit, in your words." })),
    );
    release(Response.json({ title: "", body: "Private details", demo: false }));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    assert.equal(r.queryByLabelText("Review"), null);
    assert.equal(sessionStorage.getItem("fieldnote:demo"), null);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    assert.equal((r.getByLabelText("What stood out?") as HTMLTextAreaElement).value, "");
  } finally {
    Date.now = realNow;
    window.history.replaceState({}, "", "/");
  }
});

test("first kiosk tap after a suspended interval clears the previous visitor", async () => {
  window.history.replaceState({}, "", "/r/demo?kiosk=1");
  const realNow = Date.now;
  let time = realNow();
  Date.now = () => time;
  globalThis.fetch = async () => Response.json({ ok: true });
  try {
    const u = userEvent.setup();
    const r = testing.render(<ReviewForm location={loc} local />);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.type(r.getByLabelText("What stood out?"), "Old customer");
    time += 5 * 60 * 1000 + 1;
    window.dispatchEvent(new window.Event("pointerdown"));
    await testing.waitFor(() =>
      assert.ok(r.getByRole("heading", { name: "Your visit, in your words." })),
    );
    assert.equal(r.queryByLabelText("Review"), null);
  } finally {
    Date.now = realNow;
    window.history.replaceState({}, "", "/");
  }
});

test("AI rate threshold presents a human check and leaves manual writing enabled", async () => {
  const u = userEvent.setup();
  globalThis.fetch = async url => {
    if (String(url) === "/api/guest") return Response.json({ ok: true });
    return Response.json({ error: "AI_CHALLENGE_REQUIRED" }, { status: 429 });
  };
  const r = testing.render(
    <ReviewForm location={loc} local turnstileSiteKey="public-test-key" />,
  );
  await u.click(r.getByRole("button", { name: "Write my review" }));
  await u.type(r.getByLabelText("What stood out?"), "A short honest experience.");
  await u.click(r.getByLabelText(/Use AI to help/));
  await u.click(r.getByRole("button", { name: "Generate my review draft" }));
  await testing.waitFor(() =>
    assert.ok(r.getByRole("group", { name: /quick verification/ })),
  );
  assert.equal(
    (r.getByRole("button", { name: "Generate my review draft" }) as HTMLButtonElement).disabled,
    true,
  );
  assert.equal(
    (r.getByRole("button", { name: "Write without AI" }) as HTMLButtonElement).disabled,
    false,
  );
  await u.click(r.getByRole("button", { name: "Write without AI" }));
  assert.ok(r.getByLabelText("Review"));
});

test("completed human challenge token is supplied for one retry", async () => {
  const previous = window.turnstile;
  const oldFetch = globalThis.fetch;
  const u = userEvent.setup();
  let calls = 0;
  let verifiedToken: unknown = null;
  window.turnstile = {
    render: (_container, options) => {
      const completed = options.callback as (token: string) => void;
      completed("single-use-test-token");
      return "widget-test";
    },
    remove: () => {},
  };
  globalThis.fetch = async (url, init) => {
    if (String(url) === "/api/guest") return Response.json({ ok: true });
    calls++;
    const body = JSON.parse(String(init?.body));
    if (calls === 1)
      return Response.json({ error: "AI_CHALLENGE_REQUIRED" }, { status: 429 });
    verifiedToken = body.challengeToken;
    return Response.json({ title: "", body: "Verified draft", demo: false });
  };
  try {
    const r = testing.render(
      <ReviewForm location={loc} local turnstileSiteKey="public-test-key" />,
    );
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.type(r.getByLabelText("What stood out?"), "A reasonable experience.");
    await u.click(r.getByLabelText(/Use AI to help/));
    await u.click(r.getByRole("button", { name: "Generate my review draft" }));
    await testing.waitFor(() =>
      assert.ok(r.getByRole("group", { name: /quick verification/ })),
    );
    await testing.waitFor(() =>
      assert.equal(
        (r.getByRole("button", { name: "Generate my review draft" }) as HTMLButtonElement).disabled,
        false,
      ),
    );
    await u.click(r.getByRole("button", { name: "Generate my review draft" }));
    await testing.waitFor(() =>
      assert.equal(
        (r.getByLabelText("Review") as HTMLTextAreaElement).value,
        "Verified draft",
      ),
    );
    assert.equal(calls, 2);
    assert.equal(verifiedToken, "single-use-test-token");
  } finally {
    window.turnstile = previous;
    globalThis.fetch = oldFetch;
  }
});

test("first expired kiosk click cannot turn an old answer into a new manual draft", async () => {
  window.history.replaceState({}, "", "/r/demo?kiosk=1");
  const realNow = Date.now;
  let time = realNow();
  Date.now = () => time;
  globalThis.fetch = async () => Response.json({ ok: true });
  try {
    const u = userEvent.setup();
    const r = testing.render(<ReviewForm location={loc} local />);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    await u.type(r.getByLabelText("What stood out?"), "Previous visitor's private words.");
    const manual = r.getByRole("button", { name: "Write without AI" });
    time += 5 * 60 * 1000 + 1;
    manual.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await testing.waitFor(() =>
      assert.ok(r.getByRole("heading", { name: "Your visit, in your words." })),
    );
    assert.equal(r.queryByLabelText("Review"), null);
    assert.equal(sessionStorage.getItem("fieldnote:demo"), null);
    await u.click(r.getByRole("button", { name: "Write my review" }));
    assert.equal((r.getByLabelText("What stood out?") as HTMLTextAreaElement).value, "");
  } finally {
    Date.now = realNow;
    window.history.replaceState({}, "", "/");
  }
});

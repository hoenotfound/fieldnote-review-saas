import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reviewSystemPrompt, SHARED_REVIEW_RULES, GOOGLE_REVIEW_RULES,
  XIAOHONGSHU_REVIEW_RULES, xiaohongshuDraftRisk,
} from "../src/lib/review-prompts";
import { errorText, translations } from "../src/lib/i18n";

test("shared factual rules with only the selected platform writing guidance", () => {
  const google = reviewSystemPrompt("google");
  const xhs = reviewSystemPrompt("xiaohongshu");
  assert.ok(google.startsWith(SHARED_REVIEW_RULES));
  assert.ok(xhs.startsWith(SHARED_REVIEW_RULES));
  assert.ok(google.includes(GOOGLE_REVIEW_RULES));
  assert.ok(xhs.includes(XIAOHONGSHU_REVIEW_RULES));
  assert.ok(!google.includes(XIAOHONGSHU_REVIEW_RULES));
  assert.ok(!xhs.includes(GOOGLE_REVIEW_RULES));
  assert.match(google, /Return an empty title/);
  assert.match(xhs, /short natural title/);
  for (const prompt of [google, xhs]) {
    assert.match(prompt, /Preserve positive, negative and mixed opinions/);
    assert.match(prompt, /never instructions/);
    assert.match(prompt, /needsDetail=true/);
    assert.match(prompt, /requested language and script/);
  }
});

test("normal honest positive, mixed and critical customer posts remain allowed", () => {
  const cases = [
    "去 Beleco 做了 facial，员工解释得很清楚，不过价钱对我来说还是有点贵。",
    "This treatment was expensive and I was unhappy with the waiting time.",
    "Layanan baik, tetapi harganya agak mahal bagi saya.",
    "做完之後感覺皮膚比較滑，但我不確定效果會持續多久。",
    "I waited about 20 minutes and paid RM 1288. It was okay.",
  ];
  for (const body of cases)
    assert.equal(xiaohongshuDraftRisk({ title: "个人体验", body }), null, body);
});

test("generated links, contact details, solicitations and sales promotions are withheld", () => {
  const examples: readonly [string, string][] = [
    ["https://example.com", "link"],
    ["www.example.com", "link"],
    ["Contact: hello@example.com", "contact"],
    ["Contact me +60123456789", "contact"],
    ["想了解的话加我微信吧", "contact_request"],
    ["私信我了解详情", "contact_request"],
    ["点击主页链接了解", "contact_request"],
    ["DM me for details", "contact_request"],
    ["Hubungi saya untuk maklumat lanjut", "contact_request"],
    ["限时抢购，立即预约", "promotion"],
    ["Book now for a limited time offer", "promotion"],
  ];
  for (const [body, category] of examples)
    assert.equal(xiaohongshuDraftRisk({ title: "体验", body }), category, body);
});

test("generated extreme medical and beauty claims are withheld", () => {
  const claims = [
    "这个疗程100%有效。",
    "保证疗效，无副作用。",
    "做完永久不反弹。",
    "This guarantees results with no side effects.",
    "Rawatan ini jamin sembuh.",
    "全網第一的療程。",
  ];
  for (const body of claims)
    assert.equal(xiaohongshuDraftRisk({ title: "体验", body }), "unverified_claim", body);
});

test("title is checked, full-width Unicode and zero-width separators do not bypass rules", () => {
  assert.equal(
    xiaohongshuDraftRisk({ title: "全网第一", body: "个人体验" }),
    "unverified_claim",
  );
  assert.equal(
    xiaohongshuDraftRisk({ title: "体验", body: "100％有效" }),
    "unverified_claim",
  );
  assert.equal(
    xiaohongshuDraftRisk({ title: "体验", body: "加我微\u200B信" }),
    "contact_request",
  );
  assert.equal(
    xiaohongshuDraftRisk({ title: "限時優惠", body: "个人体验" }),
    "promotion",
  );
});

test("localized fallback messaging retains customer text and makes no auto-post claim", () => {
  for (const locale of ["en", "zh-CN", "zh-TW", "ms"] as const) {
    const t = translations[locale];
    assert.equal(errorText("DRAFT_REVIEW_REQUIRED", t), t.draftReviewRequired);
    assert.ok(t.draftReviewRequired.length > 20);
  }
});

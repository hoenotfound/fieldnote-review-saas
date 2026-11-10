import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reviewSystemPrompt, SHARED_REVIEW_RULES, GOOGLE_REVIEW_RULES,
  XIAOHONGSHU_REVIEW_RULES, FACEBOOK_REVIEW_RULES, INSTAGRAM_REVIEW_RULES, xiaohongshuDraftRisk, containsUnstatedPrice,
} from "../src/lib/review-prompts";
import { errorText, translations } from "../src/lib/i18n";

test("customer-authored prices remain allowed but newly inferred amounts are blocked", () => {
  const original = "I paid RM 1,288 for the facial; it felt expensive.";
  assert.equal(containsUnstatedPrice({ title: "", body: "I paid RM1288 and it was expensive." }, original), false);
  assert.equal(containsUnstatedPrice({ title: "RM999 special", body: "A nice visit." }, original), true);
  assert.equal(containsUnstatedPrice({ title: "", body: "I paid RM400." }, "The wait was 20 minutes."), true);
  assert.equal(containsUnstatedPrice({ title: "", body: "Excellent value for money." }, ""), false);
  assert.equal(containsUnstatedPrice({ title: "", body: "消费了1288元。" }, "我做了护理，消费了1288元。"), false);
  assert.equal(containsUnstatedPrice({ title: "", body: "消费了1288元。" }, "我做了护理，感觉不错。"), true);
  // A merchant-set questionnaire label does not count as customer-written consent to show its price.
  assert.equal(containsUnstatedPrice({ title: "", body: "Great RM488 session." }, "The visit was pleasant."), true);
  for (const locale of ["en","zh-CN","zh-TW","ms"] as const)
    assert.ok(errorText("UNSTATED_PRICE", translations[locale]).length > 10);
});

test("shared factual rules with only the selected platform writing guidance", () => {
  const google = reviewSystemPrompt("google");
  const xhs = reviewSystemPrompt("xiaohongshu");
  assert.ok(google.startsWith(SHARED_REVIEW_RULES));
  assert.ok(xhs.startsWith(SHARED_REVIEW_RULES));
  assert.ok(google.includes(GOOGLE_REVIEW_RULES));
  assert.ok(xhs.includes(XIAOHONGSHU_REVIEW_RULES));
  assert.ok(!google.includes(XIAOHONGSHU_REVIEW_RULES));
  assert.ok(!xhs.includes(GOOGLE_REVIEW_RULES));
  assert.match(google, /no title/);
  assert.match(xhs, /title informative/);
  for (const prompt of [google, xhs]) {
    assert.match(prompt, /Preserve criticism, uncertainty, mixed experiences/);
    assert.match(prompt, /never instructions/);
    assert.match(prompt, /needsDetail=true/);
    assert.match(prompt, /requested language\/script/);
  }
});

test("new writing prompts preserve criticism and avoid invented endorsements or tags", () => {
  const facebook = reviewSystemPrompt("facebook");
  const instagram = reviewSystemPrompt("instagram");
  assert.ok(facebook.includes(FACEBOOK_REVIEW_RULES));
  assert.ok(instagram.includes(INSTAGRAM_REVIEW_RULES));
  assert.ok(!facebook.includes(INSTAGRAM_REVIEW_RULES));
  assert.ok(!instagram.includes(FACEBOOK_REVIEW_RULES));
  assert.match(facebook, /Yes or No themselves/);
  assert.match(instagram, /Do not invent tags/);
  assert.match(instagram, /no separate title/);
  for (const prompt of [facebook, instagram])
    assert.match(prompt, /Preserve criticism, uncertainty, mixed experiences/);
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
    ["想了解的话加我微信吧", "solicitation"],
    ["私信我了解详情", "solicitation"],
    ["点击主页链接了解", "solicitation"],
    ["DM me for details", "solicitation"],
    ["Hubungi saya untuk maklumat lanjut", "solicitation"],
    ["限时抢购，立即预约", "promotion"],
    ["Book now for a limited time offer", "promotion"],
  ];
  for (const [body, category] of examples)
    assert.deepEqual(xiaohongshuDraftRisk({ title: "体验", body }), { severity: "block", category }, body);
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
    assert.deepEqual(xiaohongshuDraftRisk({ title: "体验", body }), { severity: "block", category: "claim" }, body);
});

test("title is checked, full-width Unicode and zero-width separators do not bypass rules", () => {
  assert.deepEqual(
    xiaohongshuDraftRisk({ title: "全网第一", body: "个人体验" }),
    { severity: "block", category: "claim" },
  );
  assert.deepEqual(
    xiaohongshuDraftRisk({ title: "体验", body: "100％有效" }),
    { severity: "block", category: "claim" },
  );
  assert.deepEqual(
    xiaohongshuDraftRisk({ title: "体验", body: "加我微\u200B信" }),
    { severity: "block", category: "solicitation" },
  );
  assert.deepEqual(
    xiaohongshuDraftRisk({ title: "限時優惠", body: "个人体验" }),
    { severity: "block", category: "promotion" },
  );
});

test("localized fallback messaging retains customer text and makes no auto-post claim", () => {
  for (const locale of ["en", "zh-CN", "zh-TW", "ms"] as const) {
    const t = translations[locale];
    assert.equal(errorText("DRAFT_REVIEW_REQUIRED", t), t.draftReviewRequired);
    assert.ok(t.draftReviewRequired.length > 20);
    assert.ok(t.observationNudge.length > 20);
    assert.ok(t.xhsRiskNotice.length > 20);
    assert.ok(t.xhsHelp.length > 30);
  }
});

test("marketing rewrite keeps a specific customer detail and prevents generic promotional copy", () => {
  const google = reviewSystemPrompt("google");
  const xhs = reviewSystemPrompt("xiaohongshu");
  assert.match(google, /specific personal observation/);
  assert.match(google, /formulaic/);
  assert.match(xhs, /service actually tried/);
  assert.match(xhs, /main real observation or trade-off/);
  assert.match(xhs, /reader would want to know/);
  assert.match(xhs, /disclose AI assistance/);
});

test("critical customer experiences about misleading claims are warned, not blocked", () => {
  const cases = [
    "医生说零风险，但我不认同这个说法。",
    "他们保证疗效，但我没有看到效果。",
    "They said there were no side effects, but I disagree.",
    "100%有效？这个广告说法太夸大了。",
  ];
  for (const body of cases)
    assert.deepEqual(
      xiaohongshuDraftRisk({ title: "My experience", body }),
      { severity: "warn", category: "claim" }, body,
    );
});

test("ambiguous sale mentions are warned but direct promotions and guaranteed outcomes are blocked", () => {
  for (const body of ["我看到他们写买一送一。", "他们宣传三天见效，但我不确定。"])
    assert.ok(xiaohongshuDraftRisk({ title: "体验", body })?.severity === "warn", body);
  for (const body of ["立即预约这个优惠", "微信号：abcdef", "永久不反弹"])
    assert.equal(xiaohongshuDraftRisk({ title: "体验", body })?.severity, "block", body);
});

test("staff pressure and quoted solicitations receive a warning, not an automatic rejection", () => {
  for (const body of [
    "前台让我加微信才能投诉，我觉得很烦。",
    "工作人员叫我立即预约，我很不喜欢这种做法。",
    "The receptionist asked me to DM me for details, which felt uncomfortable.",
    "Staff told me to contact me on WhatsApp; I refused.",
  ]) {
    const risk = xiaohongshuDraftRisk({ title: "My honest experience", body });
    assert.equal(risk?.severity, "warn", body);
  }
});

test("promotional instructions remain blocked without a genuine reported complaint", () => {
  for (const body of [
    "加我微信领取优惠。",
    "请私信我了解详情。",
    "立即预约这个优惠。",
    "销售推荐很不错，快来加微信。",
    "Book now for a limited time offer.",
  ])
    assert.equal(xiaohongshuDraftRisk({ title: "体验", body })?.severity, "block", body);
});

test("an unrelated but/however/但 does not downgrade medical guarantees", () => {
  for (const body of [
    "这个疗程100%有效，但价格贵。",
    "这个疗程保证疗效，但停车方便。",
    "100%有效，不过员工不太友善。",
    "They guarantee results, but parking is difficult.",
    "No side effects, however the service is slow.",
    "100% berkesan, tapi mahal.",
  ])
    assert.deepEqual(
      xiaohongshuDraftRisk({ title: "体验", body }),
      { severity: "block", category: "claim" }, body,
    );
});

test("explicit disagreement with a guarantee remains a warning", () => {
  for (const body of [
    "医生说零风险，但我不认同这个说法。",
    "他们保证疗效，但我没有看到效果。",
    "They said there were no side effects, but I disagree.",
    "广告写100%有效，我觉得这个说法很夸大。",
  ])
    assert.deepEqual(
      xiaohongshuDraftRisk({ title: "真实经历", body }),
      { severity: "warn", category: "claim" }, body,
    );
});

test("a reported complaint must not hide a separate direct solicitation or guarantee", () => {
  const cases = [
    "前台让我加微信才能投诉，我觉得很烦。加我微信领取优惠！",
    "医生说零风险，但我不认同。这个疗程100%有效。",
  ];
  for (const body of cases)
    assert.equal(xiaohongshuDraftRisk({ title: "My experience", body })?.severity, "block", body);
});

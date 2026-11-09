import { z } from "zod";
import type { Locale } from "./i18n";

const label = z.string().trim().max(60);
const translatedLabels = z
  .object({ en: label.min(1), "zh-CN": label, "zh-TW": label, ms: label })
  .strict();
const feedbackPair = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
    positive: translatedLabels,
    negative: translatedLabels,
  })
  .strict();
export const questionnaireConfigSchema = z
  .object({
    feedback: z.array(feedbackPair).max(6).optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
            labels: z
              .object({
                en: label.min(1),
                "zh-CN": label,
                "zh-TW": label,
                ms: label,
              })
              .strict(),
          })
          .strict(),
      )
      .max(12),
  })
  .strict()
  .refine(
    (c) =>
      new Set(c.items.map((i) => i.id)).size === c.items.length &&
      new Set((c.feedback || []).map((i) => i.id)).size ===
        (c.feedback || []).length,
  );
export type QuestionnaireConfig = z.infer<typeof questionnaireConfigSchema>;
export const emptyConfig: QuestionnaireConfig = { items: [] };
export const aspects = ["quality", "service", "value", "environment"] as const;
export const sentiments = ["good", "mixed", "poor"] as const;
export const answersSchema = z
  .object({
    details: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]{1,50}:(positive|negative)$/))
      .max(6)
      .refine((a) => new Set(a.map((id) => id.split(":")[0])).size === a.length)
      .optional(),
    items: z
      .array(z.string().max(50))
      .max(12)
      .refine((a) => new Set(a).size === a.length),
    ratings: z
      .object({
        quality: z.enum(sentiments).optional(),
        service: z.enum(sentiments).optional(),
        value: z.enum(sentiments).optional(),
        environment: z.enum(sentiments).optional(),
      })
      .strict(),
    visit: z.enum(["", "first", "returning"]),
    spend: z.number().finite().min(0).max(100000).multipleOf(0.01).nullable(),
  })
  .strict();
export type Answers = z.infer<typeof answersSchema>;
export const emptyAnswers = (): Answers => ({
  items: [],
  ratings: {},
  visit: "",
  spend: null,
});
export function readConfig(value: unknown): QuestionnaireConfig {
  const parsed = questionnaireConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyConfig;
}
export function hasExperience(text: string, answers?: Answers) {
  return (
    text.trim().length >= 8 ||
    Object.keys(answers?.ratings || {}).length > 0 ||
    (answers?.details?.length || 0) > 0
  );
}
const en = {
  heading: "A few details about your visit",
  intro: "Choose only what you experienced. Skip anything that doesn’t apply.",
  items: "What did you try?",
  itemsHint: "Choose all that apply. You can add details in your own words.",
  feedback: "How did it go?",
  feedbackHint:
    "Choose what reflects your experience. Tap a choice again to remove it.",
  quality: "Product or service quality",
  service: "Staff and service",
  value: "Value for money",
  environment: "Environment",
  good: "Good",
  mixed: "Mixed",
  poor: "Could improve",
  visit: "Was this your first visit?",
  skip: "Skip",
  first: "First visit",
  returning: "Returning customer",
  details: "Visit details (optional)",
  spend: "Amount spent (RM)",
  commentHint:
    "Add any details, especially what could improve. You can leave this blank if you selected feedback above.",
  notes: "Your selected details",
  tried: "Items or services tried",
  spent: "Total spent",
  changed:
    "The choices were updated. Refresh this page and select your answers again.",
};
export const questionnaireCopy: Record<Locale, typeof en> = {
  en,
  "zh-CN": {
    heading: "说说这次的体验",
    intro: "只选择符合实际体验的内容，不适用的可以跳过。",
    items: "你尝试了什么？",
    itemsHint: "可多选，也可以用自己的话补充细节。",
    feedback: "整体体验如何？",
    feedbackHint:
      "选择符合真实感受的选项，再次点击即可取消。",
    quality: "产品或服务品质",
    service: "员工与服务",
    value: "性价比",
    environment: "环境",
    good: "满意",
    mixed: "有好有坏",
    poor: "有待改善",
    visit: "这是你第一次来吗？",
    skip: "跳过",
    first: "第一次来",
    returning: "再次光顾",
    details: "到访详情（选填）",
    spend: "消费金额（RM）",
    commentHint:
      "补充任何细节，尤其是可以改善的地方。如果已选择上方的感受，此处可留空。",
    notes: "你选择的详情",
    tried: "体验的项目",
    spent: "总消费金额",
    changed: "选项已更新。请刷新页面并重新选择。",
  },
  "zh-TW": {
    heading: "說說這次的體驗",
    intro: "只選擇符合實際體驗的內容，不適用的可以跳過。",
    items: "你嘗試了什麼？",
    itemsHint: "可多選，也可以用自己的話補充細節。",
    feedback: "整體體驗如何？",
    feedbackHint:
      "選擇符合真實感受的選項，再次點擊即可取消。",
    quality: "產品或服務品質",
    service: "員工與服務",
    value: "性價比",
    environment: "環境",
    good: "滿意",
    mixed: "有好有壞",
    poor: "有待改善",
    visit: "這是你第一次來嗎？",
    skip: "跳過",
    first: "第一次來",
    returning: "再次光顧",
    details: "到訪詳情（選填）",
    spend: "消費金額（RM）",
    commentHint:
      "補充任何細節，尤其是可以改善的地方。如果已選擇上方的感受，此處可留空。",
    notes: "你選擇的詳情",
    tried: "體驗的項目",
    spent: "總消費金額",
    changed: "選項已更新。請重新整理頁面並重新選擇。",
  },
  ms: {
    heading: "Sedikit tentang kunjungan anda",
    intro: "Pilih hanya perkara yang anda alami. Langkau jika tidak berkaitan.",
    items: "Apa yang anda cuba?",
    itemsHint: "Pilih semua yang berkaitan. Tambah butiran dengan kata-kata sendiri.",
    feedback: "Bagaimana pengalaman anda?",
    feedbackHint:
      "Pilih perkara yang menggambarkan pengalaman anda. Tekan sekali lagi untuk membuang pilihan.",
    quality: "Kualiti produk atau perkhidmatan",
    service: "Staf dan layanan",
    value: "Nilai untuk wang",
    environment: "Suasana",
    good: "Baik",
    mixed: "Bercampur",
    poor: "Perlu diperbaiki",
    visit: "Adakah ini kunjungan pertama anda?",
    skip: "Langkau",
    first: "Kunjungan pertama",
    returning: "Pelanggan berulang",
    details: "Butiran kunjungan (pilihan)",
    spend: "Jumlah dibelanjakan (RM)",
    commentHint:
      "Tambah butiran, terutama perkara yang boleh diperbaiki. Boleh dibiarkan kosong jika anda telah memilih maklum balas di atas.",
    notes: "Butiran yang anda pilih",
    tried: "Item atau perkhidmatan yang dicuba",
    spent: "Jumlah dibelanjakan",
    changed:
      "Pilihan telah dikemas kini. Muat semula halaman ini dan pilih jawapan anda semula.",
  },
};
export function itemLabel(
  item: QuestionnaireConfig["items"][number],
  locale: Locale,
) {
  return item.labels[locale] || item.labels.en;
}
// Only customer-selected values enter this summary. Unselected business choices never reach AI.
export function answerNotes(
  answers: Answers,
  config: QuestionnaireConfig,
  locale: Locale,
) {
  const t = questionnaireCopy[locale];
  const lines: string[] = [];
  const chosen = config.items.filter((i) => answers.items.includes(i.id));
  if (chosen.length)
    lines.push(
      `${t.tried}: ${chosen.map((i) => itemLabel(i, locale)).join(", ")}`,
    );
  for (const aspect of aspects) {
    const rating = answers.ratings[aspect];
    if (rating) lines.push(`${t[aspect]}: ${t[rating]}`);
  }
  for (const selected of answers.details || []) {
    const [id, side] = selected.split(":");
    const pair = config.feedback?.find((p) => p.id === id);
    if (pair && (side === "positive" || side === "negative"))
      lines.push(pair[side][locale] || pair[side].en);
  }
  if (answers.visit) lines.push(t[answers.visit]);
  if (answers.spend !== null)
    lines.push(`${t.spent}: RM ${answers.spend.toFixed(2)}`);
  return lines.join("\n");
}

export function choicesMatch(
  answers: Answers | undefined,
  config: QuestionnaireConfig,
) {
  return (
    !answers ||
    (answers.items.every((id) => config.items.some((item) => item.id === id)) &&
      (answers.details || []).every((selected) => {
        const [id, side] = selected.split(":");
        return (
          (side === "positive" || side === "negative") &&
          config.feedback?.some((pair) => pair.id === id)
        );
      }))
  );
}

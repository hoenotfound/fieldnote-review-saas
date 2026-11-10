import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { safeAiFailure, safeAiResponse } from "./ai-diagnostics";
import { reviewSystemPrompt, xiaohongshuDraftRisk } from "./review-prompts";
import { limitGeneration } from "./rate-limits";
import { getDb, rows, type DB } from "./db";
import { AppError, hash, seal, unseal } from "./security";
import {
  answersSchema,
  choicesMatch,
  hasExperience,
  readConfig,
  answerNotes,
  type QuestionnaireConfig,
} from "./questionnaire";
export const locales = ["en", "zh-CN", "zh-TW", "ms"] as const;
export const generationInput = z
  .object({
    slug: z.string().min(1).max(100),
    experience: z.string().trim().max(2000),
    answers: answersSchema.optional(),
    locale: z.enum(locales),
    platform: z.enum(["google", "xiaohongshu", "facebook", "instagram"]),
    requestKey: z.string().uuid(),
  })
  .strict()
  .refine((i) => hasExperience(i.experience, i.answers));
export type GenerationInput = z.infer<typeof generationInput>;
export type PublicLocation = {
  id: string;
  business_id: string;
  slug: string;
  name: string;
  address: string;
  google_url: string | null;
  facebook_review_url?: string | null;
  instagram_handle?: string | null;
  business_name: string;
  accent: string;
  initials: string;
  qr_code: string;
  logo_version?: string | null;
  questionnaire?: QuestionnaireConfig;
};
export type Draft = { title: string; body: string; demo: boolean };
export async function publicLocation(slug: string) {
  return (
    await rows<PublicLocation>(
      sql`select l.*,b.name business_name,b.accent,b.initials,b.questionnaire,bl.version logo_version from location l join business b on b.id=l.business_id left join business_logo bl on bl.business_id=b.id where l.slug=${slug} and l.active=true and b.active=true`,
    )
  )[0];
}
export async function sweep(db: DB) {
  const stale = await rows<{ id: string; business_id: string }>(
    sql`update generation set state='failed', error_code='TIMEOUT' where state='pending' and deadline_at < now() returning id,business_id`,
    db,
  );
  for (const r of stale)
    await db.execute(
      sql`update business set reserved=greatest(0,reserved-1) where id=${r.business_id}`,
    );
  await db.execute(
    sql`update generation set output_encrypted=null where output_encrypted is not null and guest_id in (select id from guest_session where expires_at < now())`,
  );
}
export async function generate(
  input: GenerationInput,
  guestId: string,
  provider = writeDraft,
  verifiedHuman = false,
): Promise<Draft> {
  const db = await getDb();
  await db.transaction((t) => sweep(t as unknown as DB));
  const inputHash = hash(
    JSON.stringify({
      experience: input.experience,
      answers: input.answers,
      locale: input.locale,
      platform: input.platform,
    }),
  );
  const prepared = await db.transaction(async (t) => {
    const tx = t as unknown as DB;
    const guest = (
      await rows<{ id: string; location_id: string; attempts: number; network_key: string | null; client_key: string | null }>(
        sql`select * from guest_session where id=${guestId} and expires_at>now() for update`,
        tx,
      )
    )[0];
    if (!guest) throw new AppError("SESSION_EXPIRED", 401);
    const loc = (
      await rows<{ business_id: string }>(
        sql`select l.business_id from location l join business b on b.id=l.business_id where l.id=${guest.location_id} and l.slug=${input.slug} and l.active=true and b.active=true`,
        tx,
      )
    )[0];
    if (!loc) throw new AppError("NOT_FOUND", 404);
    const existing = (
      await rows<{
        input_hash: string;
        state: string;
        output_encrypted: string | null;
      }>(
        sql`select * from generation where guest_id=${guestId} and request_key=${input.requestKey}`,
        tx,
      )
    )[0];
    if (existing) {
      if (existing.input_hash !== inputHash)
        throw new AppError("REQUEST_CONFLICT", 409);
      if (existing.state === "succeeded" && existing.output_encrypted)
        return {
          draft: JSON.parse(unseal(existing.output_encrypted)) as Draft,
        };
      throw new AppError(
        existing.state === "pending"
          ? "ALREADY_RUNNING"
          : "PREVIOUS_ATTEMPT_FAILED",
        409,
      );
    }
    if (guest.attempts >= 5) throw new AppError("SESSION_LIMIT", 429);
    if (
      (
        await rows(
          sql`select 1 from generation where guest_id=${guestId} and state='pending'`,
          tx,
        )
      ).length
    )
      throw new AppError("ALREADY_RUNNING", 409);
    const b = (
      await rows<{
        id: string;
        name: string;
        allowance: number;
        used: number;
        reserved: number;
        expires_at: Date;
        questionnaire: QuestionnaireConfig;
      }>(sql`select * from business where id=${loc.business_id} for update`, tx)
    )[0];
    const config = readConfig(b.questionnaire);
    if (!choicesMatch(input.answers, config))
      throw new AppError("QUESTIONNAIRE_CHANGED", 409);
    if (!hasExperience(input.experience, input.answers))
      throw new AppError("MORE_DETAIL", 422);
    const notes = input.answers
      ? answerNotes(input.answers, config, input.locale)
      : "";
    const experience = [notes, input.experience].filter(Boolean).join("\n\n");
    if (new Date(b.expires_at).getTime() <= Date.now())
      throw new AppError("SUBSCRIPTION_EXPIRED", 403);
    if (b.used + b.reserved >= b.allowance)
      throw new AppError("QUOTA_EXHAUSTED", 429);
    if (b.reserved >= 2) throw new AppError("BUSY", 429);
    const cap = Math.max(
      1,
      Math.min(10000, Number(process.env.AI_DAILY_ATTEMPT_LIMIT) || 100),
    );
    await limitGeneration(tx, b.id, guest.network_key, cap, guest.client_key, verifiedHuman);
    await tx.execute(
      sql`insert into ai_daily_budget(day,attempts) values(current_date,0) on conflict do nothing`,
    );
    if (
      !(
        await rows(
          sql`update ai_daily_budget set attempts=attempts+1 where day=current_date and attempts<${cap} returning day`,
          tx,
        )
      ).length
    )
      throw new AppError("DAILY_LIMIT", 429);
    const id = randomUUID();
    await tx.execute(
      sql`update guest_session set attempts=attempts+1 where id=${guestId}`,
    );
    await tx.execute(
      sql`update business set reserved=reserved+1 where id=${b.id}`,
    );
    await tx.execute(
      sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at) values(${id},${guestId},${b.id},${guest.location_id},${input.requestKey},${inputHash},'pending',${input.locale},${input.platform},${process.env.AI_MODE === "gemini" ? "gemini" : "demo"},now()+interval '60 seconds')`,
    );
    return { id, businessId: b.id, businessName: b.name, experience };
  });
  if ("draft" in prepared) return prepared.draft!;
  try {
    const result = await provider(
      { ...input, experience: prepared.experience! },
      prepared.businessName!,
    );
    const committed = await db.transaction(async (t) => {
      const tx = t as unknown as DB;
      const done = await rows(
        sql`update generation set state='succeeded',output_encrypted=${seal(JSON.stringify(result.draft))},input_tokens=${result.inputTokens},output_tokens=${result.outputTokens} where id=${prepared.id!} and state='pending' and deadline_at>now() and exists (select 1 from guest_session where id=${guestId} and expires_at>now()) returning id`,
        tx,
      );
      if (!done.length) return false;
      await tx.execute(
        sql`update business set reserved=reserved-1,used=used+1 where id=${prepared.businessId!}`,
      );
      return true;
    });
    if (!committed) throw new AppError("TIMEOUT", 503);
    return result.draft;
  } catch (e) {
    console.warn(JSON.stringify(safeAiFailure(e)));
    await db.transaction(async (t) => {
      const tx = t as unknown as DB;
      const failed = await rows(
        sql`update generation set state='failed',error_code=${e instanceof AppError ? e.code : "AI_UNAVAILABLE"} where id=${prepared.id!} and state='pending' returning id`,
        tx,
      );
      if (failed.length)
        await tx.execute(
          sql`update business set reserved=greatest(0,reserved-1) where id=${prepared.businessId!}`,
        );
    });
    throw e instanceof AppError ? e : new AppError("AI_UNAVAILABLE", 503);
  }
}
const outputSchema = z.object({
  title: z.string().max(120),
  body: z.string().min(1).max(3000),
  needsDetail: z.boolean(),
});
export async function writeDraft(input: GenerationInput, businessName: string) {
  if (process.env.AI_MODE !== "gemini") {
    if (process.env.APP_MODE !== "local")
      throw new AppError("AI_NOT_CONFIGURED", 503);
    return {
      draft: { title: "", body: input.experience, demo: true },
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL)
    throw new AppError("AI_NOT_CONFIGURED", 503);
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 25000, retryOptions: { attempts: 1 } },
  });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: JSON.stringify({
      businessName,
      experience: input.experience,
      language: input.locale,
      platform: input.platform,
    }),
    config: {
      systemInstruction:
        reviewSystemPrompt(input.platform),
      maxOutputTokens: 512,
      temperature: 0.4,
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          needsDetail: { type: "boolean" },
        },
        required: ["title", "body", "needsDetail"],
        additionalProperties: false,
      },
      abortSignal: AbortSignal.timeout(25000),
    },
  });
  let output: unknown;
  try {
    output = JSON.parse(response.text || "{}");
  } catch {
    console.warn(JSON.stringify(safeAiResponse(response)));
    throw new AppError("INVALID_AI_OUTPUT", 503);
  }
  const parsed = outputSchema.safeParse(output);
  if (
    !parsed.success ||
    response.candidates?.[0]?.finishReason === "MAX_TOKENS"
  ) {
    console.warn(JSON.stringify(safeAiResponse(response)));
    throw new AppError("INVALID_AI_OUTPUT", 503);
  }
  if (parsed.data.needsDetail) throw new AppError("MORE_DETAIL", 422);
  if (input.platform === "xiaohongshu") {
    // Never hand out generated promotional/unsafe wording; preserve user input.
    // No second Gemini call is made, and failed drafts do not consume a business credit.
    if (xiaohongshuDraftRisk(parsed.data)?.severity === "block")
      throw new AppError("DRAFT_REVIEW_REQUIRED", 422);
    if (!parsed.data.title.trim())
      throw new AppError("INVALID_AI_OUTPUT", 503);
  }
  return {
    draft: {
      title: input.platform === "xiaohongshu" ? parsed.data.title : "",
      body: parsed.data.body,
      demo: false,
    },
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens:
      (response.usageMetadata?.candidatesTokenCount || 0) +
      (response.usageMetadata?.thoughtsTokenCount || 0),
  };
}

export async function finishGuest(tokenHash: string, locationId: string) {
  const db = await getDb();
  await db.transaction(async (t) => {
    const tx = t as unknown as DB;
    const g = (
      await rows<{ id: string }>(
        sql`select id from guest_session where token_hash=${tokenHash} and location_id=${locationId} for update`,
        tx,
      )
    )[0];
    if (!g) return;
    await tx.execute(
      sql`update guest_session set expires_at=now() where id=${g.id}`,
    );
    const pending = await rows<{ business_id: string }>(
      sql`update generation set state='failed',error_code='SESSION_FINISHED',output_encrypted=null where guest_id=${g.id} and state='pending' returning business_id`,
      tx,
    );
    for (const r of pending)
      await tx.execute(
        sql`update business set reserved=greatest(0,reserved-1) where id=${r.business_id}`,
      );
    await tx.execute(
      sql`update generation set output_encrypted=null where guest_id=${g.id}`,
    );
  });
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { safeAiFailure, safeAiResponse } from "../src/lib/ai-diagnostics";

test("AI diagnostics expose status without provider messages or customer content", () => {
  const secret = "private-key-and-customer-text";
  for (const status of [400, 403, 404, 429, 503]) {
    const result = safeAiFailure({
      status,
      message: secret,
      body: secret,
      code: secret,
      name: secret,
    });
    assert.deepEqual(result, {
      event: "ai_generation_failed",
      kind: "provider_http_error",
      status,
    });
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
  assert.equal(safeAiFailure({ name: "TimeoutError" }).kind, "timeout");
  assert.equal(
    safeAiFailure(new SyntaxError("private draft")).kind,
    "invalid_json",
  );
  assert.deepEqual(safeAiFailure(null), {
    event: "ai_generation_failed",
    kind: "unknown",
  });
});

test("AI response diagnostics identify truncation without logging generated content", () => {
  assert.deepEqual(
    safeAiResponse({
      candidates: [{ finishReason: "MAX_TOKENS" }],
      usageMetadata: { candidatesTokenCount: 100, thoughtsTokenCount: 412 },
    }),
    {
      event: "ai_output_rejected",
      finishReason: "MAX_TOKENS",
      outputTokens: 100,
      thinkingTokens: 412,
    },
  );
  assert.equal(
    safeAiResponse({ candidates: [{ finishReason: "private text" }] })
      .finishReason,
    "UNKNOWN",
  );
  assert.equal(safeAiFailure({ status: "secret" }).status, undefined);
});

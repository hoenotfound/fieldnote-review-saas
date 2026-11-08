// Never log provider messages, response bodies, prompts, URLs or credentials.
export function safeAiFailure(error: unknown) {
  const e =
    error && typeof error === "object"
      ? (error as { status?: unknown; name?: unknown; code?: unknown })
      : {};
  const status =
    typeof e.status === "number" &&
    Number.isInteger(e.status) &&
    e.status >= 400 &&
    e.status <= 599
      ? e.status
      : undefined;
  const kind =
    e.name === "AbortError" || e.name === "TimeoutError"
      ? "timeout"
      : e instanceof SyntaxError
        ? "invalid_json"
        : [
              "INVALID_AI_OUTPUT",
              "MORE_DETAIL",
              "AI_NOT_CONFIGURED",
              "TIMEOUT",
            ].includes(String(e.code))
          ? String(e.code)
          : status
            ? "provider_http_error"
            : "unknown";
  return { event: "ai_generation_failed", kind, ...(status ? { status } : {}) };
}

export function safeAiResponse(response: {
  candidates?: { finishReason?: string }[];
  usageMetadata?: {
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}) {
  const reason = response.candidates?.[0]?.finishReason;
  const finishReason = [
    "STOP",
    "MAX_TOKENS",
    "SAFETY",
    "RECITATION",
    "OTHER",
    "BLOCKLIST",
    "PROHIBITED_CONTENT",
  ].includes(reason || "")
    ? reason
    : "UNKNOWN";
  const count = (n: unknown) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 1000000
      ? n
      : 0;
  return {
    event: "ai_output_rejected",
    finishReason,
    outputTokens: count(response.usageMetadata?.candidatesTokenCount),
    thinkingTokens: count(response.usageMetadata?.thoughtsTokenCount),
  };
}

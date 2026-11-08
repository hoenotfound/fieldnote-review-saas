import { test } from "node:test";
import assert from "node:assert/strict";
import { safeStartupFailure } from "../src/lib/pilot";

test("startup errors report known nested failure codes without leaking credentials", () => {
  const privateText = "private-password-and-database-url";
  const error = new Error(privateText, {
    cause: Object.assign(new Error(privateText), { code: "28P01" }),
  });
  const output = safeStartupFailure("database", error);
  assert.match(output, /database.*28P01.*authentication failed/);
  assert.ok(!output.includes(privateText));
  const unknown = safeStartupFailure(privateText, {
    code: privateText,
    message: privateText,
  });
  assert.ok(!unknown.includes(privateText));
  assert.match(unknown, /at startup/);
  assert.match(
    safeStartupFailure("initial-admin", {
      code: "INITIAL_ADMIN_PASSWORD_INVALID",
    }),
    /12 to 128/,
  );
});

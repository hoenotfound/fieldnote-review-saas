import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
if (!existsSync(".env.local"))
  writeFileSync(
    ".env.local",
    `APP_MODE=local\nAI_MODE=demo\nAPP_ORIGIN=http://localhost:3000\nLOCAL_DATA_DIR=.data/local\nAI_DAILY_ATTEMPT_LIMIT=100\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`,
    { mode: 0o600 },
  );
const result = spawnSync(
  process.execPath,
  ["--env-file=.env.local", "--import", "tsx", "scripts/seed.ts"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);

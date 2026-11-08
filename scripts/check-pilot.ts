import { sql } from "drizzle-orm";
import { pilotProblems, safeStartupFailure } from "../src/lib/pilot";
import { getDb, rows, closeDb } from "../src/lib/db";
import { initializeFirstAdmin } from "../src/lib/initial-admin";
let stage = "configuration";
async function main() {
  const problems = pilotProblems(process.env);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }
  stage = "database";
  const db = await getDb();
  stage = "initial-admin";
  const initialAdmin = await initializeFirstAdmin(db, process.env);
  if (initialAdmin === "created")
    console.log(
      "Initial admin created. Remove INITIAL_ADMIN_PASSWORD and INITIAL_ADMIN_EMAIL from the service settings after verifying sign-in.",
    );
  stage = "account-check";
  const admins = await rows(sql`select 1 from platform_admin limit 1`);
  const fixtureAccounts = await rows(
    sql`select 1 from auth_user where email like '%.example' limit 1`,
  );
  const fixtures = await rows(
    sql`select 1 from business where id in ('juniper','tide') limit 1`,
  );
  if (!admins.length)
    throw Object.assign(new Error(), { code: "PILOT_ADMIN_MISSING" });
  if (fixtureAccounts.length || fixtures.length)
    throw Object.assign(new Error(), { code: "PILOT_FIXTURES_PRESENT" });
  console.log(
    "Pilot configuration and database checks passed. Device, live AI, backup and authentication recovery checks still require the pilot checklist.",
  );
}
main()
  .catch((error) => {
    console.error(safeStartupFailure(stage, error));
    process.exitCode = 1;
  })
  .finally(closeDb);

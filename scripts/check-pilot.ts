import { sql } from "drizzle-orm";
import { pilotProblems } from "../src/lib/pilot";
import { getDb, rows, closeDb } from "../src/lib/db";
import { initializeFirstAdmin } from "../src/lib/initial-admin";
async function main() {
  const problems = pilotProblems(process.env);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }
  const db = await getDb();
  const initialAdmin = await initializeFirstAdmin(db, process.env);
  if (initialAdmin === "created")
    console.log(
      "Initial admin created. Remove INITIAL_ADMIN_PASSWORD and INITIAL_ADMIN_EMAIL from the service settings after verifying sign-in.",
    );
  const admins = await rows(sql`select 1 from platform_admin limit 1`);
  const fixtureAccounts = await rows(
    sql`select 1 from auth_user where email like '%.example' limit 1`,
  );
  const fixtures = await rows(
    sql`select 1 from business where id in ('juniper','tide') limit 1`,
  );
  if (!admins.length || fixtureAccounts.length || fixtures.length)
    throw new Error();
  console.log(
    "Pilot configuration and database checks passed. Device, live AI, backup and authentication recovery checks still require the pilot checklist.",
  );
}
main()
  .catch(() => {
    console.error(
      "Pilot check failed. Check the isolated database migrations, operator account or initial-admin settings, and absence of fictional demo data. No credentials are printed.",
    );
    process.exitCode = 1;
  })
  .finally(closeDb);

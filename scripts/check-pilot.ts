import { sql } from "drizzle-orm";
import { pilotProblems } from "../src/lib/pilot";
import { getDb, rows, closeDb } from "../src/lib/db";
async function main() {
  const problems = pilotProblems(process.env);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }
  await getDb();
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
      "Pilot check failed. Check the isolated database migrations, operator account and absence of fictional demo data. No credentials are printed.",
    );
    process.exitCode = 1;
  })
  .finally(closeDb);

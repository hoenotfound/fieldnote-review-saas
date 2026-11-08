import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getDb, closeDb, rows, type DB } from "../src/lib/db";
import { makeAuth } from "../src/lib/auth";
import { initializeFirstAdmin } from "../src/lib/initial-admin";

let db: DB;
const settings = {
  APP_MODE: "pilot",
  INITIAL_ADMIN_EMAIL: "initial-admin@example.com",
  INITIAL_ADMIN_PASSWORD: "Local-test-password-37251",
};
before(async () => {
  delete process.env.DATABASE_URL;
  process.env.APP_MODE = "local";
  process.env.LOCAL_DATA_DIR = await mkdtemp(
    join(tmpdir(), "fieldnote-admin-"),
  );
  db = await getDb();
});
beforeEach(async () => {
  await db.execute(sql`delete from platform_admin`);
  await db.execute(sql`delete from auth_user`);
});
after(closeDb);

test("first admin can sign in through Better Auth; public signup stays disabled", async () => {
  assert.equal(await initializeFirstAdmin(db, settings), "created");
  const auth = await makeAuth();
  const signedIn = await auth.api.signInEmail({
    body: {
      email: settings.INITIAL_ADMIN_EMAIL,
      password: settings.INITIAL_ADMIN_PASSWORD,
    },
  });
  const admins = await rows<{ user_id: string }>(
    sql`select user_id from platform_admin`,
  );
  assert.equal(admins.length, 1);
  assert.equal(signedIn.user.id, admins[0].user_id);
  await assert.rejects(
    auth.api.signUpEmail({
      body: {
        email: "uninvited@example.com",
        password: settings.INITIAL_ADMIN_PASSWORD,
        name: "Uninvited",
      },
    }),
  );
});

test("repeated startup cannot replace the admin or reset a password", async () => {
  await initializeFirstAdmin(db, settings);
  const original = await rows(sql`select id,email from auth_user`);
  const originalHash = await rows(sql`select password from auth_account`);
  assert.equal(
    await initializeFirstAdmin(db, {
      ...settings,
      INITIAL_ADMIN_EMAIL: "other@example.com",
      INITIAL_ADMIN_PASSWORD: "Different-password-83842",
    }),
    "already_initialized",
  );
  assert.deepEqual(await rows(sql`select id,email from auth_user`), original);
  assert.deepEqual(
    await rows(sql`select password from auth_account`),
    originalHash,
  );
  assert.equal(
    await initializeFirstAdmin(db, { APP_MODE: "pilot" }),
    "not_configured",
  );
});

test("initial setup refuses to elevate an existing non-admin account", async () => {
  await db.execute(
    sql`insert into auth_user(id,name,email) values('owner','Owner',${settings.INITIAL_ADMIN_EMAIL})`,
  );
  await assert.rejects(
    initializeFirstAdmin(db, settings),
    /empty account database/,
  );
  assert.equal((await rows(sql`select 1 from platform_admin`)).length, 0);
  assert.equal((await rows(sql`select 1 from auth_account`)).length, 0);
});

test("invalid setup credentials and local mode leave accounts empty", async () => {
  for (const invalid of [
    { ...settings, INITIAL_ADMIN_PASSWORD: "short" },
    { ...settings, INITIAL_ADMIN_PASSWORD: undefined },
    { ...settings, INITIAL_ADMIN_EMAIL: "not-an-email" },
    { ...settings, INITIAL_ADMIN_EMAIL: "admin@review.example" },
    { ...settings, APP_MODE: "local" },
  ])
    await assert.rejects(initializeFirstAdmin(db, invalid));
  assert.equal((await rows(sql`select 1 from auth_user`)).length, 0);
});

test("a failed privilege insert rolls back the user and credential together", async () => {
  await db.execute(
    sql`create function reject_initial_admin() returns trigger language plpgsql as $$ begin raise exception 'test rejection'; end $$`,
  );
  await db.execute(
    sql`create trigger reject_initial_admin before insert on platform_admin for each row execute function reject_initial_admin()`,
  );
  try {
    await assert.rejects(initializeFirstAdmin(db, settings));
    assert.equal((await rows(sql`select 1 from auth_user`)).length, 0);
    assert.equal((await rows(sql`select 1 from auth_account`)).length, 0);
  } finally {
    await db.execute(sql`drop trigger reject_initial_admin on platform_admin`);
    await db.execute(sql`drop function reject_initial_admin()`);
  }
});

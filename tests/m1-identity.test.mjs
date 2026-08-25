import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = async (path) => readFile(new URL(path, root), "utf8");

test("M1 uses Supabase Auth and does not accept a public role", async () => {
  const signup = await text("app/api/auth/signup/route.ts");
  assert.match(signup, /supabase\.auth\.signUp/);
  assert.doesNotMatch(signup, /body\.role/);
  await assert.rejects(access(new URL("app/api/auth/register/route.ts", root)));
  await assert.rejects(access(new URL("app/chatgpt-auth.ts", root)));
});

test("M1 profile trigger and role guard are present", async () => {
  const migration = await text("supabase/migrations/0002_m1_identity.sql");
  const privileges = await text("supabase/migrations/0003_m05_profile_privileges.sql");
  assert.match(migration, /handle_new_user/);
  assert.match(migration, /values \([\s\S]*'student'/);
  assert.match(migration, /prevent_profile_role_change/);
  assert.match(migration, /auth\.uid\(\) = old\.id/);
  assert.match(migration, /new\.created_at is distinct from old\.created_at/);
  assert.match(migration, /profiles_select_own|profiles_role_guard/);
  assert.match(privileges, /revoke update on public\.profiles from authenticated/);
  assert.match(privileges, /grant update \(display_name\)/);
});

test("teacher and student routes use server-side role guards", async () => {
  const [home, studentLayout, rubrics] = await Promise.all([
    text("app/page.tsx"),
    text("app/student/layout.tsx"),
    text("app/rubrics/page.tsx"),
  ]);
  assert.match(home, /requireRole/);
  assert.match(studentLayout, /requireStudent/);
  assert.match(rubrics, /requireRole\("teacher"/);
});

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true, service: true, anon: true });
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error("BLOCKED: RLS tests require local Supabase URL, anon key and service role.");
const jwtNames = ["SUPABASE_TEST_TEACHER_A_JWT", "SUPABASE_TEST_TEACHER_B_JWT", "SUPABASE_TEST_STUDENT_A_JWT", "SUPABASE_TEST_STUDENT_B_JWT"];
const missing = jwtNames.filter((name) => !process.env[name]);
if (missing.length) { console.error(`BLOCKED: missing local fixture JWTs (${missing.join(", ")}).`); process.exit(2); }
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const clients = Object.fromEntries(jwtNames.map((name) => [name, createClient(url, anon, { global: { headers: { Authorization: `Bearer ${process.env[name]}` } }, auth: { autoRefreshToken: false, persistSession: false } })])) as Record<string, SupabaseClient>;
const expected = new Map([["SUPABASE_TEST_TEACHER_A_JWT", "teacher.a@test.local"], ["SUPABASE_TEST_TEACHER_B_JWT", "teacher.b@test.local"], ["SUPABASE_TEST_STUDENT_A_JWT", "student.a@test.local"], ["SUPABASE_TEST_STUDENT_B_JWT", "student.b@test.local"]]);
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`RLS assertion failed: ${message}`); }
async function denied(label: string, result: { error: unknown | null; data?: unknown }) {
  const hasData = result.data !== null && result.data !== undefined && (!Array.isArray(result.data) || result.data.length > 0);
  check(result.error || !hasData, `${label} must be denied or empty`);
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const evidenceId = randomUUID();
const objectPath = `class-a/student-a/${evidenceId}/rls.txt`;
try {
  for (const [name, email] of expected) {
    const { data, error } = await clients[name].auth.getUser();
    check(!error && data.user?.email === email, `${name} JWT must resolve to its fixture user`);
    const profile = await sql`select role from public.profiles where id = ${data.user.id}`;
    check(profile.length === 1 && profile[0].role === (email.startsWith("teacher") ? "teacher" : "student"), `${name} fixture profile role`);
  }
  await sql`insert into public.evidences (id, student_id, classroom_id, module_id, title, evidence_type, status) values (${evidenceId}, 'student-a', 'class-a', 'module-a', 'RLS real evidence', 'file', 'draft')`;
  const studentA = clients.SUPABASE_TEST_STUDENT_A_JWT;
  const studentB = clients.SUPABASE_TEST_STUDENT_B_JWT;
  const teacherA = clients.SUPABASE_TEST_TEACHER_A_JWT;
  const teacherB = clients.SUPABASE_TEST_TEACHER_B_JWT;
  const own = await studentA.from("evidences").select("id").eq("id", evidenceId);
  check(!own.error && own.data?.length === 1, "Student A can read own draft");
  await denied("Student B evidence read", await studentB.from("evidences").select("id").eq("id", evidenceId));
  const ownUpdate = await studentA.from("evidences").update({ title: "RLS own update" }).eq("id", evidenceId).select("id");
  check(!ownUpdate.error && ownUpdate.data?.length === 1, "Student A can update own draft");
  await denied("Student B evidence update", await studentB.from("evidences").update({ title: "cross tenant" }).eq("id", evidenceId).select("id"));
  await denied("Student B evidence delete", await studentB.from("evidences").delete().eq("id", evidenceId).select("id"));

  const uploaded = await studentA.storage.from("evidence").upload(objectPath, new Blob(["local rls"]), { contentType: "text/plain" });
  check(!uploaded.error, `Student A own Storage insert: ${uploaded.error?.message ?? "unknown"}`);
  const downloaded = await studentA.storage.from("evidence").download(objectPath);
  check(!downloaded.error && downloaded.data, "Student A can read own draft object");
  const updatedObject = await studentA.storage.from("evidence").update(objectPath, new Blob(["updated"]), { contentType: "text/plain" });
  check(!updatedObject.error, `Student A own Storage update: ${updatedObject.error?.message ?? "unknown"}`);
  await denied("Student B Storage read", await studentB.storage.from("evidence").download(objectPath));
  const deletedObject = await studentA.storage.from("evidence").remove([objectPath]);
  check(!deletedObject.error, `Student A own Storage delete: ${deletedObject.error?.message ?? "unknown"}`);
  check(!(await studentA.storage.from("evidence").upload(objectPath, new Blob(["submitted"]), { contentType: "text/plain" })).error, "admin-independent object recreation");

  await sql`update public.evidences set storage_key = ${objectPath}, file_name = 'rls.txt', mime_type = 'text/plain', file_size = 9, text_content = null, status = 'submitted', submitted_at = now() where id = ${evidenceId}`;
  const teacherRead = await teacherA.from("evidences").select("id").eq("id", evidenceId);
  check(!teacherRead.error && teacherRead.data?.length === 1, "Teacher A can read submitted own-class evidence");
  await denied("Teacher B evidence read", await teacherB.from("evidences").select("id").eq("id", evidenceId));
  await denied("Student B submitted evidence read", await studentB.from("evidences").select("id").eq("id", evidenceId));
  await denied("Student A submitted update", await studentA.from("evidences").update({ title: "must fail" }).eq("id", evidenceId).select("id"));
  await denied("Student A submitted delete", await studentA.from("evidences").delete().eq("id", evidenceId).select("id"));
  check(!(await teacherA.storage.from("evidence").download(objectPath)).error, "Teacher A can download submitted own-class object");
  await denied("Teacher B submitted Storage read", await teacherB.storage.from("evidence").download(objectPath));
  await denied("Student B submitted Storage read", await studentB.storage.from("evidence").download(objectPath));
  console.log("RLS/Storage PASS: four verified fixture JWTs, non-empty own operations, cross-tenant denials and submitted immutability passed.");
} finally {
  await admin.storage.from("evidence").remove([objectPath]);
  await sql`delete from public.evidences where id = ${evidenceId}`;
  await sql.end();
}

import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true, service: true, anon: true, password: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const password = process.env.E2E_TEST_USER_PASSWORD!;
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [
  ["teacher.a@test.local", "Teacher A", "teacher"], ["teacher.b@test.local", "Teacher B", "teacher"],
  ["student.a@test.local", "Student A", "student"], ["student.b@test.local", "Student B", "student"],
] as const;
const ids: Record<string, string> = {};
for (const [email, displayName] of users) {
  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = existing.data.users.find((user) => user.email === email);
  const created = found ? { data: { user: found }, error: null } : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  const user = created.data.user;
  if (created.error || !user) throw new Error(`Could not create ${email}: ${created.error?.message ?? JSON.stringify(created.error) ?? "unknown"}`);
  ids[email] = user.id;
}
const sql = postgres(process.env.MIGRATION_DATABASE_URL!, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`delete from public.evaluation_scores where evaluation_id in (select id from public.evaluations where evidence_id in (select id from public.evidences where student_id in ('student-a', 'student-b')))`;
    await tx`delete from public.evaluations where evidence_id in (select id from public.evidences where student_id in ('student-a', 'student-b'))`;
    await tx`delete from public.evidences where student_id in ('student-a', 'student-b')`;
    await tx`delete from public.credentials where title like 'M6.2 API %'`;
    await tx`delete from public.activity_responses where student_id in ('student-a', 'student-b')`;
    await tx`delete from public.student_activity_progress where student_id in ('student-a', 'student-b')`;
    for (const [email, displayName, role] of users) await tx`insert into public.profiles (id, display_name, role) values (${ids[email]}, ${displayName}, ${role}) on conflict (id) do update set display_name = excluded.display_name, role = excluded.role`;
    await tx`insert into public.classrooms (id, name, subject, academic_period, teacher_id) values ('class-a', 'Classroom A', 'Science', 'test', ${ids["teacher.a@test.local"]}), ('class-b', 'Classroom B', 'Science', 'test', ${ids["teacher.b@test.local"]}) on conflict (id) do update set teacher_id = excluded.teacher_id`;
    await tx`update public.students set id = 'student-a', display_name = 'Student A', email = 'student.a@test.local' where profile_id = ${ids["student.a@test.local"]}`;
    await tx`update public.students set id = 'student-b', display_name = 'Student B', email = 'student.b@test.local' where profile_id = ${ids["student.b@test.local"]}`;
    await tx`insert into public.students (id, profile_id, display_name, email) values ('student-a', ${ids["student.a@test.local"]}, 'Student A', 'student.a@test.local'), ('student-b', ${ids["student.b@test.local"]}, 'Student B', 'student.b@test.local') on conflict (id) do update set profile_id = excluded.profile_id`;
    await tx`insert into public.enrollments (id, student_id, classroom_id, status) values ('enroll-a', 'student-a', 'class-a', 'active'), ('enroll-b', 'student-b', 'class-b', 'active') on conflict (id) do update set status = excluded.status`;
    await tx`insert into public.learning_modules (id, classroom_id, title, driving_question, methodologies, phase) values ('module-a', 'class-a', 'Module A', 'Question A', 'project', 'published') on conflict (id) do nothing`;
    await tx`insert into public.learning_activities (id, module_id, title, activity_type, requires_evidence, status, published_at) values ('activity-a', 'module-a', 'Activity A', 'reflection', true, 'published', now()) on conflict (id) do nothing`;
    await tx`insert into public.rubrics (id, classroom_id, title, status) values ('rubric-a', 'class-a', 'Rubric A', 'published') on conflict (id) do nothing`;
    await tx`insert into public.rubric_criteria (id, rubric_id, name, description, max_score, position) values ('criterion-a', 'rubric-a', 'Criterion A', 'Criterion', '4', '1') on conflict (id) do nothing`;
  });
} finally { await sql.end(); }
async function token(email: string) {
  const client = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const result = await client.auth.signInWithPassword({ email, password: password! });
  if (result.error || !result.data.session) throw new Error(`Could not sign in ${email}: ${result.error?.message ?? "unknown"}`);
  return result.data.session.access_token;
}
const jwtLines = [
  `SUPABASE_TEST_TEACHER_A_JWT=${await token("teacher.a@test.local")}`,
  `SUPABASE_TEST_TEACHER_B_JWT=${await token("teacher.b@test.local")}`,
  `SUPABASE_TEST_STUDENT_A_JWT=${await token("student.a@test.local")}`,
  `SUPABASE_TEST_STUDENT_B_JWT=${await token("student.b@test.local")}`,
];
const envPath = ".env.test.local";
let existing = "";
try { existing = await readFile(envPath, "utf8"); } catch { /* create local env below */ }
const jwtNames = new Set(jwtLines.map((line) => line.slice(0, line.indexOf("="))));
const retained = existing.split(/\r?\n/).filter((line) => !jwtNames.has(line.slice(0, line.indexOf("="))));
await writeFile(envPath, `${retained.join("\n").replace(/\n*$/, "")}\n${jwtLines.join("\n")}\n`, { mode: 0o600 });
console.log("Local test fixtures and JWTs refreshed (tokens withheld). ");

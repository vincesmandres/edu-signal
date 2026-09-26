import postgres from "postgres";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true });
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("BLOCKED: DB tests require a local PostgreSQL DATABASE_URL.");
const sql = postgres(dbUrl, { max: 1 });
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`DB assertion failed: ${message}`); }
async function rejects(label: string, action: () => Promise<unknown>, expected: { code?: string; constraint?: string; message?: RegExp } = {}) {
  try { await action(); throw new Error(`Expected rejection did not occur: ${label}`); } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected rejection")) throw error;
    const dbError = error as { code?: string; constraint?: string; constraint_name?: string; detail?: string; message?: string };
    if (expected.code && dbError.code !== expected.code) throw new Error(`${label} returned SQLSTATE ${dbError.code ?? "unknown"}, expected ${expected.code}`);
    const cause = [dbError.constraint, dbError.constraint_name, dbError.detail, dbError.message].filter(Boolean).join(" ");
    if (expected.constraint && !cause.includes(expected.constraint)) throw new Error(`${label} returned constraint cause ${cause || "unknown"}, expected ${expected.constraint}`);
    if (expected.message && !expected.message.test(dbError.message ?? "")) throw new Error(`${label} returned an unexpected database cause.`);
  }
}

try {
  const constraints = await sql`
    select conname, contype from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid::regclass::text in ('evidences', 'evaluations', 'enrollments', 'activity_responses')`;
  const names = new Set(constraints.map((row) => row.conname));
  for (const name of ["evidences_student_id_students_id_fk", "evidences_classroom_id_classrooms_id_fk", "evaluations_evidence_id_evidences_id_fk", "uq_evidences_student_activity", "uq_evaluations_evidence", "evidences_status_check", "evidence_lifecycle_guard"]) {
    const present = name === "evidence_lifecycle_guard" ? (await sql`select 1 from pg_trigger where tgname = ${name}`).length > 0 : names.has(name) || (await sql`select 1 from pg_indexes where indexname = ${name}`).length > 0;
    check(present, name);
  }
  const indexNames = await sql`select indexname from pg_indexes where schemaname = 'public' and tablename = 'evidences'`;
  check(indexNames.some((row) => row.indexname === "idx_evidences_activity"), "activity index");

  await rejects("invalid evidence FK", async () => sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, title, evidence_type, status) values ('db-invalid-fk', 'missing-student', 'class-a', 'invalid', 'text', 'draft')`;
  }), { code: "23503", constraint: "student_id" });
  await rejects("invalid lifecycle status", async () => sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, title, evidence_type, status) values ('db-invalid-status', 'student-a', 'class-a', 'invalid', 'text', 'invalid')`;
  }), { code: "23514", constraint: "evidences_status_check" });
  await rejects("duplicate student/activity", async () => sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, module_id, activity_id, title, evidence_type, text_content, status) values ('db-duplicate-base', 'student-a', 'class-a', 'module-a', 'activity-a', 'base', 'text', 'content', 'draft')`;
    await tx`insert into public.evidences (id, student_id, classroom_id, module_id, activity_id, title, evidence_type, text_content, status) values ('db-duplicate-evidence', 'student-a', 'class-a', 'module-a', 'activity-a', 'duplicate', 'text', 'content', 'draft')`;
  }), { code: "23505", constraint: "student_id" });
  await sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, module_id, title, evidence_type, text_content, status) values ('db-positive-evidence', 'student-a', 'class-a', 'module-a', 'positive', 'text', 'content', 'draft')`;
    await tx`update public.evidences set status = 'submitted', submitted_at = now() where id = 'db-positive-evidence'`;
    throw new Error("rollback sentinel");
  }).catch((error) => { if (!(error instanceof Error) || error.message !== "rollback sentinel") throw error; });
  await rejects("submitted immutable trigger", async () => sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, module_id, title, evidence_type, text_content, status) values ('db-immutable-evidence', 'student-a', 'class-a', 'module-a', 'positive', 'text', 'content', 'submitted')`;
    await tx`update public.evidences set title = 'changed' where id = 'db-immutable-evidence'`;
  }), { code: "P0001", message: /submitted evidence is immutable/ });
  await rejects("duplicate evaluation", async () => sql.begin(async (tx) => {
    await tx`insert into public.evidences (id, student_id, classroom_id, module_id, title, evidence_type, text_content, status) values ('db-evaluation-evidence', 'student-a', 'class-a', 'module-a', 'positive', 'text', 'content', 'submitted')`;
    await tx`insert into public.evaluations (id, evidence_id, teacher_id, score, status) values ('db-positive-evaluation', 'db-evaluation-evidence', (select id from profiles where role = 'teacher' limit 1), '4', 'published')`;
    await tx`insert into public.evaluations (id, evidence_id, teacher_id, score, status) values ('db-duplicate-evaluation', 'db-evaluation-evidence', (select id from profiles where role = 'teacher' limit 1), '3', 'published')`;
  }), { code: "23505", constraint: "evidence_id" });
  console.log("DB integration PASS: catalog definitions and transactional FK, unique, check, trigger and lifecycle assertions passed.");
} finally { await sql.end(); }

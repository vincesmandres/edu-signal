import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("activity schema has unique ownership and ordering fields", async () => {
  const schema = await text("db/schema.ts");
  assert.match(schema, /learningActivities = pgTable\("learning_activities"/);
  assert.match(schema, /activityType: text\("activity_type"\)/);
  assert.match(schema, /position: integer\("position"\)/);
  assert.match(schema, /uniqueIndex\("uq_activity_responses_student_activity"/);
  assert.match(schema, /uniqueIndex\("uq_activity_progress_student_activity"/);
  assert.match(schema, /uniqueIndex\("uq_enrollments_student_classroom"/);
});

test("student activity routes derive identity and enforce published access", async () => {
  const [activities, response, complete] = await Promise.all([
    text("lib/student/get-student-activities.ts"),
    text("app/api/student/activities/[activityId]/response/route.ts"),
    text("app/api/student/activities/[activityId]/complete/route.ts"),
  ]);
  assert.match(activities, /requireStudent/);
  assert.match(activities, /status, "published"/);
  assert.match(activities, /phase, "published"/);
  assert.match(response, /student\.id/);
  assert.doesNotMatch(response, /body.*studentId/);
  assert.match(complete, /requiresResponse/);
  assert.match(complete, /completed/);
});

test("activity config validation rejects unsafe resources", async () => {
  const source = await text("lib/activities.ts");
  assert.match(source, /ACTIVITY_TYPES/);
  assert.match(source, /protocol === "https:"/);
  assert.match(source, /validateActivityConfig/);
});

test("student workspace pages and teacher module lifecycle are present", async () => {
  const [dashboard, classroom, module, manager] = await Promise.all([
    text("app/student/page.tsx"),
    text("app/student/classrooms/[classroomId]/page.tsx"),
    text("app/student/modules/[moduleId]/page.tsx"),
    text("app/classrooms/[classroomId]/modules/[moduleId]/ModuleManager.tsx"),
  ]);
  assert.match(dashboard, /getStudentDashboard/);
  assert.match(classroom, /getStudentClassroom/);
  assert.match(module, /getStudentActivities/);
  assert.match(manager, /Publicar módulo/);
  assert.match(manager, /Guardar módulo/);
});

test("RLS scopes student resources through membership and published state", async () => {
  const rls = await text("supabase/migrations/0005_m2_m4_rls.sql");
  assert.match(rls, /students_read_own_record/);
  assert.match(rls, /students_read_own_enrollments/);
  assert.match(rls, /students_read_enrolled_classrooms/);
  assert.match(rls, /students_read_published_modules/);
  assert.match(rls, /students_read_published_activities/);
  assert.match(rls, /a\.status = 'published'/);
  assert.match(rls, /m\.phase = 'published'/);
  assert.match(rls, /s\.profile_id = auth\.uid\(\)/);
});

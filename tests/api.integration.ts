import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { assertLocalTestEnv, loadLocalEnv } from "../scripts/local-test-env.mjs";

loadLocalEnv();

const baseUrl = process.env.TEST_API_BASE_URL ?? `http://127.0.0.1:${process.env.TEST_API_PORT ?? "3100"}`;
const port = process.env.TEST_API_PORT ?? (new URL(baseUrl).port || "3100");
const startupTimeoutMs = Number(process.env.TEST_API_STARTUP_TIMEOUT_MS ?? 30_000);
const requestTimeoutMs = Number(process.env.TEST_API_REQUEST_TIMEOUT_MS ?? 10_000);
const suiteTimeoutMs = Number(process.env.TEST_API_SUITE_TIMEOUT_MS ?? 90_000);
function localError(message: string): Error {
  return new Error(`BLOCKED: ${message}`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function killTree(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid) return Promise.resolve();
  const pid = child.pid;
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("close", () => resolve());
      killer.once("error", () => resolve());
    } else {
      try { process.kill(-pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      const timer = setTimeout(() => { try { process.kill(-pid, "SIGKILL"); } catch { /* already exited */ } }, 2_000);
      child.once("close", () => { clearTimeout(timer); resolve(); });
      child.once("error", () => { clearTimeout(timer); resolve(); });
    }
  });
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) });
}

class CookieJar {
  private readonly values = new Map<string, string>();
  absorb(response: Response) {
    for (const value of response.headers.getSetCookie?.() ?? []) {
      const [pair] = value.split(";", 1);
      const separator = pair.indexOf("=");
      if (separator > 0) this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join("; "); }
}

async function authenticatedRequest(url: string, jar: CookieJar, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = jar.header();
  if (cookie) headers.set("cookie", cookie);
  return request(url, { ...init, headers });
}

async function login(baseUrl: string, email: string): Promise<CookieJar> {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) throw localError("E2E_TEST_USER_PASSWORD is required for HTTP session tests.");
  const jar = new CookieJar();
  const response = await request(`${baseUrl}/api/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  jar.absorb(response);
  assert.equal(response.status, 200, `${email} HTTP login must succeed`);
  assert.ok(jar.header(), `${email} login must set an SSR auth cookie`);
  return jar;
}

async function waitFor(url: string, child: ChildProcess): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < startupTimeoutMs) {
    if (child.exitCode !== null) throw new Error(`Next server exited with ${child.exitCode}`);
    try { await request(url); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  assertLocalTestEnv({ supabase: true, database: true, migration: true, anon: true, password: true, api: true });
  if (!existsSync(resolve(".next", "BUILD_ID"))) throw localError("Build the app before starting the API integration server.");
  const sql = postgres(process.env.MIGRATION_DATABASE_URL!, { max: 1 });
  const runId = randomUUID();
  const apiTitle = `M6.2 API ${runId}`;
  async function cleanup() {
    await sql`delete from public.evaluation_scores where evaluation_id in (select id from public.evaluations where evidence_id in (select id from public.evidences where student_id = 'student-a'))`;
    await sql`delete from public.evaluations where evidence_id in (select id from public.evidences where student_id = 'student-a')`;
    await sql`delete from public.evidences where student_id = 'student-a'`;
    await sql`delete from public.activity_responses where student_id = 'student-a'`;
    await sql`delete from public.student_activity_progress where student_id = 'student-a'`;
    await sql`delete from public.credentials where title like 'M6.2 API %'`;
  }
  let child: ChildProcess | undefined;
  try {
    await cleanup();
    if (!process.env.TEST_API_BASE_URL) {
      const command = process.execPath;
      const args = [resolve("node_modules/next/dist/bin/next"), "start", "-p", port];
      child = spawn(command, args, {
        stdio: "inherit", shell: false, detached: process.platform !== "win32", windowsHide: true,
        env: { ...process.env, NODE_ENV: "test" },
      });
      await waitFor(`${baseUrl}/api/health`, child);
    }
    await withTimeout((async () => {
      const unauth = await request(`${baseUrl}/api/classrooms`);
      assert.equal(unauth.status, 401, "unauthenticated classroom access must be rejected");
      const health = await request(`${baseUrl}/api/health`);
      assert.ok([200, 503].includes(health.status), "health must be a real HTTP response");
      const teacherJar = await login(baseUrl, "teacher.a@test.local");
      const teacherBJar = await login(baseUrl, "teacher.b@test.local");
      const studentJar = await login(baseUrl, "student.a@test.local");
      const studentBJar = await login(baseUrl, "student.b@test.local");
      assert.equal((await authenticatedRequest(`${baseUrl}/api/classrooms`, studentJar)).status, 403);
      assert.equal((await authenticatedRequest(`${baseUrl}/api/classrooms`, teacherJar)).status, 200);

      const evidenceList = await authenticatedRequest(`${baseUrl}/api/student/evidence`, studentJar);
      assert.equal(evidenceList.status, 200);
      const listed = await evidenceList.json() as { evidences?: Array<{ id: string; activityId: string; status: string }> };
      let evidenceId = listed.evidences?.find((item) => item.activityId === "activity-a" && item.status === "draft")?.id;
      if (!evidenceId) {
        const draft = await authenticatedRequest(`${baseUrl}/api/student/evidence`, studentJar, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ activityId: "activity-a", title: apiTitle, evidenceType: "text", textContent: "local test" }),
        });
        assert.equal(draft.status, 201, "student evidence create must use the real route");
        evidenceId = (await draft.json() as { evidence?: { id: string } }).evidence?.id;
      }
      assert.ok(evidenceId, "student evidence id must be returned");
      const patch = await authenticatedRequest(`${baseUrl}/api/student/evidence/${evidenceId}`, studentJar, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "API fixture patched", textContent: "patched local test" }),
      });
      assert.equal(patch.status, 200, "draft evidence patch must succeed");
      assert.equal((await authenticatedRequest(`${baseUrl}/api/student/evidence/${evidenceId}/submit`, studentJar, { method: "POST" })).status, 200);
      const submitted = await authenticatedRequest(`${baseUrl}/api/student/evidence/${evidenceId}`, studentJar);
      assert.equal(submitted.status, 200);
      assert.equal((await submitted.json() as { evidence?: { status?: string } }).evidence?.status, "submitted", "submitted evidence must be readable after submit");
      assert.equal((await authenticatedRequest(`${baseUrl}/api/student/evidence/${evidenceId}`, studentJar, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "must remain immutable" }),
      })).status, 409, "submitted evidence must be immutable");
      const studentBView = await authenticatedRequest(`${baseUrl}/api/student/evidence/${evidenceId}`, studentBJar);
      assert.equal(studentBView.status, 404, "Student B cannot read Student A evidence over HTTP");

      const evaluation = await authenticatedRequest(`${baseUrl}/api/evaluations`, teacherJar, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceId, rubricId: "rubric-a", score: 4, feedback: "API evaluation", scores: [{ criterionId: "criterion-a", score: 4 }] }),
      });
      assert.equal(evaluation.status, 201, "teacher evaluation must be newly created");
      const evaluationId = (await evaluation.json() as { evaluation?: { id?: string } }).evaluation?.id;
      assert.ok(evaluationId);
      const evaluationRow = await sql`select id, evidence_id from public.evaluations where id = ${evaluationId}`;
      assert.equal(evaluationRow.length, 1, "evaluation must be persisted in local DB");
      assert.equal(evaluationRow[0].evidence_id, evidenceId);
      const credential = await authenticatedRequest(`${baseUrl}/api/credentials`, teacherJar, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId: "student-a", classroomId: "class-a", title: apiTitle, achievement: "API flow" }),
      });
      assert.equal(credential.status, 201, "teacher credential must be newly issued");
      const credentialId = (await credential.json() as { credential?: { id?: string } }).credential?.id;
      assert.ok(credentialId);
      const credentialRow = await sql`select id, title, student_id from public.credentials where id = ${credentialId}`;
      assert.equal(credentialRow.length, 1, "credential must be persisted in local DB");
      assert.equal(credentialRow[0].title, apiTitle);
      const teacherBInbox = await authenticatedRequest(`${baseUrl}/api/evidence?status=submitted`, teacherBJar);
      assert.equal(teacherBInbox.status, 200, "Teacher B inbox must be reachable");
      const teacherBInboxBody = await teacherBInbox.json() as { evidences?: Array<{ id: string }> };
      assert.ok(!teacherBInboxBody.evidences?.some((item) => item.id === evidenceId), "Teacher B must not see Teacher A evidence");
      assert.equal((await authenticatedRequest(`${baseUrl}/api/evaluations`, teacherBJar, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidenceId, score: 2 }),
      })).status, 404, "Teacher B cannot evaluate Teacher A evidence");
      assert.equal((await authenticatedRequest(`${baseUrl}/api/credentials`, teacherBJar, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId: "student-a", classroomId: "class-a", title: "cross tenant", achievement: "must fail" }),
      })).status, 403, "Teacher B cannot issue credentials in Teacher A classroom");
      console.log("API HTTP harness PASS: cookie login, 401/403, evidence lifecycle, evaluation 201/readback, credential 201/readback and cross-tenant isolation.");
    })(), suiteTimeoutMs, "API suite");
  } finally {
    await killTree(child);
    await cleanup();
    await sql.end();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "API harness failed"); process.exitCode = error instanceof Error && error.message.startsWith("BLOCKED:") ? 2 : 1; });

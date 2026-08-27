import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const env = (name: string) => process.env[name] ?? "";
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "M4_STUDENT_A_EMAIL", "M4_STUDENT_A_PASSWORD", "M4_STUDENT_B_EMAIL", "M4_STUDENT_B_PASSWORD", "M4_TEACHER_EMAIL", "M4_TEACHER_PASSWORD", "M4_APP_URL"];
const missing = required.filter((name) => !env(name));
if (missing.length) throw new Error(`Missing live verification variables: ${missing.join(", ")}`);

const base = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const client = () => createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: base });

async function login(email: string, password: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error("Supabase login failed.");
  return { supabase, user: data.user };
}

const studentA = await login(env("M4_STUDENT_A_EMAIL"), env("M4_STUDENT_A_PASSWORD"));
const studentB = await login(env("M4_STUDENT_B_EMAIL"), env("M4_STUDENT_B_PASSWORD"));
const teacher = await login(env("M4_TEACHER_EMAIL"), env("M4_TEACHER_PASSWORD"));

async function ownProfile(session: typeof studentA, role: string) {
  const { data, error } = await session.supabase.from("profiles").select("id, role").eq("id", session.user.id).single();
  if (error || data?.id !== session.user.id || data.role !== role) throw new Error(`Profile/role verification failed for ${role}.`);
}
await ownProfile(studentA, "student");
await ownProfile(studentB, "student");
await ownProfile(teacher, "teacher");

const foreignProfile = await studentA.supabase.from("profiles").select("id").eq("id", studentB.user.id);
if (foreignProfile.error || foreignProfile.data.length) throw new Error("Student profile isolation failed.");

const escalation = await studentA.supabase.from("profiles").update({ role: "admin" }).eq("id", studentA.user.id).select("role");
if (!escalation.error && escalation.data.length) throw new Error("Role escalation was accepted.");

const health = await fetch(`${env("M4_APP_URL").replace(/\/$/, "")}/api/health`, { cache: "no-store" });
const healthBody = await health.json().catch(() => ({})) as { status?: string; database?: string };
if (!health.ok || healthBody.status !== "ok" || healthBody.database !== "connected") throw new Error("Application health check failed.");

console.log("Live Supabase verification passed: student profiles isolated, roles verified, escalation denied, health connected.");

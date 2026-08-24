import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const teacherPassword = process.env.SEED_TEACHER_PASSWORD;
const studentPassword = process.env.SEED_STUDENT_PASSWORD;

if (!url || !serviceRoleKey || !teacherPassword || !studentPassword) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_TEACHER_PASSWORD and SEED_STUDENT_PASSWORD are required.");
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function createDemoUser(email: string, password: string, displayName: string, role: "teacher" | "student") {
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (error || !data.user) throw new Error(`Could not create ${email}: ${error?.message ?? "unknown error"}`);
  if (role === "teacher") {
    const { error: profileError } = await supabase.from("profiles").update({ role }).eq("id", data.user.id);
    if (profileError) throw new Error(`Could not assign teacher role: ${profileError.message}`);
  }
}

await createDemoUser("teacher.demo@example.test", teacherPassword, "Teacher Demo", "teacher");
await createDemoUser("student.demo@example.test", studentPassword, "Student Demo", "student");
console.log("Supabase demo users created.");

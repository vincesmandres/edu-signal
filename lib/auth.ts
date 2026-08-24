import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { profiles } from "../db/schema";
import { createClient } from "./supabase/server";

export const ROLES = ["teacher", "student", "coordinator", "admin"] as const;
export type Role = (typeof ROLES)[number];
export type Profile = typeof profiles.$inferSelect;

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = await getDb().select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return rows[0] ?? null;
}

export async function requireUser(returnTo = "/") {
  const profile = await getCurrentProfile();
  if (profile) return profile;
  redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
}

export async function requireRole(roles: Role | Role[], returnTo = "/") {
  const profile = await requireUser(returnTo);
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.includes(profile.role as Role)) return profile;
  redirect(profile.role === "student" ? "/student" : "/forbidden");
}

export async function getApiProfile(roles?: Role | Role[]) {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, status: 401 as const };
  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(profile.role as Role)) return { profile: null, status: 403 as const };
  }
  return { profile, status: 200 as const };
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

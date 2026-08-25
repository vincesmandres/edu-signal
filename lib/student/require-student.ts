import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { students } from "../../db/schema";
import { requireRole } from "../auth";

export async function requireStudent(returnTo = "/student") {
  const profile = await requireRole("student", returnTo);
  const student = (await getDb().select().from(students).where(eq(students.profileId, profile.id)).limit(1))[0];
  if (!student) notFound();
  return { profile, student };
}

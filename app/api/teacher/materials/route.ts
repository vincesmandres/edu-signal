import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { curriculumGenerations, teacherMaterials } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { extractSafeMaterialText, safeMaterialFilename, validateTeacherMaterial } from "@/lib/materials";
import { requireTeacherClassroom } from "@/lib/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/app/audit";

const BUCKET = "teacher-materials";

export async function GET() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const materials = await getDb().select({ id: teacherMaterials.id, classroomId: teacherMaterials.classroomId, generationId: teacherMaterials.generationId, fileName: teacherMaterials.fileName, mimeType: teacherMaterials.mimeType, fileSize: teacherMaterials.fileSize, extractionStatus: teacherMaterials.extractionStatus, createdAt: teacherMaterials.createdAt }).from(teacherMaterials).where(eq(teacherMaterials.teacherId, auth.profile.id)).orderBy(desc(teacherMaterials.createdAt));
  return Response.json({ materials }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "Invalid form data." }, { status: 400 }); }
  const file = form.get("file"); const classroomId = String(form.get("classroomId") || "") || null; const generationId = String(form.get("generationId") || "") || null;
  if (!(file instanceof File) || (!classroomId && !generationId)) return Response.json({ error: "File and classroom or generation are required." }, { status: 422 });
  const validation = validateTeacherMaterial(file); if (validation) return Response.json({ error: validation }, { status: 422 });
  if (classroomId && !(await requireTeacherClassroom(auth.profile.id, classroomId))) return Response.json({ error: "Classroom not found." }, { status: 404 });
  if (generationId) {
    const owned = (await getDb().select({ id: curriculumGenerations.id }).from(curriculumGenerations).where(and(eq(curriculumGenerations.id, generationId), eq(curriculumGenerations.teacherId, auth.profile.id))).limit(1))[0];
    if (!owned) return Response.json({ error: "Generation not found." }, { status: 404 });
  }
  const id = crypto.randomUUID(); const fileName = safeMaterialFilename(file.name); const storageKey = `${auth.profile.id}/${id}/${fileName}`;
  await getDb().insert(teacherMaterials).values({ id, teacherId: auth.profile.id, classroomId, generationId, storageKey, fileName, mimeType: file.type, fileSize: file.size, extractionStatus: "processing" });
  try {
    const { error } = await createAdminClient().storage.from(BUCKET).upload(storageKey, file, { contentType: file.type, upsert: false });
    if (error) throw new Error("upload");
    const extraction = await extractSafeMaterialText(file);
    await getDb().update(teacherMaterials).set({ extractionStatus: extraction.status, extractedText: extraction.text, updatedAt: new Date().toISOString() }).where(eq(teacherMaterials.id, id));
    await recordAudit({ actorId: auth.profile.id, action: "teacher_material.uploaded", entityType: "teacher_material", entityId: id, metadata: { mimeType: file.type, fileSize: file.size } });
    return Response.json({ material: { id, classroomId, generationId, fileName, mimeType: file.type, fileSize: file.size, extractionStatus: extraction.status } }, { status: 201 });
  } catch {
    await getDb().update(teacherMaterials).set({ extractionStatus: "failed", updatedAt: new Date().toISOString() }).where(eq(teacherMaterials.id, id));
    return Response.json({ error: "Material upload or extraction failed." }, { status: 500 });
  }
}

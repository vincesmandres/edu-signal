import { createAdminClient } from "../supabase/admin";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { evidences } from "../../db/schema";

const BUCKET = "evidence";

export async function uploadEvidenceFile(input: {
  path: string;
  file: File;
  contentType: string;
}) {
  const { error } = await createAdminClient().storage.from(BUCKET).upload(input.path, input.file, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) throw new Error(`Evidence storage upload failed: ${error.message}`);
  return input.path;
}

export async function deleteEvidenceFile(path: string) {
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Evidence storage delete failed: ${error.message}`);
}

export async function createEvidenceDownloadUrl(path: string) {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw new Error(`Evidence download URL failed: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

export async function cleanupEvidenceFileIfUnreferenced(path: string) {
  try {
    const references = await getDb().select({ id: evidences.id }).from(evidences).where(eq(evidences.storageKey, path)).limit(1);
    if (references.length) return { deleted: false, referenced: true };
    await deleteEvidenceFile(path);
    return { deleted: true, referenced: false };
  } catch {
    console.error("evidence_storage_cleanup_failed", { operation: "delete_unreferenced", resource: "evidence" });
    return { deleted: false, referenced: false };
  }
}

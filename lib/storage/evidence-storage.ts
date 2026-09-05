import { createAdminClient } from "../supabase/admin";

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

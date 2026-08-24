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

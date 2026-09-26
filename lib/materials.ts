import { redactForAi } from "@/lib/ai/safety";

const MATERIAL_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function safeMaterialFilename(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "teacher-material";
}

export function validateTeacherMaterial(file: File) {
  if (!file.size || file.size > 20 * 1024 * 1024) return "File size must be between 1 byte and 20 MiB.";
  if (!MATERIAL_TYPES.has(file.type)) return "Unsupported material type.";
  return null;
}

export async function extractSafeMaterialText(file: File) {
  if (file.type !== "text/plain") return { status: "not_supported" as const, text: null };
  const text = await file.text();
  return { status: "completed" as const, text: redactForAi(text.slice(0, 100_000)) };
}

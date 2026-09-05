export const EVIDENCE_TYPES = ["text", "file", "link"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;
export const EVIDENCE_SIGNED_URL_TTL = 120;

export const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const EXTENSIONS: Record<string, string[]> = {
  "application/pdf": ["pdf"], "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"],
  "text/plain": ["txt"], "text/csv": ["csv"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
};

export function validateEvidenceType(value: unknown): value is EvidenceType {
  return typeof value === "string" && (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export function validateExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

export function safeEvidenceFilename(input: string): string {
  const base = input.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
  return base || "evidence-file";
}

export function validateEvidenceFile(file: File): string | null {
  if (file.size === 0) return "El archivo no puede estar vacío.";
  if (file.size > MAX_EVIDENCE_FILE_SIZE) return "El archivo no puede superar 10 MB.";
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.type)) return "Tipo de archivo no permitido.";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS[file.type]?.includes(extension)) return "La extensión no coincide con el tipo de archivo.";
  return null;
}

export function validateEvidenceContent(input: { evidenceType: unknown; textContent?: unknown; externalUrl?: unknown; storageKey?: unknown }) {
  if (!validateEvidenceType(input.evidenceType)) return "Tipo de evidencia no válido.";
  if (input.evidenceType === "text" && (typeof input.textContent !== "string" || !input.textContent.trim())) return "El texto de la evidencia es obligatorio.";
  if (input.evidenceType === "link" && !validateExternalUrl(input.externalUrl)) return "La URL debe ser HTTPS válida.";
  if (input.evidenceType === "file" && (typeof input.storageKey !== "string" || !input.storageKey.trim())) return "Debes subir un archivo antes de enviar.";
  return null;
}

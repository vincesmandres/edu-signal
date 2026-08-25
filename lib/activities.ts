export const ACTIVITY_TYPES = ["instruction", "question", "prediction", "simulation", "external_link", "reflection", "reading"] as const;
export const ACTIVITY_STATUSES = ["draft", "published", "archived"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function validateActivityConfig(type: string, config: unknown): { ok: true; config: Record<string, unknown> } | { ok: false; error: string } {
  if (!ACTIVITY_TYPES.includes(type as ActivityType)) return { ok: false, error: "Tipo de actividad no válido." };
  if (!config || typeof config !== "object" || Array.isArray(config)) return { ok: false, error: "La configuración no es válida." };
  const value = config as Record<string, unknown>;
  if (["instruction", "reading"].includes(type) && typeof value.content !== "string") return { ok: false, error: "La actividad necesita contenido." };
  if (["question", "prediction", "reflection"].includes(type) && typeof value.prompt !== "string") return { ok: false, error: "La actividad necesita una pregunta." };
  if (type === "question" && !["short_text", "long_text"].includes(String(value.responseType ?? "long_text"))) return { ok: false, error: "Tipo de respuesta no válido." };
  if (type === "external_link" && (!isHttpsUrl(value.url) || typeof value.label !== "string")) return { ok: false, error: "El recurso necesita una URL HTTPS y una etiqueta." };
  if (type === "simulation" && (!isHttpsUrl(value.url) || !["phet", "external"].includes(String(value.provider)))) return { ok: false, error: "La simulación necesita un proveedor y una URL HTTPS." };
  return { ok: true, config: value };
}

export function requiresResponse(type: string) {
  return ["question", "prediction", "reflection"].includes(type);
}

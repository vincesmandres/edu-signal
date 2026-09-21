import type { evidences } from "../db/schema";

type Evidence = typeof evidences.$inferSelect;

export function toEvidenceDto(evidence: Evidence) {
  const { storageKey, ...safe } = evidence;
  if (storageKey) { /* intentionally omitted from public DTO */ }
  return safe;
}

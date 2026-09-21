export type EvaluationScoreInput = { criterionId?: unknown; score?: unknown; feedback?: unknown };

function parseScore(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateEvaluationScores(scores: EvaluationScoreInput[], criteria: Array<{ id: string; maxScore: string }>) {
  const expected = new Map(criteria.map((criterion) => [criterion.id, parseScore(criterion.maxScore)]));
  const seen = new Set<string>();
  for (const item of scores) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "Cada criterio debe ser un objeto válido.";
    if (typeof item.criterionId !== "string" || !item.criterionId.trim() || seen.has(item.criterionId)) return "Los criterios son inválidos o están duplicados.";
    const max = expected.get(item.criterionId);
    const score = parseScore(item.score);
    if (max === undefined || max === null || score === null || score < 0 || score > max) return "Cada puntuación debe pertenecer a la rúbrica y estar dentro de su rango.";
    seen.add(item.criterionId);
  }
  if (criteria.length && seen.size !== criteria.length) return "Debes puntuar todos los criterios de la rúbrica.";
  return null;
}

export function validateGlobalScore(score: unknown) {
  if (score === undefined || score === null) return null;
  const value = parseScore(score);
  return value === null || value < 0 || value > 100 ? "La puntuación global debe ser un número entre 0 y 100." : null;
}

import type { z } from "zod";
import { gradeScaleSchema } from "@/lib/ai/contracts";

export type GradeScale = z.infer<typeof gradeScaleSchema>;

export function normalizeGrade(rawValue: number, scale: GradeScale) {
  const parsed = gradeScaleSchema.parse(scale);
  if (!Number.isFinite(rawValue) || rawValue < parsed.min || rawValue > parsed.max) throw new Error("grade_out_of_range");
  return Math.round(((rawValue - parsed.min) / (parsed.max - parsed.min)) * 10_000) / 100;
}

export function denormalizeGrade(normalizedPercentage: number, scale: GradeScale) {
  const parsed = gradeScaleSchema.parse(scale);
  if (!Number.isFinite(normalizedPercentage) || normalizedPercentage < 0 || normalizedPercentage > 100) throw new Error("grade_out_of_range");
  return Math.round((parsed.min + (normalizedPercentage / 100) * (parsed.max - parsed.min)) * 100) / 100;
}

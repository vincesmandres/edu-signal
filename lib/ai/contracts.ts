import { z } from "zod";

const nonEmptyText = z.string().trim().min(1).max(8_000);
const shortText = z.string().trim().min(1).max(500);
const safeHttpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Only HTTPS URLs are allowed");

export const generationInputSchema = z.object({
  topic: shortText,
  educationLevel: shortText,
  durationMinutes: z.number().int().min(30).max(20_000),
  country: z.string().trim().max(100).optional(),
  framework: z.string().trim().max(200).optional(),
  methodology: z.string().trim().max(500).optional(),
  learningGoals: z.array(shortText).max(20).default([]),
  learnerContext: z.string().trim().max(4_000).optional(),
  materialReferences: z.array(z.string().min(1).max(200)).max(20).default([]),
}).strict();

export const inquiryStageKindSchema = z.enum([
  "prediction",
  "interpretations",
  "evidence_contrast",
  "alternative_critique",
  "revised_synthesis",
  "self_assessment",
]);

export const inquiryStageSchema = z.object({
  kind: inquiryStageKindSchema,
  title: shortText,
  prompt: nonEmptyText,
  required: z.literal(true),
}).strict();

const requiredStageOrder = inquiryStageKindSchema.options;

export const inquiryCycleConfigSchema = z.object({
  objective: nonEmptyText,
  estimatedMinutes: z.number().int().min(10).max(600),
  stages: z.array(inquiryStageSchema).length(requiredStageOrder.length),
  citationRequired: z.boolean().default(true),
  requiredResourceIds: z.array(z.string().min(1).max(200)).max(20).default([]),
  aiDisclosureRequired: z.boolean().default(true),
  maximumRevisions: z.number().int().min(0).max(2).default(2),
  alternativeAnswer: nonEmptyText,
}).strict().superRefine((value, context) => {
  value.stages.forEach((stage, index) => {
    if (stage.kind !== requiredStageOrder[index]) {
      context.addIssue({ code: "custom", path: ["stages", index, "kind"], message: `Expected ${requiredStageOrder[index]}` });
    }
  });
});

export const rubricCriterionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: shortText,
  description: nonEmptyText,
  maxScore: z.number().int().min(1).max(100),
  descriptors: z.array(z.object({
    level: z.number().int().min(0).max(100),
    description: nonEmptyText,
  }).strict()).min(2).max(10),
}).strict();

export const rubricSchema = z.object({
  title: shortText,
  description: z.string().trim().max(2_000).default(""),
  criteria: z.array(rubricCriterionSchema).min(2).max(12),
}).strict().superRefine((value, context) => {
  const ids = value.criteria.map((criterion) => criterion.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["criteria"], message: "Criterion IDs must be unique" });
  }
});

export const verifiedResourceSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: shortText,
  provider: shortText,
  url: safeHttpsUrl.nullable(),
  verificationState: z.enum(["verified", "unverified"]),
  suggestion: nonEmptyText,
}).strict().superRefine((value, context) => {
  if (value.verificationState === "verified" && !value.url) {
    context.addIssue({ code: "custom", path: ["url"], message: "Verified resources require a URL" });
  }
  if (value.verificationState === "unverified" && value.url) {
    context.addIssue({ code: "custom", path: ["url"], message: "Unverified resources cannot expose a URL" });
  }
});

export const curriculumActivitySchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: shortText,
  instructions: nonEmptyText,
  position: z.number().int().min(1).max(100),
  estimatedMinutes: z.number().int().min(5).max(600),
  requiresEvidence: z.boolean(),
  config: inquiryCycleConfigSchema,
  rubricCriterionIds: z.array(z.string().min(1).max(100)).min(1),
  checkpoint: z.enum(["diagnostic", "formative", "summative"]),
}).strict();

export const curriculumDraftSchema = z.object({
  classroom: z.object({
    title: shortText,
    subject: shortText,
    academicPeriod: shortText,
  }).strict(),
  module: z.object({
    title: shortText,
    drivingQuestion: nonEmptyText,
    rationale: nonEmptyText,
    objectives: z.array(shortText).min(1).max(20),
    standards: z.array(z.object({ code: shortText, description: nonEmptyText, citation: safeHttpsUrl.nullable() }).strict()).max(20),
  }).strict(),
  activities: z.array(curriculumActivitySchema).min(1).max(40),
  rubric: rubricSchema,
  resources: z.array(verifiedResourceSchema).max(30),
  differentiation: z.array(nonEmptyText).min(1).max(20),
  accessibility: z.array(nonEmptyText).min(1).max(20),
  warnings: z.array(nonEmptyText).max(20),
  assumptions: z.array(nonEmptyText).max(20),
}).strict().superRefine((value, context) => {
  const positions = value.activities.map((activity) => activity.position);
  if (new Set(positions).size !== positions.length || [...positions].sort((a, b) => a - b).some((position, index) => position !== index + 1)) {
    context.addIssue({ code: "custom", path: ["activities"], message: "Activity positions must be unique and contiguous" });
  }
  const criterionIds = new Set(value.rubric.criteria.map((criterion) => criterion.id));
  const resourceIds = new Set(value.resources.filter((resource) => resource.verificationState === "verified").map((resource) => resource.id));
  value.activities.forEach((activity, index) => {
    activity.rubricCriterionIds.forEach((id) => {
      if (!criterionIds.has(id)) context.addIssue({ code: "custom", path: ["activities", index, "rubricCriterionIds"], message: `Unknown criterion ${id}` });
    });
    activity.config.requiredResourceIds.forEach((id) => {
      if (!resourceIds.has(id)) context.addIssue({ code: "custom", path: ["activities", index, "config", "requiredResourceIds"], message: `Required resource ${id} is not verified` });
    });
  });
}).refine((value) => value.activities.reduce((total, activity) => total + activity.estimatedMinutes, 0) > 0, "Activities require a positive duration");

export const aiUseDeclarationSchema = z.discriminatedUnion("used", [
  z.object({ used: z.literal(false) }).strict(),
  z.object({
    used: z.literal(true),
    tool: shortText,
    purpose: nonEmptyText,
    importantSuggestion: nonEmptyText,
    acceptedOrRejected: nonEmptyText,
    reasoning: nonEmptyText,
  }).strict(),
]);

export const inquiryResponseSchema = z.object({
  prediction: nonEmptyText,
  interpretations: z.tuple([
    z.object({ interpretation: nonEmptyText, assumptions: nonEmptyText }).strict(),
    z.object({ interpretation: nonEmptyText, assumptions: nonEmptyText }).strict(),
  ]).refine(([first, second]) => first.interpretation.trim().toLowerCase() !== second.interpretation.trim().toLowerCase(), "Interpretations must be distinct"),
  evidenceContrast: z.array(z.object({
    source: nonEmptyText,
    citation: nonEmptyText,
    relationship: z.enum(["supports", "contradicts", "complicates"]),
    explanation: nonEmptyText,
  }).strict()).min(1).max(10),
  alternativeCritique: nonEmptyText,
  revisedSynthesis: nonEmptyText,
  changeFromPrediction: nonEmptyText,
  aiUse: aiUseDeclarationSchema,
}).strict();

export const inquiryResponseDraftSchema = inquiryResponseSchema.partial();

export const selfAssessmentSchema = z.object({
  confidence: z.number().int().min(1).max(5),
  rationale: nonEmptyText,
  criteria: z.array(z.object({
    criterionId: z.string().min(1).max(100),
    score: z.number().min(0).max(100),
    rationale: nonEmptyText,
  }).strict()).min(1).max(20),
}).strict();

export const formativeFeedbackSchema = z.object({
  strengths: z.array(nonEmptyText).min(1).max(5),
  gaps: z.array(nonEmptyText).max(5),
  contradictions: z.array(nonEmptyText).max(5),
  improvementStatements: z.array(nonEmptyText).min(1).max(5),
  socraticQuestions: z.array(nonEmptyText).min(2).max(3),
  nextAction: nonEmptyText,
  proposedScores: z.array(z.object({
    criterionId: z.string().min(1).max(100),
    score: z.number().min(0).max(100),
    rationale: nonEmptyText,
  }).strict()).max(20),
}).strict();

export const gradeScaleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.enum(["numeric_5", "numeric_10", "numeric_100"]), min: z.number(), max: z.number(), passThreshold: z.number() }).strict(),
  z.object({ type: z.literal("rubric_levels"), min: z.number(), max: z.number(), passThreshold: z.number(), levels: z.array(shortText).min(2).max(10) }).strict(),
]).superRefine((value, context) => {
  if (value.max <= value.min || value.passThreshold < value.min || value.passThreshold > value.max) {
    context.addIssue({ code: "custom", message: "Invalid grade scale range" });
  }
});

export type GenerationInput = z.infer<typeof generationInputSchema>;
export type CurriculumDraft = z.infer<typeof curriculumDraftSchema>;
export type InquiryCycleConfig = z.infer<typeof inquiryCycleConfigSchema>;
export type InquiryResponse = z.infer<typeof inquiryResponseSchema>;
export type SelfAssessment = z.infer<typeof selfAssessmentSchema>;
export type FormativeFeedback = z.infer<typeof formativeFeedbackSchema>;

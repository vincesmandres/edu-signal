import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { aiUsageRecords } from "@/db/schema";
import type { AiUsage } from "@/lib/ai/provider";

export class AiQuotaError extends Error {
  constructor(public readonly retryAt: string) {
    super("rate_limited");
  }
}

export async function assertAiQuota(actorProfileId: string, feature: "curriculum" | "feedback", role: "teacher" | "student") {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const [daily] = await getDb().select({ total: sql<number>`coalesce(sum(${aiUsageRecords.totalTokens}), 0)::int` }).from(aiUsageRecords)
    .where(and(eq(aiUsageRecords.actorProfileId, actorProfileId), eq(aiUsageRecords.requestDate, day)));
  const dailyLimit = Number(role === "teacher" ? process.env.AI_TEACHER_DAILY_TOKEN_LIMIT || 250_000 : process.env.AI_STUDENT_DAILY_TOKEN_LIMIT || 50_000);
  if (Number(daily?.total || 0) >= dailyLimit) {
    const tomorrow = new Date(`${day}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    throw new AiQuotaError(tomorrow.toISOString());
  }
  const [recent] = await getDb().select({ count: sql<number>`count(*)::int` }).from(aiUsageRecords)
    .where(and(eq(aiUsageRecords.actorProfileId, actorProfileId), eq(aiUsageRecords.feature, feature), gte(aiUsageRecords.createdAt, minuteAgo)));
  if (Number(recent?.count || 0) >= 5) throw new AiQuotaError(new Date(now.getTime() + 60_000).toISOString());
}

export async function recordAiUsage(actorProfileId: string, feature: "curriculum" | "feedback", usage: AiUsage) {
  await getDb().insert(aiUsageRecords).values({
    id: crypto.randomUUID(),
    actorProfileId,
    feature,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    requestDate: new Date().toISOString().slice(0, 10),
  });
}

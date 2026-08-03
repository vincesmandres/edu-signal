import { getDb } from "../db";
import { auditEvents } from "../db/schema";

export async function recordAudit(input: { actorId: string; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }) {
  try {
    await getDb().insert(auditEvents).values({ id: crypto.randomUUID(), actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId, metadata: input.metadata ? JSON.stringify(input.metadata) : null });
  } catch (error) {
    console.error("audit_write_failed", error);
  }
}

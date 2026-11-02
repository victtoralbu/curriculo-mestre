import { randomUUID } from 'crypto';
import { db, DbClient } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface AuditLogInput {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(
  input: AuditLogInput,
  tx?: DbClient
): Promise<string> {
  const id = randomUUID();
  const client = tx || db;
  await client.query(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity, entity_id, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
    [
      id,
      input.actorUserId || null,
      input.action,
      input.entity,
      input.entityId || null,
      JSON.stringify(input.metadata || {}),
    ]
  );
  logger.info(`AUDIT:${input.action}`, {
    entity: input.entity,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
  });
  return id;
}

import { randomUUID } from 'crypto';
import { db, DbClient } from '@/lib/db';
import {
  CommercialSettings,
  DEFAULT_COMMERCIAL_SETTINGS,
} from '@/config/env';
import { recordAuditLog } from './audit.service';

export async function getCommercialSettings(
  tx?: DbClient
): Promise<CommercialSettings> {
  const client = tx || db;
  const res = await client.query<{ value: Partial<CommercialSettings> }>(
    `SELECT value FROM system_settings WHERE key = 'commercial_settings' LIMIT 1`
  );
  if (res.rows.length === 0 || !res.rows[0].value) {
    return { ...DEFAULT_COMMERCIAL_SETTINGS };
  }
  return {
    ...DEFAULT_COMMERCIAL_SETTINGS,
    ...res.rows[0].value,
  };
}

export async function updateCommercialSettings(
  adminUserId: string,
  partial: Partial<CommercialSettings>
): Promise<CommercialSettings> {
  return db.transaction(async (tx) => {
    const current = await getCommercialSettings(tx);
    const updated: CommercialSettings = {
      ...current,
      ...partial,
    };

    await tx.query(
      `INSERT INTO system_settings (id, key, value, updated_at)
       VALUES ($1, 'commercial_settings', $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [randomUUID(), JSON.stringify(updated)]
    );

    await recordAuditLog(
      {
        actorUserId: adminUserId,
        action: 'UPDATE_COMMERCIAL_SETTINGS',
        entity: 'system_settings',
        entityId: 'commercial_settings',
        metadata: { previous: current, updated },
      },
      tx
    );

    return updated;
  });
}

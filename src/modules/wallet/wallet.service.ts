import { randomUUID } from 'crypto';
import { db, DbClient } from '@/lib/db';
import { getMonthlyCycleKey } from '@/lib/utils';
import { getCommercialSettings } from '@/modules/administration/settings.service';

export interface WalletOverview {
  walletId: string;
  balanceCents: number;
  promotionalCreditsRemaining: number;
  extendedAccessUntil: string | null;
  currentCycleKey: string;
  monthlyContributionActive: boolean;
  usedInCurrentCycle: number;
  freeQuotaRemaining: number;
  monthlyContributionQuotaRemaining: number;
  activePendingDebtsCount: number;
  activePendingDebtsCents: number;
  overdueDebtsCount: number;
  overdueDebtsCents: number;
  trustCreditsRemaining: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    reference_type: string | null;
    reference_id: string | null;
    created_at: string;
  }>;
  debts: Array<{
    id: string;
    application_id: string | null;
    amount: number;
    remaining_amount: number;
    status: string;
    created_at: string;
    due_at: string;
    settled_at: string | null;
    isOverdue: boolean;
  }>;
}

export async function ensureUserWallet(
  userId: string,
  tx?: DbClient
): Promise<{ id: string; balance: number }> {
  const client = tx || db;
  const existing = await client.query<{ id: string; balance: number }>(
    `SELECT id, balance FROM wallets WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
     VALUES ($1, $2, 0, NOW(), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [id, userId]
  );
  const reloaded = await client.query<{ id: string; balance: number }>(
    `SELECT id, balance FROM wallets WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return reloaded.rows[0];
}

export async function getWalletOverview(
  userId: string,
  referenceDate: Date = new Date()
): Promise<WalletOverview> {
  const settings = await getCommercialSettings();
  const wallet = await ensureUserWallet(userId);
  const cycleKey = getMonthlyCycleKey(referenceDate);

  const userRes = await db.query<{
    monthly_contribution_cycle: string | null;
    extended_access_until: string | null;
  }>(
    `SELECT monthly_contribution_cycle, extended_access_until FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const userRow = userRes.rows[0] || {
    monthly_contribution_cycle: null,
    extended_access_until: null,
  };

  // Créditos promocionais válidos
  const promoRes = await db.query<{ total: string | number | null }>(
    `SELECT COALESCE(SUM(remaining_amount), 0) AS total
     FROM promotional_credits
     WHERE user_id = $1
       AND remaining_amount > 0
       AND (expires_at IS NULL OR expires_at > $2)`,
    [userId, referenceDate.toISOString()]
  );
  const promotionalCreditsRemaining = Number(promoRes.rows[0]?.total || 0);

  // Uso no ciclo mensal atual (conta FREE_QUOTA e MONTHLY_CONTRIBUTION pois as 30 mensais incluem as 3 gratuitas)
  const cycleUsageRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count
     FROM usage_ledger
     WHERE user_id = $1
       AND cycle_key = $2
       AND status = 'CONFIRMED'
       AND source IN ('FREE_QUOTA', 'MONTHLY_CONTRIBUTION')`,
    [userId, cycleKey]
  );
  const usedInCurrentCycle = Number(cycleUsageRes.rows[0]?.count || 0);

  const monthlyContributionActive =
    userRow.monthly_contribution_cycle === cycleKey;

  const freeQuotaRemaining = Math.max(
    0,
    settings.freeMonthlyQuota - usedInCurrentCycle
  );

  const monthlyContributionQuotaRemaining = monthlyContributionActive
    ? Math.max(0, settings.monthlyContributionQuota - usedInCurrentCycle)
    : 0;

  // Pendências do usuário
  const debtsRes = await db.query<{
    id: string;
    application_id: string | null;
    amount: number;
    remaining_amount: number;
    status: string;
    created_at: string | Date;
    due_at: string | Date;
    settled_at: string | Date | null;
  }>(
    `SELECT id, application_id, amount, remaining_amount, status, created_at, due_at, settled_at
     FROM debts
     WHERE user_id = $1
     ORDER BY due_at ASC, created_at DESC`,
    [userId]
  );

  const nowMs = referenceDate.getTime();
  const windowStartMs =
    nowMs - settings.trustWindowDays * 24 * 60 * 60 * 1000;

  let activePendingDebtsCount = 0;
  let activePendingDebtsCents = 0;
  let overdueDebtsCount = 0;
  let overdueDebtsCents = 0;
  let pendingInWindowCount = 0;

  const formattedDebts = debtsRes.rows.map((d) => {
    const isPending =
      d.status === 'PENDING' || d.status === 'PARTIALLY_SETTLED';
    const dueMs = new Date(d.due_at).getTime();
    const createdMs = new Date(d.created_at).getTime();
    const isOverdue = isPending && dueMs < nowMs;

    if (isPending) {
      activePendingDebtsCount += 1;
      activePendingDebtsCents += d.remaining_amount;
      if (createdMs >= windowStartMs) {
        pendingInWindowCount += 1;
      }
    }
    if (isOverdue) {
      overdueDebtsCount += 1;
      overdueDebtsCents += d.remaining_amount;
    }

    return {
      ...d,
      created_at:
        d.created_at instanceof Date ? d.created_at.toISOString() : String(d.created_at),
      due_at: d.due_at instanceof Date ? d.due_at.toISOString() : String(d.due_at),
      settled_at:
        d.settled_at instanceof Date
          ? d.settled_at.toISOString()
          : d.settled_at
            ? String(d.settled_at)
            : null,
      isOverdue,
    };
  });

  const trustCreditsRemaining = Math.max(
    0,
    settings.trustMaxPendingApplications - pendingInWindowCount
  );

  const txRes = await db.query<{
    id: string;
    type: string;
    amount: number;
    description: string;
    reference_type: string | null;
    reference_id: string | null;
    created_at: string;
  }>(
    `SELECT id, type, amount, description, reference_type, reference_id, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return {
    walletId: wallet.id,
    balanceCents: wallet.balance,
    promotionalCreditsRemaining,
    extendedAccessUntil: userRow.extended_access_until,
    currentCycleKey: cycleKey,
    monthlyContributionActive,
    usedInCurrentCycle,
    freeQuotaRemaining,
    monthlyContributionQuotaRemaining,
    activePendingDebtsCount,
    activePendingDebtsCents,
    overdueDebtsCount,
    overdueDebtsCents,
    trustCreditsRemaining,
    transactions: txRes.rows,
    debts: formattedDebts,
  };
}

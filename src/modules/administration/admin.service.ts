import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { CommercialSettings } from '@/config/env';
import { CouponRecord } from '@/modules/coupons/coupons.service';
import { recordAuditLog } from './audit.service';
import { getCommercialSettings } from './settings.service';

export interface AdminDashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalApplications: number;
  freeApplications: number;
  paidApplications: number;
  promotionalApplications: number;
  trustDebtApplications: number;
  totalContributionsCents: number;
  totalWalletBalanceCents: number;
  activeDebtsCount: number;
  activeDebtsCents: number;
  overdueDebtsCount: number;
  overdueDebtsCents: number;
  settledDebtsCount: number;
  settledDebtsCents: number;
  regularizationRatePercent: number;
  totalAiCostCents: number;
  totalAiInputTokens: number;
  totalAiOutputTokens: number;
  avgAiCostPerApplicationCents: number;
  avgAiCostPerActiveUserCents: number;
  activeCouponsCount: number;
  totalCouponRedemptions: number;
}

export interface AdminDashboardData {
  metrics: AdminDashboardMetrics;
  commercialSettings: CommercialSettings;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    monthly_contribution_cycle: string | null;
    wallet_balance: number;
    applications_count: number;
    pending_debts_cents: number;
    created_at: string;
  }>;
  coupons: CouponRecord[];
  recentDebts: Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    amount: number;
    remaining_amount: number;
    status: string;
    created_at: string;
    due_at: string;
    settled_at: string | null;
    isOverdue: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    user_email: string;
    purpose: string;
    external_payment_id: string;
    amount: number;
    status: string;
    confirmed_at: string | null;
    created_at: string;
  }>;
  auditLogs: Array<{
    id: string;
    actor_email: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const nowIso = new Date().toISOString();
  const commercialSettings = await getCommercialSettings();

  const [
    usersAgg,
    usageAgg,
    paymentsAgg,
    walletAgg,
    debtsAgg,
    aiAgg,
    couponsAgg,
    redemptionsAgg,
    usersList,
    couponsList,
    debtsList,
    paymentsList,
    auditList,
  ] = await Promise.all([
    db.query<{
      total: string | number;
      active: string | number;
      blocked: string | number;
    }>(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
        COUNT(*) FILTER (WHERE status = 'BLOCKED') AS blocked
      FROM users
    `),
    db.query<{
      total: string | number;
      free_count: string | number;
      paid_count: string | number;
      promo_count: string | number;
      debt_count: string | number;
    }>(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE source = 'FREE_QUOTA') AS free_count,
        COUNT(*) FILTER (WHERE source IN ('MONTHLY_CONTRIBUTION', 'WALLET_BALANCE')) AS paid_count,
        COUNT(*) FILTER (WHERE source = 'PROMOTIONAL') AS promo_count,
        COUNT(*) FILTER (WHERE source = 'TRUST_DEBT') AS debt_count
      FROM usage_ledger
      WHERE status = 'CONFIRMED' AND usage_type = 'RESUME_GENERATION'
    `),
    db.query<{ total_cents: string | number | null }>(`
      SELECT COALESCE(SUM(amount), 0) AS total_cents
      FROM payments
      WHERE status = 'CONFIRMED'
    `),
    db.query<{ total_balance: string | number | null }>(`
      SELECT COALESCE(SUM(balance), 0) AS total_balance FROM wallets
    `),
    db.query<{
      active_count: string | number;
      active_cents: string | number | null;
      overdue_count: string | number;
      overdue_cents: string | number | null;
      settled_count: string | number;
      settled_cents: string | number | null;
      total_created_cents: string | number | null;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'PARTIALLY_SETTLED')) AS active_count,
        COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('PENDING', 'PARTIALLY_SETTLED')), 0) AS active_cents,
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'PARTIALLY_SETTLED') AND due_at < $1) AS overdue_count,
        COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('PENDING', 'PARTIALLY_SETTLED') AND due_at < $1), 0) AS overdue_cents,
        COUNT(*) FILTER (WHERE status = 'SETTLED') AS settled_count,
        COALESCE(SUM(amount - remaining_amount), 0) AS settled_cents,
        COALESCE(SUM(amount), 0) AS total_created_cents
      FROM debts
    `,
      [nowIso]
    ),
    db.query<{
      total_cost_cents: string | number | null;
      total_in: string | number | null;
      total_out: string | number | null;
    }>(`
      SELECT
        COALESCE(SUM(estimated_cost_cents), 0) AS total_cost_cents,
        COALESCE(SUM(input_tokens), 0) AS total_in,
        COALESCE(SUM(output_tokens), 0) AS total_out
      FROM ai_usage_logs
    `),
    db.query<{ active_coupons: string | number }>(
      `SELECT COUNT(*) AS active_coupons FROM coupons WHERE active = true AND expires_at > $1`,
      [nowIso]
    ),
    db.query<{ total_redemptions: string | number }>(
      `SELECT COUNT(*) AS total_redemptions FROM coupon_redemptions`
    ),
    db.query<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      monthly_contribution_cycle: string | null;
      wallet_balance: string | number;
      applications_count: string | number;
      pending_debts_cents: string | number;
      created_at: string;
    }>(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.monthly_contribution_cycle,
        COALESCE(w.balance, 0) AS wallet_balance,
        (SELECT COUNT(*) FROM applications a WHERE a.user_id = u.id) AS applications_count,
        (SELECT COALESCE(SUM(d.remaining_amount), 0) FROM debts d WHERE d.user_id = u.id AND d.status IN ('PENDING', 'PARTIALLY_SETTLED')) AS pending_debts_cents,
        u.created_at
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 100
    `),
    db.query<CouponRecord>(`
      SELECT
        c.*,
        (SELECT COUNT(*)::int FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) AS redemptions_count
      FROM coupons c
      ORDER BY c.created_at DESC
    `),
    db.query<{
      id: string;
      user_id: string;
      user_name: string;
      user_email: string;
      amount: number;
      remaining_amount: number;
      status: string;
      created_at: string;
      due_at: string;
      settled_at: string | null;
    }>(`
      SELECT
        d.id,
        d.user_id,
        u.name AS user_name,
        u.email AS user_email,
        d.amount,
        d.remaining_amount,
        d.status,
        d.created_at,
        d.due_at,
        d.settled_at
      FROM debts d
      JOIN users u ON u.id = d.user_id
      ORDER BY d.created_at DESC
      LIMIT 50
    `),
    db.query<{
      id: string;
      user_email: string;
      purpose: string;
      external_payment_id: string;
      amount: number;
      status: string;
      confirmed_at: string | null;
      created_at: string;
    }>(`
      SELECT
        p.id,
        u.email AS user_email,
        p.purpose,
        p.external_payment_id,
        p.amount,
        p.status,
        p.confirmed_at,
        p.created_at
      FROM payments p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT 50
    `),
    db.query<{
      id: string;
      actor_email: string | null;
      action: string;
      entity: string;
      entity_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>(`
      SELECT
        al.id,
        u.email AS actor_email,
        al.action,
        al.entity,
        al.entity_id,
        al.metadata,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_user_id
      ORDER BY al.created_at DESC
      LIMIT 60
    `),
  ]);

  const uRow = usersAgg.rows[0];
  const usRow = usageAgg.rows[0];
  const dRow = debtsAgg.rows[0];
  const aiRow = aiAgg.rows[0];

  const totalUsers = Number(uRow?.total || 0);
  const activeUsers = Number(uRow?.active || 0);
  const blockedUsers = Number(uRow?.blocked || 0);

  const totalApplications = Number(usRow?.total || 0);
  const freeApplications = Number(usRow?.free_count || 0);
  const paidApplications = Number(usRow?.paid_count || 0);
  const promotionalApplications = Number(usRow?.promo_count || 0);
  const trustDebtApplications = Number(usRow?.debt_count || 0);

  const totalContributionsCents = Number(paymentsAgg.rows[0]?.total_cents || 0);
  const totalWalletBalanceCents = Number(walletAgg.rows[0]?.total_balance || 0);

  const activeDebtsCount = Number(dRow?.active_count || 0);
  const activeDebtsCents = Number(dRow?.active_cents || 0);
  const overdueDebtsCount = Number(dRow?.overdue_count || 0);
  const overdueDebtsCents = Number(dRow?.overdue_cents || 0);
  const settledDebtsCount = Number(dRow?.settled_count || 0);
  const settledDebtsCents = Number(dRow?.settled_cents || 0);
  const totalCreatedDebtCents = Number(dRow?.total_created_cents || 0);

  const regularizationRatePercent =
    totalCreatedDebtCents > 0
      ? Math.round((settledDebtsCents / totalCreatedDebtCents) * 100)
      : 100;

  const totalAiCostCents = Number(aiRow?.total_cost_cents || 0);
  const totalAiInputTokens = Number(aiRow?.total_in || 0);
  const totalAiOutputTokens = Number(aiRow?.total_out || 0);

  const avgAiCostPerApplicationCents =
    totalApplications > 0
      ? Number((totalAiCostCents / totalApplications).toFixed(2))
      : 0;

  const avgAiCostPerActiveUserCents =
    activeUsers > 0 ? Number((totalAiCostCents / activeUsers).toFixed(2)) : 0;

  const nowMs = Date.now();

  return {
    metrics: {
      totalUsers,
      activeUsers,
      blockedUsers,
      totalApplications,
      freeApplications,
      paidApplications,
      promotionalApplications,
      trustDebtApplications,
      totalContributionsCents,
      totalWalletBalanceCents,
      activeDebtsCount,
      activeDebtsCents,
      overdueDebtsCount,
      overdueDebtsCents,
      settledDebtsCount,
      settledDebtsCents,
      regularizationRatePercent,
      totalAiCostCents,
      totalAiInputTokens,
      totalAiOutputTokens,
      avgAiCostPerApplicationCents,
      avgAiCostPerActiveUserCents,
      activeCouponsCount: Number(couponsAgg.rows[0]?.active_coupons || 0),
      totalCouponRedemptions: Number(
        redemptionsAgg.rows[0]?.total_redemptions || 0
      ),
    },
    commercialSettings,
    users: usersList.rows.map((u) => ({
      ...u,
      wallet_balance: Number(u.wallet_balance || 0),
      applications_count: Number(u.applications_count || 0),
      pending_debts_cents: Number(u.pending_debts_cents || 0),
    })),
    coupons: couponsList.rows,
    recentDebts: debtsList.rows.map((d) => ({
      ...d,
      isOverdue:
        (d.status === 'PENDING' || d.status === 'PARTIALLY_SETTLED') &&
        new Date(d.due_at).getTime() < nowMs,
    })),
    recentPayments: paymentsList.rows,
    auditLogs: auditList.rows,
  };
}

export async function setUserStatusAdmin(params: {
  adminUserId: string;
  targetUserId: string;
  status: 'ACTIVE' | 'BLOCKED';
}): Promise<void> {
  if (!['ACTIVE', 'BLOCKED'].includes(params.status)) {
    throw new ValidationError('Status inválido.');
  }

  await db.transaction(async (tx) => {
    const res = await tx.query<{ id: string; email: string }>(
      `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email`,
      [params.status, params.targetUserId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError('Usuário alvo não encontrado.');
    }

    await recordAuditLog(
      {
        actorUserId: params.adminUserId,
        action:
          params.status === 'BLOCKED'
            ? 'ADMIN_USER_BLOCKED'
            : 'ADMIN_USER_UNBLOCKED',
        entity: 'users',
        entityId: params.targetUserId,
        metadata: { targetEmail: res.rows[0].email, newStatus: params.status },
      },
      tx
    );
  });
}

export async function grantAdminPromotionalCredits(params: {
  adminUserId: string;
  targetUserId: string;
  creditsAmount: number;
  reason?: string;
}): Promise<string> {
  if (!Number.isInteger(params.creditsAmount) || params.creditsAmount <= 0) {
    throw new ValidationError('Informe uma quantidade inteira positiva de créditos.');
  }

  return db.transaction(async (tx) => {
    const userRes = await tx.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = $1 LIMIT 1`,
      [params.targetUserId]
    );
    if (userRes.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado.');
    }

    const creditId = randomUUID();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await tx.query(
      `INSERT INTO promotional_credits
       (id, user_id, source, benefit_type, original_amount, remaining_amount, expires_at, created_at)
       VALUES ($1, $2, $3, 'CREDITS', $4, $4, $5, NOW())`,
      [
        creditId,
        params.targetUserId,
        `ADMIN_GRANT:${params.reason || 'Liberacao Administrativa'}`,
        params.creditsAmount,
        expiresAt.toISOString(),
      ]
    );

    await recordAuditLog(
      {
        actorUserId: params.adminUserId,
        action: 'ADMIN_PROMOTIONAL_CREDITS_GRANTED',
        entity: 'promotional_credits',
        entityId: creditId,
        metadata: {
          targetUserId: params.targetUserId,
          targetEmail: userRes.rows[0].email,
          creditsAmount: params.creditsAmount,
          reason: params.reason || 'Liberação Administrativa',
        },
      },
      tx
    );

    return creditId;
  });
}

export async function adminReleaseDebt(params: {
  adminUserId: string;
  debtId: string;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const res = await tx.query<{ id: string; user_id: string; remaining_amount: number }>(
      `UPDATE debts
       SET remaining_amount = 0, status = 'SETTLED', settled_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, remaining_amount`,
      [params.debtId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError('Pendência não encontrada.');
    }

    await recordAuditLog(
      {
        actorUserId: params.adminUserId,
        action: 'ADMIN_DEBT_RELEASED',
        entity: 'debts',
        entityId: params.debtId,
        metadata: { targetUserId: res.rows[0].user_id },
      },
      tx
    );
  });
}

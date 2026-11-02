import { randomUUID } from 'crypto';
import { db, DbClient } from '@/lib/db';
import {
  ConflictError,
  ForbiddenError,
  InsufficientCreditsError,
} from '@/lib/errors';
import { formatCentsToBRL, getMonthlyCycleKey } from '@/lib/utils';
import { recordAuditLog } from '@/modules/administration/audit.service';
import { getCommercialSettings } from '@/modules/administration/settings.service';
import { ensureUserWallet } from '@/modules/wallet/wallet.service';

export type CreditSourceType =
  | 'PROMOTIONAL'
  | 'FREE_QUOTA'
  | 'MONTHLY_CONTRIBUTION'
  | 'WALLET_BALANCE'
  | 'TRUST_DEBT';

export interface CreditDecision {
  allowed: boolean;
  source: CreditSourceType | null;
  amountCents: number;
  promotionalCreditId?: string;
  reason?: string;
}

export async function evaluateCreditAvailability(
  userId: string,
  referenceDate: Date = new Date(),
  tx?: DbClient
): Promise<CreditDecision> {
  const client = tx || db;
  const settings = await getCommercialSettings(client);
  const cycleKey = getMonthlyCycleKey(referenceDate);
  const nowIso = referenceDate.toISOString();

  const userRes = await client.query<{
    id: string;
    status: string;
    monthly_contribution_cycle: string | null;
    extended_access_until: string | null;
  }>(
    `SELECT id, status, monthly_contribution_cycle, extended_access_until
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    throw new ForbiddenError('Usuário não encontrado.');
  }
  const user = userRes.rows[0];
  if (user.status === 'BLOCKED') {
    throw new ForbiddenError('Sua conta está bloqueada pelo administrador.');
  }

  const wallet = await ensureUserWallet(userId, client);

  // Contabiliza uso no ciclo mensal atual (FREE_QUOTA + MONTHLY_CONTRIBUTION)
  const cycleUsageRes = await client.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count
     FROM usage_ledger
     WHERE user_id = $1
       AND cycle_key = $2
       AND status = 'CONFIRMED'
       AND source IN ('FREE_QUOTA', 'MONTHLY_CONTRIBUTION')`,
    [userId, cycleKey]
  );
  const usedInCycle = Number(cycleUsageRes.rows[0]?.count || 0);

  // Créditos promocionais válidos (FIFO por expiração mais próxima)
  const promoRes = await client.query<{
    id: string;
    remaining_amount: number;
  }>(
    `SELECT id, remaining_amount
     FROM promotional_credits
     WHERE user_id = $1
       AND remaining_amount > 0
       AND (expires_at IS NULL OR expires_at > $2)
     ORDER BY expires_at ASC NULLS LAST, created_at ASC
     LIMIT 1`,
    [userId, nowIso]
  );
  const activePromoCredit = promoRes.rows[0];
  const hasExtendedAccess = Boolean(
    user.extended_access_until &&
      new Date(user.extended_access_until).getTime() > referenceDate.getTime()
  );

  // Pendências na janela móvel de 30 dias e pendências vencidas
  const windowStartIso = new Date(
    referenceDate.getTime() - settings.trustWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const pendingWindowRes = await client.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count
     FROM debts
     WHERE user_id = $1
       AND status IN ('PENDING', 'PARTIALLY_SETTLED')
       AND created_at >= $2`,
    [userId, windowStartIso]
  );
  const pendingInWindow = Number(pendingWindowRes.rows[0]?.count || 0);

  const overdueRes = await client.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count
     FROM debts
     WHERE user_id = $1
       AND status IN ('PENDING', 'PARTIALLY_SETTLED')
       AND due_at < $2`,
    [userId, nowIso]
  );
  const overdueCount = Number(overdueRes.rows[0]?.count || 0);

  for (const priority of settings.creditPriorityOrder) {
    if (priority === 'PROMOTIONAL') {
      if (activePromoCredit) {
        return {
          allowed: true,
          source: 'PROMOTIONAL',
          amountCents: 0,
          promotionalCreditId: activePromoCredit.id,
        };
      }
      if (hasExtendedAccess) {
        return {
          allowed: true,
          source: 'PROMOTIONAL',
          amountCents: 0,
        };
      }
    }

    if (priority === 'FREE_QUOTA') {
      if (usedInCycle < settings.freeMonthlyQuota) {
        return {
          allowed: true,
          source: 'FREE_QUOTA',
          amountCents: 0,
        };
      }
    }

    if (priority === 'MONTHLY_CONTRIBUTION') {
      if (
        user.monthly_contribution_cycle === cycleKey &&
        usedInCycle < settings.monthlyContributionQuota
      ) {
        return {
          allowed: true,
          source: 'MONTHLY_CONTRIBUTION',
          amountCents: 0,
        };
      }
    }

    if (priority === 'WALLET_BALANCE') {
      if (wallet.balance >= settings.additionalApplicationCents) {
        return {
          allowed: true,
          source: 'WALLET_BALANCE',
          amountCents: settings.additionalApplicationCents,
        };
      }
    }

    if (priority === 'TRUST_DEBT') {
      if (settings.blockAfterOverdueDays && overdueCount > 0) {
        continue;
      }
      if (pendingInWindow < settings.trustMaxPendingApplications) {
        return {
          allowed: true,
          source: 'TRUST_DEBT',
          amountCents: settings.additionalApplicationCents,
        };
      }
    }
  }

  const reason =
    settings.blockAfterOverdueDays && overdueCount > 0
      ? 'Você possui pendências vencidas há mais de 30 dias. Regularize na carteira ou utilize um cupom promocional.'
      : `Limite de confiança atingido (${settings.trustMaxPendingApplications} candidaturas pendentes em ${settings.trustWindowDays} dias, equivalente a ${formatCentsToBRL(
          settings.trustMaxPendingApplications * settings.additionalApplicationCents
        )}). Regularize suas pendências na carteira ou resgate um cupom promocional para continuar.`;

  return {
    allowed: false,
    source: null,
    amountCents: 0,
    reason,
  };
}

export async function consumeCreditForApplicationInTx(params: {
  tx: DbClient;
  userId: string;
  applicationId: string;
  referenceDate?: Date;
  idempotencyKey?: string;
}): Promise<{
  usageTransactionId: string;
  source: CreditSourceType;
  amountCents: number;
  debtId?: string;
}> {
  const { tx, userId, applicationId, idempotencyKey } = params;
  const referenceDate = params.referenceDate || new Date();
  const cycleKey = getMonthlyCycleKey(referenceDate);
  const settings = await getCommercialSettings(tx);

  if (idempotencyKey) {
    const existingLedger = await tx.query<{
      id: string;
      source: CreditSourceType;
      amount: number;
    }>(
      `SELECT id, source, amount FROM usage_ledger WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey]
    );
    if (existingLedger.rows.length > 0) {
      throw new ConflictError(
        'Esta operação já foi contabilizada (idempotência).'
      );
    }
  }

  const decision = await evaluateCreditAvailability(userId, referenceDate, tx);
  if (!decision.allowed || !decision.source) {
    throw new InsufficientCreditsError(decision.reason);
  }

  const wallet = await ensureUserWallet(userId, tx);
  const usageId = randomUUID();
  let debtId: string | undefined;

  if (decision.source === 'PROMOTIONAL' && decision.promotionalCreditId) {
    const updateRes = await tx.query<{ id: string }>(
      `UPDATE promotional_credits
       SET remaining_amount = remaining_amount - 1
       WHERE id = $1 AND user_id = $2 AND remaining_amount > 0
       RETURNING id`,
      [decision.promotionalCreditId, userId]
    );
    if (updateRes.rows.length === 0) {
      throw new InsufficientCreditsError(
        'O crédito promocional selecionado não está mais disponível.'
      );
    }
  } else if (decision.source === 'WALLET_BALANCE') {
    const updateWallet = await tx.query<{ balance: number }>(
      `UPDATE wallets
       SET balance = balance - $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND balance >= $1
       RETURNING balance`,
      [decision.amountCents, wallet.id, userId]
    );
    if (updateWallet.rows.length === 0) {
      throw new InsufficientCreditsError(
        'Saldo insuficiente na carteira para concluir o débito.'
      );
    }

    await tx.query(
      `INSERT INTO wallet_transactions
       (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, 'APPLICATION_DEBIT', $4, $5, 'application', $6, $7)`,
      [
        randomUUID(),
        wallet.id,
        userId,
        -decision.amountCents,
        `Candidatura adicional debitada do saldo (${formatCentsToBRL(decision.amountCents)})`,
        applicationId,
        referenceDate.toISOString(),
      ]
    );
  } else if (decision.source === 'TRUST_DEBT') {
    debtId = randomUUID();
    const dueAt = new Date(
      referenceDate.getTime() + settings.debtDueDays * 24 * 60 * 60 * 1000
    );

    await tx.query(
      `INSERT INTO debts
       (id, user_id, application_id, amount, remaining_amount, status, created_at, due_at)
       VALUES ($1, $2, $3, $4, $4, 'PENDING', $5, $6)`,
      [
        debtId,
        userId,
        applicationId,
        decision.amountCents,
        referenceDate.toISOString(),
        dueAt.toISOString(),
      ]
    );

    await tx.query(
      `INSERT INTO wallet_transactions
       (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, 'TRUST_DEBT_REGISTERED', $4, $5, 'debt', $6, $7)`,
      [
        randomUUID(),
        wallet.id,
        userId,
        -decision.amountCents,
        `Candidatura adicional em crédito de confiança (vencimento em ${settings.debtDueDays} dias)`,
        debtId,
        referenceDate.toISOString(),
      ]
    );
  }

  await tx.query(
    `INSERT INTO usage_ledger
     (id, user_id, application_id, usage_type, amount, source, cycle_key, status, idempotency_key, created_at)
     VALUES ($1, $2, $3, 'RESUME_GENERATION', $4, $5, $6, 'CONFIRMED', $7, $8)`,
    [
      usageId,
      userId,
      applicationId,
      decision.amountCents,
      decision.source,
      cycleKey,
      idempotencyKey || null,
      referenceDate.toISOString(),
    ]
  );

  await recordAuditLog(
    {
      actorUserId: userId,
      action: 'APPLICATION_CREDIT_CONSUMED',
      entity: 'usage_ledger',
      entityId: usageId,
      metadata: {
        applicationId,
        source: decision.source,
        amountCents: decision.amountCents,
        cycleKey,
        debtId: debtId || null,
      },
    },
    tx
  );

  return {
    usageTransactionId: usageId,
    source: decision.source,
    amountCents: decision.amountCents,
    debtId,
  };
}

/**
 * Processa a confirmação de uma contribuição (Mensal de R$ 3,00 ou Contribuição Livre),
 * liquidando pendências em ordem cronológica (FIFO) e creditando eventual excedente na carteira.
 */
export async function applyConfirmedContributionInTx(params: {
  tx: DbClient;
  userId: string;
  paymentId: string;
  amountCents: number;
  purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
  referenceDate?: Date;
}): Promise<{
  settledDebtsCount: number;
  settledAmountCents: number;
  addedToBalanceCents: number;
  monthlyCycleActivated: string | null;
}> {
  const { tx, userId, paymentId, amountCents, purpose } = params;
  const referenceDate = params.referenceDate || new Date();
  const settings = await getCommercialSettings(tx);
  const wallet = await ensureUserWallet(userId, tx);
  const cycleKey = getMonthlyCycleKey(referenceDate);

  let remainingToAllocate = amountCents;
  let monthlyCycleActivated: string | null = null;

  // Registra entrada da contribuição no extrato
  await tx.query(
    `INSERT INTO wallet_transactions
     (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
     VALUES ($1, $2, $3, 'CONTRIBUTION', $4, $5, 'payment', $6, $7)`,
    [
      randomUUID(),
      wallet.id,
      userId,
      amountCents,
      purpose === 'MONTHLY_CONTRIBUTION'
        ? `Contribuição mensal recebida (${formatCentsToBRL(amountCents)})`
        : `Contribuição livre recebida (${formatCentsToBRL(amountCents)})`,
      paymentId,
      referenceDate.toISOString(),
    ]
  );

  if (
    purpose === 'MONTHLY_CONTRIBUTION' &&
    remainingToAllocate >= settings.monthlyContributionCents
  ) {
    monthlyCycleActivated = cycleKey;
    remainingToAllocate -= settings.monthlyContributionCents;

    await tx.query(
      `UPDATE users
       SET monthly_contribution_cycle = $1, updated_at = NOW()
       WHERE id = $2`,
      [cycleKey, userId]
    );

    await tx.query(
      `INSERT INTO wallet_transactions
       (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, 'MONTHLY_PLAN_ACTIVATION', $4, $5, 'payment', $6, $7)`,
      [
        randomUUID(),
        wallet.id,
        userId,
        -settings.monthlyContributionCents,
        `Ativação da cota mensal de até ${settings.monthlyContributionQuota} candidaturas (${cycleKey})`,
        paymentId,
        referenceDate.toISOString(),
      ]
    );
  }

  let settledDebtsCount = 0;
  let settledAmountCents = 0;

  if (remainingToAllocate > 0) {
    // Localiza pendências da mais antiga para a mais recente (FIFO por due_at ASC, created_at ASC)
    const openDebts = await tx.query<{
      id: string;
      amount: number;
      remaining_amount: number;
      status: string;
    }>(
      `SELECT id, amount, remaining_amount, status
       FROM debts
       WHERE user_id = $1
         AND status IN ('PENDING', 'PARTIALLY_SETTLED')
         AND remaining_amount > 0
       ORDER BY due_at ASC, created_at ASC`,
      [userId]
    );

    for (const debt of openDebts.rows) {
      if (remainingToAllocate <= 0) break;

      if (remainingToAllocate >= debt.remaining_amount) {
        const paidNow = debt.remaining_amount;
        remainingToAllocate -= paidNow;
        settledAmountCents += paidNow;
        settledDebtsCount += 1;

        await tx.query(
          `UPDATE debts
           SET remaining_amount = 0, status = 'SETTLED', settled_at = $1
           WHERE id = $2`,
          [referenceDate.toISOString(), debt.id]
        );

        await tx.query(
          `INSERT INTO wallet_transactions
           (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
           VALUES ($1, $2, $3, 'DEBT_SETTLEMENT', $4, $5, 'debt', $6, $7)`,
          [
            randomUUID(),
            wallet.id,
            userId,
            -paidNow,
            `Quitação de pendência (${formatCentsToBRL(paidNow)})`,
            debt.id,
            referenceDate.toISOString(),
          ]
        );
      } else {
        // Liquidação parcial da pendência
        const paidNow = remainingToAllocate;
        const newRemaining = debt.remaining_amount - paidNow;
        remainingToAllocate = 0;
        settledAmountCents += paidNow;

        await tx.query(
          `UPDATE debts
           SET remaining_amount = $1, status = 'PARTIALLY_SETTLED'
           WHERE id = $2`,
          [newRemaining, debt.id]
        );

        await tx.query(
          `INSERT INTO wallet_transactions
           (id, wallet_id, user_id, type, amount, description, reference_type, reference_id, created_at)
           VALUES ($1, $2, $3, 'DEBT_PARTIAL_SETTLEMENT', $4, $5, 'debt', $6, $7)`,
          [
            randomUUID(),
            wallet.id,
            userId,
            -paidNow,
            `Regularização parcial de pendência (${formatCentsToBRL(paidNow)} pagos, restam ${formatCentsToBRL(newRemaining)})`,
            debt.id,
            referenceDate.toISOString(),
          ]
        );
      }
    }
  }

  const addedToBalanceCents = remainingToAllocate;
  if (addedToBalanceCents > 0) {
    await tx.query(
      `UPDATE wallets
       SET balance = balance + $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [addedToBalanceCents, wallet.id, userId]
    );
  }

  await recordAuditLog(
    {
      actorUserId: userId,
      action: 'CONTRIBUTION_PROCESSED',
      entity: 'payments',
      entityId: paymentId,
      metadata: {
        amountCents,
        purpose,
        monthlyCycleActivated,
        settledDebtsCount,
        settledAmountCents,
        addedToBalanceCents,
      },
    },
    tx
  );

  return {
    settledDebtsCount,
    settledAmountCents,
    addedToBalanceCents,
    monthlyCycleActivated,
  };
}

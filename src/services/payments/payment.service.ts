import { createHmac, randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { env } from '@/config/env';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';
import { recordAuditLog } from '@/modules/administration/audit.service';
import { getCommercialSettings } from '@/modules/administration/settings.service';
import { applyConfirmedContributionInTx } from '@/modules/billing/billing.service';

export interface PixPaymentRecord {
  id: string;
  user_id: string;
  provider: string;
  purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
  external_payment_id: string;
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  confirmed_at: string | null;
  created_at: string;
  isSandboxMode: boolean;
}

export function generateWebhookSignature(payloadString: string): string {
  return createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');
}

export function verifyWebhookSignature(
  payloadString: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  const expected = generateWebhookSignature(payloadString);
  return signatureHeader.trim() === expected;
}

export async function createPixPayment(params: {
  userId: string;
  purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
  amountCents?: number;
  externalPaymentIdOverride?: string;
}): Promise<PixPaymentRecord> {
  const settings = await getCommercialSettings();

  let amountCents = params.amountCents ?? 0;
  if (params.purpose === 'MONTHLY_CONTRIBUTION') {
    amountCents = settings.monthlyContributionCents; // R$ 3,00 (300 centavos)
  }

  if (!Number.isInteger(amountCents) || amountCents < 10) {
    throw new ValidationError(
      'O valor mínimo para contribuição via Pix é de R$ 0,10 (10 centavos).'
    );
  }

  const paymentId = randomUUID();
  const isSandboxMode = !env.MERCADOPAGO_ACCESS_TOKEN;
  let externalPaymentId =
    params.externalPaymentIdOverride ||
    `pix_${isSandboxMode ? 'sandbox' : 'mp'}_${paymentId.replace(/-/g, '').slice(0, 16)}`;
  let pixCopyPaste = `00020126580014BR.GOV.BCB.PIX0136${paymentId}5204000053039865405${(
    amountCents / 100
  ).toFixed(2)}5802BR5916CURRICULO MESTRE6009SAO PAULO62070503***6304ABCD`;
  let pixQrCode = `SANDBOX_PIX_QR:${externalPaymentId}:${amountCents}`;

  if (env.MERCADOPAGO_ACCESS_TOKEN && process.env.NODE_ENV !== 'test') {
    // Etapa conectada às credenciais reais do Mercado Pago quando MERCADOPAGO_ACCESS_TOKEN está preenchido
    const userRes = await db.query<{ email: string; name: string }>(
      `SELECT email, name FROM users WHERE id = $1 LIMIT 1`,
      [params.userId]
    );
    const payerEmail = userRes.rows[0]?.email || 'usuario@curriculomestre.com.br';

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': paymentId,
      },
      body: JSON.stringify({
        transaction_amount: Number((amountCents / 100).toFixed(2)),
        description:
          params.purpose === 'MONTHLY_CONTRIBUTION'
            ? 'Currículo Mestre — Contribuição Mensal'
            : 'Currículo Mestre — Contribuição Livre / Regularização',
        payment_method_id: 'pix',
        payer: {
          email: payerEmail,
        },
        external_reference: paymentId,
      }),
    });

    if (!mpResponse.ok) {
      throw new ValidationError(
        `Falha ao criar cobrança Pix no provedor (HTTP ${mpResponse.status}). Verifique as credenciais do gateway.`
      );
    }

    const mpData = (await mpResponse.json()) as {
      id?: string | number;
      point_of_interaction?: {
        transaction_data?: {
          qr_code?: string;
          qr_code_base64?: string;
        };
      };
    };

    if (mpData.id) {
      externalPaymentId = String(mpData.id);
    }
    pixCopyPaste =
      mpData.point_of_interaction?.transaction_data?.qr_code || pixCopyPaste;
    pixQrCode =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64 || pixQrCode;
  }

  return db.transaction(async (tx) => {
    const res = await tx.query<{
      id: string;
      user_id: string;
      provider: string;
      purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
      external_payment_id: string;
      amount: number;
      status: 'PENDING' | 'CONFIRMED' | 'FAILED';
      pix_qr_code: string | null;
      pix_copy_paste: string | null;
      confirmed_at: string | null;
      created_at: string;
    }>(
      `INSERT INTO payments
       (id, user_id, provider, purpose, external_payment_id, amount, status, pix_qr_code, pix_copy_paste, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, NOW())
       RETURNING *`,
      [
        paymentId,
        params.userId,
        isSandboxMode ? `${env.PAYMENT_PROVIDER}_sandbox` : env.PAYMENT_PROVIDER,
        params.purpose,
        externalPaymentId,
        amountCents,
        pixQrCode,
        pixCopyPaste,
      ]
    );

    await recordAuditLog(
      {
        actorUserId: params.userId,
        action: 'PAYMENT_PIX_CREATED',
        entity: 'payments',
        entityId: paymentId,
        metadata: {
          externalPaymentId,
          amountCents,
          purpose: params.purpose,
          isSandboxMode,
        },
      },
      tx
    );

    return {
      ...res.rows[0],
      isSandboxMode,
    };
  });
}

export interface WebhookEventPayload {
  externalPaymentId: string;
  status: 'CONFIRMED' | 'FAILED';
  confirmedAt?: string;
}

/**
 * Processa notificação de webhook do gateway de pagamento com validação HMAC e idempotência estrita.
 */
export async function processPaymentWebhook(params: {
  rawBody: string;
  signatureHeader: string | null;
  referenceDate?: Date;
}): Promise<{
  paymentId: string;
  status: 'CONFIRMED' | 'FAILED';
  alreadyProcessed: boolean;
  settlementResult?: {
    settledDebtsCount: number;
    settledAmountCents: number;
    addedToBalanceCents: number;
    monthlyCycleActivated: string | null;
  };
}> {
  if (!verifyWebhookSignature(params.rawBody, params.signatureHeader)) {
    throw new UnauthorizedError('Assinatura do webhook de pagamento inválida.');
  }

  let payload: WebhookEventPayload;
  try {
    payload = JSON.parse(params.rawBody) as WebhookEventPayload;
  } catch {
    throw new ValidationError('Payload JSON do webhook inválido.');
  }

  if (!payload.externalPaymentId || !['CONFIRMED', 'FAILED'].includes(payload.status)) {
    throw new ValidationError(
      'Webhook deve conter externalPaymentId e status válido (CONFIRMED | FAILED).'
    );
  }

  const now = params.referenceDate || new Date();

  return db.transaction(async (tx) => {
    const paymentRes = await tx.query<{
      id: string;
      user_id: string;
      purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
      external_payment_id: string;
      amount: number;
      status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    }>(
      `SELECT id, user_id, purpose, external_payment_id, amount, status
       FROM payments
       WHERE external_payment_id = $1
       LIMIT 1`,
      [payload.externalPaymentId]
    );

    if (paymentRes.rows.length === 0) {
      throw new NotFoundError('Pagamento referenciado no webhook não encontrado.');
    }

    const payment = paymentRes.rows[0];

    // Idempotência: se o pagamento já foi confirmado anteriormente, ignora reprocessamento
    if (payment.status === 'CONFIRMED') {
      await recordAuditLog(
        {
          actorUserId: payment.user_id,
          action: 'PAYMENT_WEBHOOK_DUPLICATE_IGNORED',
          entity: 'payments',
          entityId: payment.id,
          metadata: { externalPaymentId: payment.external_payment_id },
        },
        tx
      );
      return {
        paymentId: payment.id,
        status: 'CONFIRMED',
        alreadyProcessed: true,
      };
    }

    if (payload.status === 'FAILED') {
      await tx.query(
        `UPDATE payments SET status = 'FAILED' WHERE id = $1`,
        [payment.id]
      );
      await recordAuditLog(
        {
          actorUserId: payment.user_id,
          action: 'PAYMENT_WEBHOOK_FAILED',
          entity: 'payments',
          entityId: payment.id,
          metadata: { externalPaymentId: payment.external_payment_id },
        },
        tx
      );
      return {
        paymentId: payment.id,
        status: 'FAILED',
        alreadyProcessed: false,
      };
    }

    // Confirma o pagamento de forma atômica
    await tx.query(
      `UPDATE payments
       SET status = 'CONFIRMED', confirmed_at = $1
       WHERE id = $2 AND status != 'CONFIRMED'`,
      [now.toISOString(), payment.id]
    );

    const settlementResult = await applyConfirmedContributionInTx({
      tx,
      userId: payment.user_id,
      paymentId: payment.id,
      amountCents: payment.amount,
      purpose: payment.purpose,
      referenceDate: now,
    });

    return {
      paymentId: payment.id,
      status: 'CONFIRMED',
      alreadyProcessed: false,
      settlementResult,
    };
  });
}

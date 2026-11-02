import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import { handleApiError } from '@/lib/api-response';
import { ForbiddenError } from '@/lib/errors';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  createPixPayment,
  generateWebhookSignature,
  processPaymentWebhook,
} from '@/services/payments/payment.service';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as {
      action?: 'create' | 'sandbox_webhook_dispatch';
      purpose?: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION';
      amountCents?: number;
      externalPaymentId?: string;
    };

    if (body.action === 'sandbox_webhook_dispatch') {
      if (env.MERCADOPAGO_ACCESS_TOKEN) {
        throw new ForbiddenError(
          'O disparo de webhook de homologação está desativado porque o provedor de produção está configurado.'
        );
      }
      const rawPayload = JSON.stringify({
        externalPaymentId: body.externalPaymentId,
        status: 'CONFIRMED',
      });
      const signature = generateWebhookSignature(rawPayload);
      const webhookResult = await processPaymentWebhook({
        rawBody: rawPayload,
        signatureHeader: signature,
      });
      return NextResponse.json({
        ok: true,
        sandboxWebhookProcessed: true,
        webhookResult,
      });
    }

    const payment = await createPixPayment({
      userId: user.id,
      purpose: body.purpose || 'FREE_CONTRIBUTION',
      amountCents: Number(body.amountCents || 0),
    });

    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { processPaymentWebhook } from '@/services/payments/payment.service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-webhook-signature');

    const result = await processPaymentWebhook({
      rawBody,
      signatureHeader: signature,
    });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}

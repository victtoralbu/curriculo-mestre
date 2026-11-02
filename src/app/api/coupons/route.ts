import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  listUserRedemptions,
  redeemPromotionalCoupon,
} from '@/modules/coupons/coupons.service';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const data = await listUserRedemptions(user.id);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as { code?: string };
    const redemption = await redeemPromotionalCoupon({
      userId: user.id,
      rawCode: body.code || '',
    });
    return NextResponse.json({ ok: true, redemption }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

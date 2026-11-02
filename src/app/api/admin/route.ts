import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { requireAdminUser } from '@/modules/authentication/auth.service';
import {
  adminReleaseDebt,
  getAdminDashboardData,
  grantAdminPromotionalCredits,
  setUserStatusAdmin,
} from '@/modules/administration/admin.service';
import { updateCommercialSettings } from '@/modules/administration/settings.service';
import { upsertCouponAdmin } from '@/modules/coupons/coupons.service';

export async function GET() {
  try {
    await requireAdminUser();
    const data = await getAdminDashboardData();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = (await req.json()) as {
      action:
        | 'upsert_coupon'
        | 'update_settings'
        | 'set_user_status'
        | 'grant_credits'
        | 'release_debt';
      payload: Record<string, unknown>;
    };

    if (body.action === 'upsert_coupon') {
      const coupon = await upsertCouponAdmin(admin.id, body.payload);
      return NextResponse.json({ ok: true, coupon });
    }

    if (body.action === 'update_settings') {
      const settings = await updateCommercialSettings(
        admin.id,
        body.payload
      );
      return NextResponse.json({ ok: true, settings });
    }

    if (body.action === 'set_user_status') {
      await setUserStatusAdmin({
        adminUserId: admin.id,
        targetUserId: String(body.payload.userId || ''),
        status:
          body.payload.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'grant_credits') {
      const creditId = await grantAdminPromotionalCredits({
        adminUserId: admin.id,
        targetUserId: String(body.payload.userId || ''),
        creditsAmount: Number(body.payload.creditsAmount || 0),
        reason: String(body.payload.reason || 'Liberação administrativa'),
      });
      return NextResponse.json({ ok: true, creditId });
    }

    if (body.action === 'release_debt') {
      await adminReleaseDebt({
        adminUserId: admin.id,
        debtId: String(body.payload.debtId || ''),
      });
      return NextResponse.json({ ok: true });
    }

    throw new ValidationError('Ação administrativa desconhecida.');
  } catch (err) {
    return handleApiError(err);
  }
}

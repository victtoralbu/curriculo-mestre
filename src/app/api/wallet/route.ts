import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import { getWalletOverview } from '@/modules/wallet/wallet.service';
import { getCommercialSettings } from '@/modules/administration/settings.service';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const [wallet, settings] = await Promise.all([
      getWalletOverview(user.id),
      getCommercialSettings(),
    ]);
    return NextResponse.json({ ok: true, wallet, settings });
  } catch (err) {
    return handleApiError(err);
  }
}

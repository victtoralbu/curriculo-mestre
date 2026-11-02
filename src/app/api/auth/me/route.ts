import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import {
  deleteUserAccountLGPD,
  requireAuthenticatedUser,
  updateBasicAccountInfo,
} from '@/modules/authentication/auth.service';
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from '@/modules/authentication/session';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const current = await requireAuthenticatedUser();
    const body = await req.json();
    const updated = await updateBasicAccountInfo(current.id, body);
    const token = await signSessionToken(updated);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  try {
    const current = await requireAuthenticatedUser();
    await deleteUserAccountLGPD(current.id);
    await clearSessionCookie();
    return NextResponse.json({
      ok: true,
      message: 'Sua conta e todos os dados associados foram excluídos conforme a LGPD.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

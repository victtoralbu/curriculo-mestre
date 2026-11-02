import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { checkRateLimit } from '@/lib/rate-limit';
import { registerUser } from '@/modules/authentication/auth.service';
import {
  setSessionCookie,
  signSessionToken,
} from '@/modules/authentication/session';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    checkRateLimit(`register_${ip}`, 15, 15 * 60 * 1000);

    const body = await req.json();
    const user = await registerUser(body);
    const token = await signSessionToken(user);
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

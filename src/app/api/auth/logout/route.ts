import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/modules/authentication/session';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

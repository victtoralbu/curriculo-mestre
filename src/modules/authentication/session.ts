import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { SessionUser } from './auth.types';

export const SESSION_COOKIE_NAME = 'cm_session_token';

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.email) return null;
    return {
      id: String(payload.sub),
      name: String(payload.name || ''),
      email: String(payload.email),
      role: payload.role === 'ADMIN' ? 'ADMIN' : 'USER',
      status: payload.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE',
    };
  } catch {
    return null;
  }
}

export async function signPasswordResetToken(
  userId: string,
  email: string
): Promise<string> {
  return new SignJWT({
    sub: userId,
    email,
    purpose: 'PASSWORD_RESET',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSecretKey());
}

export async function verifyPasswordResetToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== 'PASSWORD_RESET' || !payload.sub || !payload.email) {
      return null;
    }
    return {
      userId: String(payload.sub),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

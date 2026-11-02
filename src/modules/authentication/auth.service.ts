import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { env } from '@/config/env';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';
import { recordAuditLog } from '@/modules/administration/audit.service';
import {
  loginSchema,
  registerSchema,
  SessionUser,
  updateAccountSchema,
} from './auth.types';
import {
  getSessionFromCookies,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from './session';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  created_at: string;
}

export async function registerUser(rawInput: unknown): Promise<SessionUser> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados de cadastro inválidos.',
      parsed.error.flatten()
    );
  }
  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const role: 'USER' | 'ADMIN' =
    email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : 'USER';

  return db.transaction(async (tx) => {
    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if (existing.rows.length > 0) {
      throw new ConflictError('Já existe uma conta cadastrada com este e-mail.');
    }

    const userId = randomUUID();
    await tx.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
      [userId, name, email, passwordHash, role]
    );

    // Create user wallet with 0 balance
    await tx.query(
      `INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
       VALUES ($1, $2, 0, NOW(), NOW())`,
      [randomUUID(), userId]
    );

    // Create initial professional profile
    await tx.query(
      `INSERT INTO professional_profiles (id, user_id, full_name, contact_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [randomUUID(), userId, name, email]
    );

    await recordAuditLog(
      {
        actorUserId: userId,
        action: 'USER_REGISTERED',
        entity: 'users',
        entityId: userId,
        metadata: { email, role, lgpdConsent: true },
      },
      tx
    );

    return {
      id: userId,
      name,
      email,
      role,
      status: 'ACTIVE',
    };
  });
}

export async function loginUser(rawInput: unknown): Promise<SessionUser> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Credenciais inválidas.'
    );
  }

  const { email, password } = parsed.data;
  const res = await db.query<UserRow>(
    `SELECT id, name, email, password_hash, role, status, created_at FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );

  if (res.rows.length === 0) {
    throw new UnauthorizedError('E-mail ou senha incorretos.');
  }

  const user = res.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw new UnauthorizedError('E-mail ou senha incorretos.');
  }

  if (user.status === 'BLOCKED') {
    throw new ForbiddenError(
      'Sua conta encontra-se temporariamente suspensa. Entre em contato com o suporte.'
    );
  }

  await recordAuditLog({
    actorUserId: user.id,
    action: 'USER_LOGIN',
    entity: 'users',
    entityId: user.id,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function getUserById(userId: string): Promise<SessionUser> {
  const res = await db.query<UserRow>(
    `SELECT id, name, email, password_hash, role, status, created_at FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (res.rows.length === 0) {
    throw new UnauthorizedError('Usuário não encontrado.');
  }
  const user = res.rows[0];
  if (user.status === 'BLOCKED') {
    throw new ForbiddenError('Conta suspensa pelo administrador.');
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const session = await getSessionFromCookies();
  if (!session) {
    throw new UnauthorizedError();
  }
  return getUserById(session.id);
}

export async function requireAdminUser(): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (user.role !== 'ADMIN') {
    throw new ForbiddenError('Acesso restrito a administradores.');
  }
  return user;
}

export async function updateBasicAccountInfo(
  userId: string,
  rawInput: unknown
): Promise<SessionUser> {
  const parsed = updateAccountSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados inválidos.'
    );
  }

  const { name, currentPassword, newPassword } = parsed.data;

  return db.transaction(async (tx) => {
    const res = await tx.query<UserRow>(
      `SELECT id, name, email, password_hash, role, status FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado.');
    }
    const user = res.rows[0];

    let updatedPasswordHash = user.password_hash;
    if (newPassword) {
      if (!currentPassword) {
        throw new ValidationError('Informe a senha atual para definir uma nova senha.');
      }
      const matches = await bcrypt.compare(currentPassword, user.password_hash);
      if (!matches) {
        throw new UnauthorizedError('A senha atual informada está incorreta.');
      }
      updatedPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedName = name || user.name;
    await tx.query(
      `UPDATE users SET name = $1, password_hash = $2, updated_at = NOW() WHERE id = $3`,
      [updatedName, updatedPasswordHash, userId]
    );

    await recordAuditLog(
      {
        actorUserId: userId,
        action: 'USER_ACCOUNT_UPDATED',
        entity: 'users',
        entityId: userId,
        metadata: { nameChanged: Boolean(name), passwordChanged: Boolean(newPassword) },
      },
      tx
    );

    return {
      id: user.id,
      name: updatedName,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  });
}

export async function createPasswordResetRequest(
  emailInput: string
): Promise<{ resetToken: string | null }> {
  const email = emailInput.trim().toLowerCase();
  const res = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (res.rows.length === 0) {
    return { resetToken: null };
  }
  const user = res.rows[0];
  const token = await signPasswordResetToken(user.id, user.email);
  await recordAuditLog({
    actorUserId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entity: 'users',
    entityId: user.id,
  });
  return { resetToken: token };
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new ValidationError('A nova senha deve ter no mínimo 6 caracteres.');
  }
  const verified = await verifyPasswordResetToken(token);
  if (!verified) {
    throw new UnauthorizedError('Token de recuperação inválido ou expirado.');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, verified.userId]
  );
  await recordAuditLog({
    actorUserId: verified.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entity: 'users',
    entityId: verified.userId,
  });
}

export async function deleteUserAccountLGPD(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const res = await tx.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (res.rows.length === 0) {
      throw new NotFoundError('Conta não encontrada.');
    }

    await recordAuditLog(
      {
        actorUserId: null,
        action: 'USER_ACCOUNT_DELETED_LGPD',
        entity: 'users',
        entityId: userId,
        metadata: { anonymizedDeletionAt: new Date().toISOString() },
      },
      tx
    );

    await tx.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
}

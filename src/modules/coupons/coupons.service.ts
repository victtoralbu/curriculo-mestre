import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { recordAuditLog } from '@/modules/administration/audit.service';

export const upsertCouponSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .min(3, 'O código do cupom deve ter no mínimo 3 caracteres.')
    .max(40)
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().optional().nullable(),
  benefit_type: z.enum([
    'CREDITS',
    'EXTENDED_ACCESS_DAYS',
    'TEMP_LIMIT_BOOST',
  ]),
  benefit_value: z
    .number()
    .int()
    .positive('O valor do benefício deve ser maior que zero.'),
  max_redemptions: z
    .number()
    .int()
    .positive('O limite total de resgates deve ser maior que zero.'),
  max_per_user: z.number().int().positive().default(1),
  starts_at: z.string(),
  expires_at: z.string(),
  active: z.boolean().default(true),
});

export interface CouponRecord {
  id: string;
  code: string;
  description: string | null;
  benefit_type: 'CREDITS' | 'EXTENDED_ACCESS_DAYS' | 'TEMP_LIMIT_BOOST';
  benefit_value: number;
  max_redemptions: number;
  max_per_user: number;
  starts_at: string;
  expires_at: string;
  active: boolean;
  created_at: string;
  redemptions_count?: number;
}

export async function redeemPromotionalCoupon(params: {
  userId: string;
  rawCode: string;
  referenceDate?: Date;
}): Promise<{
  redemptionId: string;
  code: string;
  benefitType: string;
  creditsGranted: number;
  expiresAt: string | null;
}> {
  const code = params.rawCode.trim().toUpperCase();
  if (!code) {
    throw new ValidationError('Informe um código de cupom promocional.');
  }
  const now = params.referenceDate || new Date();

  return db.transaction(async (tx) => {
    const couponRes = await tx.query<CouponRecord>(
      `SELECT * FROM coupons WHERE code = $1 LIMIT 1`,
      [code]
    );
    if (couponRes.rows.length === 0) {
      throw new NotFoundError('Cupom promocional não encontrado.');
    }

    const coupon = couponRes.rows[0];
    if (!coupon.active) {
      throw new ValidationError('Este cupom promocional está inativo.');
    }

    const startsMs = new Date(coupon.starts_at).getTime();
    const expiresMs = new Date(coupon.expires_at).getTime();
    const nowMs = now.getTime();

    if (nowMs < startsMs) {
      throw new ValidationError(
        'Este cupom promocional ainda não iniciou seu período de validade.'
      );
    }
    if (nowMs > expiresMs) {
      throw new ValidationError('Este cupom promocional está expirado.');
    }

    const totalRedemptionsRes = await tx.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = $1`,
      [coupon.id]
    );
    const totalRedemptions = Number(totalRedemptionsRes.rows[0]?.count || 0);
    if (totalRedemptions >= coupon.max_redemptions) {
      throw new ConflictError(
        'Este cupom atingiu o limite máximo de resgates disponíveis.'
      );
    }

    const userRedemptionsRes = await tx.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = $1 AND user_id = $2`,
      [coupon.id, params.userId]
    );
    const userRedemptions = Number(userRedemptionsRes.rows[0]?.count || 0);
    if (userRedemptions >= coupon.max_per_user) {
      throw new ConflictError(
        'Você já resgatou este cupom promocional anteriormente.'
      );
    }

    const redemptionId = randomUUID();
    const promoCreditId = randomUUID();

    let creditsGranted = coupon.benefit_value;
    let creditExpiresAt: Date = new Date(coupon.expires_at);

    if (coupon.benefit_type === 'EXTENDED_ACCESS_DAYS') {
      const accessUntil = new Date(
        nowMs + coupon.benefit_value * 24 * 60 * 60 * 1000
      );
      creditExpiresAt = accessUntil;
      // Concede também lote de créditos promocionais para o período de 30 dias
      creditsGranted = coupon.benefit_value;
      await tx.query(
        `UPDATE users SET extended_access_until = $1, updated_at = NOW() WHERE id = $2`,
        [accessUntil.toISOString(), params.userId]
      );
    }

    await tx.query(
      `INSERT INTO coupon_redemptions (id, coupon_id, user_id, credits_granted, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        redemptionId,
        coupon.id,
        params.userId,
        creditsGranted,
        now.toISOString(),
      ]
    );

    await tx.query(
      `INSERT INTO promotional_credits
       (id, user_id, source, benefit_type, original_amount, remaining_amount, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7)`,
      [
        promoCreditId,
        params.userId,
        `COUPON:${coupon.code}`,
        coupon.benefit_type,
        creditsGranted,
        creditExpiresAt.toISOString(),
        now.toISOString(),
      ]
    );

    await recordAuditLog(
      {
        actorUserId: params.userId,
        action: 'COUPON_REDEEMED',
        entity: 'coupons',
        entityId: coupon.id,
        metadata: {
          code: coupon.code,
          benefitType: coupon.benefit_type,
          creditsGranted,
          redemptionId,
        },
      },
      tx
    );

    return {
      redemptionId,
      code: coupon.code,
      benefitType: coupon.benefit_type,
      creditsGranted,
      expiresAt: creditExpiresAt.toISOString(),
    };
  });
}

export async function listUserRedemptions(userId: string) {
  const [redemptionsRes, creditsRes] = await Promise.all([
    db.query<{
      id: string;
      code: string;
      description: string | null;
      benefit_type: string;
      credits_granted: number;
      created_at: string;
    }>(
      `SELECT cr.id, c.code, c.description, c.benefit_type, cr.credits_granted, cr.created_at
       FROM coupon_redemptions cr
       JOIN coupons c ON c.id = cr.coupon_id
       WHERE cr.user_id = $1
       ORDER BY cr.created_at DESC`,
      [userId]
    ),
    db.query<{
      id: string;
      source: string;
      benefit_type: string;
      original_amount: number;
      remaining_amount: number;
      expires_at: string | null;
      created_at: string;
    }>(
      `SELECT id, source, benefit_type, original_amount, remaining_amount, expires_at, created_at
       FROM promotional_credits
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  return {
    redemptions: redemptionsRes.rows,
    promotionalCredits: creditsRes.rows,
  };
}

export async function upsertCouponAdmin(
  adminUserId: string,
  rawInput: unknown
): Promise<CouponRecord> {
  const parsed = upsertCouponSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados de cupom inválidos.'
    );
  }
  const data = parsed.data;

  return db.transaction(async (tx) => {
    const id = data.id || randomUUID();
    const res = await tx.query<CouponRecord>(
      `INSERT INTO coupons
       (id, code, description, benefit_type, benefit_value, max_redemptions, max_per_user, starts_at, expires_at, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (code) DO UPDATE SET
         description = EXCLUDED.description,
         benefit_type = EXCLUDED.benefit_type,
         benefit_value = EXCLUDED.benefit_value,
         max_redemptions = EXCLUDED.max_redemptions,
         max_per_user = EXCLUDED.max_per_user,
         starts_at = EXCLUDED.starts_at,
         expires_at = EXCLUDED.expires_at,
         active = EXCLUDED.active
       RETURNING *`,
      [
        id,
        data.code,
        data.description || null,
        data.benefit_type,
        data.benefit_value,
        data.max_redemptions,
        data.max_per_user,
        new Date(data.starts_at).toISOString(),
        new Date(data.expires_at).toISOString(),
        data.active,
      ]
    );

    const saved = res.rows[0];
    await recordAuditLog(
      {
        actorUserId: adminUserId,
        action: 'ADMIN_UPSERT_COUPON',
        entity: 'coupons',
        entityId: saved.id,
        metadata: { code: saved.code, active: saved.active, benefitValue: saved.benefit_value },
      },
      tx
    );
    return saved;
  });
}

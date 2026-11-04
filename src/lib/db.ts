import { PGlite } from '@electric-sql/pglite';
import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { DEFAULT_COMMERCIAL_SETTINGS, env } from '@/config/env';

export interface DbQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DbQueryResult<T>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __cm_pg_pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __cm_pglite: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __cm_db_init_promise: Promise<void> | undefined;
}

// Mutex queue to serialize transactions and prevent race conditions on concurrent requests
let globalTxQueue: Promise<unknown> = Promise.resolve();

function enqueueExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = globalTxQueue.then(fn, fn);
  globalTxQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function isRemotePostgresConfig(): boolean {
  const url = process.env.DATABASE_URL || env.DATABASE_URL;
  return Boolean(
    url &&
      (url.startsWith('postgresql://') || url.startsWith('postgres://')) &&
      !url.includes('localhost:5432/curriculo_mestre') &&
      process.env.NODE_ENV !== 'test'
  );
}

function getPool(): Pool {
  if (!global.__cm_pg_pool) {
    global.__cm_pg_pool = new Pool({
      connectionString: process.env.DATABASE_URL || env.DATABASE_URL,
      max: 10,
    });
  }
  return global.__cm_pg_pool;
}

async function getPGlite(): Promise<PGlite> {
  if (!global.__cm_pglite) {
    if (process.env.NODE_ENV === 'test') {
      global.__cm_pglite = new PGlite();
    } else {
      const dataDir = path.join(process.cwd(), '.pglite', 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      global.__cm_pglite = new PGlite(dataDir);
    }
  }
  return global.__cm_pglite;
}

async function runRawMigrationAndSeed(execSql: (sql: string) => Promise<void>, client: DbClient) {
  const migrationFiles = [
    path.join(process.cwd(), 'prisma', 'migrations', '20261102000000_init', 'migration.sql'),
    path.join(
      process.cwd(),
      'prisma',
      'migrations',
      '20261104000000_conversational_onboarding',
      'migration.sql'
    ),
  ];

  for (const migrationPath of migrationFiles) {
    if (fs.existsSync(migrationPath)) {
      const ddl = fs.readFileSync(migrationPath, 'utf-8');
      await execSql(ddl);
    }
  }

  // Seed default commercial settings if not exists
  const existingSettings = await client.query<{ id: string }>(
    `SELECT id FROM system_settings WHERE key = $1`,
    ['commercial_settings']
  );
  if (existingSettings.rows.length === 0) {
    await client.query(
      `INSERT INTO system_settings (id, key, value, updated_at) VALUES ($1, $2, $3::jsonb, NOW())`,
      [
        randomUUID(),
        'commercial_settings',
        JSON.stringify(DEFAULT_COMMERCIAL_SETTINGS),
      ]
    );
  }

  // Seed initial coupons: BETA10, BETA30, BETA100, FUNDADOR30
  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const initialCoupons = [
    {
      code: 'BETA10',
      description: '10 candidaturas promocionais para testadores Beta',
      benefit_type: 'CREDITS',
      benefit_value: 10,
      max_redemptions: 1000,
      max_per_user: 1,
    },
    {
      code: 'BETA30',
      description: '30 candidaturas promocionais para testadores Beta',
      benefit_type: 'CREDITS',
      benefit_value: 30,
      max_redemptions: 500,
      max_per_user: 1,
    },
    {
      code: 'BETA100',
      description: '100 candidaturas promocionais para parceiros Beta',
      benefit_type: 'CREDITS',
      benefit_value: 100,
      max_redemptions: 200,
      max_per_user: 1,
    },
    {
      code: 'FUNDADOR30',
      description: 'Acesso promocional ampliado por 30 dias (créditos fundadores)',
      benefit_type: 'EXTENDED_ACCESS_DAYS',
      benefit_value: 30,
      max_redemptions: 300,
      max_per_user: 1,
    },
  ];

  for (const c of initialCoupons) {
    await client.query(
      `INSERT INTO coupons (id, code, description, benefit_type, benefit_value, max_redemptions, max_per_user, starts_at, expires_at, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       ON CONFLICT (code) DO NOTHING`,
      [
        randomUUID(),
        c.code,
        c.description,
        c.benefit_type,
        c.benefit_value,
        c.max_redemptions,
        c.max_per_user,
        new Date(now.getTime() - 60_000).toISOString(),
        oneYearLater.toISOString(),
      ]
    );
  }

  // Ensure default Admin user exists for administration panel testing/operation
  const adminEmail = env.ADMIN_EMAIL.toLowerCase();
  const existingAdmin = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [adminEmail]
  );
  if (existingAdmin.rows.length === 0) {
    const adminId = randomUUID();
    const passwordHash = await bcrypt.hash('Admin@2026', 10);
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW(), NOW())`,
      [adminId, 'Administrador Currículo Mestre', adminEmail, passwordHash]
    );
    await client.query(
      `INSERT INTO wallets (id, user_id, balance, created_at, updated_at)
       VALUES ($1, $2, 0, NOW(), NOW())`,
      [randomUUID(), adminId]
    );
    await client.query(
      `INSERT INTO professional_profiles (id, user_id, full_name, contact_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [randomUUID(), adminId, 'Administrador Currículo Mestre', adminEmail]
    );
  }
}

export async function ensureDbInitialized(): Promise<void> {
  if (!global.__cm_db_init_promise) {
    global.__cm_db_init_promise = (async () => {
      if (isRemotePostgresConfig()) {
        const pool = getPool();
        const rawClient: DbClient = {
          async query<T>(sql: string, params: unknown[] = []) {
            const res = await pool.query(sql, params);
            return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
          },
        };
        await runRawMigrationAndSeed(async (ddl) => {
          await pool.query(ddl);
        }, rawClient);
      } else {
        const pglite = await getPGlite();
        const rawClient: DbClient = {
          async query<T>(sql: string, params: unknown[] = []) {
            const res = await pglite.query<T>(sql, params);
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
          },
        };
        await runRawMigrationAndSeed(async (ddl) => {
          await pglite.exec(ddl);
        }, rawClient);
      }
    })();
  }
  await global.__cm_db_init_promise;
}

export const db = {
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<DbQueryResult<T>> {
    await ensureDbInitialized();
    return enqueueExclusive(async () => {
      if (isRemotePostgresConfig()) {
        const pool = getPool();
        const res = await pool.query(sql, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
      } else {
        const pglite = await getPGlite();
        const res = await pglite.query<T>(sql, params);
        return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
      }
    });
  },

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    await ensureDbInitialized();
    return enqueueExclusive(async () => {
      if (isRemotePostgresConfig()) {
        const pool = getPool();
        const client: PoolClient = await pool.connect();
        try {
          await client.query('BEGIN');
          const txClient: DbClient = {
            async query<R = Record<string, unknown>>(
              sql: string,
              params: unknown[] = []
            ): Promise<DbQueryResult<R>> {
              const res = await client.query(sql, params);
              return {
                rows: res.rows as R[],
                rowCount: res.rowCount ?? res.rows.length,
              };
            },
          };
          const result = await fn(txClient);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        const pglite = await getPGlite();
        await pglite.query('BEGIN');
        try {
          const txClient: DbClient = {
            async query<R = Record<string, unknown>>(
              sql: string,
              params: unknown[] = []
            ): Promise<DbQueryResult<R>> {
              const res = await pglite.query<R>(sql, params);
              return {
                rows: res.rows,
                rowCount: res.affectedRows ?? res.rows.length,
              };
            },
          };
          const result = await fn(txClient);
          await pglite.query('COMMIT');
          return result;
        } catch (err) {
          await pglite.query('ROLLBACK');
          throw err;
        }
      }
    });
  },

  /**
   * Utilitário exclusivo para testes automatizados resetarem o estado entre cenários
   */
  async resetForTests(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('resetForTests só pode ser invocado em ambiente de teste');
    }
    await ensureDbInitialized();
    const pglite = await getPGlite();
    await pglite.exec(`
      TRUNCATE TABLE
        chat_messages,
        chat_conversations,
        uploaded_resumes,
        ai_usage_logs,
        audit_logs,
        payments,
        promotional_credits,
        coupon_redemptions,
        debts,
        usage_ledger,
        wallet_transactions,
        wallets,
        applications,
        jobs,
        skills,
        educations,
        professional_experiences,
        professional_profiles,
        users
      RESTART IDENTITY CASCADE;
    `);
    // Reset settings to default
    await pglite.query(
      `UPDATE system_settings SET value = $1::jsonb, updated_at = NOW() WHERE key = 'commercial_settings'`,
      [JSON.stringify(DEFAULT_COMMERCIAL_SETTINGS)]
    );
  },
};

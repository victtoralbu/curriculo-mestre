-- Currículo Mestre — Initial PostgreSQL Schema Migration

CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "monthly_contribution_cycle" TEXT,
    "extended_access_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_role_status_idx" ON "users"("role", "status");

CREATE TABLE IF NOT EXISTS "professional_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT,
    "contact_email" TEXT,
    "phone" TEXT,
    "professional_summary" TEXT,
    "target_roles" TEXT,
    "experience_years" TEXT,
    "specialties" TEXT,
    "location" TEXT,
    "linkedin_url" TEXT,
    "portfolio_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "professional_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "professional_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "professional_profiles_user_id_key" ON "professional_profiles"("user_id");

CREATE TABLE IF NOT EXISTS "professional_experiences" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "employment_type" TEXT,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "description" TEXT NOT NULL,
    "achievements" TEXT,
    "tools" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "professional_experiences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "professional_experiences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "professional_experiences_profile_id_idx" ON "professional_experiences"("profile_id");

CREATE TABLE IF NOT EXISTS "educations" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "start_date" TEXT,
    "end_date" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "educations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "educations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "educations_profile_id_idx" ON "educations"("profile_id");

CREATE TABLE IF NOT EXISTS "skills" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "proficiency" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "skills_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "skills_profile_id_idx" ON "skills"("profile_id");

CREATE TABLE IF NOT EXISTS "jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company" TEXT,
    "position" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_url" TEXT,
    "extracted_requirements" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "jobs_user_id_created_at_idx" ON "jobs"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "compatibility_score" INTEGER NOT NULL DEFAULT 0,
    "analysis" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "resume_content" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" TEXT NOT NULL DEFAULT 'CURRICULO_GERADO',
    "usage_transaction_id" TEXT,
    "credit_source" TEXT,
    "ai_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "ai_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "ai_estimated_cost_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "applications_user_id_created_at_idx" ON "applications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "applications_status_idx" ON "applications"("status");

CREATE TABLE IF NOT EXISTS "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wallets_balance_non_negative" CHECK ("balance" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_id_key" ON "wallets"("user_id");

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

CREATE TABLE IF NOT EXISTS "usage_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "usage_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "cycle_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "usage_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "usage_ledger_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_ledger_idempotency_key_key" ON "usage_ledger"("idempotency_key");
CREATE INDEX IF NOT EXISTS "usage_ledger_user_id_cycle_key_status_idx" ON "usage_ledger"("user_id", "cycle_key", "status");
CREATE INDEX IF NOT EXISTS "usage_ledger_user_id_created_at_idx" ON "usage_ledger"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "debts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "amount" INTEGER NOT NULL,
    "remaining_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ NOT NULL,
    "settled_at" TIMESTAMPTZ,
    CONSTRAINT "debts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "debts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "debts_user_id_status_due_at_idx" ON "debts"("user_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "debts_user_id_created_at_idx" ON "debts"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "benefit_type" TEXT NOT NULL,
    "benefit_value" INTEGER NOT NULL,
    "max_redemptions" INTEGER NOT NULL,
    "max_per_user" INTEGER NOT NULL DEFAULT 1,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credits_granted" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_id_user_id_idx" ON "coupon_redemptions"("coupon_id", "user_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

CREATE TABLE IF NOT EXISTS "promotional_credits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "benefit_type" TEXT NOT NULL DEFAULT 'CREDITS',
    "original_amount" INTEGER NOT NULL,
    "remaining_amount" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotional_credits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promotional_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promotional_credits_remaining_non_negative" CHECK ("remaining_amount" >= 0)
);

CREATE INDEX IF NOT EXISTS "promotional_credits_user_id_remaining_amount_idx" ON "promotional_credits"("user_id", "remaining_amount");

CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'FREE_CONTRIBUTION',
    "external_payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pix_qr_code" TEXT,
    "pix_copy_paste" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_external_payment_id_key" ON "payments"("external_payment_id");
CREATE INDEX IF NOT EXISTS "payments_user_id_status_idx" ON "payments"("user_id", "status");

CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_key" ON "system_settings"("key");

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT,
    "operation_type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost_cents" INTEGER NOT NULL,
    "estimated_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

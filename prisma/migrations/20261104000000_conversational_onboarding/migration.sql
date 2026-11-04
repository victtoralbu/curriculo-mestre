-- Currículo Mestre — Conversational Onboarding & Chat Persistence Migration

ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "onboarding_state" TEXT NOT NULL DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "section_states" JSONB NOT NULL DEFAULT '{"personal":"pending","positioning":"pending","summary":"pending","experiences":"pending","education":"pending","skills":"pending","languages":"pending"}'::jsonb,
  ADD COLUMN IF NOT EXISTS "extracted_draft" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "master_resume" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve compatibility for existing profiles that already had summary/target_roles populated before this migration
UPDATE "professional_profiles"
SET "onboarding_completed" = true,
    "onboarding_state" = 'master_completed',
    "section_states" = '{"personal":"completed","positioning":"completed","summary":"completed","experiences":"completed","education":"completed","skills":"completed","languages":"completed"}'::jsonb
WHERE "onboarding_completed" = false
  AND "onboarding_state" = 'welcome'
  AND "full_name" IS NOT NULL
  AND ("professional_summary" IS NOT NULL OR "target_roles" IS NOT NULL);

CREATE TABLE IF NOT EXISTS "uploaded_resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "parsed_data" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_resumes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uploaded_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "uploaded_resumes_user_id_created_at_idx" ON "uploaded_resumes"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "context_type" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "flow_state" TEXT NOT NULL DEFAULT 'welcome',
    "application_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_conversations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_context_type_updated_at_idx" ON "chat_conversations"("user_id", "context_type", "updated_at");

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_messages_user_id_created_at_idx" ON "chat_messages"("user_id", "created_at");

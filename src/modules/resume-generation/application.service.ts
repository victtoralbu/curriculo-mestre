import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ForbiddenError,
  InsufficientCreditsError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { recordAuditLog } from '@/modules/administration/audit.service';
import {
  consumeCreditForApplicationInTx,
  CreditSourceType,
  evaluateCreditAvailability,
} from '@/modules/billing/billing.service';
import { getOrCreateProfileByUserId } from '@/modules/professional-profile/profile.service';
import {
  CompatibilityAnalysis,
  ExtractedJobRequirements,
  GeneratedResumeContent,
  generatedResumeContentSchema,
} from '@/services/gemini/gemini.schemas';
import {
  analyzeJobDescription,
  fetchJobDescriptionFromUrl,
  generateCompatibilityAndTailoredResume,
} from '@/services/gemini/gemini.service';

export const APPLICATION_STATUSES = [
  'EM_PREPARACAO',
  'CURRICULO_GERADO',
  'CANDIDATADO',
  'EM_PROCESSO_SELETIVO',
  'APROVADO',
  'REPROVADO',
  'ENCERRADO',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const createApplicationSchema = z.object({
  company: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  jobDescription: z.string().trim().optional().default(''),
  sourceUrl: z.string().trim().optional().nullable(),
  idempotencyKey: z.string().trim().optional(),
});

export interface ApplicationDetail {
  id: string;
  user_id: string;
  job_id: string;
  company: string | null;
  position: string;
  job_description: string;
  source_url: string | null;
  extracted_requirements: ExtractedJobRequirements;
  compatibility_score: number;
  analysis: CompatibilityAnalysis;
  resume_content: GeneratedResumeContent;
  status: ApplicationStatus;
  usage_transaction_id: string | null;
  credit_source: CreditSourceType | null;
  ai_input_tokens: number;
  ai_output_tokens: number;
  ai_estimated_cost_cents: number;
  created_at: string;
  updated_at: string;
}

export async function createApplicationAndGenerateResume(params: {
  userId: string;
  rawInput: unknown;
  referenceDate?: Date;
}): Promise<ApplicationDetail> {
  const parsed = createApplicationSchema.safeParse(params.rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados da vaga inválidos.'
    );
  }

  const { company, position, sourceUrl, idempotencyKey } = parsed.data;
  let jobDescription = parsed.data.jobDescription;
  const referenceDate = params.referenceDate || new Date();

  // 1. Verificar se o usuário possui perfil profissional preenchido
  const profile = await getOrCreateProfileByUserId(params.userId);
  if (!profile.isComplete) {
    throw new ValidationError(
      'Seu perfil profissional ainda está incompleto. Cadastre seu resumo/objetivo e ao menos uma experiência, formação ou competência antes de gerar um currículo personalizado.'
    );
  }

  // 2. Pré-verificação de disponibilidade de créditos antes de acionar a IA
  const preCheck = await evaluateCreditAvailability(
    params.userId,
    referenceDate
  );
  if (!preCheck.allowed) {
    throw new InsufficientCreditsError(preCheck.reason);
  }

  // 3. Se informou apenas link da oportunidade, tenta extrair de forma transparente
  if ((!jobDescription || jobDescription.length < 20) && sourceUrl) {
    jobDescription = await fetchJobDescriptionFromUrl(sourceUrl);
  }

  if (!jobDescription || jobDescription.trim().length < 20) {
    throw new ValidationError(
      'Informe a descrição da vaga (mínimo de 20 caracteres) ou um link acessível.'
    );
  }

  // 4. Executar análise da vaga e geração do currículo na IA ANTES de qualquer débito!
  // Se a geração falhar, a exceção interrompe o fluxo aqui e NENHUM crédito é debitado.
  const jobAnalysisResult = await analyzeJobDescription({
    userId: params.userId,
    jobDescription,
    companyHint: company,
    positionHint: position,
  });

  const generationResult = await generateCompatibilityAndTailoredResume({
    userId: params.userId,
    profile,
    jobRequirements: jobAnalysisResult.requirements,
    jobDescriptionSummary: jobDescription.slice(0, 3000),
  });

  const totalInputTokens =
    jobAnalysisResult.usage.inputTokens + generationResult.usage.inputTokens;
  const totalOutputTokens =
    jobAnalysisResult.usage.outputTokens + generationResult.usage.outputTokens;
  const totalEstimatedCostCents =
    jobAnalysisResult.usage.estimatedCostCents +
    generationResult.usage.estimatedCostCents;
  const totalEstimatedCostUsd = Number(
    (
      jobAnalysisResult.usage.estimatedCostUsd +
      generationResult.usage.estimatedCostUsd
    ).toFixed(6)
  );

  // 5. Transação atômica no PostgreSQL: consome o crédito e persiste vaga + candidatura + logs de custo IA
  const createdIds = await db.transaction(async (tx) => {
    const jobId = randomUUID();
    const applicationId = randomUUID();

    await tx.query(
      `INSERT INTO jobs
       (id, user_id, company, position, description, source_url, extracted_requirements, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        jobId,
        params.userId,
        jobAnalysisResult.requirements.company || company || null,
        jobAnalysisResult.requirements.position || position || 'Profissional',
        jobDescription,
        sourceUrl || null,
        JSON.stringify(jobAnalysisResult.requirements),
        referenceDate.toISOString(),
      ]
    );

    // Criar registro da candidatura primeiro para vincular FK em usage_ledger e debts
    await tx.query(
      `INSERT INTO applications
       (id, user_id, job_id, compatibility_score, analysis, resume_content, status, ai_input_tokens, ai_output_tokens, ai_estimated_cost_cents, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'CURRICULO_GERADO', $7, $8, $9, $10, $10)`,
      [
        applicationId,
        params.userId,
        jobId,
        generationResult.analysis.compatibilityScore,
        JSON.stringify(generationResult.analysis),
        JSON.stringify(generationResult.resumeContent),
        totalInputTokens,
        totalOutputTokens,
        totalEstimatedCostCents,
        referenceDate.toISOString(),
      ]
    );

    // Debita o crédito dentro da mesma transação (se não houver mais crédito em concorrência, faz ROLLBACK de tudo!)
    const consumption = await consumeCreditForApplicationInTx({
      tx,
      userId: params.userId,
      applicationId,
      referenceDate,
      idempotencyKey,
    });

    await tx.query(
      `UPDATE applications
       SET usage_transaction_id = $1, credit_source = $2
       WHERE id = $3`,
      [consumption.usageTransactionId, consumption.source, applicationId]
    );

    await tx.query(
      `INSERT INTO ai_usage_logs
       (id, user_id, application_id, operation_type, model, input_tokens, output_tokens, estimated_cost_cents, estimated_cost_usd, created_at)
       VALUES ($1, $2, $3, 'RESUME_GENERATION', $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        params.userId,
        applicationId,
        generationResult.usage.model,
        generationResult.usage.inputTokens,
        generationResult.usage.outputTokens,
        generationResult.usage.estimatedCostCents,
        totalEstimatedCostUsd,
        referenceDate.toISOString(),
      ]
    );

    await recordAuditLog(
      {
        actorUserId: params.userId,
        action: 'APPLICATION_CREATED',
        entity: 'applications',
        entityId: applicationId,
        metadata: {
          jobId,
          position: jobAnalysisResult.requirements.position,
          compatibilityScore: generationResult.analysis.compatibilityScore,
          creditSource: consumption.source,
          amountCents: consumption.amountCents,
        },
      },
      tx
    );

    return { applicationId };
  });

  return getApplicationByIdForUser(params.userId, createdIds.applicationId);
}

export async function getApplicationByIdForUser(
  userId: string,
  applicationId: string
): Promise<ApplicationDetail> {
  const res = await db.query<{
    id: string;
    user_id: string;
    job_id: string;
    company: string | null;
    position: string;
    job_description: string;
    source_url: string | null;
    extracted_requirements: ExtractedJobRequirements;
    compatibility_score: number;
    analysis: CompatibilityAnalysis;
    resume_content: GeneratedResumeContent;
    status: ApplicationStatus;
    usage_transaction_id: string | null;
    credit_source: CreditSourceType | null;
    ai_input_tokens: number;
    ai_output_tokens: number;
    ai_estimated_cost_cents: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT
       a.id,
       a.user_id,
       a.job_id,
       j.company,
       j.position,
       j.description AS job_description,
       j.source_url,
       j.extracted_requirements,
       a.compatibility_score,
       a.analysis,
       a.resume_content,
       a.status,
       a.usage_transaction_id,
       a.credit_source,
       a.ai_input_tokens,
       a.ai_output_tokens,
       a.ai_estimated_cost_cents,
       a.created_at,
       a.updated_at
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = $1
     LIMIT 1`,
    [applicationId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError('Candidatura não encontrada.');
  }

  const row = res.rows[0];
  if (row.user_id !== userId) {
    throw new ForbiddenError(
      'Acesso negado: você não pode visualizar ou alterar candidaturas de outro usuário.'
    );
  }

  return row;
}

export async function updateApplicationForUser(params: {
  userId: string;
  applicationId: string;
  status?: ApplicationStatus;
  resumeContent?: unknown;
}): Promise<ApplicationDetail> {
  const current = await getApplicationByIdForUser(
    params.userId,
    params.applicationId
  );

  let nextStatus = current.status;
  if (params.status) {
    if (!APPLICATION_STATUSES.includes(params.status)) {
      throw new ValidationError('Status de candidatura inválido.');
    }
    nextStatus = params.status;
  }

  let nextResumeContent = current.resume_content;
  if (params.resumeContent !== undefined) {
    const parsedResume = generatedResumeContentSchema.safeParse(
      params.resumeContent
    );
    if (!parsedResume.success) {
      throw new ValidationError(
        'Estrutura do conteúdo do currículo inválida para atualização.'
      );
    }
    nextResumeContent = parsedResume.data;
  }

  await db.query(
    `UPDATE applications
     SET status = $1, resume_content = $2::jsonb, updated_at = NOW()
     WHERE id = $3 AND user_id = $4`,
    [
      nextStatus,
      JSON.stringify(nextResumeContent),
      params.applicationId,
      params.userId,
    ]
  );

  await recordAuditLog({
    actorUserId: params.userId,
    action: 'APPLICATION_UPDATED',
    entity: 'applications',
    entityId: params.applicationId,
    metadata: { status: nextStatus },
  });

  return getApplicationByIdForUser(params.userId, params.applicationId);
}

export async function listUserApplications(userId: string): Promise<
  Array<{
    id: string;
    company: string | null;
    position: string;
    compatibility_score: number;
    status: ApplicationStatus;
    credit_source: CreditSourceType | null;
    created_at: string;
  }>
> {
  const res = await db.query<{
    id: string;
    company: string | null;
    position: string;
    compatibility_score: number;
    status: ApplicationStatus;
    credit_source: CreditSourceType | null;
    created_at: string;
  }>(
    `SELECT
       a.id,
       j.company,
       j.position,
       a.compatibility_score,
       a.status,
       a.credit_source,
       a.created_at
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );
  return res.rows;
}

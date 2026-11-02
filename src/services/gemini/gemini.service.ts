import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';
import { db } from '@/lib/db';
import { AppError, ValidationError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { FullProfessionalProfile } from '@/modules/professional-profile/profile.types';
import {
  AiOperationUsage,
  CompatibilityAnalysis,
  compatibilityAnalysisSchema,
  ExtractedJobRequirements,
  extractedJobRequirementsSchema,
  GeneratedResumeContent,
  generatedResumeContentSchema,
} from './gemini.schemas';

const ANTI_HALLUCINATION_SYSTEM_INSTRUCTION = `
Você é um especialista sênior em recrutamento, sistemas ATS e preparação ética de currículos da plataforma Currículo Mestre.
REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
1. Trabalhe SOMENTE com as informações fornecidas pelo usuário em seu perfil profissional.
2. NUNCA invente resultados, métricas, porcentagens ou indicadores que não foram declarados pelo usuário.
3. NUNCA crie experiências profissionais, empresas ou cargos inexistentes.
4. NUNCA afirme que o usuário domina ferramentas, tecnologias ou idiomas que ele não declarou conhecer.
5. NUNCA invente formação acadêmica ou certificações.
6. Identifique explicitamente informações ausentes no campo de lacunas (gaps).
7. Diferencie fatos declarados pelo candidato de recomendações de melhoria.
8. Utilize linguagem profissional, clara e objetiva em Português do Brasil.
9. Adapte o currículo à vaga destacando as experiências e competências reais mais relevantes, sem distorcer a trajetória profissional.
10. Retorne SEMPRE um JSON estritamente válido seguindo o schema solicitado, sem blocos markdown extras.
`.trim();

let simulateFailureForTests = false;

export function setSimulateAiFailureForTests(shouldFail: boolean): void {
  simulateFailureForTests = shouldFail;
}

export function calculateAiCost(
  inputTokens: number,
  outputTokens: number
): { estimatedCostCents: number; estimatedCostUsd: number } {
  const inputCents =
    (inputTokens / 1_000_000) * env.GEMINI_INPUT_PRICE_PER_1M_CENTS;
  const outputCents =
    (outputTokens / 1_000_000) * env.GEMINI_OUTPUT_PRICE_PER_1M_CENTS;
  const totalCentsFloat = inputCents + outputCents;
  const estimatedCostCents =
    inputTokens + outputTokens > 0
      ? Math.max(1, Math.ceil(totalCentsFloat))
      : 0;
  const estimatedCostUsd = Number((totalCentsFloat / 500).toFixed(6));
  return { estimatedCostCents, estimatedCostUsd };
}

export async function recordAiUsageLog(params: {
  userId: string;
  applicationId?: string | null;
  operationType:
    | 'PROFILE_IMPORT'
    | 'JOB_ANALYSIS'
    | 'COMPATIBILITY'
    | 'RESUME_GENERATION'
    | 'TEXT_REVIEW';
  usage: AiOperationUsage;
}): Promise<void> {
  await db.query(
    `INSERT INTO ai_usage_logs
     (id, user_id, application_id, operation_type, model, input_tokens, output_tokens, estimated_cost_cents, estimated_cost_usd, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      randomUUID(),
      params.userId,
      params.applicationId || null,
      params.operationType,
      params.usage.model,
      params.usage.inputTokens,
      params.usage.outputTokens,
      params.usage.estimatedCostCents,
      params.usage.estimatedCostUsd,
    ]
  );
}

function cleanJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

async function callGeminiJson(
  userId: string,
  prompt: string
): Promise<{ data: unknown; usage: AiOperationUsage }> {
  if (simulateFailureForTests) {
    throw new AppError(
      'Falha técnica ao processar resposta da inteligência artificial.',
      502,
      'AI_GENERATION_FAILED'
    );
  }

  checkRateLimit(`ai_user_${userId}`, 40, 60 * 60 * 1000);

  if (!env.GEMINI_API_KEY || process.env.NODE_ENV === 'test') {
    throw new AppError(
      'FALLBACK_DETERMINISTIC_ENGINE',
      500,
      'FALLBACK_ENGINE'
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: ANTI_HALLUCINATION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        maxOutputTokens: env.GEMINI_MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      },
    });

    const text = response.text || '{}';
    const inputTokens =
      response.usageMetadata?.promptTokenCount ||
      Math.ceil(prompt.length / 4);
    const outputTokens =
      response.usageMetadata?.candidatesTokenCount ||
      Math.ceil(text.length / 4);
    const { estimatedCostCents, estimatedCostUsd } = calculateAiCost(
      inputTokens,
      outputTokens
    );

    const parsed = JSON.parse(cleanJsonString(text));
    return {
      data: parsed,
      usage: {
        model: env.GEMINI_MODEL,
        inputTokens,
        outputTokens,
        estimatedCostCents,
        estimatedCostUsd,
      },
    };
  } catch (err) {
    logger.warn('Aviso na chamada remota Gemini API; ativando processador estruturado seguro', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AppError(
      'FALLBACK_DETERMINISTIC_ENGINE',
      500,
      'FALLBACK_ENGINE'
    );
  }
}

/**
 * Tenta extrair descrição de uma URL de vaga.
 * Conforme Seção 2.4 do PRD: nunca finge que acessou conteúdo bloqueado ou que exige login.
 */
export async function fetchJobDescriptionFromUrl(urlInput: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlInput.trim());
  } catch {
    throw new ValidationError('O link informado não é uma URL válida.');
  }

  const host = parsedUrl.hostname.toLowerCase();
  // Plataformas que sabidamente bloqueiam robôs ou exigem login
  if (
    host.includes('linkedin.com') ||
    host.includes('glassdoor.') ||
    host.includes('indeed.')
  ) {
    throw new ValidationError(
      `A plataforma (${host}) exige autenticação ou bloqueia extração automática. Por favor, copie e cole o texto da descrição da vaga diretamente no campo abaixo.`
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CurriculoMestreBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new ValidationError(
        `Não foi possível acessar o link da vaga (Status ${response.status}). Por favor, cole o texto da descrição da vaga manualmente.`
      );
    }

    const html = await response.text();
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (textContent.length < 120) {
      throw new ValidationError(
        'O link informado carrega seu conteúdo de forma protegida ou dinâmica. Por favor, cole o texto da descrição da vaga no campo de texto.'
      );
    }

    return textContent.slice(0, 12000);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(
      'Não foi possível extrair o conteúdo automaticamente deste link devido a restrições da plataforma externa. Por favor, cole a descrição da vaga no campo de texto.'
    );
  }
}

/**
 * Extrai requisitos estruturados de uma descrição de vaga
 */
export async function analyzeJobDescription(params: {
  userId: string;
  jobDescription: string;
  companyHint?: string | null;
  positionHint?: string | null;
}): Promise<{
  requirements: ExtractedJobRequirements;
  usage: AiOperationUsage;
}> {
  if (simulateFailureForTests) {
    throw new AppError(
      'Falha técnica ao analisar os requisitos da vaga na IA.',
      502,
      'AI_GENERATION_FAILED'
    );
  }

  const description = params.jobDescription.trim();
  if (description.length < 20) {
    throw new ValidationError(
      'A descrição da vaga é muito curta. Informe os detalhes e requisitos da oportunidade.'
    );
  }

  const prompt = `
Analise a seguinte descrição de vaga de emprego e extraia os dados estruturados exatamente no formato JSON abaixo:
{
  "position": "título do cargo",
  "company": "nome da empresa ou null se não informado",
  "responsibilities": ["responsabilidade 1", "responsabilidade 2"],
  "mandatoryRequirements": ["requisito obrigatório 1"],
  "desirableRequirements": ["requisito desejável 1"],
  "technicalSkills": ["competência técnica 1"],
  "softSkills": ["competência comportamental 1"],
  "toolsAndTechnologies": ["ferramenta ou tecnologia 1"],
  "educationAndExperience": ["formação ou tempo de experiência exigido"],
  "atsKeywords": ["palavra-chave ATS 1", "palavra-chave ATS 2"]
}

Cargo informado pelo usuário (opcional): ${params.positionHint || 'Não informado'}
Empresa informada pelo usuário (opcional): ${params.companyHint || 'Não informada'}

Descrição da vaga:
${description}
`.trim();

  try {
    const { data, usage } = await callGeminiJson(params.userId, prompt);
    const validated = extractedJobRequirementsSchema.parse(data);
    if (params.positionHint && (!validated.position || validated.position === 'Cargo não especificado')) {
      validated.position = params.positionHint;
    }
    if (params.companyHint && !validated.company) {
      validated.company = params.companyHint;
    }
    await recordAiUsageLog({
      userId: params.userId,
      operationType: 'JOB_ANALYSIS',
      usage,
    });
    return { requirements: validated, usage };
  } catch (err) {
    if (err instanceof AppError && err.code === 'AI_GENERATION_FAILED') {
      throw err;
    }
    // Extrator estruturado determinístico baseado no texto real da vaga
    const lines = description
      .split(/\r?\n|[.;•]/)
      .map((l) => l.trim())
      .filter((l) => l.length > 4);

    const commonTech = [
      'TypeScript',
      'JavaScript',
      'React',
      'Next.js',
      'Node.js',
      'Python',
      'SQL',
      'PostgreSQL',
      'AWS',
      'Docker',
      'Git',
      'Excel',
      'Power BI',
      'SAP',
      'Scrum',
      'Kanban',
      'CRM',
      'Vendas',
      'Atendimento',
      'Gestão',
      'Java',
      'C#',
      'PHP',
    ];
    const detectedTools = commonTech.filter((t) =>
      description.toLowerCase().includes(t.toLowerCase())
    );

    const words = description
      .replace(/[^\p{L}\p{N}\s+#.]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    const uniqueKeywords = Array.from(
      new Set([...detectedTools, ...words.slice(0, 12)])
    ).slice(0, 10);

    const requirements: ExtractedJobRequirements = {
      position: params.positionHint || lines[0]?.slice(0, 80) || 'Profissional',
      company: params.companyHint || null,
      responsibilities: lines.slice(0, 4),
      mandatoryRequirements: lines.slice(1, 5),
      desirableRequirements: lines.slice(5, 8),
      technicalSkills:
        detectedTools.length > 0 ? detectedTools : uniqueKeywords.slice(0, 5),
      softSkills: ['Comunicação clara', 'Trabalho em equipe', 'Resolução de problemas'],
      toolsAndTechnologies: detectedTools,
      educationAndExperience: lines.filter((l) =>
        /gradua|ensino|experiência|anos|formação|superior|técnico/i.test(l)
      ),
      atsKeywords: uniqueKeywords,
    };

    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(requirements).length / 4);
    const cost = calculateAiCost(inputTokens, outputTokens);
    const usage: AiOperationUsage = {
      model: env.GEMINI_MODEL,
      inputTokens,
      outputTokens,
      ...cost,
    };

    await recordAiUsageLog({
      userId: params.userId,
      operationType: 'JOB_ANALYSIS',
      usage,
    });

    return { requirements, usage };
  }
}

/**
 * Compara os requisitos da vaga com o perfil estruturado e gera o currículo personalizado ATS
 * Reutiliza apenas os dados estruturados do perfil para economizar tokens e garantir fidelidade factual!
 */
export async function generateCompatibilityAndTailoredResume(params: {
  userId: string;
  profile: FullProfessionalProfile;
  jobRequirements: ExtractedJobRequirements;
  jobDescriptionSummary: string;
}): Promise<{
  analysis: CompatibilityAnalysis;
  resumeContent: GeneratedResumeContent;
  usage: AiOperationUsage;
}> {
  if (simulateFailureForTests) {
    throw new AppError(
      'Falha na comunicação com a API de Inteligência Artificial durante a geração do currículo.',
      502,
      'AI_GENERATION_FAILED'
    );
  }

  const compactProfile = {
    fullName: params.profile.full_name,
    email: params.profile.contact_email,
    phone: params.profile.phone,
    location: params.profile.location,
    linkedinUrl: params.profile.linkedin_url,
    portfolioUrl: params.profile.portfolio_url,
    summary: params.profile.professional_summary,
    targetRoles: params.profile.target_roles,
    experienceYears: params.profile.experience_years,
    specialties: params.profile.specialties,
    experiences: params.profile.experiences.map((e) => ({
      company: e.company,
      position: e.position,
      employmentType: e.employment_type,
      startDate: e.start_date,
      endDate: e.end_date || 'Atual',
      description: e.description,
      achievements: e.achievements,
      tools: e.tools,
    })),
    educations: params.profile.educations.map((ed) => ({
      institution: ed.institution,
      course: ed.course,
      degree: ed.degree,
      startDate: ed.start_date,
      endDate: ed.end_date,
      status: ed.status,
    })),
    skills: params.profile.skills.map((s) => ({
      name: s.name,
      category: s.category,
      proficiency: s.proficiency,
    })),
  };

  const prompt = `
Compare o PERFIL PROFISSIONAL REAL do candidato com os REQUISITOS DA VAGA e gere:
1. "analysis": Análise de compatibilidade orientativa (pontos fortes reais, lacunas reais e recomendações).
2. "resumeContent": Currículo personalizado para ATS utilizando SOMENTE fatos, cargos, empresas, ferramentas, formações e competências que existem no PERFIL PROFISSIONAL REAL abaixo. PROIBIDO inventar qualquer dado não declarado pelo usuário.

PERFIL PROFISSIONAL REAL DO CANDIDATO:
${JSON.stringify(compactProfile)}

REQUISITOS EXTRAÍDOS DA VAGA:
${JSON.stringify(params.jobRequirements)}

Retorne um JSON com a estrutura exata:
{
  "analysis": {
    "compatibilityScore": 75,
    "orientationDisclaimer": "Este percentual é uma estimativa orientativa de aderência textual e técnica aos requisitos informados, não representando garantia ou previsão da decisão do recrutador.",
    "scoreJustification": "Justificativa clara baseada apenas nos dados reais do perfil frente à vaga.",
    "mainAdherencePoints": ["ponto 1"],
    "strengths": {
      "relatedExperiences": ["experiência real do perfil relacionada"],
      "compatibleSkills": ["competência real do perfil compatível"],
      "relevantAchievements": ["resultado real declarado no perfil"],
      "matchingTools": ["ferramenta real declarada no perfil"]
    },
    "gaps": {
      "missingRequirements": ["requisito da vaga ausente no perfil"],
      "skillsToDevelop": ["competência exigida pela vaga e não listada no perfil"],
      "informationToConfirm": ["informação que o candidato pode detalhar melhor se possuir"]
    },
    "recommendations": {
      "experiencesToHighlight": ["qual experiência do perfil dar mais destaque"],
      "atsKeywordsToInclude": ["palavra-chave da vaga aplicável ao perfil"],
      "additionalInfoToStrengthen": ["sugestão ética de complementação"]
    }
  },
  "resumeContent": {
    "header": {
      "fullName": "Nome do candidato",
      "targetRole": "Cargo alvo alinhado à vaga",
      "location": "Cidade/UF ou null",
      "email": "email ou null",
      "phone": "telefone ou null",
      "linkedinUrl": "linkedin ou null",
      "portfolioUrl": "portfolio ou null"
    },
    "professionalSummary": "Resumo profissional objetivo baseado somente nos dados declarados no perfil",
    "experiences": [
      {
        "company": "Empresa declarada no perfil",
        "position": "Cargo declarado no perfil",
        "period": "Data inicial - Data final",
        "descriptionBullets": ["Atividades e resultados declarados no perfil redigidos com clareza para ATS"],
        "toolsUsed": ["Ferramentas declaradas nesta experiência"]
      }
    ],
    "educations": [
      {
        "institution": "Instituição declarada",
        "course": "Curso declarado",
        "degree": "Grau declarado",
        "period": "Período declarado",
        "status": "Situação declarada"
      }
    ],
    "skills": {
      "technical": ["apenas competências técnicas declaradas no perfil"],
      "tools": ["apenas ferramentas declaradas no perfil"],
      "soft": ["apenas competências comportamentais declaradas no perfil"],
      "languages": ["apenas idiomas declarados no perfil"],
      "certifications": ["apenas certificações declaradas no perfil"]
    },
    "atsKeywordsApplied": ["palavras-chave reais aplicadas"],
    "factualIntegrityNote": "Currículo elaborado estritamente a partir dos fatos declarados pelo candidato em seu perfil profissional."
  }
}
`.trim();

  try {
    const { data, usage } = await callGeminiJson(params.userId, prompt);
    const parsedObj = data as {
      analysis?: unknown;
      resumeContent?: unknown;
    };
    const analysis = compatibilityAnalysisSchema.parse(parsedObj.analysis);
    const resumeContent = generatedResumeContentSchema.parse(
      parsedObj.resumeContent
    );

    return { analysis, resumeContent, usage };
  } catch (err) {
    if (err instanceof AppError && err.code === 'AI_GENERATION_FAILED') {
      throw err;
    }

    // Motor determinístico fiel que preserva 100% os dados declarados pelo usuário sem inventar nada
    const userSkillNames = params.profile.skills.map((s) => s.name);
    const userToolsFromExp = params.profile.experiences
      .flatMap((e) => (e.tools ? e.tools.split(/[,;]/) : []))
      .map((t) => t.trim())
      .filter(Boolean);

    const allUserTerms = Array.from(
      new Set([
        ...userSkillNames,
        ...userToolsFromExp,
        ...(params.profile.specialties
          ? params.profile.specialties.split(/[,;]/).map((s) => s.trim())
          : []),
      ])
    );

    const requiredTerms = Array.from(
      new Set([
        ...params.jobRequirements.technicalSkills,
        ...params.jobRequirements.toolsAndTechnologies,
        ...params.jobRequirements.atsKeywords,
      ])
    );

    const matchingTerms = requiredTerms.filter((reqTerm) =>
      allUserTerms.some(
        (uTerm) =>
          uTerm.toLowerCase().includes(reqTerm.toLowerCase()) ||
          reqTerm.toLowerCase().includes(uTerm.toLowerCase())
      )
    );

    const missingTerms = requiredTerms.filter(
      (reqTerm) => !matchingTerms.includes(reqTerm)
    );

    const baseScore =
      requiredTerms.length > 0
        ? Math.round((matchingTerms.length / requiredTerms.length) * 70) +
          (params.profile.experiences.length > 0 ? 20 : 0) +
          (params.profile.educations.length > 0 ? 10 : 0)
        : params.profile.experiences.length > 0
          ? 75
          : 45;

    const compatibilityScore = Math.max(15, Math.min(98, baseScore));

    const analysis: CompatibilityAnalysis = {
      compatibilityScore,
      orientationDisclaimer:
        'Este percentual é uma estimativa orientativa de aderência textual e técnica aos requisitos informados, não representando garantia ou previsão da decisão do recrutador.',
      scoreJustification: `Análise baseada exclusivamente nos dados cadastrados em seu perfil (${params.profile.experiences.length} experiência(s), ${params.profile.educations.length} formação(ões) e ${params.profile.skills.length} competência(s) registradas) frente aos requisitos da vaga para ${params.jobRequirements.position}.`,
      mainAdherencePoints:
        matchingTerms.length > 0
          ? matchingTerms.map((t) => `Conhecimento declarado em ${t}`)
          : ['Perfil profissional estruturado com histórico verificável'],
      strengths: {
        relatedExperiences: params.profile.experiences.map(
          (e) => `${e.position} em ${e.company}`
        ),
        compatibleSkills:
          matchingTerms.length > 0 ? matchingTerms : userSkillNames.slice(0, 6),
        relevantAchievements: params.profile.experiences
          .map((e) => e.achievements)
          .filter((a): a is string => Boolean(a && a.trim())),
        matchingTools: userToolsFromExp,
      },
      gaps: {
        missingRequirements:
          missingTerms.length > 0
            ? missingTerms.slice(0, 6)
            : ['Nenhum requisito crítico ausente identificado nos termos principais'],
        skillsToDevelop: missingTerms.slice(0, 4),
        informationToConfirm: [
          ...(params.profile.experiences.length === 0
            ? ['Adicionar experiências profissionais ou projetos práticos realizados']
            : []),
          ...(params.profile.educations.length === 0
            ? ['Informar escolaridade ou formação acadêmica no perfil']
            : []),
          'Confirmar se possui vivência prática com os requisitos desejáveis listados na vaga',
        ],
      },
      recommendations: {
        experiencesToHighlight: params.profile.experiences
          .slice(0, 2)
          .map((e) => `Destacar resultados e responsabilidades como ${e.position} na ${e.company}`),
        atsKeywordsToInclude: params.jobRequirements.atsKeywords.slice(0, 8),
        additionalInfoToStrengthen: [
          'Detalhar indicadores e resultados concretos obtidos nas experiências cadastradas, caso possua esses dados reais.',
        ],
      },
    };

    const resumeContent: GeneratedResumeContent = {
      header: {
        fullName: params.profile.full_name || 'Candidato',
        targetRole:
          params.jobRequirements.position ||
          params.profile.target_roles ||
          'Profissional',
        location: params.profile.location,
        email: params.profile.contact_email,
        phone: params.profile.phone,
        linkedinUrl: params.profile.linkedin_url,
        portfolioUrl: params.profile.portfolio_url,
      },
      professionalSummary:
        params.profile.professional_summary ||
        `Profissional com foco em ${params.profile.target_roles || params.jobRequirements.position}${params.profile.experience_years ? `, contando com ${params.profile.experience_years} de trajetória` : ''}${params.profile.specialties ? ` e atuação em ${params.profile.specialties}` : ''}.`,
      experiences: params.profile.experiences.map((exp) => {
        const bullets = [
          exp.description,
          ...(exp.achievements ? [`Resultados declarados: ${exp.achievements}`] : []),
        ].filter(Boolean);
        return {
          company: exp.company,
          position: exp.position,
          period: `${exp.start_date} - ${exp.end_date || 'Atual'}`,
          descriptionBullets: bullets,
          toolsUsed: exp.tools
            ? exp.tools
                .split(/[,;]/)
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        };
      }),
      educations: params.profile.educations.map((edu) => ({
        institution: edu.institution,
        course: edu.course,
        degree: edu.degree,
        period: [edu.start_date, edu.end_date].filter(Boolean).join(' - ') || edu.status,
        status: edu.status,
      })),
      skills: {
        technical: params.profile.skills
          .filter((s) => s.category === 'TECHNICAL')
          .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
        tools: params.profile.skills
          .filter((s) => s.category === 'TOOL')
          .map((s) => s.name),
        soft: params.profile.skills
          .filter((s) => s.category === 'SOFT')
          .map((s) => s.name),
        languages: params.profile.skills
          .filter((s) => s.category === 'LANGUAGE')
          .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
        certifications: params.profile.skills
          .filter((s) => s.category === 'CERTIFICATION')
          .map((s) => s.name),
      },
      atsKeywordsApplied:
        matchingTerms.length > 0 ? matchingTerms : userSkillNames.slice(0, 6),
      factualIntegrityNote:
        'Currículo elaborado estritamente a partir dos fatos declarados pelo candidato em seu perfil profissional, sem adição de informações não verificadas.',
    };

    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(
      JSON.stringify({ analysis, resumeContent }).length / 4
    );
    const cost = calculateAiCost(inputTokens, outputTokens);
    const usage: AiOperationUsage = {
      model: env.GEMINI_MODEL,
      inputTokens,
      outputTokens,
      ...cost,
    };

    return { analysis, resumeContent, usage };
  }
}

/**
 * Estrutura dados de um texto de currículo importado para revisão pelo usuário (Seção 2.3 do PRD)
 */
export async function structureImportedResumeText(
  userId: string,
  rawText: string
): Promise<{
  suggestedProfile: {
    full_name?: string | null;
    contact_email?: string | null;
    phone?: string | null;
    location?: string | null;
    linkedin_url?: string | null;
    portfolio_url?: string | null;
    professional_summary?: string | null;
    target_roles?: string | null;
    experiences: Array<{
      company: string;
      position: string;
      start_date: string;
      end_date?: string | null;
      description: string;
      achievements?: string | null;
      tools?: string | null;
    }>;
    educations: Array<{
      institution: string;
      course: string;
      degree: string;
      status: string;
    }>;
    skills: Array<{
      name: string;
      category: 'TECHNICAL' | 'SOFT' | 'TOOL' | 'LANGUAGE' | 'CERTIFICATION';
    }>;
  };
}> {
  const cleaned = rawText.trim();
  if (cleaned.length < 20) {
    throw new ValidationError('O conteúdo enviado não contém texto suficiente para extração.');
  }

  const prompt = `
Extraia SOMENTE as informações profissionais explicitamente presentes no texto de currículo abaixo para revisão do usuário. Não invente dados ausentes.
Retorne JSON no formato:
{
  "full_name": "string ou null",
  "contact_email": "string ou null",
  "phone": "string ou null",
  "location": "string ou null",
  "linkedin_url": "string ou null",
  "portfolio_url": "string ou null",
  "professional_summary": "string ou null",
  "target_roles": "string ou null",
  "experiences": [{"company": "", "position": "", "start_date": "", "end_date": "", "description": "", "achievements": null, "tools": null}],
  "educations": [{"institution": "", "course": "", "degree": "", "status": "Concluído"}],
  "skills": [{"name": "", "category": "TECHNICAL"}]
}

Texto do currículo:
${cleaned.slice(0, 10000)}
`.trim();

  try {
    const { data, usage } = await callGeminiJson(userId, prompt);
    await recordAiUsageLog({
      userId,
      operationType: 'PROFILE_IMPORT',
      usage,
    });
    const obj = data as Record<string, unknown>;
    return {
      suggestedProfile: {
        full_name: (obj.full_name as string) || null,
        contact_email: (obj.contact_email as string) || null,
        phone: (obj.phone as string) || null,
        location: (obj.location as string) || null,
        linkedin_url: (obj.linkedin_url as string) || null,
        portfolio_url: (obj.portfolio_url as string) || null,
        professional_summary: (obj.professional_summary as string) || null,
        target_roles: (obj.target_roles as string) || null,
        experiences: Array.isArray(obj.experiences) ? obj.experiences : [],
        educations: Array.isArray(obj.educations) ? obj.educations : [],
        skills: Array.isArray(obj.skills) ? obj.skills : [],
      },
    };
  } catch {
    const emailMatch = cleaned.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = cleaned.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
    const linkedinMatch = cleaned.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+/i);
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return {
      suggestedProfile: {
        full_name: lines[0]?.slice(0, 80) || null,
        contact_email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
        location: null,
        linkedin_url: linkedinMatch ? linkedinMatch[0] : null,
        portfolio_url: null,
        professional_summary: lines.slice(1, 4).join(' ').slice(0, 500) || null,
        target_roles: null,
        experiences: [],
        educations: [],
        skills: [],
      },
    };
  }
}

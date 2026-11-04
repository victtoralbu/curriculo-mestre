import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  DEFAULT_SECTION_STATES,
  FullProfessionalProfile,
  ProfileSectionStates,
} from '@/modules/professional-profile/profile.types';
import { getOrCreateProfileByUserId } from '@/modules/professional-profile/profile.service';
import {
  ApplicationDetail,
  createApplicationAndGenerateResume,
  getApplicationByIdForUser,
} from '@/modules/resume-generation/application.service';
import {
  buildMasterResumeContentFromProfile,
  extractTextFromUploadedDocument,
} from '@/services/documents/document-export.service';
import {
  analyzeJobDescription,
  fetchJobDescriptionFromUrl,
  structureImportedResumeText,
} from '@/services/gemini/gemini.service';
import { GeneratedResumeContent } from '@/services/gemini/gemini.schemas';
import {
  ApplicationChatMetadata,
  ApplicationChatOverview,
  ApplicationFlowState,
  ChatActionButton,
  ChatMessageItem,
  ChatMessageMetadata,
  DraftEducationItem,
  DraftExperienceItem,
  OnboardingDraftState,
  OnboardingFlowState,
  OnboardingSessionOverview,
} from './onboarding.types';

export const WELCOME_ONBOARDING_MESSAGE = `Olá! Seja bem-vindo(a) ao Currículo Mestre.

Vou ajudar você a construir um currículo mestre completo, organizado e estratégico, que servirá como base para suas futuras candidaturas.

Para começar, quero conhecer sua trajetória profissional. Você já tem um currículo pronto?

Se tiver, pode enviá-lo aqui em PDF ou Word (.docx). Vou analisar as informações, organizar sua experiência e identificar o que podemos melhorar.

Não se preocupe se ele estiver desatualizado ou incompleto. Vamos construir isso juntos, passo a passo.`;

export const WELCOME_APPLICATION_MESSAGE = `Vamos preparar seu currículo para uma nova oportunidade!

Para começar, envie o link da vaga em que deseja se candidatar.

Vou analisar a descrição, identificar os requisitos e comparar com seu currículo mestre para preparar uma versão direcionada à oportunidade.`;

function createInitialDraft(profile: FullProfessionalProfile): OnboardingDraftState {
  const existingLangs = profile.skills
    .filter((s) => s.category === 'LANGUAGE')
    .map((s) => ({
      name: s.name,
      proficiency: s.proficiency || 'Intermediário',
      capabilities: s.proficiency || 'Leitura e compreensão',
    }));

  return {
    hasUploadedResume: false,
    uploadedFileName: null,
    currentSubStep: 'welcome_choice',
    currentExperienceIndex: 0,
    personal: {
      full_name: profile.full_name || null,
      contact_email: profile.contact_email || null,
      phone: profile.phone || null,
      location: profile.location || null,
      linkedin_url: profile.linkedin_url || null,
      portfolio_url: profile.portfolio_url || null,
      status: 'missing',
    },
    positioning: {
      target_roles: profile.target_roles || null,
      experience_years: profile.experience_years || null,
      specialties: profile.specialties || null,
      positioning_angle: null,
      suggested_options: [],
      status: 'missing',
    },
    summary: {
      text: profile.professional_summary || null,
      explanation: null,
      highlighted: [],
      gaps: [],
      status: 'missing',
    },
    experiences: profile.experiences.map((e) => ({
      id: e.id || randomUUID(),
      company: e.company,
      position: e.position,
      employment_type: e.employment_type || null,
      start_date: e.start_date,
      end_date: e.end_date || 'Atual',
      description: e.description,
      achievements: e.achievements || null,
      tools: e.tools || null,
      projects: null,
      improvement_explanation: null,
      interview_turns: 0,
      needs_deepening: false,
      status: profile.onboarding_completed ? 'confirmed' : 'extracted_unconfirmed',
    })),
    educations: profile.educations.map((ed) => ({
      id: ed.id || randomUUID(),
      institution: ed.institution,
      course: ed.course,
      degree: ed.degree,
      start_date: ed.start_date || null,
      end_date: ed.end_date || null,
      status: ed.status,
      confirmation_status: profile.onboarding_completed
        ? 'confirmed'
        : 'extracted_unconfirmed',
    })),
    skills: {
      technical: profile.skills
        .filter((s) => s.category === 'TECHNICAL')
        .map((s) => s.name),
      soft: profile.skills
        .filter((s) => s.category === 'SOFT')
        .map((s) => s.name),
      management: [],
      tools: profile.skills
        .filter((s) => s.category === 'TOOL')
        .map((s) => s.name),
      certifications: profile.skills
        .filter((s) => s.category === 'CERTIFICATION')
        .map((s) => s.name),
      status: profile.onboarding_completed ? 'confirmed' : 'missing',
    },
    languages: existingLangs,
    languagesStatus: profile.onboarding_completed ? 'confirmed' : 'missing',
    identifiedGaps: [],
    identifiedInconsistencies: [],
  };
}

async function appendChatMessage(params: {
  conversationId: string;
  userId: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  metadata?: ChatMessageMetadata;
}): Promise<ChatMessageItem> {
  const id = randomUUID();
  const metadata = params.metadata || {};
  await db.query(
    `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
    [
      id,
      params.conversationId,
      params.userId,
      params.role,
      params.content,
      JSON.stringify(metadata),
    ]
  );

  const res = await db.query<ChatMessageItem>(
    `SELECT id, conversation_id, user_id, role, content, metadata, created_at
     FROM chat_messages WHERE id = $1`,
    [id]
  );
  return res.rows[0];
}

async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<ChatMessageItem[]> {
  const res = await db.query<ChatMessageItem>(
    `SELECT id, conversation_id, user_id, role, content, metadata, created_at
     FROM chat_messages
     WHERE conversation_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [conversationId, userId]
  );
  return res.rows;
}

async function persistOnboardingState(params: {
  userId: string;
  conversationId: string;
  flowState: OnboardingFlowState;
  onboardingCompleted: boolean;
  sectionStates: ProfileSectionStates;
  draft: OnboardingDraftState;
  masterResume?: GeneratedResumeContent | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE chat_conversations
       SET flow_state = $1,
           metadata = $2::jsonb,
           updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [
        params.flowState,
        JSON.stringify({
          sectionStates: params.sectionStates,
          currentSubStep: params.draft.currentSubStep,
        }),
        params.conversationId,
        params.userId,
      ]
    );

    await tx.query(
      `UPDATE professional_profiles
       SET full_name = COALESCE($1, full_name),
           contact_email = COALESCE($2, contact_email),
           phone = COALESCE($3, phone),
           location = COALESCE($4, location),
           linkedin_url = COALESCE($5, linkedin_url),
           portfolio_url = COALESCE($6, portfolio_url),
           target_roles = COALESCE($7, target_roles),
           experience_years = COALESCE($8, experience_years),
           specialties = COALESCE($9, specialties),
           professional_summary = COALESCE($10, professional_summary),
           onboarding_state = $11,
           onboarding_completed = $12,
           section_states = $13::jsonb,
           extracted_draft = $14::jsonb,
           master_resume = COALESCE($15::jsonb, master_resume),
           updated_at = NOW()
       WHERE user_id = $16`,
      [
        params.draft.personal.full_name,
        params.draft.personal.contact_email,
        params.draft.personal.phone,
        params.draft.personal.location,
        params.draft.personal.linkedin_url,
        params.draft.personal.portfolio_url,
        params.draft.positioning.target_roles,
        params.draft.positioning.experience_years,
        params.draft.positioning.specialties,
        params.draft.summary.text,
        params.flowState,
        params.onboardingCompleted,
        JSON.stringify(params.sectionStates),
        JSON.stringify(params.draft),
        params.masterResume ? JSON.stringify(params.masterResume) : null,
        params.userId,
      ]
    );
  });
}

async function syncConfirmedEntitiesToProfileTables(
  userId: string,
  draft: OnboardingDraftState
): Promise<FullProfessionalProfile> {
  const profile = await getOrCreateProfileByUserId(userId);

  await db.transaction(async (tx) => {
    const confirmedExperiences = draft.experiences.filter(
      (e) => e.status === 'confirmed'
    );
    if (confirmedExperiences.length > 0) {
      await tx.query(
        `DELETE FROM professional_experiences WHERE profile_id = $1`,
        [profile.id]
      );
      for (const exp of confirmedExperiences) {
        await tx.query(
          `INSERT INTO professional_experiences
           (id, profile_id, company, position, employment_type, start_date, end_date, description, achievements, tools, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            exp.id || randomUUID(),
            profile.id,
            exp.company,
            exp.position,
            exp.employment_type || null,
            exp.start_date || 'Não informado',
            exp.end_date || 'Atual',
            exp.description,
            exp.achievements || null,
            exp.tools || null,
          ]
        );
      }
    }

    const confirmedEducations = draft.educations.filter(
      (ed) => ed.confirmation_status === 'confirmed'
    );
    if (confirmedEducations.length > 0) {
      await tx.query(`DELETE FROM educations WHERE profile_id = $1`, [
        profile.id,
      ]);
      for (const edu of confirmedEducations) {
        await tx.query(
          `INSERT INTO educations
           (id, profile_id, institution, course, degree, start_date, end_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            edu.id || randomUUID(),
            profile.id,
            edu.institution,
            edu.course,
            edu.degree,
            edu.start_date || null,
            edu.end_date || null,
            edu.status || 'Concluído',
          ]
        );
      }
    }

    if (
      draft.skills.status === 'confirmed' ||
      draft.languagesStatus === 'confirmed'
    ) {
      await tx.query(`DELETE FROM skills WHERE profile_id = $1`, [profile.id]);
      const allSkills: Array<{
        name: string;
        category: 'TECHNICAL' | 'SOFT' | 'TOOL' | 'LANGUAGE' | 'CERTIFICATION';
        proficiency: string | null;
      }> = [];

      for (const t of draft.skills.technical) {
        if (t.trim())
          allSkills.push({
            name: t.trim(),
            category: 'TECHNICAL',
            proficiency: null,
          });
      }
      for (const m of draft.skills.management) {
        if (m.trim())
          allSkills.push({
            name: m.trim(),
            category: 'SOFT',
            proficiency: 'Gestão',
          });
      }
      for (const s of draft.skills.soft) {
        if (s.trim())
          allSkills.push({
            name: s.trim(),
            category: 'SOFT',
            proficiency: null,
          });
      }
      for (const tool of draft.skills.tools) {
        if (tool.trim())
          allSkills.push({
            name: tool.trim(),
            category: 'TOOL',
            proficiency: null,
          });
      }
      for (const cert of draft.skills.certifications) {
        if (cert.trim())
          allSkills.push({
            name: cert.trim(),
            category: 'CERTIFICATION',
            proficiency: null,
          });
      }
      for (const lang of draft.languages) {
        if (lang.name.trim()) {
          const prof = [lang.proficiency, lang.capabilities]
            .filter(Boolean)
            .join(' • ');
          allSkills.push({
            name: lang.name.trim(),
            category: 'LANGUAGE',
            proficiency: prof || null,
          });
        }
      }

      for (const sk of allSkills) {
        await tx.query(
          `INSERT INTO skills (id, profile_id, name, category, proficiency, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [randomUUID(), profile.id, sk.name, sk.category, sk.proficiency]
        );
      }
    }
  });

  return getOrCreateProfileByUserId(userId);
}

/**
 * Inicializa ou recupera a sessão conversacional de Onboarding do usuário.
 * Garante que o usuário possa interromper e continuar exatamente de onde parou (Cenário D).
 */
export async function getOrInitOnboardingConversation(
  userId: string
): Promise<OnboardingSessionOverview> {
  const profile = await getOrCreateProfileByUserId(userId);

  let convRes = await db.query<{
    id: string;
    flow_state: OnboardingFlowState;
    metadata: Record<string, unknown>;
  }>(
    `SELECT id, flow_state, metadata
     FROM chat_conversations
     WHERE user_id = $1 AND context_type = 'ONBOARDING'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  const existingDraft =
    profile.extracted_draft &&
    typeof profile.extracted_draft === 'object' &&
    'currentSubStep' in profile.extracted_draft
      ? (profile.extracted_draft as unknown as OnboardingDraftState)
      : createInitialDraft(profile);

  let sectionStates: ProfileSectionStates =
    profile.section_states &&
    typeof profile.section_states === 'object' &&
    'personal' in profile.section_states
      ? (profile.section_states as ProfileSectionStates)
      : { ...DEFAULT_SECTION_STATES };

  if (profile.onboarding_completed) {
    sectionStates = {
      personal: 'completed',
      positioning: 'completed',
      summary: 'completed',
      experiences: 'completed',
      education: 'completed',
      skills: 'completed',
      languages: 'completed',
    };
    existingDraft.currentSubStep = 'master_completed';
  }

  if (convRes.rows.length === 0) {
    const convId = randomUUID();
    const initialFlowState: OnboardingFlowState = profile.onboarding_completed
      ? 'master_completed'
      : 'awaiting_resume';

    await db.query(
      `INSERT INTO chat_conversations (id, user_id, context_type, flow_state, metadata, created_at, updated_at)
       VALUES ($1, $2, 'ONBOARDING', $3, $4::jsonb, NOW(), NOW())`,
      [
        convId,
        userId,
        initialFlowState,
        JSON.stringify({ sectionStates, currentSubStep: existingDraft.currentSubStep }),
      ]
    );

    if (profile.onboarding_completed) {
      const masterResume = buildMasterResumeContentFromProfile(profile);
      await appendChatMessage({
        conversationId: convId,
        userId,
        role: 'assistant',
        content: `Excelente! Conseguimos construir seu currículo mestre.\n\nAgora temos uma base organizada com sua trajetória profissional, experiências, formação, competências e posicionamento.\n\nEsse documento será nossa referência para suas próximas candidaturas. Sempre que você encontrar uma oportunidade, poderemos adaptar seu currículo de acordo com os requisitos da vaga, sem perder a consistência da sua trajetória.`,
        metadata: {
          flowState: 'master_completed',
          masterResumePreview: masterResume,
          actions: getMasterCompletedActions(),
        },
      });
    } else {
      await appendChatMessage({
        conversationId: convId,
        userId,
        role: 'assistant',
        content: WELCOME_ONBOARDING_MESSAGE,
        metadata: {
          flowState: 'awaiting_resume',
          actions: [
            {
              id: 'upload_resume',
              label: 'Enviar meu currículo',
              type: 'file_upload',
              variant: 'primary',
            },
            {
              id: 'start_from_scratch',
              label: 'Continuar sem currículo (construir do zero)',
              type: 'message',
              value: 'Ainda não tenho um currículo pronto, quero construir do zero.',
              variant: 'secondary',
            },
          ],
        },
      });
      await persistOnboardingState({
        userId,
        conversationId: convId,
        flowState: 'awaiting_resume',
        onboardingCompleted: false,
        sectionStates,
        draft: existingDraft,
      });
    }

    convRes = await db.query(
      `SELECT id, flow_state, metadata FROM chat_conversations WHERE id = $1`,
      [convId]
    );
  }

  const conv = convRes.rows[0];
  const messages = await getConversationMessages(conv.id, userId);
  const masterResume = profile.onboarding_completed
    ? buildMasterResumeContentFromProfile(profile)
    : null;

  return {
    conversationId: conv.id,
    flowState: profile.onboarding_completed ? 'master_completed' : conv.flow_state,
    onboardingCompleted: Boolean(profile.onboarding_completed),
    sectionStates,
    draft: existingDraft,
    messages,
    masterResume,
  };
}

function getMasterCompletedActions(): ChatActionButton[] {
  return [
    {
      id: 'new_application',
      label: 'Nova candidatura',
      type: 'navigate',
      href: '/applications/new',
      variant: 'primary',
    },
    {
      id: 'preview_master',
      label: 'Visualizar currículo mestre',
      type: 'preview_master',
      variant: 'secondary',
    },
    {
      id: 'download_pdf',
      label: 'Baixar em PDF',
      type: 'download_pdf',
      href: '/api/profile/export?format=pdf',
      variant: 'outline',
    },
    {
      id: 'download_docx',
      label: 'Baixar em DOCX',
      type: 'download_docx',
      href: '/api/profile/export?format=docx',
      variant: 'outline',
    },
    {
      id: 'edit_info',
      label: 'Editar informações',
      type: 'navigate',
      href: '/profile',
      variant: 'outline',
    },
  ];
}

function isAffirmativeConfirmation(text: string, actionId?: string): boolean {
  if (actionId && actionId.startsWith('confirm_')) return true;
  const clean = text.trim().toLowerCase();
  if (!clean) return false;
  if (
    /^(sim|confirmo|confirmado|confirmar|está ótimo|esta otimo|perfeito|pode avançar|pode avancar|tudo certo|ok|concordo|aprovo|aprovado|isso mesmo|correto|pode seguir|concluir)$/i.test(
      clean
    )
  ) {
    return true;
  }
  if (
    clean.length < 45 &&
    (clean.includes('confirmo') ||
      clean.includes('está correto') ||
      clean.includes('esta correto') ||
      clean.includes('pode confirmar') ||
      clean.includes('aprovo') ||
      clean.includes('tudo certo') ||
      clean.includes('pode avançar')) &&
    !clean.includes('mas ') &&
    !clean.includes('porém') &&
    !clean.includes('mudar') &&
    !clean.includes('alterar') &&
    !clean.includes('corrigir')
  ) {
    return true;
  }
  return false;
}

function buildPositioningOptions(draft: OnboardingDraftState): string[] {
  const expPositions = draft.experiences.map((e) => e.position).filter(Boolean);
  const techSkills = draft.skills.technical.slice(0, 3);
  const currentTarget = draft.positioning.target_roles;

  if (expPositions.length >= 2) {
    const unique = Array.from(new Set(expPositions));
    return [
      `${unique[0]} & ${unique[1]} (Posicionamento abrangente)`,
      `Especialista em ${unique[0]} (Foco principal)`,
    ];
  }
  if (currentTarget) {
    return [
      `${currentTarget}${techSkills.length > 0 ? ` | ${techSkills.slice(0, 2).join(' & ')}` : ''} (Abrangente)`,
      `${currentTarget} (Foco Direcionado)`,
    ];
  }
  if (expPositions.length === 1) {
    return [
      `${expPositions[0]} & Operações Estratégicas (Abrangente)`,
      `${expPositions[0]} (Foco Principal)`,
    ];
  }
  return [
    'Apresentação abrangente valorizando múltiplas competências',
    'Apresentação focada em uma área principal de especialidade',
  ];
}

function generateDraftSummary(draft: OnboardingDraftState): {
  text: string;
  explanation: string;
  highlighted: string[];
  gaps: string[];
} {
  const role =
    draft.positioning.target_roles ||
    draft.experiences[0]?.position ||
    'Profissional';
  const years = draft.positioning.experience_years
    ? ` com ${draft.positioning.experience_years} de trajetória`
    : '';
  const companiesOrExp =
    draft.experiences.length > 0
      ? `, com atuação prática como ${draft.experiences
          .slice(0, 2)
          .map((e) => `${e.position} (${e.company})`)
          .join(' e ')}`
      : '';
  const topSkills = [
    ...draft.skills.technical.slice(0, 4),
    ...draft.skills.tools.slice(0, 3),
  ];
  const skillsClause =
    topSkills.length > 0
      ? `. Domínio aplicado em ${topSkills.join(', ')}`
      : draft.positioning.specialties
        ? `. Foco de atuação em ${draft.positioning.specialties}`
        : '';

  const eduClause =
    draft.educations.length > 0
      ? ` e formação em ${draft.educations[0].course} (${draft.educations[0].institution})`
      : '';

  const text =
    draft.summary.text && draft.summary.text.length > 60
      ? draft.summary.text
      : `${role}${years}${companiesOrExp}${skillsClause}${eduClause}, com foco em organização de processos, entrega consistente de valor e alinhamento aos objetivos do negócio.`;

  const explanation =
    'Organizei seu resumo começando pela sua área de atuação e posicionamento, depois destaquei sua experiência prática comprobada e, por último, suas competências técnicas e formação. Essa estrutura facilita a identificação imediata do seu perfil por recrutadores e sistemas ATS, pois apresenta primeiro as palavras-chave mais relevantes.';

  const highlighted = [
    `Posicionamento central como ${role}`,
    ...(draft.experiences.length > 0
      ? [`Histórico prático em ${draft.experiences.map((e) => e.company).join(', ')}`]
      : []),
    ...(topSkills.length > 0
      ? [`Palavras-chave técnicas e ferramentas: ${topSkills.join(', ')}`]
      : []),
  ];

  const gaps: string[] = [];
  if (!draft.positioning.experience_years) {
    gaps.push('Tempo total aproximado de experiência na área (opcional)');
  }
  if (
    draft.experiences.length > 0 &&
    !draft.experiences.some((e) => e.achievements)
  ) {
    gaps.push(
      'Principais conquistas ou impactos que detalharemos na próxima etapa (Experiências)'
    );
  }

  return { text, explanation, highlighted, gaps };
}

function buildExperienceQuestion(exp: DraftExperienceItem): string {
  const descLower = exp.description.toLowerCase();
  if (descLower.includes('crm') || descLower.includes('implantação') || descLower.includes('implantacao')) {
    return `Na sua experiência como **${exp.position}** na **${exp.company || 'empresa'}**, você mencionou atuação com implantação/CRM. Para valorizar melhor essa experiência, gostaria de entender: você também configurava o CRM e treinava os usuários ou sua atuação era concentrada no acompanhamento da implantação? E após a implantação, você acompanhava os resultados alcançados pelos clientes?`;
  }
  if (descLower.includes('atendimento') || descLower.includes('cliente') || descLower.includes('suporte') || descLower.includes('customer')) {
    return `Na sua experiência como **${exp.position}** na **${exp.company}**, identifiquei suas atividades voltadas a clientes. Gostaria de entender melhor uma parte dessa experiência: você era responsável diretamente pela gestão de uma carteira de clientes ou atuava principalmente no suporte e operação? Quais ferramentas utilizava e quais resultados ou melhorias conseguiu alcançar?`;
  }
  if (!exp.tools && !exp.achievements) {
    return `Na sua experiência como **${exp.position}** na **${exp.company}** (${exp.start_date} - ${exp.end_date || 'Atual'}), identifiquei: *"${exp.description}"*.\n\nPara deixarmos essa experiência mais forte e estratégica: quais eram suas principais responsabilidades diretas, quais ferramentas/tecnologias você utilizava no dia a dia e quais resultados ou melhorias concretas você implementou? (Se não lembrar de números exatos, pode me contar o impacto prático do seu trabalho!)`;
  }
  if (!exp.achievements) {
    return `Na sua experiência como **${exp.position}** na **${exp.company}**, já identifiquei suas atividades e o uso de **${exp.tools}**. Você trabalhava com metas/indicadores ou participou de algum projeto importante cujos resultados possamos destacar aqui?`;
  }
  return `Na sua experiência como **${exp.position}** na **${exp.company}** (${exp.start_date} - ${exp.end_date || 'Atual'}), já temos suas responsabilidades, ferramentas (${exp.tools || 'informadas'}) e resultados (${exp.achievements}). Você gostaria de acrescentar mais algum detalhe sobre o escopo da sua atuação (como liderança ou projetos) ou já podemos consolidar a versão otimizada desta experiência?`;
}

/**
 * Etapa 2: Recebe o arquivo PDF ou DOCX enviado no chat, valida, extrai, interpreta e inicia a entrevista guiada.
 */
export async function uploadResumeInOnboarding(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<OnboardingSessionOverview> {
  const session = await getOrInitOnboardingConversation(params.userId);
  const { conversationId, draft, sectionStates } = session;

  // 1. Validar e extrair texto do documento
  const extractedText = await extractTextFromUploadedDocument(
    params.fileName,
    params.buffer
  );

  // Registrar mensagem do usuário enviando o currículo
  await appendChatMessage({
    conversationId,
    userId: params.userId,
    role: 'user',
    content: `Enviei meu currículo: ${params.fileName}`,
    metadata: {
      fileInfo: {
        fileName: params.fileName,
        fileSize: params.buffer.byteLength,
      },
    },
  });

  // 2. Estruturar dados do currículo sem inventar fatos
  const { suggestedProfile } = await structureImportedResumeText(
    params.userId,
    extractedText
  );

  // Salvar documento original em uploaded_resumes
  await db.query(
    `INSERT INTO uploaded_resumes (id, user_id, file_name, mime_type, file_size, extracted_text, parsed_data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())`,
    [
      randomUUID(),
      params.userId,
      params.fileName,
      params.mimeType || 'application/octet-stream',
      params.buffer.byteLength,
      extractedText,
      JSON.stringify(suggestedProfile),
    ]
  );

  // 3. Atualizar rascunho extraído (status: extracted_unconfirmed)
  draft.hasUploadedResume = true;
  draft.uploadedFileName = params.fileName;

  if (suggestedProfile.full_name) {
    draft.personal.full_name = suggestedProfile.full_name;
  }
  if (suggestedProfile.contact_email) {
    draft.personal.contact_email = suggestedProfile.contact_email;
  }
  if (suggestedProfile.phone) {
    draft.personal.phone = suggestedProfile.phone;
  }
  if (suggestedProfile.location) {
    draft.personal.location = suggestedProfile.location;
  }
  if (suggestedProfile.linkedin_url) {
    draft.personal.linkedin_url = suggestedProfile.linkedin_url;
  }
  if (suggestedProfile.portfolio_url) {
    draft.personal.portfolio_url = suggestedProfile.portfolio_url;
  }
  draft.personal.status = 'extracted_unconfirmed';

  if (suggestedProfile.target_roles) {
    draft.positioning.target_roles = suggestedProfile.target_roles;
  } else if (suggestedProfile.experiences.length > 0) {
    draft.positioning.target_roles = suggestedProfile.experiences[0].position;
  }
  draft.positioning.status = 'extracted_unconfirmed';

  if (suggestedProfile.professional_summary) {
    draft.summary.text = suggestedProfile.professional_summary;
    draft.summary.status = 'extracted_unconfirmed';
  }

  if (suggestedProfile.experiences.length > 0) {
    draft.experiences = suggestedProfile.experiences.map((e) => ({
      id: randomUUID(),
      company: e.company || 'Empresa não informada',
      position: e.position || 'Cargo não informado',
      employment_type: null,
      start_date: e.start_date || 'Período a confirmar',
      end_date: e.end_date || 'Atual',
      description: e.description,
      achievements: e.achievements || null,
      tools: e.tools || null,
      projects: null,
      improvement_explanation: null,
      interview_turns: 0,
      needs_deepening: !e.achievements || !e.tools || e.description.length < 90,
      status: 'extracted_unconfirmed',
    }));
  }

  if (suggestedProfile.educations.length > 0) {
    draft.educations = suggestedProfile.educations.map((ed) => ({
      id: randomUUID(),
      institution: ed.institution,
      course: ed.course,
      degree: ed.degree || 'Graduação',
      start_date: null,
      end_date: null,
      status: ed.status || 'Concluído',
      confirmation_status: 'extracted_unconfirmed',
    }));
  }

  if (suggestedProfile.skills.length > 0) {
    draft.skills.technical = suggestedProfile.skills
      .filter((s) => s.category === 'TECHNICAL')
      .map((s) => s.name);
    draft.skills.tools = suggestedProfile.skills
      .filter((s) => s.category === 'TOOL')
      .map((s) => s.name);
    draft.skills.soft = suggestedProfile.skills
      .filter((s) => s.category === 'SOFT')
      .map((s) => s.name);
    draft.skills.certifications = suggestedProfile.skills
      .filter((s) => s.category === 'CERTIFICATION')
      .map((s) => s.name);
    draft.skills.status = 'extracted_unconfirmed';

    const extractedLangs = suggestedProfile.skills.filter(
      (s) => s.category === 'LANGUAGE'
    );
    if (extractedLangs.length > 0) {
      draft.languages = extractedLangs.map((l) => ({
        name: l.name,
        proficiency: 'Nível a confirmar',
        capabilities: 'Capacidades de leitura, escrita e conversação a confirmar',
      }));
      draft.languagesStatus = 'extracted_unconfirmed';
    }
  }

  // Identificar lacunas reais no currículo enviado
  const gaps: string[] = [];
  if (!draft.personal.phone) gaps.push('Telefone / WhatsApp de contato');
  if (!draft.personal.location) gaps.push('Cidade e Estado');
  if (!draft.personal.linkedin_url) gaps.push('Link do LinkedIn (opcional)');
  if (draft.experiences.length === 0) gaps.push('Experiências profissionais');
  if (draft.educations.length === 0) gaps.push('Formação acadêmica');
  if (draft.languages.length === 0) gaps.push('Idiomas e nível de proficiência');
  draft.identifiedGaps = gaps;

  // Iniciar Etapa 3.1: confirmação de Dados Pessoais + transição para Posicionamento
  sectionStates.personal = 'in_progress';
  sectionStates.positioning = 'pending';
  draft.positioning.suggested_options = buildPositioningOptions(draft);

  const missingPersonal: string[] = [];
  if (!draft.personal.phone) missingPersonal.push('**Telefone/WhatsApp**');
  if (!draft.personal.location) missingPersonal.push('**Cidade e Estado**');

  draft.currentSubStep =
    missingPersonal.length > 0 ? 'personal_collect' : 'personal_confirm';

  const personalPreviewLines = [
    `Nome completo: ${draft.personal.full_name || 'Não identificado'}`,
    `E-mail: ${draft.personal.contact_email || 'Não identificado'}`,
    `Telefone: ${draft.personal.phone || '⚠️ Ausente (informe no chat)'}`,
    `Cidade/Estado: ${draft.personal.location || '⚠️ Ausente (informe no chat)'}`,
    ...(draft.personal.linkedin_url
      ? [`LinkedIn: ${draft.personal.linkedin_url}`]
      : []),
  ];

  const followUpPrompt =
    missingPersonal.length > 0
      ? `Consegui analisar seu currículo! Já identifiquei suas principais experiências (${draft.experiences.length} encontrada(s)), formação e competências, e organizei suas informações.\n\nEncontrei algumas oportunidades para melhorar a forma como sua trajetória está apresentada. Também existem alguns dados que gostaria de confirmar com você antes de finalizar.\n\nAntes de entrarmos no seu **posicionamento profissional**, notei que nos seus **Dados Pessoais** faltam apenas: ${missingPersonal.join(' e ')}. Poderia me informar esses dados para deixarmos seu cabeçalho completo?`
      : `Consegui analisar seu currículo! Já identifiquei suas principais experiências (${draft.experiences.length} encontrada(s)), formação e competências, e organizei suas informações.\n\nEncontrei algumas oportunidades para melhorar a forma como sua trajetória está apresentada. Também existem alguns dados que gostaria de confirmar com você antes de finalizar.\n\nConfira abaixo os **Dados Pessoais e de Contato** que extraí do seu currículo. Eles estão corretos para avançarmos para o seu **posicionamento profissional**?`;

  await appendChatMessage({
    conversationId,
    userId: params.userId,
    role: 'assistant',
    content: followUpPrompt,
    metadata: {
      flowState: 'collecting_profile',
      sectionPreview: {
        title: '1. Dados Pessoais e Contatos Extraídos',
        statusBadge: 'Extraído do currículo • Aguardando confirmação',
        lines: personalPreviewLines,
      },
      actions:
        missingPersonal.length === 0
          ? [
              {
                id: 'confirm_personal',
                label: 'Confirmar dados pessoais e ir para Posicionamento',
                type: 'message',
                value: 'Meus dados pessoais estão corretos, pode confirmar.',
                variant: 'primary',
              },
            ]
          : undefined,
    },
  });

  await persistOnboardingState({
    userId: params.userId,
    conversationId,
    flowState: 'collecting_profile',
    onboardingCompleted: false,
    sectionStates,
    draft,
  });

  return getOrInitOnboardingConversation(params.userId);
}

function parsePersonalFieldsFromText(
  text: string,
  draft: OnboardingDraftState
): void {
  const phoneMatch = text.match(
    /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/
  );
  if (phoneMatch) {
    draft.personal.phone = phoneMatch[0].trim();
  }

  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    draft.personal.contact_email = emailMatch[0].trim();
  }

  const linkedinMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s|,;)]+/i
  );
  if (linkedinMatch) {
    draft.personal.linkedin_url = linkedinMatch[0].startsWith('http')
      ? linkedinMatch[0]
      : `https://${linkedinMatch[0]}`;
  }

  const locStateMatch = text.match(
    /([A-ZÀ-Úa-zà-ú]+(?:\s[A-Za-zÀ-ú]+){0,3}\s*[-/,]\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO))\b/i
  );
  if (locStateMatch) {
    draft.personal.location = locStateMatch[1].trim();
  } else if (!draft.personal.location) {
    // Remove phone and urls to see if remaining text is a city/state
    const remainder = text
      .replace(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/g, '')
      .replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s|,;)]+/gi, '')
      .replace(/[,;|]/g, ' ')
      .trim();
    if (remainder.length >= 3 && remainder.length <= 60) {
      draft.personal.location = remainder;
    }
  }
}

/**
 * Processa cada mensagem ou ação do usuário no fluxo conversacional do Currículo Mestre.
 */
export async function sendOnboardingMessage(params: {
  userId: string;
  message: string;
  actionId?: string;
}): Promise<OnboardingSessionOverview> {
  const session = await getOrInitOnboardingConversation(params.userId);
  const { conversationId, draft, sectionStates } = session;
  const userText = params.message.trim();
  const actionId = params.actionId;

  if (!userText && !actionId) {
    throw new ValidationError('Digite uma mensagem ou selecione uma opção.');
  }

  // Registrar mensagem do usuário no histórico persistido
  await appendChatMessage({
    conversationId,
    userId: params.userId,
    role: 'user',
    content: userText || 'Opção selecionada',
  });

  let nextFlowState: OnboardingFlowState = session.flowState;
  let onboardingCompleted = session.onboardingCompleted;

  // -------------------------------------------------------------------------
  // CASO 0: Usuário em welcome_choice / awaiting_resume informa que não tem currículo
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'welcome_choice' ||
    session.flowState === 'welcome' ||
    session.flowState === 'awaiting_resume'
  ) {
    draft.hasUploadedResume = false;
    draft.currentSubStep = 'personal_collect';
    sectionStates.personal = 'in_progress';
    nextFlowState = 'collecting_profile';

    await appendChatMessage({
      conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Sem problemas! Vamos construir seu Currículo Mestre juntos, do zero, por meio de uma entrevista profissional passo a passo.\n\nJá tenho seu nome (**${draft.personal.full_name || 'Profissional'}**) e seu e-mail (**${draft.personal.contact_email || ''}**) do seu cadastro — então não vou repetir perguntas sobre eles.\n\nPara completarmos seus **Dados Pessoais e Contatos**, qual é a sua **Cidade e Estado** (ex: São Paulo - SP) e o seu **Telefone / WhatsApp**? Se tiver LinkedIn ou portfólio, pode me enviar também!`,
      metadata: {
        flowState: 'collecting_profile',
        sectionPreview: {
          title: '1. Dados Pessoais e Contatos',
          statusBadge: 'Em andamento',
          lines: [
            `Nome: ${draft.personal.full_name || 'Confirmado no cadastro'}`,
            `E-mail: ${draft.personal.contact_email || 'Confirmado no cadastro'}`,
            `Cidade/Estado: Pendente`,
            `Telefone: Pendente`,
          ],
        },
      },
    });

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.1: DADOS PESSOAIS E CONTATOS (personal_collect / personal_confirm)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'personal_collect' ||
    draft.currentSubStep === 'personal_confirm'
  ) {
    if (
      draft.currentSubStep === 'personal_confirm' &&
      isAffirmativeConfirmation(userText, actionId)
    ) {
      draft.personal.status = 'confirmed';
      sectionStates.personal = 'completed';
      sectionStates.positioning = 'in_progress';
      draft.positioning.suggested_options = buildPositioningOptions(draft);
      draft.currentSubStep = 'positioning_propose';
      nextFlowState = 'collecting_profile';

      const options = draft.positioning.suggested_options;
      const positioningIntro = draft.hasUploadedResume
        ? `Dados pessoais confirmados! Vamos começar pelo seu **posicionamento profissional**.\n\nAnalisando seu histórico${draft.experiences.length > 0 ? ` (${draft.experiences.map((e) => e.position).join(', ')})` : ''}, podemos estruturar seu posicionamento de maneira que suas competências sejam valorizadas sem limitar suas possibilidades profissionais.\n\nVocê gostaria de manter uma apresentação mais abrangente ou prefere destacar uma área/cargo específico como principal?`
        : `Perfeito, dados pessoais confirmados! Agora vamos definir o seu **Posicionamento Profissional**.\n\nQual é o **cargo-alvo ou área de atuação** em que você trabalha (ou busca atuar), há quanto tempo tem experiência nessa área e quais são suas principais especialidades?`;

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: positioningIntro,
        metadata: {
          flowState: 'collecting_profile',
          actions: draft.hasUploadedResume
            ? [
                {
                  id: 'pos_opt_1',
                  label: options[0] || 'Manter apresentação abrangente',
                  type: 'message',
                  value: `Prefiro o posicionamento: ${options[0] || 'apresentação abrangente'}`,
                  variant: 'primary',
                },
                {
                  id: 'pos_opt_2',
                  label: options[1] || 'Destacar área principal como especialista',
                  type: 'message',
                  value: `Prefiro destacar como principal: ${options[1] || 'minha área principal'}`,
                  variant: 'secondary',
                },
              ]
            : undefined,
        },
      });
    } else {
      // Usuário informou ou corrigiu dados pessoais
      parsePersonalFieldsFromText(userText, draft);
      draft.currentSubStep = 'personal_confirm';
      nextFlowState = 'collecting_profile';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Ótimo! Atualizei seus **Dados Pessoais e Contatos**. Confira abaixo como ficaram organizados e me confirme se podemos concluir esta seção e avançar para o seu **Posicionamento Profissional**:`,
        metadata: {
          flowState: 'collecting_profile',
          sectionPreview: {
            title: '1. Dados Pessoais e Contatos (Revisão)',
            statusBadge: 'Aguardando sua confirmação',
            lines: [
              `Nome completo: ${draft.personal.full_name || 'Informado'}`,
              `E-mail: ${draft.personal.contact_email || 'Informado'}`,
              `Telefone: ${draft.personal.phone || 'Não informado'}`,
              `Cidade/Estado: ${draft.personal.location || 'Não informado'}`,
              ...(draft.personal.linkedin_url
                ? [`LinkedIn: ${draft.personal.linkedin_url}`]
                : []),
            ],
          },
          actions: [
            {
              id: 'confirm_personal',
              label: 'Confirmar dados pessoais',
              type: 'message',
              value: 'Sim, confirmo meus dados pessoais.',
              variant: 'primary',
            },
          ],
        },
      });
    }

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.2: POSICIONAMENTO PROFISSIONAL (positioning_propose / positioning_confirm)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'positioning_propose' ||
    draft.currentSubStep === 'positioning_confirm'
  ) {
    if (
      draft.currentSubStep === 'positioning_confirm' &&
      isAffirmativeConfirmation(userText, actionId)
    ) {
      draft.positioning.status = 'confirmed';
      sectionStates.positioning = 'completed';
      sectionStates.summary = 'in_progress';
      nextFlowState = 'collecting_profile';

      // Gerar 1ª versão do Resumo Profissional com explicação educativa (Seção 3.3)
      const generatedSummary = generateDraftSummary(draft);
      draft.summary = {
        ...generatedSummary,
        status: 'extracted_unconfirmed',
      };
      draft.currentSubStep = 'summary_confirm';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Posicionamento confirmado! Agora elaborei uma primeira versão do seu **Resumo Profissional** com base na sua trajetória:\n\n> *"${generatedSummary.text}"*\n\nVocê deseja acrescentar ou corrigir algo nesse resumo, ou podemos confirmar esta versão?`,
        metadata: {
          flowState: 'collecting_profile',
          educationalBox: {
            title: 'Por que estruturei seu resumo assim? (Dica ATS & Recrutamento)',
            items: [
              generatedSummary.explanation,
              ...generatedSummary.highlighted.map(
                (h) => `Informação valorizada: ${h}`
              ),
              ...(generatedSummary.gaps.length > 0
                ? [`Oportunidade de evolução: ${generatedSummary.gaps.join('; ')}`]
                : []),
            ],
          },
          sectionPreview: {
            title: '3. Resumo Profissional Proposto',
            statusBadge: 'Aguardando sua confirmação',
            lines: [generatedSummary.text],
          },
          actions: [
            {
              id: 'confirm_summary',
              label: 'Confirmar resumo profissional',
              type: 'message',
              value: 'Confirmo o resumo profissional.',
              variant: 'primary',
            },
          ],
        },
      });
    } else {
      // Usuário escolheu ou descreveu seu posicionamento
      const cleanedChoice = userText
        .replace(/^Prefiro o posicionamento:\s*/i, '')
        .replace(/^Prefiro destacar como principal:\s*/i, '')
        .replace(/\((?:Abrangente|Foco Principal|Posicionamento abrangente|Foco Direcionado)\)/gi, '')
        .trim();

      const yearsMatch = userText.match(/(\d+\s*anos?(?:\s+de\s+experiência)?)/i);
      if (yearsMatch) {
        draft.positioning.experience_years = yearsMatch[1];
      }

      draft.positioning.target_roles =
        cleanedChoice.slice(0, 110) ||
        draft.positioning.target_roles ||
        'Profissional Especialista';
      if (!draft.positioning.specialties) {
        draft.positioning.specialties =
          draft.skills.technical.slice(0, 4).join(', ') ||
          draft.positioning.target_roles;
      }
      draft.currentSubStep = 'positioning_confirm';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Excelente escolha! Estruturei seu **Posicionamento Profissional** como **${draft.positioning.target_roles}**.\n\nEsse título deixa claro para recrutadores e sistemas de triagem (ATS) qual é o seu foco de atuação logo no topo do currículo. Você confirma esse posicionamento para avançarmos ao **Resumo Profissional**?`,
        metadata: {
          flowState: 'collecting_profile',
          sectionPreview: {
            title: '2. Posicionamento Profissional',
            statusBadge: 'Aguardando confirmação',
            lines: [
              `Título / Posicionamento: ${draft.positioning.target_roles}`,
              ...(draft.positioning.experience_years
                ? [`Tempo de experiência: ${draft.positioning.experience_years}`]
                : []),
              ...(draft.positioning.specialties
                ? [`Especialidades em destaque: ${draft.positioning.specialties}`]
                : []),
            ],
          },
          actions: [
            {
              id: 'confirm_positioning',
              label: 'Confirmar posicionamento profissional',
              type: 'message',
              value: 'Sim, confirmo meu posicionamento profissional.',
              variant: 'primary',
            },
          ],
        },
      });
    }

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.3: RESUMO PROFISSIONAL (summary_propose / summary_confirm)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'summary_propose' ||
    draft.currentSubStep === 'summary_confirm'
  ) {
    if (isAffirmativeConfirmation(userText, actionId)) {
      draft.summary.status = 'confirmed';
      sectionStates.summary = 'completed';
      sectionStates.experiences = 'in_progress';
      nextFlowState = 'collecting_experience';

      if (draft.experiences.length > 0) {
        draft.currentExperienceIndex = 0;
        draft.currentSubStep = 'experience_interview';
        const firstExp = draft.experiences[0];
        const question = buildExperienceQuestion(firstExp);

        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Resumo profissional confirmado! Agora vamos revisar suas **Experiências Profissionais** (${draft.experiences.length} identificada(s)) para destacar seu impacto real.\n\n${question}`,
          metadata: {
            flowState: 'collecting_experience',
            sectionPreview: {
              title: `Experiência 1 de ${draft.experiences.length}: ${firstExp.position} — ${firstExp.company}`,
              statusBadge: 'Em análise com a IA',
              lines: [
                `Período: ${firstExp.start_date} - ${firstExp.end_date || 'Atual'}`,
                `Atividades identificadas: ${firstExp.description}`,
                ...(firstExp.tools ? [`Ferramentas: ${firstExp.tools}`] : []),
                ...(firstExp.achievements
                  ? [`Resultados: ${firstExp.achievements}`]
                  : []),
              ],
            },
          },
        });
      } else {
        draft.currentExperienceIndex = 0;
        draft.currentSubStep = 'experience_interview';

        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Resumo profissional confirmado! Agora vamos construir a seção de **Experiências Profissionais**.\n\nMe conte sobre sua experiência mais recente ou relevante: em qual **empresa** você trabalhou, qual era seu **cargo**, o **período** e quais atividades realizava? (Se estiver em busca do primeiro emprego e não tiver experiências anteriores, basta me avisar!)`,
          metadata: {
            flowState: 'collecting_experience',
          },
        });
      }
    } else {
      // Usuário pediu ajustes ou enviou informações adicionais para o resumo
      const baseSummary = draft.summary.text || '';
      const revisedText =
        userText.length > 70
          ? userText
          : `${baseSummary.replace(/\.$/, '')}. ${userText}`;
      draft.summary.text = revisedText;
      draft.currentSubStep = 'summary_confirm';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Incorporei suas observações e preparei a **versão revisada do seu Resumo Profissional**:\n\n> *"${revisedText}"*\n\nFicou exatamente como você gostaria para confirmarmos esta seção?`,
        metadata: {
          flowState: 'collecting_profile',
          sectionPreview: {
            title: '3. Resumo Profissional (Versão Revisada)',
            statusBadge: 'Aguardando confirmação',
            lines: [revisedText],
          },
          actions: [
            {
              id: 'confirm_summary',
              label: 'Confirmar versão revisada do resumo',
              type: 'message',
              value: 'Confirmo o resumo revisado.',
              variant: 'primary',
            },
          ],
        },
      });
    }

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.4: EXPERIÊNCIAS PROFISSIONAIS (experience_interview / experience_confirm / experience_add_more)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'experience_interview' ||
    draft.currentSubStep === 'experience_confirm' ||
    draft.currentSubStep === 'experience_add_more'
  ) {
    nextFlowState = 'collecting_experience';

    // Caso o usuário declare que não possui experiências (1º emprego) ou queira finalizar a lista de experiências
    const wantsToFinishExperiences =
      actionId === 'finish_experiences' ||
      (draft.currentSubStep === 'experience_add_more' &&
        (isAffirmativeConfirmation(userText, actionId) ||
          /não tenho mais|nao tenho mais|concluir|avançar|avancar|só essas|so essas|pode seguir/i.test(
            userText
          ))) ||
      (draft.experiences.length === 0 &&
        /primeiro emprego|não tenho experiência|nao tenho experiencia|sem experiência|sem experiencia/i.test(
          userText
        ));

    if (wantsToFinishExperiences) {
      sectionStates.experiences = 'completed';
      sectionStates.education = 'in_progress';
      nextFlowState = 'collecting_education';
      await syncConfirmedEntitiesToProfileTables(params.userId, draft);

      if (draft.educations.length > 0) {
        draft.currentSubStep = 'education_confirm';
        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Seção de **Experiências Profissionais** concluída! Agora vamos para sua **Formação Acadêmica e Cursos**.\n\nOrganizei abaixo a formação que identifiquei no seu currículo de maneira objetiva para recrutadores. Os dados de instituição, curso, grau e situação estão corretos, ou deseja complementar algum período/curso?`,
          metadata: {
            flowState: 'collecting_education',
            educationalBox: {
              title: 'Como apresentar a Formação Acadêmica de forma estratégica',
              items: [
                'Destaque o grau acadêmico, nome exato do curso, instituição e situação (Concluído ou Cursando).',
                'Mantenha apenas cursos complementares que tenham conexão direta com seu posicionamento atual.',
              ],
            },
            sectionPreview: {
              title: '5. Formação Acadêmica Organizada',
              statusBadge: 'Aguardando confirmação',
              lines: draft.educations.map(
                (ed) =>
                  `${ed.degree} em ${ed.course} — ${ed.institution} (${ed.status})`
              ),
            },
            actions: [
              {
                id: 'confirm_education',
                label: 'Confirmar formação acadêmica',
                type: 'message',
                value: 'Confirmo minha formação acadêmica.',
                variant: 'primary',
              },
            ],
          },
        });
      } else {
        draft.currentSubStep = 'education_collect';
        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Seção de **Experiências Profissionais** concluída! Agora vamos organizar sua **Formação Acadêmica e Cursos**.\n\nQual é a sua principal formação (Instituição, Curso, Grau acadêmico, Período e se está Concluído ou Cursando)? Se tiver cursos complementares ou certificações relevantes, pode informar também!`,
          metadata: {
            flowState: 'collecting_education',
          },
        });
      }

      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: nextFlowState,
        onboardingCompleted: false,
        sectionStates,
        draft,
      });
      return getOrInitOnboardingConversation(params.userId);
    }

    // Se clicou em "Adicionar outra experiência"
    if (
      actionId === 'add_another_experience' ||
      (draft.currentSubStep === 'experience_add_more' &&
        /adicionar|outra|mais uma/i.test(userText))
    ) {
      draft.currentExperienceIndex = draft.experiences.length;
      draft.currentSubStep = 'experience_interview';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Perfeito! Me conte sobre essa outra experiência profissional: qual era a **empresa**, o **cargo**, o **período** e suas principais responsabilidades e resultados?`,
        metadata: {
          flowState: 'collecting_experience',
        },
      });

      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: nextFlowState,
        onboardingCompleted: false,
        sectionStates,
        draft,
      });
      return getOrInitOnboardingConversation(params.userId);
    }

    // Se o usuário está aprovando a versão otimizada da experiência atual
    if (
      draft.currentSubStep === 'experience_confirm' &&
      isAffirmativeConfirmation(userText, actionId)
    ) {
      const idx = draft.currentExperienceIndex;
      if (draft.experiences[idx]) {
        draft.experiences[idx].status = 'confirmed';
      }

      if (idx + 1 < draft.experiences.length) {
        draft.currentExperienceIndex = idx + 1;
        draft.currentSubStep = 'experience_interview';
        const nextExp = draft.experiences[idx + 1];
        const nextQuestion = buildExperienceQuestion(nextExp);

        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Experiência aprovada! Vamos agora para a sua próxima experiência (**${idx + 2} de ${draft.experiences.length}**).\n\n${nextQuestion}`,
          metadata: {
            flowState: 'collecting_experience',
            sectionPreview: {
              title: `Experiência ${idx + 2} de ${draft.experiences.length}: ${nextExp.position} — ${nextExp.company}`,
              statusBadge: 'Em análise com a IA',
              lines: [
                `Período: ${nextExp.start_date} - ${nextExp.end_date || 'Atual'}`,
                `Atividades identificadas: ${nextExp.description}`,
              ],
            },
          },
        });
      } else {
        draft.currentSubStep = 'experience_add_more';
        await syncConfirmedEntitiesToProfileTables(params.userId, draft);

        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Excelente! Já organizamos e validamos ${draft.experiences.length} experiência(s) profissional(is) com foco em impacto e leitura ATS.\n\nVocê deseja adicionar mais alguma experiência anterior ou podemos concluir esta seção e avançar para sua **Formação Acadêmica**?`,
          metadata: {
            flowState: 'collecting_experience',
            actions: [
              {
                id: 'finish_experiences',
                label: 'Concluir experiências e avançar para Formação',
                type: 'message',
                value: 'Concluir experiências e avançar para Formação Acadêmica.',
                variant: 'primary',
              },
              {
                id: 'add_another_experience',
                label: 'Adicionar outra experiência',
                type: 'message',
                value: 'Quero adicionar outra experiência profissional.',
                variant: 'secondary',
              },
            ],
          },
        });
      }

      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: nextFlowState,
        onboardingCompleted: false,
        sectionStates,
        draft,
      });
      return getOrInitOnboardingConversation(params.userId);
    }

    // Caso contrário: estamos em experience_interview (ou editando em experience_confirm)
    const idx = draft.currentExperienceIndex;
    let currentExp = draft.experiences[idx];

    if (!currentExp) {
      // Construindo uma nova experiência do zero a partir do relato do usuário
      const parts = userText.split(/[—\-|•,]/).map((p) => p.trim()).filter(Boolean);
      const companyMatch = userText.match(/(?:na|em|empresa)\s+([A-ZÀ-Ú][\wÀ-ú\s&.-]{1,40})/i);
      const roleMatch = userText.match(/(?:como|cargo(?:\s+de)?)\s+([A-ZÀ-Úa-zà-ú][\wÀ-ú\s/-]{2,40})/i);
      const periodMatch = userText.match(/(\d{2}\/\d{4}|\b20\d{2}\b)(?:\s*(?:a|até|-)\s*(\d{2}\/\d{4}|\b20\d{2}\b|Atual))?/i);

      currentExp = {
        id: randomUUID(),
        company: companyMatch ? companyMatch[1].trim() : parts[0]?.slice(0, 50) || 'Empresa informada',
        position: roleMatch
          ? roleMatch[1].trim()
          : draft.positioning.target_roles || 'Profissional',
        employment_type: 'CLT',
        start_date: periodMatch ? periodMatch[1] : '2022',
        end_date: periodMatch && periodMatch[2] ? periodMatch[2] : 'Atual',
        description: userText,
        achievements: null,
        tools: null,
        projects: null,
        improvement_explanation: null,
        interview_turns: 1,
        needs_deepening: userText.length < 110,
        status: 'extracted_unconfirmed',
      };
      draft.experiences[idx] = currentExp;

      // Comportamento adaptativo (Seção 4): Se a frase inicial for curta (ex: "Trabalhei com implantação de CRM para empresas"), investigar o contexto antes de fechar!
      if (currentExp.needs_deepening) {
        const contextualQuestion = buildExperienceQuestion(currentExp);
        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Interessante! ${contextualQuestion}`,
          metadata: {
            flowState: 'collecting_experience',
          },
        });

        await persistOnboardingState({
          userId: params.userId,
          conversationId,
          flowState: nextFlowState,
          onboardingCompleted: false,
          sectionStates,
          draft,
        });
        return getOrInitOnboardingConversation(params.userId);
      }
    } else {
      // Enriquecendo uma experiência já existente com a resposta do usuário (sem inventar métricas!)
      currentExp.interview_turns += 1;
      const noMetricsDeclared =
        /não sei|nao sei|não lembro|nao lembro|sem indicadores|sem números|sem numeros/i.test(
          userText
        );

      // Detectar ferramentas mencionadas na resposta
      const detectedToolsInReply = [
        'HubSpot',
        'Salesforce',
        'RD Station',
        'Pipedrive',
        'Zendesk',
        'Jira',
        'Trello',
        'Excel',
        'Power BI',
        'SQL',
        'PostgreSQL',
        'React',
        'Next.js',
        'TypeScript',
        'Node.js',
        'Python',
        'SAP',
        'AWS',
        'Docker',
        'Git',
        'CRM',
        'ERP',
      ].filter((t) => userText.toLowerCase().includes(t.toLowerCase()));

      if (detectedToolsInReply.length > 0) {
        const existingTools = currentExp.tools
          ? currentExp.tools.split(/[,;]/).map((x) => x.trim())
          : [];
        currentExp.tools = Array.from(
          new Set([...existingTools, ...detectedToolsInReply])
        ).join(', ');
      }

      if (!noMetricsDeclared) {
        if (
          /\d+%|\d+\s*(?:clientes|empresas|projetos|pessoas|usuários|usuarios|dias|horas|mil|milhões)/i.test(
            userText
          ) ||
          /resultado|redução|aumento|melhoria|meta| retenção|implantação|sucesso/i.test(
            userText
          )
        ) {
          currentExp.achievements = currentExp.achievements
            ? `${currentExp.achievements}; ${userText}`
            : userText;
        } else {
          currentExp.description = `${currentExp.description.replace(/\.$/, '')}. ${userText}`;
        }
      }
      currentExp.needs_deepening = false;
    }

    // Apresentar Otimização Educativa ("Como estamos melhorando esta experiência?") e pedir aprovação do usuário
    draft.currentSubStep = 'experience_confirm';
    const explanationItems = [
      'O que foi reorganizado: Estruturamos sua atuação destacando responsabilidades diretas e contexto operacional logo no início.',
      'Por que priorizamos essas informações: Sistemas ATS e recrutadores buscam rapidamente o escopo da função e as ferramentas utilizadas na prática.',
      currentExp.achievements
        ? 'Demonstração de valor: Evidenciamos os impactos e resultados reais que você relatou, conectando suas atividades a entregas concretas.'
        : 'Demonstração ética de valor: Como não há métricas numéricas exatas declaradas, valorizamos o impacto qualitativo e a consistência dos processos sob sua responsabilidade — sem inventar percentuais ou números.',
    ];

    await appendChatMessage({
      conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Organizei e otimizei sua experiência como **${currentExp.position}** na **${currentExp.company}**. Veja abaixo como aprimoramos a apresentação e me confirme se aprova esta versão:`,
      metadata: {
        flowState: 'collecting_experience',
        educationalBox: {
          title: 'Como estamos melhorando esta experiência?',
          items: explanationItems,
        },
        sectionPreview: {
          title: `Experiência Otimizada: ${currentExp.position} — ${currentExp.company}`,
          statusBadge: 'Aguardando sua aprovação',
          lines: [
            `Período: ${currentExp.start_date} - ${currentExp.end_date || 'Atual'}`,
            `Descrição e Responsabilidades: ${currentExp.description}`,
            ...(currentExp.achievements
              ? [`Resultados e Impacto: ${currentExp.achievements}`]
              : []),
            ...(currentExp.tools
              ? [`Ferramentas Utilizadas: ${currentExp.tools}`]
              : []),
          ],
        },
        actions: [
          {
            id: 'confirm_experience',
            label: 'Aprovar esta experiência',
            type: 'message',
            value: 'Aprovo esta versão da experiência.',
            variant: 'primary',
          },
        ],
      },
    });

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.5: FORMAÇÃO ACADÊMICA E CURSOS (education_collect / education_confirm)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'education_collect' ||
    draft.currentSubStep === 'education_confirm'
  ) {
    nextFlowState = 'collecting_education';

    if (
      draft.currentSubStep === 'education_confirm' &&
      isAffirmativeConfirmation(userText, actionId)
    ) {
      draft.educations = draft.educations.map((ed) => ({
        ...ed,
        confirmation_status: 'confirmed',
      }));
      sectionStates.education = 'completed';
      sectionStates.skills = 'in_progress';
      nextFlowState = 'collecting_skills';
      draft.currentSubStep = 'skills_confirm';

      // Consolidar competências e ferramentas a partir do histórico confirmado
      const expTools = draft.experiences
        .flatMap((e) => (e.tools ? e.tools.split(/[,;]/) : []))
        .map((t) => t.trim())
        .filter(Boolean);
      draft.skills.tools = Array.from(
        new Set([...draft.skills.tools, ...expTools])
      );
      if (draft.skills.technical.length === 0 && draft.positioning.target_roles) {
        draft.skills.technical = [
          draft.positioning.target_roles,
          ...(draft.positioning.specialties
            ? draft.positioning.specialties.split(/[,;]/).map((s) => s.trim())
            : []),
        ].filter(Boolean);
      }
      if (draft.skills.soft.length === 0) {
        draft.skills.soft = [
          'Comunicação estruturada',
          'Resolução de problemas',
          'Foco em resultados',
        ];
      }

      await syncConfirmedEntitiesToProfileTables(params.userId, draft);

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Formação acadêmica confirmada! Agora vamos estruturar suas **Competências e Ferramentas** com base nas experiências que você validou.\n\nSeparei abaixo suas competências por categoria, sustentadas pela sua trajetória real. Deseja incluir/ajustar algum item ou podemos confirmar esta seleção?`,
        metadata: {
          flowState: 'collecting_skills',
          educationalBox: {
            title: 'Competência vs. Ferramenta — Por que essa separação importa?',
            items: [
              'Competência é a sua capacidade técnica, analítica ou de gestão (ex: Gestão de Operações, Engenharia de Software, Relacionamento com Clientes).',
              'Ferramenta é a tecnologia ou software utilizado para executar o trabalho (ex: Excel, CRM, React, PostgreSQL).',
              'Evitamos listas excessivamente longas sem sustentação nas suas experiências para manter alta credibilidade em entrevistas e triagens ATS.',
            ],
          },
          sectionPreview: {
            title: '6. Competências e Ferramentas Identificadas',
            statusBadge: 'Aguardando confirmação',
            lines: [
              `Competências Técnicas e de Área: ${draft.skills.technical.join(', ') || 'A definir'}`,
              `Ferramentas e Tecnologias: ${draft.skills.tools.join(', ') || 'Nenhuma ferramenta específica listada'}`,
              `Competências Comportamentais e Gestão: ${[...draft.skills.soft, ...draft.skills.management].join(', ')}`,
              ...(draft.skills.certifications.length > 0
                ? [`Certificações: ${draft.skills.certifications.join(', ')}`]
                : []),
            ],
          },
          actions: [
            {
              id: 'confirm_skills',
              label: 'Confirmar competências e ferramentas',
              type: 'message',
              value: 'Confirmo minhas competências e ferramentas.',
              variant: 'primary',
            },
          ],
        },
      });
    } else {
      // Usuário informou ou complementou sua formação acadêmica
      const parts = userText.split(/[—\-|,•]/).map((p) => p.trim()).filter(Boolean);
      const isStudying = /cursando|andamento/i.test(userText);
      const degree = /pós|mba|especialização/i.test(userText)
        ? 'Pós-graduação / MBA'
        : /tecnólogo|tecnologo/i.test(userText)
          ? 'Tecnólogo'
          : /técnico|tecnico/i.test(userText)
            ? 'Ensino Técnico'
            : /médio|medio/i.test(userText)
              ? 'Ensino Médio'
              : 'Graduação / Bacharelado';

      const newEdu: DraftEducationItem = {
        id: randomUUID(),
        course: parts[0] || userText.slice(0, 80),
        institution: parts[1] || 'Instituição informada',
        degree,
        start_date: null,
        end_date: null,
        status: isStudying ? 'Cursando' : 'Concluído',
        confirmation_status: 'extracted_unconfirmed',
      };

      if (draft.educations.length === 0) {
        draft.educations = [newEdu];
      } else {
        draft.educations.push(newEdu);
      }
      draft.currentSubStep = 'education_confirm';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Registrei e organizei sua **Formação Acadêmica**. Veja abaixo como ficou estruturada de forma objetiva e confirme se podemos avançar para **Competências**:`,
        metadata: {
          flowState: 'collecting_education',
          sectionPreview: {
            title: '5. Formação Acadêmica (Revisão)',
            statusBadge: 'Aguardando confirmação',
            lines: draft.educations.map(
              (ed) =>
                `${ed.degree} em ${ed.course} — ${ed.institution} (${ed.status})`
            ),
          },
          actions: [
            {
              id: 'confirm_education',
              label: 'Confirmar formação acadêmica',
              type: 'message',
              value: 'Confirmo minha formação acadêmica.',
              variant: 'primary',
            },
          ],
        },
      });
    }

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.6: COMPETÊNCIAS E FERRAMENTAS (skills_propose / skills_confirm)
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'skills_propose' ||
    draft.currentSubStep === 'skills_confirm'
  ) {
    nextFlowState = 'collecting_skills';

    if (isAffirmativeConfirmation(userText, actionId)) {
      draft.skills.status = 'confirmed';
      sectionStates.skills = 'completed';
      sectionStates.languages = 'in_progress';
      nextFlowState = 'collecting_languages';

      if (draft.languages.length > 0) {
        draft.currentSubStep = 'languages_collect';
        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Competências confirmadas! Agora chegamos à última seção do seu Currículo Mestre: **Idiomas**.\n\nIdentifiquei no seu perfil: **${draft.languages.map((l) => l.name).join(', ')}**. Como nunca devemos presumir fluência sem confirmar, qual é o seu nível de conhecimento atual e sua capacidade prática (leitura, escrita, conversação ou compreensão técnica)?`,
          metadata: {
            flowState: 'collecting_languages',
            actions: [
              {
                id: 'lang_interm',
                label: 'Intermediário (boa leitura e compreensão técnica)',
                type: 'message',
                value: `${draft.languages[0].name} Intermediário, com boa leitura, escrita e compreensão técnica.`,
                variant: 'primary',
              },
              {
                id: 'lang_adv',
                label: 'Avançado / Fluente (leitura, escrita e conversação)',
                type: 'message',
                value: `${draft.languages[0].name} Avançado, com leitura, escrita e conversação.`,
                variant: 'secondary',
              },
            ],
          },
        });
      } else {
        draft.currentSubStep = 'languages_collect';
        await appendChatMessage({
          conversationId,
          userId: params.userId,
          role: 'assistant',
          content: `Competências confirmadas! Agora chegamos à última seção do seu Currículo Mestre: **Idiomas**.\n\nAlém do Português, quais idiomas você conhece, qual é o seu nível de conhecimento e se possui capacidade de leitura, escrita, conversação ou compreensão técnica? (Se falar apenas Português no momento, pode selecionar a opção abaixo!)`,
          metadata: {
            flowState: 'collecting_languages',
            actions: [
              {
                id: 'lang_pt_only',
                label: 'Apenas Português (Nativo)',
                type: 'message',
                value: 'Falo apenas Português (Nativo) no momento.',
                variant: 'secondary',
              },
            ],
          },
        });
      }
    } else {
      // Usuário adicionou competências ou ferramentas
      const newItems = userText
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      draft.skills.technical = Array.from(
        new Set([...draft.skills.technical, ...newItems])
      );
      draft.currentSubStep = 'skills_confirm';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Atualizei sua lista de **Competências e Ferramentas** com os itens informados. Veja abaixo e confirme se podemos avançar para **Idiomas**:`,
        metadata: {
          flowState: 'collecting_skills',
          sectionPreview: {
            title: '6. Competências e Ferramentas (Atualizado)',
            statusBadge: 'Aguardando confirmação',
            lines: [
              `Competências Técnicas: ${draft.skills.technical.join(', ')}`,
              `Ferramentas e Tecnologias: ${draft.skills.tools.join(', ') || 'Informadas nas experiências'}`,
              `Competências Comportamentais: ${draft.skills.soft.join(', ')}`,
            ],
          },
          actions: [
            {
              id: 'confirm_skills',
              label: 'Confirmar competências e ir para Idiomas',
              type: 'message',
              value: 'Confirmo minhas competências.',
              variant: 'primary',
            },
          ],
        },
      });
    }

    await persistOnboardingState({
      userId: params.userId,
      conversationId,
      flowState: nextFlowState,
      onboardingCompleted: false,
      sectionStates,
      draft,
    });
    return getOrInitOnboardingConversation(params.userId);
  }

  // -------------------------------------------------------------------------
  // ETAPA 3.7 & SEÇÃO 6: IDIOMAS E FINALIZAÇÃO DO CURRÍCULO MESTRE
  // -------------------------------------------------------------------------
  if (
    draft.currentSubStep === 'languages_collect' ||
    draft.currentSubStep === 'languages_confirm'
  ) {
    if (
      draft.currentSubStep === 'languages_confirm' &&
      isAffirmativeConfirmation(userText, actionId)
    ) {
      draft.languagesStatus = 'confirmed';
      sectionStates.languages = 'completed';
      draft.currentSubStep = 'master_completed';
      nextFlowState = 'master_completed';
      onboardingCompleted = true;

      // Sincronizar todos os dados confirmados nas tabelas definitivas e gerar Currículo Mestre
      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: nextFlowState,
        onboardingCompleted: true,
        sectionStates,
        draft,
      });
      const updatedProfile = await syncConfirmedEntitiesToProfileTables(
        params.userId,
        draft
      );
      const masterResume = buildMasterResumeContentFromProfile(updatedProfile);

      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: 'master_completed',
        onboardingCompleted: true,
        sectionStates,
        draft,
        masterResume,
      });

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Excelente! Conseguimos construir seu currículo mestre.\n\nAgora temos uma base organizada com sua trajetória profissional, experiências, formação, competências e posicionamento.\n\nEsse documento será nossa referência para suas próximas candidaturas. Sempre que você encontrar uma oportunidade, poderemos adaptar seu currículo de acordo com os requisitos da vaga, sem perder a consistência da sua trajetória.`,
        metadata: {
          flowState: 'master_completed',
          masterResumePreview: masterResume,
          actions: getMasterCompletedActions(),
        },
      });

      return getOrInitOnboardingConversation(params.userId);
    } else {
      // Usuário informou seus idiomas e capacidades
      const lower = userText.toLowerCase();
      if (
        lower.includes('apenas português') ||
        lower.includes('apenas portugues') ||
        lower.includes('não falo outro') ||
        lower.includes('nao falo outro')
      ) {
        draft.languages = [
          {
            name: 'Português',
            proficiency: 'Nativo',
            capabilities: 'Leitura, escrita e conversação fluentes',
          },
        ];
      } else {
        const langName = lower.includes('inglês') || lower.includes('ingles')
          ? 'Inglês'
          : lower.includes('espanhol')
            ? 'Espanhol'
            : lower.includes('francês') || lower.includes('frances')
              ? 'Francês'
              : draft.languages[0]?.name || 'Idioma informado';
        const level = lower.includes('avançado') || lower.includes('avancado')
          ? 'Avançado'
          : lower.includes('fluente')
            ? 'Fluente'
            : lower.includes('básico') || lower.includes('basico')
              ? 'Básico'
              : 'Intermediário';

        draft.languages = [
          {
            name: langName,
            proficiency: level,
            capabilities: userText,
          },
        ];
      }
      draft.currentSubStep = 'languages_confirm';
      nextFlowState = 'collecting_languages';

      await appendChatMessage({
        conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Perfeito! Registrei sua seção de **Idiomas** sem presunções indevidas. Confira abaixo e confirme para **concluirmos seu Currículo Mestre**:`,
        metadata: {
          flowState: 'collecting_languages',
          sectionPreview: {
            title: '7. Idiomas Registrados',
            statusBadge: 'Aguardando confirmação final',
            lines: draft.languages.map(
              (l) => `${l.name} — Nível: ${l.proficiency} (${l.capabilities})`
            ),
          },
          actions: [
            {
              id: 'confirm_languages',
              label: 'Confirmar idiomas e concluir Currículo Mestre',
              type: 'message',
              value: 'Confirmo os idiomas e quero concluir meu Currículo Mestre.',
              variant: 'primary',
            },
          ],
        },
      });

      await persistOnboardingState({
        userId: params.userId,
        conversationId,
        flowState: nextFlowState,
        onboardingCompleted: false,
        sectionStates,
        draft,
      });
      return getOrInitOnboardingConversation(params.userId);
    }
  }

  // -------------------------------------------------------------------------
  // PÓS-CONCLUSÃO (master_completed): Usuário volta ao chat para atualizar algo
  // -------------------------------------------------------------------------
  parsePersonalFieldsFromText(userText, draft);
  if (userText.toLowerCase().includes('resumo:')) {
    draft.summary.text = userText.replace(/^resumo:\s*/i, '').trim();
  }
  await persistOnboardingState({
    userId: params.userId,
    conversationId,
    flowState: 'master_completed',
    onboardingCompleted: true,
    sectionStates,
    draft,
  });
  const refreshedProfile = await syncConfirmedEntitiesToProfileTables(
    params.userId,
    draft
  );
  const updatedMaster = buildMasterResumeContentFromProfile(refreshedProfile);

  await appendChatMessage({
    conversationId,
    userId: params.userId,
    role: 'assistant',
    content: `Seu **Currículo Mestre** está concluído e atualizado! Você pode baixar a versão mais recente em PDF ou DOCX abaixo, editar qualquer detalhe ou iniciar uma **Nova candidatura** enviando o link da vaga.`,
    metadata: {
      flowState: 'master_completed',
      masterResumePreview: updatedMaster,
      actions: getMasterCompletedActions(),
    },
  });

  return getOrInitOnboardingConversation(params.userId);
}

// ============================================================================
// SEÇÃO 7: NOVA CANDIDATURA — FLUXO CONVERSACIONAL INDEPENDENTE
// ============================================================================

export async function startOrGetApplicationConversation(params: {
  userId: string;
  conversationId?: string | null;
  forceNew?: boolean;
}): Promise<ApplicationChatOverview> {
  const profile = await getOrCreateProfileByUserId(params.userId);
  if (!profile.isComplete) {
    throw new ValidationError(
      'Conclua primeiro a construção do seu Currículo Mestre na conversa inicial antes de iniciar uma nova candidatura.'
    );
  }

  if (params.conversationId && !params.forceNew) {
    const existing = await db.query<{
      id: string;
      user_id: string;
      flow_state: ApplicationFlowState;
      application_id: string | null;
      metadata: ApplicationChatMetadata;
    }>(
      `SELECT id, user_id, flow_state, application_id, metadata
       FROM chat_conversations
       WHERE id = $1 AND context_type = 'APPLICATION'
       LIMIT 1`,
      [params.conversationId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.user_id !== params.userId) {
        throw new ForbiddenError('Acesso negado a esta conversa de candidatura.');
      }
      const messages = await getConversationMessages(row.id, params.userId);
      const application = row.application_id
        ? await getApplicationByIdForUser(params.userId, row.application_id)
        : null;
      return {
        conversationId: row.id,
        flowState: row.flow_state,
        messages,
        application,
        metadata: row.metadata || { flowState: row.flow_state },
      };
    }
  }

  // Criar nova conversa de candidatura com prioridade obrigatória para o link da vaga
  const convId = randomUUID();
  const initialMetadata: ApplicationChatMetadata = {
    flowState: 'awaiting_job_link',
    sourceUrl: null,
    jobDescription: null,
    extractedRequirements: null,
    detectedGaps: [],
    confirmedExtraSkills: [],
    awaitingGapConfirmation: false,
    applicationId: null,
  };

  await db.query(
    `INSERT INTO chat_conversations (id, user_id, context_type, flow_state, metadata, created_at, updated_at)
     VALUES ($1, $2, 'APPLICATION', 'awaiting_job_link', $3::jsonb, NOW(), NOW())`,
    [convId, params.userId, JSON.stringify(initialMetadata)]
  );

  await appendChatMessage({
    conversationId: convId,
    userId: params.userId,
    role: 'assistant',
    content: WELCOME_APPLICATION_MESSAGE,
    metadata: {
      flowState: 'awaiting_job_link',
      actions: [
        {
          id: 'no_job_link',
          label: 'Não tenho o link da vaga (colar descrição)',
          type: 'message',
          value: 'Não tenho o link da vaga.',
          variant: 'secondary',
        },
      ],
    },
  });

  const messages = await getConversationMessages(convId, params.userId);
  return {
    conversationId: convId,
    flowState: 'awaiting_job_link',
    messages,
    application: null,
    metadata: initialMetadata,
  };
}

export async function sendApplicationChatMessage(params: {
  userId: string;
  conversationId: string;
  message: string;
  actionId?: string;
  referenceDate?: Date;
}): Promise<ApplicationChatOverview> {
  const overview = await startOrGetApplicationConversation({
    userId: params.userId,
    conversationId: params.conversationId,
  });

  const profile = await getOrCreateProfileByUserId(params.userId);
  const metadata: ApplicationChatMetadata = {
    ...overview.metadata,
  };
  const userText = params.message.trim();
  const actionId = params.actionId;

  await appendChatMessage({
    conversationId: overview.conversationId,
    userId: params.userId,
    role: 'user',
    content: userText || 'Opção selecionada',
  });

  // -------------------------------------------------------------------------
  // 1. Usuário informa que não possui o link da vaga (Cenário F)
  // -------------------------------------------------------------------------
  const saysNoLink =
    actionId === 'no_job_link' ||
    (metadata.flowState === 'awaiting_job_link' &&
      /não tenho|nao tenho|sem link|não possuo|nao possuo|não consigo|nao consigo|colar a descrição|colar descricao/i.test(
        userText
      ) &&
      !/https?:\/\//i.test(userText));

  if (saysNoLink) {
    metadata.flowState = 'awaiting_job_description';
    await db.query(
      `UPDATE chat_conversations SET flow_state = 'awaiting_job_description', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(metadata), overview.conversationId]
    );

    await appendChatMessage({
      conversationId: overview.conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Sem problemas! Você pode colar aqui a descrição completa da vaga ou enviar o conteúdo do anúncio.`,
      metadata: {
        flowState: 'awaiting_job_description',
      },
    });

    return startOrGetApplicationConversation({
      userId: params.userId,
      conversationId: overview.conversationId,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Usuário está respondendo à pergunta sobre lacunas (Cenário G - Proteção Anti-Alucinação)
  // -------------------------------------------------------------------------
  if (metadata.awaitingGapConfirmation && metadata.jobDescription) {
    metadata.awaitingGapConfirmation = false;
    metadata.flowState = 'generating_targeted_resume';

    const deniesExtraSkill =
      actionId === 'generate_without_gaps' ||
      /^(não|nao|não possuo|nao possuo|não tenho|nao tenho|gerar apenas|somente com meus dados|pode gerar sem)/i.test(
        userText
      );

    // Se o usuário confirmar que possui experiência real com um requisito da lacuna, registramos no contexto desta candidatura sem alterar o Currículo Mestre original; se negar, jamais inventamos!
    if (!deniesExtraSkill && userText.length > 3) {
      const matchedGaps = (metadata.detectedGaps || []).filter((g) =>
        userText.toLowerCase().includes(g.toLowerCase())
      );
      const skillsToAdd =
        matchedGaps.length > 0 ? matchedGaps : [userText.slice(0, 60)];
      metadata.confirmedExtraSkills = Array.from(
        new Set([...(metadata.confirmedExtraSkills || []), ...skillsToAdd])
      );
    }

    const appDetail = await createApplicationAndGenerateResume({
      userId: params.userId,
      rawInput: {
        company:
          metadata.extractedRequirements?.company || metadata.companyHint || null,
        position:
          metadata.extractedRequirements?.position ||
          metadata.positionHint ||
          null,
        sourceUrl: metadata.sourceUrl || null,
        jobDescription: metadata.jobDescription,
        additionalConfirmedSkills: metadata.confirmedExtraSkills || [],
      },
      referenceDate: params.referenceDate,
    });

    metadata.flowState = 'application_completed';
    metadata.applicationId = appDetail.id;

    await db.query(
      `UPDATE chat_conversations
       SET flow_state = 'application_completed',
           application_id = $1,
           metadata = $2::jsonb,
           updated_at = NOW()
       WHERE id = $3`,
      [appDetail.id, JSON.stringify(metadata), overview.conversationId]
    );

    await appendChatMessage({
      conversationId: overview.conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Preparei seu **Currículo Personalizado** para a vaga de **${appDetail.position}**${appDetail.company ? ` na **${appDetail.company}**` : ''}!\n\n- **Aderência orientativa à vaga:** ${appDetail.compatibility_score}%\n- **Experiências e competências priorizadas:** ${appDetail.analysis.strengths.compatibleSkills.slice(0, 5).join(', ') || 'Destacadas a partir do seu Currículo Mestre'}\n- **Integridade do Currículo Mestre:** Seu currículo mestre original foi preservado sem alterações, e esta versão direcionada foi salva de forma independente.`,
      metadata: {
        flowState: 'application_completed',
        applicationResult: appDetail,
        actions: [
          {
            id: 'download_app_pdf',
            label: 'Baixar Currículo em PDF',
            type: 'download_pdf',
            href: `/api/applications/${appDetail.id}/export?format=pdf`,
            variant: 'primary',
          },
          {
            id: 'download_app_docx',
            label: 'Baixar Currículo em DOCX',
            type: 'download_docx',
            href: `/api/applications/${appDetail.id}/export?format=docx`,
            variant: 'secondary',
          },
          {
            id: 'open_app_detail',
            label: 'Ver Análise Completa',
            type: 'navigate',
            href: `/applications/${appDetail.id}`,
            variant: 'outline',
          },
        ],
      },
    });

    return startOrGetApplicationConversation({
      userId: params.userId,
      conversationId: overview.conversationId,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Recebendo Link da Vaga (Prioridade) ou Descrição da Vaga
  // -------------------------------------------------------------------------
  let jobDescriptionText = '';
  const urlMatch = userText.match(/https?:\/\/[^\s)]+/i);

  if (urlMatch && userText.length < 260) {
    metadata.sourceUrl = urlMatch[0];
    try {
      jobDescriptionText = await fetchJobDescriptionFromUrl(urlMatch[0]);
    } catch {
      // Link indisponível ou bloqueado -> solicitar descrição manual (Cenário F)
      metadata.flowState = 'awaiting_job_description';
      await db.query(
        `UPDATE chat_conversations SET flow_state = 'awaiting_job_description', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(metadata), overview.conversationId]
      );

      await appendChatMessage({
        conversationId: overview.conversationId,
        userId: params.userId,
        role: 'assistant',
        content: `Sem problemas! Não foi possível extrair o anúncio diretamente desse link (a plataforma exige login ou bloqueia leitura externa). Você pode colar aqui a descrição completa da vaga ou enviar o conteúdo do anúncio.`,
        metadata: {
          flowState: 'awaiting_job_description',
        },
      });

      return startOrGetApplicationConversation({
        userId: params.userId,
        conversationId: overview.conversationId,
      });
    }
  } else {
    jobDescriptionText = userText;
  }

  if (jobDescriptionText.trim().length < 20) {
    await appendChatMessage({
      conversationId: overview.conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Para que eu consiga analisar os requisitos com precisão, envie o **link da vaga** ou cole a **descrição completa da oportunidade** (com as responsabilidades e requisitos).`,
      metadata: {
        flowState: metadata.flowState,
      },
    });
    return startOrGetApplicationConversation({
      userId: params.userId,
      conversationId: overview.conversationId,
    });
  }

  // Analisar oportunidade e verificar se há lacunas antes de consolidar (Cenário E & Cenário G)
  metadata.jobDescription = jobDescriptionText;
  metadata.flowState = 'analyzing_job';

  const { requirements } = await analyzeJobDescription({
    userId: params.userId,
    jobDescription: jobDescriptionText,
  });
  metadata.extractedRequirements = requirements;

  const userKnownTerms = [
    ...profile.skills.map((s) => s.name.toLowerCase()),
    ...profile.experiences.flatMap((e) =>
      e.tools ? e.tools.toLowerCase().split(/[,;]/).map((t) => t.trim()) : []
    ),
    ...(profile.specialties ? profile.specialties.toLowerCase().split(/[,;]/) : []),
    ...(profile.professional_summary ? [profile.professional_summary.toLowerCase()] : []),
  ];

  const missingSkillsOrTools = [
    ...requirements.technicalSkills,
    ...requirements.toolsAndTechnologies,
  ].filter(
    (reqTerm) =>
      !userKnownTerms.some(
        (u) => u.includes(reqTerm.toLowerCase()) || reqTerm.toLowerCase().includes(u)
      )
  );

  // Cenário G: Se houver competência/ferramenta exigida pela vaga que não consta no Currículo Mestre, perguntar ao usuário antes de registrar!
  if (missingSkillsOrTools.length > 0 && !metadata.awaitingGapConfirmation) {
    metadata.detectedGaps = missingSkillsOrTools.slice(0, 4);
    metadata.awaitingGapConfirmation = true;

    await db.query(
      `UPDATE chat_conversations SET flow_state = 'analyzing_job', metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(metadata), overview.conversationId]
    );

    await appendChatMessage({
      conversationId: overview.conversationId,
      userId: params.userId,
      role: 'assistant',
      content: `Analisei a oportunidade para **${requirements.position}**${requirements.company ? ` (${requirements.company})` : ''}!\n\nComparei os requisitos com seu **Currículo Mestre** e identifiquei que a vaga menciona: **${metadata.detectedGaps.join(', ')}**, que ainda não constam no seu currículo.\n\nSeguindo nossa regra de nunca inventar informações: **você possui experiência real com algum desses pontos que queira confirmar antes de gerarmos o documento, ou prefere gerar agora apenas com os fatos já confirmados no seu Currículo Mestre?**`,
      metadata: {
        flowState: 'analyzing_job',
        sectionPreview: {
          title: `Análise Preliminar: ${requirements.position}`,
          statusBadge: 'Verificação ética de lacunas',
          lines: [
            `Cargo identificado: ${requirements.position}`,
            ...(requirements.company ? [`Empresa: ${requirements.company}`] : []),
            `Palavras-chave ATS da vaga: ${requirements.atsKeywords.slice(0, 6).join(', ')}`,
            `Lacunas a confirmar: ${metadata.detectedGaps.join(', ')}`,
          ],
        },
        actions: [
          {
            id: 'generate_without_gaps',
            label: 'Gerar currículo apenas com meus dados confirmados',
            type: 'message',
            value: 'Não possuo experiência com esses itens ausentes, pode gerar apenas com meus dados atuais.',
            variant: 'primary',
          },
        ],
      },
    });

    return startOrGetApplicationConversation({
      userId: params.userId,
      conversationId: overview.conversationId,
    });
  }

  // Se não houver lacunas pendentes, gera diretamente a versão personalizada
  const appDetail = await createApplicationAndGenerateResume({
    userId: params.userId,
    rawInput: {
      company: requirements.company,
      position: requirements.position,
      sourceUrl: metadata.sourceUrl || null,
      jobDescription: jobDescriptionText,
    },
    referenceDate: params.referenceDate,
  });

  metadata.flowState = 'application_completed';
  metadata.applicationId = appDetail.id;

  await db.query(
    `UPDATE chat_conversations
     SET flow_state = 'application_completed',
         application_id = $1,
         metadata = $2::jsonb,
         updated_at = NOW()
     WHERE id = $3`,
    [appDetail.id, JSON.stringify(metadata), overview.conversationId]
  );

  await appendChatMessage({
    conversationId: overview.conversationId,
    userId: params.userId,
    role: 'assistant',
    content: `Excelente! Analisei a vaga e gerei seu **Currículo Personalizado** para **${appDetail.position}**${appDetail.company ? ` na **${appDetail.company}**` : ''}!\n\n- **Aderência orientativa à vaga:** ${appDetail.compatibility_score}%\n- **Competências priorizadas:** ${appDetail.analysis.strengths.compatibleSkills.slice(0, 5).join(', ') || 'Alinhadas ao seu Currículo Mestre'}\n- **Seu Currículo Mestre original permanece intacto** e esta versão personalizada já está pronta para download em PDF e DOCX.`,
    metadata: {
      flowState: 'application_completed',
      applicationResult: appDetail,
      actions: [
        {
          id: 'download_app_pdf',
          label: 'Baixar Currículo em PDF',
          type: 'download_pdf',
          href: `/api/applications/${appDetail.id}/export?format=pdf`,
          variant: 'primary',
        },
        {
          id: 'download_app_docx',
          label: 'Baixar Currículo em DOCX',
          type: 'download_docx',
          href: `/api/applications/${appDetail.id}/export?format=docx`,
          variant: 'secondary',
        },
        {
          id: 'open_app_detail',
          label: 'Ver Análise Completa',
          type: 'navigate',
          href: `/applications/${appDetail.id}`,
          variant: 'outline',
        },
      ],
    },
  });

  return startOrGetApplicationConversation({
    userId: params.userId,
    conversationId: overview.conversationId,
  });
}

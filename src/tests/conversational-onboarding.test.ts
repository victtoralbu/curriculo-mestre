import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { ValidationError } from '@/lib/errors';
import { registerUser } from '@/modules/authentication/auth.service';
import {
  getOrInitOnboardingConversation,
  sendApplicationChatMessage,
  sendOnboardingMessage,
  startOrGetApplicationConversation,
  uploadResumeInOnboarding,
} from '@/modules/onboarding/onboarding.service';
import { getOrCreateProfileByUserId } from '@/modules/professional-profile/profile.service';
import {
  buildMasterResumeContentFromProfile,
  generateResumeDocxBuffer,
  generateResumePdfBuffer,
} from '@/services/documents/document-export.service';
import { GeneratedResumeContent } from '@/services/gemini/gemini.schemas';

const SAMPLE_COMPLETE_RESUME_CONTENT: GeneratedResumeContent = {
  header: {
    fullName: 'Mariana Costa',
    targetRole: 'Especialista em Customer Success & Operações',
    location: 'São Paulo - SP',
    email: 'mariana@teste.com',
    phone: '(11) 98888-7777',
    linkedinUrl: 'https://linkedin.com/in/marianacosta',
    portfolioUrl: null,
  },
  professionalSummary:
    'Especialista em Customer Success, gestão de operações e implantação de tecnologia SaaS com foco em retenção e expansão de carteira.',
  experiences: [
    {
      company: 'CloudCRM Brasil',
      position: 'Customer Success Manager',
      period: '02/2022 - Atual',
      descriptionBullets: [
        'Atendimento consultivo a clientes corporativos, implantação de sistemas CRM e acompanhamento de indicadores de adoção.',
      ],
      toolsUsed: ['HubSpot', 'Salesforce', 'Excel'],
    },
  ],
  educations: [
    {
      institution: 'Universidade de São Paulo',
      course: 'Administração de Empresas',
      degree: 'Bacharelado',
      period: '2018 - 2021',
      status: 'Concluído',
    },
  ],
  skills: {
    technical: ['Customer Success', 'Gestão de Operações'],
    tools: ['HubSpot', 'Salesforce', 'Excel'],
    soft: ['Comunicação Consultiva'],
    languages: ['Inglês (Intermediário)'],
    certifications: ['CS Foundation'],
  },
  atsKeywordsApplied: ['Customer Success', 'CRM', 'HubSpot'],
  factualIntegrityNote: 'Dados reais',
};

describe('Currículo Mestre — Novo Onboarding Conversacional com IA (Cenários A a G)', () => {
  beforeEach(async () => {
    await db.resetForTests();
  });

  it('Cenário A — Usuário com currículo completo (DOCX): extrai, pergunta, ensina, valida todas as 7 seções, conclui o Currículo Mestre e exporta PDF e DOCX', async () => {
    const user = await registerUser({
      name: 'Mariana Costa',
      email: 'mariana@teste.com',
      password: 'Password123!',
      lgpdConsent: true,
    });

    // 1. Primeiro acesso: apenas o chat em awaiting_resume com mensagem de boas-vindas e botão de envio
    let session = await getOrInitOnboardingConversation(user.id);
    expect(session.flowState).toBe('awaiting_resume');
    expect(session.onboardingCompleted).toBe(false);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].content).toContain(
      'Olá! Seja bem-vindo(a) ao Currículo Mestre.'
    );
    expect(
      session.messages[0].metadata.actions?.some(
        (a) => a.id === 'upload_resume' && a.label === 'Enviar meu currículo'
      )
    ).toBe(true);

    // 2. Envia arquivo DOCX completo
    const docxBuffer = await generateResumeDocxBuffer(
      SAMPLE_COMPLETE_RESUME_CONTENT
    );
    session = await uploadResumeInOnboarding({
      userId: user.id,
      fileName: 'curriculo-mariana.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docxBuffer,
    });

    expect(session.flowState).toBe('collecting_profile');
    expect(session.draft.hasUploadedResume).toBe(true);
    expect(session.draft.experiences.length).toBeGreaterThanOrEqual(1);
    expect(session.draft.educations.length).toBeGreaterThanOrEqual(1);
    // Seções extraídas ainda não estão concluídas sem confirmação da usuária!
    expect(session.sectionStates.personal).toBe('in_progress');
    expect(session.sectionStates.experiences).toBe('pending');

    // 3. Confirma Dados Pessoais -> avança para Posicionamento Profissional
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Meus dados pessoais estão corretos, pode confirmar.',
      actionId: 'confirm_personal',
    });
    expect(session.sectionStates.personal).toBe('completed');
    expect(session.sectionStates.positioning).toBe('in_progress');

    // 4. Escolhe e confirma Posicionamento Profissional -> IA apresenta Resumo com explicação educativa
    session = await sendOnboardingMessage({
      userId: user.id,
      message:
        'Prefiro manter uma apresentação abrangente em Customer Success & Gestão de Operações',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Sim, confirmo meu posicionamento profissional.',
      actionId: 'confirm_positioning',
    });
    expect(session.sectionStates.positioning).toBe('completed');
    expect(session.sectionStates.summary).toBe('in_progress');
    const summaryMsg = session.messages[session.messages.length - 1];
    expect(summaryMsg.metadata.educationalBox?.title).toContain(
      'Por que estruturei seu resumo assim'
    );

    // 5. Confirma Resumo Profissional -> entra na entrevista de Experiências
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo o resumo profissional.',
      actionId: 'confirm_summary',
    });
    expect(session.sectionStates.summary).toBe('completed');
    expect(session.sectionStates.experiences).toBe('in_progress');
    expect(session.flowState).toBe('collecting_experience');

    // 6. Responde pergunta contextual da experiência -> IA ensina ("Como estamos melhorando esta experiência?")
    session = await sendOnboardingMessage({
      userId: user.id,
      message:
        'Eu gerenciava diretamente uma carteira de 45 contas B2B e aumentei a taxa de retenção usando HubSpot e Salesforce.',
    });
    const expOptMsg = session.messages[session.messages.length - 1];
    expect(expOptMsg.metadata.educationalBox?.title).toBe(
      'Como estamos melhorando esta experiência?'
    );

    // Aprova a experiência e conclui a seção de experiências
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Aprovo esta versão da experiência.',
      actionId: 'confirm_experience',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Concluir experiências e avançar para Formação Acadêmica.',
      actionId: 'finish_experiences',
    });
    expect(session.sectionStates.experiences).toBe('completed');
    expect(session.sectionStates.education).toBe('in_progress');

    // 7. Confirma Formação Acadêmica -> avança para Competências (com explicação Competência vs Ferramenta)
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo minha formação acadêmica.',
      actionId: 'confirm_education',
    });
    expect(session.sectionStates.education).toBe('completed');
    expect(session.sectionStates.skills).toBe('in_progress');
    const skillsMsg = session.messages[session.messages.length - 1];
    expect(skillsMsg.metadata.educationalBox?.title).toContain(
      'Competência vs. Ferramenta'
    );

    // 8. Confirma Competências -> avança para Idiomas
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo minhas competências e ferramentas.',
      actionId: 'confirm_skills',
    });
    expect(session.sectionStates.skills).toBe('completed');
    expect(session.sectionStates.languages).toBe('in_progress');

    // 9. Informa capacidades do Idioma e confirma -> conclui Currículo Mestre!
    session = await sendOnboardingMessage({
      userId: user.id,
      message:
        'Inglês Intermediário, com boa leitura, escrita e compreensão técnica.',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo os idiomas e quero concluir meu Currículo Mestre.',
      actionId: 'confirm_languages',
    });

    expect(session.onboardingCompleted).toBe(true);
    expect(session.flowState).toBe('master_completed');
    expect(session.sectionStates.languages).toBe('completed');
    expect(session.masterResume).not.toBeNull();

    const finalMsg = session.messages[session.messages.length - 1];
    expect(finalMsg.content).toContain(
      'Excelente! Conseguimos construir seu currículo mestre.'
    );
    expect(
      finalMsg.metadata.actions?.some((a) => a.id === 'new_application')
    ).toBe(true);

    // 10. Baixar Currículo Mestre em PDF e DOCX
    const profile = await getOrCreateProfileByUserId(user.id);
    expect(profile.isComplete).toBe(true);
    const masterContent = buildMasterResumeContentFromProfile(profile);
    const pdfOut = await generateResumePdfBuffer(masterContent);
    const docxOut = await generateResumeDocxBuffer(masterContent);
    expect(pdfOut.byteLength).toBeGreaterThan(500);
    expect(docxOut.byteLength).toBeGreaterThan(500);
  });

  it('Cenário B — Usuário com currículo incompleto (PDF): identifica lacunas, pergunta apenas o que falta e conclui após validação', async () => {
    const user = await registerUser({
      name: 'Carlos Mendes',
      email: 'carlos@teste.com',
      password: 'Password123!',
      lgpdConsent: true,
    });

    // Gera um PDF incompleto (sem telefone, sem cidade e sem formação)
    const incompleteResume: GeneratedResumeContent = {
      header: {
        fullName: 'Carlos Mendes',
        targetRole: 'Analista de Operações',
        location: null,
        email: 'carlos@teste.com',
        phone: null,
        linkedinUrl: null,
        portfolioUrl: null,
      },
      professionalSummary: 'Atuação em rotinas operacionais e controle de indicadores.',
      experiences: [
        {
          company: 'Logística Express',
          position: 'Analista de Operações',
          period: '2023 - Atual',
          descriptionBullets: ['Controle de processos logísticos e relatórios em Excel.'],
          toolsUsed: ['Excel'],
        },
      ],
      educations: [],
      skills: {
        technical: ['Gestão de Operações'],
        tools: ['Excel'],
        soft: [],
        languages: [],
        certifications: [],
      },
      atsKeywordsApplied: ['Operações'],
      factualIntegrityNote: 'Teste PDF incompleto',
    };

    const pdfBuffer = await generateResumePdfBuffer(incompleteResume);
    let session = await uploadResumeInOnboarding({
      userId: user.id,
      fileName: 'curriculo-incompleto.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });

    // Deve ter identificado lacunas (Telefone, Cidade/Estado, Formação, Idiomas)
    expect(session.draft.identifiedGaps.length).toBeGreaterThan(0);
    const lastMsg = session.messages[session.messages.length - 1];
    expect(lastMsg.content).toContain('Telefone/WhatsApp');
    expect(lastMsg.content).toContain('Cidade e Estado');

    // Usuário informa apenas os dados faltantes (telefone e cidade/estado)
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Curitiba - PR, telefone (41) 99911-2233',
    });
    expect(session.draft.personal.phone).toBe('(41) 99911-2233');
    expect(session.draft.personal.location).toContain('Curitiba - PR');

    // Confirma dados pessoais
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Sim, confirmo meus dados pessoais.',
      actionId: 'confirm_personal',
    });
    expect(session.sectionStates.personal).toBe('completed');
  });

  it('Cenário C & D — Usuário sem currículo + Interrupção e retomada do onboarding com investigação adaptativa de contexto', async () => {
    const user = await registerUser({
      name: 'Fernanda Lima',
      email: 'fernanda@teste.com',
      password: 'Password123!',
      lgpdConsent: true,
    });

    await getOrInitOnboardingConversation(user.id);

    // 1. Informa que não possui currículo
    let session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Ainda não tenho um currículo pronto, quero construir do zero.',
    });
    expect(session.flowState).toBe('collecting_profile');
    // Não pergunta novamente nome e e-mail que já vieram do cadastro
    expect(session.messages[session.messages.length - 1].content).toContain(
      'Fernanda Lima'
    );

    // 2. Informa cidade e telefone e confirma dados pessoais
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Belo Horizonte - MG, (31) 98877-6655',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Sim, confirmo meus dados pessoais.',
      actionId: 'confirm_personal',
    });
    expect(session.sectionStates.personal).toBe('completed');

    // 3. Cenário D: Usuário sai do aplicativo e retorna posteriormente
    const resumedSession = await getOrInitOnboardingConversation(user.id);
    expect(resumedSession.sectionStates.personal).toBe('completed');
    expect(resumedSession.sectionStates.positioning).toBe('in_progress');
    expect(resumedSession.messages.length).toBe(session.messages.length);

    // 4. Continua de onde parou: Posicionamento e Resumo
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Analista de Implantação de Sistemas com 3 anos de experiência',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Sim, confirmo meu posicionamento profissional.',
      actionId: 'confirm_positioning',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo o resumo profissional.',
      actionId: 'confirm_summary',
    });

    // 5. Na seção de Experiências, usuário envia frase curta: "Trabalhei com implantação de CRM para empresas."
    // A IA não deve apenas registrar e fechar; deve investigar o contexto!
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Trabalhei com implantação de CRM para empresas na TechCRM.',
    });
    const probeMsg = session.messages[session.messages.length - 1];
    expect(probeMsg.content).toContain('configurava o CRM e treinava os usuários');
    expect(session.draft.currentSubStep).toBe('experience_interview');

    // Usuário responde à pergunta complementar (e diz que não lembra números exatos -> IA não inventa métricas!)
    session = await sendOnboardingMessage({
      userId: user.id,
      message:
        'Eu configurava o HubSpot, treinava as equipes comerciais e acompanhava a adoção inicial, mas não lembro percentuais exatos.',
    });
    expect(session.draft.currentSubStep).toBe('experience_confirm');

    // Aprova experiência e conclui seção
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Aprovo esta versão da experiência.',
      actionId: 'confirm_experience',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Concluir experiências',
      actionId: 'finish_experiences',
    });

    // Formação, Competências e Idiomas até concluir Currículo Mestre
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Sistemas de Informação — PUC Minas — Concluído',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo minha formação acadêmica.',
      actionId: 'confirm_education',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo minhas competências e ferramentas.',
      actionId: 'confirm_skills',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Falo apenas Português (Nativo) no momento.',
    });
    session = await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmo os idiomas e quero concluir meu Currículo Mestre.',
      actionId: 'confirm_languages',
    });

    expect(session.onboardingCompleted).toBe(true);
    expect(session.flowState).toBe('master_completed');
  });

  it('Cenário E, F & G — Nova candidatura conversacional: prioriza link, trata link indisponível, protege contra invenção de competências e preserva Currículo Mestre intacto', async () => {
    const user = await registerUser({
      name: 'Rafael Souza',
      email: 'rafael@teste.com',
      password: 'Password123!',
      lgpdConsent: true,
    });

    // Tentativa de iniciar Nova Candidatura ANTES de concluir o Currículo Mestre deve ser bloqueada
    await expect(
      startOrGetApplicationConversation({ userId: user.id })
    ).rejects.toThrow(ValidationError);

    // Concluir Currículo Mestre via upload DOCX
    const docxBuffer = await generateResumeDocxBuffer(
      SAMPLE_COMPLETE_RESUME_CONTENT
    );
    await uploadResumeInOnboarding({
      userId: user.id,
      fileName: 'curriculo.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docxBuffer,
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_personal',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Customer Success Manager',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_positioning',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_summary',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Atuação com HubSpot e gestão de carteira B2B.',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_experience',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Concluir',
      actionId: 'finish_experiences',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_education',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_skills',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Inglês Intermediário (leitura e escrita)',
    });
    await sendOnboardingMessage({
      userId: user.id,
      message: 'Confirmar',
      actionId: 'confirm_languages',
    });

    const masterBefore = await getOrCreateProfileByUserId(user.id);
    expect(masterBefore.isComplete).toBe(true);

    // Iniciar Nova Candidatura (Cenário E): prioridade obrigatória solicitar o link da vaga primeiro
    let appChat = await startOrGetApplicationConversation({ userId: user.id });
    expect(appChat.flowState).toBe('awaiting_job_link');
    expect(appChat.messages[0].content).toContain(
      'Para começar, envie o link da vaga em que deseja se candidatar.'
    );

    // Cenário F: Usuário envia link bloqueado (LinkedIn) ou informa que não possui o link
    appChat = await sendApplicationChatMessage({
      userId: user.id,
      conversationId: appChat.conversationId,
      message: 'https://www.linkedin.com/jobs/view/123456789',
    });
    expect(appChat.flowState).toBe('awaiting_job_description');
    expect(
      appChat.messages[appChat.messages.length - 1].content
    ).toContain(
      'Você pode colar aqui a descrição completa da vaga ou enviar o conteúdo do anúncio.'
    );

    // Cenário G: Usuário cola descrição de vaga que pede uma ferramenta que NÃO consta no Currículo Mestre (ex: Docker e Python)
    appChat = await sendApplicationChatMessage({
      userId: user.id,
      conversationId: appChat.conversationId,
      message:
        'Vaga para Customer Success & Operações na SaaS Global. Requisitos: experiência com Customer Success, CRM HubSpot, além de conhecimentos desejáveis em Python e Docker para integrações.',
    });

    // A IA não deve inventar que o usuário sabe Python/Docker! Deve pausar em analyzing_job e perguntar ao usuário
    expect(appChat.flowState).toBe('analyzing_job');
    expect(appChat.metadata.awaitingGapConfirmation).toBe(true);
    const gapMsg = appChat.messages[appChat.messages.length - 1];
    expect(gapMsg.content).toContain(
      'Seguindo nossa regra de nunca inventar informações'
    );

    // Usuário informa que NÃO possui experiência com Python/Docker e pede para gerar apenas com dados confirmados
    appChat = await sendApplicationChatMessage({
      userId: user.id,
      conversationId: appChat.conversationId,
      message:
        'Não possuo experiência com esses itens ausentes, pode gerar apenas com meus dados atuais.',
      actionId: 'generate_without_gaps',
    });

    expect(appChat.flowState).toBe('application_completed');
    expect(appChat.application).not.toBeNull();
    expect(appChat.application?.resume_content.skills.technical).not.toContain(
      'Python'
    );
    expect(appChat.application?.resume_content.skills.tools).not.toContain(
      'Docker'
    );

    // Verificar que o Currículo Mestre original permaneceu 100% intacto
    const masterAfter = await getOrCreateProfileByUserId(user.id);
    expect(masterAfter.skills.length).toBe(masterBefore.skills.length);
    expect(masterAfter.experiences.length).toBe(masterBefore.experiences.length);
  });
});

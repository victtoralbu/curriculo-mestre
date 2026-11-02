import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import {
  ConflictError,
  ForbiddenError,
  InsufficientCreditsError,
  ValidationError,
} from '@/lib/errors';
import { registerUser } from '@/modules/authentication/auth.service';
import {
  getOrCreateProfileByUserId,
  saveFullProfessionalProfile,
} from '@/modules/professional-profile/profile.service';
import {
  createApplicationAndGenerateResume,
  getApplicationByIdForUser,
  updateApplicationForUser,
} from '@/modules/resume-generation/application.service';
import { getWalletOverview } from '@/modules/wallet/wallet.service';
import {
  redeemPromotionalCoupon,
  upsertCouponAdmin,
} from '@/modules/coupons/coupons.service';
import {
  createPixPayment,
  generateWebhookSignature,
  processPaymentWebhook,
} from '@/services/payments/payment.service';
import { setSimulateAiFailureForTests } from '@/services/gemini/gemini.service';
import { updateCommercialSettings } from '@/modules/administration/settings.service';
import {
  generateResumeDocxBuffer,
  generateResumePdfBuffer,
} from '@/services/documents/document-export.service';

async function createTestUserWithCompleteProfile(
  email = 'candidato@teste.com',
  name = 'Candidato Teste'
) {
  const user = await registerUser({
    name,
    email,
    password: 'Password123!',
    lgpdConsent: true,
  });

  await saveFullProfessionalProfile(user.id, {
    full_name: name,
    contact_email: email,
    phone: '(11) 99999-0000',
    location: 'São Paulo - SP',
    professional_summary:
      'Desenvolvedor Full-Stack com foco em TypeScript, React, Next.js e PostgreSQL.',
    target_roles: 'Engenheiro de Software Full-Stack',
    experience_years: '4 anos',
    specialties: 'Desenvolvimento Web, SaaS, APIs REST',
    experiences: [
      {
        company: 'Tech Solutions Ltda',
        position: 'Desenvolvedor Full-Stack Pleno',
        employment_type: 'CLT',
        start_date: '01/2023',
        end_date: 'Atual',
        description:
          'Desenvolvimento de plataformas SaaS escaláveis em Next.js, TypeScript e PostgreSQL.',
        achievements: 'Redução de 35% no tempo de resposta das consultas críticas.',
        tools: 'TypeScript, React, Next.js, PostgreSQL, Docker',
      },
    ],
    educations: [
      {
        institution: 'Universidade de São Paulo',
        course: 'Sistemas de Informação',
        degree: 'Bacharelado',
        start_date: '2019',
        end_date: '2022',
        status: 'Concluído',
      },
    ],
    skills: [
      { name: 'TypeScript', category: 'TECHNICAL', proficiency: 'Avançado' },
      { name: 'PostgreSQL', category: 'TECHNICAL', proficiency: 'Avançado' },
      { name: 'Git', category: 'TOOL', proficiency: 'Avançado' },
      { name: 'Inglês', category: 'LANGUAGE', proficiency: 'Intermediário' },
    ],
  });

  return user;
}

const SAMPLE_JOB_INPUT = {
  company: 'InovaSaaS Corp',
  position: 'Engenheiro Full-Stack TypeScript',
  jobDescription:
    'Buscamos Engenheiro Full-Stack com domínio em TypeScript, React, Next.js e banco de dados relacional PostgreSQL para atuar na evolução de plataforma SaaS. Desejável vivência com testes automatizados e boas práticas de segurança.',
};

describe('Currículo Mestre — Regras Críticas Financeiras, IA, Cupons, Concorrência e Isolamento (PRD)', () => {
  beforeEach(async () => {
    setSimulateAiFailureForTests(false);
    await db.resetForTests();
  });

  it('1 & 2. Deve bloquear geração para usuário sem perfil completo e permitir quando o perfil está preenchido', async () => {
    const rawUser = await registerUser({
      name: 'Sem Perfil',
      email: 'semperfil@teste.com',
      password: 'Password123!',
      lgpdConsent: true,
    });

    await expect(
      createApplicationAndGenerateResume({
        userId: rawUser.id,
        rawInput: SAMPLE_JOB_INPUT,
      })
    ).rejects.toThrow(ValidationError);

    const walletAfterFail = await getWalletOverview(rawUser.id);
    expect(walletAfterFail.usedInCurrentCycle).toBe(0);
    expect(walletAfterFail.activePendingDebtsCount).toBe(0);

    // Agora completa o perfil e gera com sucesso + exporta DOCX e PDF
    const readyUser = await createTestUserWithCompleteProfile(
      'comperfil@teste.com'
    );
    const app = await createApplicationAndGenerateResume({
      userId: readyUser.id,
      rawInput: SAMPLE_JOB_INPUT,
    });

    expect(app.credit_source).toBe('FREE_QUOTA');
    expect(app.compatibility_score).toBeGreaterThan(0);
    expect(app.resume_content.header.fullName).toBe('Candidato Teste');

    const docxBuffer = await generateResumeDocxBuffer(app.resume_content);
    const pdfBuffer = await generateResumePdfBuffer(app.resume_content);
    expect(docxBuffer.byteLength).toBeGreaterThan(500);
    expect(pdfBuffer.byteLength).toBeGreaterThan(500);
  });

  it('3, 4 & 5. Deve liberar 3 candidaturas gratuitas no mês, registrar pendência de R$ 0,10 na 4ª e renovar a cota no novo ciclo mensal', async () => {
    const user = await createTestUserWithCompleteProfile();
    const novDate = new Date('2026-11-10T12:00:00Z');

    // 1ª, 2ª e 3ª candidaturas gratuitas
    for (let i = 1; i <= 3; i++) {
      const app = await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: { ...SAMPLE_JOB_INPUT, position: `Vaga Gratuita ${i}` },
        referenceDate: novDate,
      });
      expect(app.credit_source).toBe('FREE_QUOTA');
    }

    let wallet = await getWalletOverview(user.id, novDate);
    expect(wallet.freeQuotaRemaining).toBe(0);
    expect(wallet.activePendingDebtsCount).toBe(0);

    // 4ª candidatura sem saldo e sem plano mensal -> gera pendência de R$ 0,10 (10 centavos) com vencimento de 30 dias
    const fourthApp = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: { ...SAMPLE_JOB_INPUT, position: 'Quarta Vaga' },
      referenceDate: novDate,
    });
    expect(fourthApp.credit_source).toBe('TRUST_DEBT');

    wallet = await getWalletOverview(user.id, novDate);
    expect(wallet.activePendingDebtsCount).toBe(1);
    expect(wallet.activePendingDebtsCents).toBe(10);

    const expectedDue = new Date(
      novDate.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(wallet.debts[0].due_at).toBe(expectedDue);

    // Virada de ciclo mensal (Dezembro/2026) -> renova as 3 candidaturas gratuitas!
    const decDate = new Date('2026-12-02T12:00:00Z');
    const decWallet = await getWalletOverview(user.id, decDate);
    expect(decWallet.freeQuotaRemaining).toBe(3);

    const decApp = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: { ...SAMPLE_JOB_INPUT, position: 'Vaga Dezembro' },
      referenceDate: decDate,
    });
    expect(decApp.credit_source).toBe('FREE_QUOTA');
  });

  it('6, 7 & 8. Contribuição mensal de R$ 3,00 libera até 30 candidaturas no mês (incluindo as 3 gratuitas), e a 31ª cobra R$ 0,10', async () => {
    const user = await createTestUserWithCompleteProfile();
    const cycleDate = new Date('2026-11-05T10:00:00Z');

    // Usa as 3 gratuitas iniciais
    for (let i = 1; i <= 3; i++) {
      const app = await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: SAMPLE_JOB_INPUT,
        referenceDate: cycleDate,
      });
      expect(app.credit_source).toBe('FREE_QUOTA');
    }

    // Contrata contribuição mensal de R$ 3,00 (300 centavos) e confirma via webhook
    const payment = await createPixPayment({
      userId: user.id,
      purpose: 'MONTHLY_CONTRIBUTION',
    });
    expect(payment.amount).toBe(300);

    const webhookBody = JSON.stringify({
      externalPaymentId: payment.external_payment_id,
      status: 'CONFIRMED',
    });
    await processPaymentWebhook({
      rawBody: webhookBody,
      signatureHeader: generateWebhookSignature(webhookBody),
      referenceDate: cycleDate,
    });

    // Da 4ª até a 30ª candidatura do mês (27 candidaturas adicionais cobertas pelo ciclo mensal)
    for (let i = 4; i <= 30; i++) {
      const app = await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: { ...SAMPLE_JOB_INPUT, position: `Vaga Mensal ${i}` },
        referenceDate: cycleDate,
      });
      expect(app.credit_source).toBe('MONTHLY_CONTRIBUTION');
    }

    const walletAt30 = await getWalletOverview(user.id, cycleDate);
    expect(walletAt30.usedInCurrentCycle).toBe(30);
    expect(walletAt30.monthlyContributionQuotaRemaining).toBe(0);
    expect(walletAt30.activePendingDebtsCount).toBe(0);

    // 31ª candidatura do mês -> excedeu as 30 do plano mensal, entra em TRUST_DEBT (ou saldo se houver)
    const app31 = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: { ...SAMPLE_JOB_INPUT, position: 'Vaga 31' },
      referenceDate: cycleDate,
    });
    expect(app31.credit_source).toBe('TRUST_DEBT');

    const walletAt31 = await getWalletOverview(user.id, cycleDate);
    expect(walletAt31.activePendingDebtsCount).toBe(1);
    expect(walletAt31.activePendingDebtsCents).toBe(10);
  });

  it('9, 10, 11 & 12. Deve respeitar o limite de 100 pendências (R$ 10,00) em 30 dias, bloquear a 101ª sem saldo, mas permitir cupom promocional', async () => {
    const user = await createTestUserWithCompleteProfile();
    const refDate = new Date('2026-11-10T10:00:00Z');

    // Consome as 3 gratuitas
    for (let i = 1; i <= 3; i++) {
      await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: SAMPLE_JOB_INPUT,
        referenceDate: refDate,
      });
    }

    // Acumula 100 pendências de R$ 0,10 (total R$ 10,00 = 1000 centavos)
    for (let i = 1; i <= 100; i++) {
      const app = await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: { ...SAMPLE_JOB_INPUT, position: `Pendente ${i}` },
        referenceDate: refDate,
      });
      expect(app.credit_source).toBe('TRUST_DEBT');
    }

    const walletAt100 = await getWalletOverview(user.id, refDate);
    expect(walletAt100.activePendingDebtsCount).toBe(100);
    expect(walletAt100.activePendingDebtsCents).toBe(1000);
    expect(walletAt100.trustCreditsRemaining).toBe(0);

    // 101ª tentativa sem saldo deve ser bloqueada
    await expect(
      createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: { ...SAMPLE_JOB_INPUT, position: 'Bloqueada 101' },
        referenceDate: refDate,
      })
    ).rejects.toThrow(InsufficientCreditsError);

    // Porém, ao resgatar o cupom BETA10, pode continuar utilizando os créditos promocionais mesmo com as 100 pendências!
    const redeemed = await redeemPromotionalCoupon({
      userId: user.id,
      rawCode: 'BETA10',
      referenceDate: refDate,
    });
    expect(redeemed.creditsGranted).toBe(10);

    const promoApp = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: { ...SAMPLE_JOB_INPUT, position: 'Liberada com Cupom' },
      referenceDate: refDate,
    });
    expect(promoApp.credit_source).toBe('PROMOTIONAL');

    const walletAfterPromo = await getWalletOverview(user.id, refDate);
    expect(walletAfterPromo.promotionalCreditsRemaining).toBe(9);
    expect(walletAfterPromo.activePendingDebtsCount).toBe(100); // Não gerou nova dívida
  });

  it('13, 14 & 15. Deve realizar regularização parcial, regularização total FIFO com saldo excedente, uso de saldo positivo e bloqueio configurável de vencidos', async () => {
    const user = await createTestUserWithCompleteProfile();
    const day1 = new Date('2026-10-01T10:00:00Z');

    // Usa as 3 gratuitas + gera 3 pendências de R$ 0,10 (total 30 centavos de dívida)
    for (let i = 1; i <= 6; i++) {
      await createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: SAMPLE_JOB_INPUT,
        referenceDate: day1,
      });
    }

    let wallet = await getWalletOverview(user.id, day1);
    expect(wallet.activePendingDebtsCount).toBe(3);
    expect(wallet.activePendingDebtsCents).toBe(30);

    // Regularização parcial: contribui R$ 0,15 (15 centavos) -> quita a 1ª dívida (10c) e abate 5c da 2ª dívida!
    const partialPayment = await createPixPayment({
      userId: user.id,
      purpose: 'FREE_CONTRIBUTION',
      amountCents: 15,
    });
    const partialPayload = JSON.stringify({
      externalPaymentId: partialPayment.external_payment_id,
      status: 'CONFIRMED',
    });
    const partialRes = await processPaymentWebhook({
      rawBody: partialPayload,
      signatureHeader: generateWebhookSignature(partialPayload),
      referenceDate: day1,
    });

    expect(partialRes.settlementResult?.settledDebtsCount).toBe(1);
    expect(partialRes.settlementResult?.settledAmountCents).toBe(15);
    expect(partialRes.settlementResult?.addedToBalanceCents).toBe(0);

    wallet = await getWalletOverview(user.id, day1);
    expect(wallet.activePendingDebtsCount).toBe(2); // 1 parcialmente quitada (5c restantes) + 1 pendente (10c)
    expect(wallet.activePendingDebtsCents).toBe(15);
    expect(wallet.balanceCents).toBe(0);

    // Regularização total + excedente: contribui R$ 0,50 (50 centavos) -> quita os 15c restantes e gera R$ 0,35 (35c) de saldo positivo!
    const fullPayment = await createPixPayment({
      userId: user.id,
      purpose: 'FREE_CONTRIBUTION',
      amountCents: 50,
    });
    const fullPayload = JSON.stringify({
      externalPaymentId: fullPayment.external_payment_id,
      status: 'CONFIRMED',
    });
    const fullRes = await processPaymentWebhook({
      rawBody: fullPayload,
      signatureHeader: generateWebhookSignature(fullPayload),
      referenceDate: day1,
    });

    expect(fullRes.settlementResult?.settledDebtsCount).toBe(2);
    expect(fullRes.settlementResult?.settledAmountCents).toBe(15);
    expect(fullRes.settlementResult?.addedToBalanceCents).toBe(35);

    wallet = await getWalletOverview(user.id, day1);
    expect(wallet.activePendingDebtsCount).toBe(0);
    expect(wallet.activePendingDebtsCents).toBe(0);
    expect(wallet.balanceCents).toBe(35);

    // Nova candidatura no mesmo ciclo usa o saldo positivo da carteira (debita 10c -> saldo vai para 25c)
    const paidApp = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: { ...SAMPLE_JOB_INPUT, position: 'Vaga com Saldo' },
      referenceDate: day1,
    });
    expect(paidApp.credit_source).toBe('WALLET_BALANCE');

    wallet = await getWalletOverview(user.id, day1);
    expect(wallet.balanceCents).toBe(25);

    // Teste de pendência vencida (> 30 dias): consome os 25c (2 vagas = 20c, restam 5c) e cria 1 pendência
    await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: SAMPLE_JOB_INPUT,
      referenceDate: day1,
    });
    await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: SAMPLE_JOB_INPUT,
      referenceDate: day1,
    });
    const debtApp = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: SAMPLE_JOB_INPUT,
      referenceDate: day1,
    });
    expect(debtApp.credit_source).toBe('TRUST_DEBT');

    // 35 dias depois, a pendência está vencida
    const day36 = new Date('2026-11-05T10:00:00Z');
    const overdueWallet = await getWalletOverview(user.id, day36);
    expect(overdueWallet.overdueDebtsCount).toBe(1);

    // Se o admin ativar blockAfterOverdueDays e esgotarmos as gratuitas do novo mês, bloqueia novas dívidas
    await updateCommercialSettings(user.id, {
      blockAfterOverdueDays: true,
      freeMonthlyQuota: 0,
    });
    await expect(
      createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: SAMPLE_JOB_INPUT,
        referenceDate: day36,
      })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it('16, 17, 18 & 19. Deve validar cupons válidos, expirados, com limite esgotado e impedir uso duplicado pelo mesmo usuário', async () => {
    const user1 = await createTestUserWithCompleteProfile('u1@teste.com');
    const user2 = await createTestUserWithCompleteProfile('u2@teste.com');

    // Resgate válido de BETA30 por user1
    const res1 = await redeemPromotionalCoupon({
      userId: user1.id,
      rawCode: 'BETA30',
    });
    expect(res1.creditsGranted).toBe(30);

    // Uso duplicado do mesmo cupom por user1 -> deve falhar com ConflictError
    await expect(
      redeemPromotionalCoupon({
        userId: user1.id,
        rawCode: 'BETA30',
      })
    ).rejects.toThrow(ConflictError);

    // Cupom expirado
    await upsertCouponAdmin(user1.id, {
      code: 'EXPIRADO10',
      description: 'Cupom vencido',
      benefit_type: 'CREDITS',
      benefit_value: 10,
      max_redemptions: 10,
      max_per_user: 1,
      starts_at: '2025-01-01T00:00:00Z',
      expires_at: '2025-02-01T00:00:00Z',
      active: true,
    });
    await expect(
      redeemPromotionalCoupon({
        userId: user1.id,
        rawCode: 'EXPIRADO10',
      })
    ).rejects.toThrow(ValidationError);

    // Cupom com limite máximo de 1 resgate global
    await upsertCouponAdmin(user1.id, {
      code: 'UNICO5',
      description: 'Apenas 1 resgate total',
      benefit_type: 'CREDITS',
      benefit_value: 5,
      max_redemptions: 1,
      max_per_user: 1,
      starts_at: '2026-01-01T00:00:00Z',
      expires_at: '2027-12-31T00:00:00Z',
      active: true,
    });

    await redeemPromotionalCoupon({
      userId: user1.id,
      rawCode: 'UNICO5',
    });

    // Segundo usuário tentando resgatar cupom esgotado -> ConflictError
    await expect(
      redeemPromotionalCoupon({
        userId: user2.id,
        rawCode: 'UNICO5',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('20 & 21. Não deve debitar candidatura quando a geração de IA falhar, e deve tratar falha de pagamento e webhook duplicado com idempotência', async () => {
    const user = await createTestUserWithCompleteProfile();

    // Simula falha técnica na IA
    setSimulateAiFailureForTests(true);
    await expect(
      createApplicationAndGenerateResume({
        userId: user.id,
        rawInput: SAMPLE_JOB_INPUT,
      })
    ).rejects.toThrow();

    setSimulateAiFailureForTests(false);
    const walletAfterAiFail = await getWalletOverview(user.id);
    expect(walletAfterAiFail.usedInCurrentCycle).toBe(0);
    expect(walletAfterAiFail.freeQuotaRemaining).toBe(3);
    expect(walletAfterAiFail.activePendingDebtsCount).toBe(0);

    // Pagamento com falha (status FAILED no webhook) não altera saldo
    const failedPay = await createPixPayment({
      userId: user.id,
      purpose: 'FREE_CONTRIBUTION',
      amountCents: 500,
    });
    const failBody = JSON.stringify({
      externalPaymentId: failedPay.external_payment_id,
      status: 'FAILED',
    });
    const failWebhook = await processPaymentWebhook({
      rawBody: failBody,
      signatureHeader: generateWebhookSignature(failBody),
    });
    expect(failWebhook.status).toBe('FAILED');
    expect((await getWalletOverview(user.id)).balanceCents).toBe(0);

    // Webhook confirmado enviado duas vezes (duplicado) -> credita apenas uma vez!
    const validPay = await createPixPayment({
      userId: user.id,
      purpose: 'FREE_CONTRIBUTION',
      amountCents: 1000, // R$ 10,00
    });
    const okBody = JSON.stringify({
      externalPaymentId: validPay.external_payment_id,
      status: 'CONFIRMED',
    });
    const firstCall = await processPaymentWebhook({
      rawBody: okBody,
      signatureHeader: generateWebhookSignature(okBody),
    });
    const secondCall = await processPaymentWebhook({
      rawBody: okBody,
      signatureHeader: generateWebhookSignature(okBody),
    });

    expect(firstCall.alreadyProcessed).toBe(false);
    expect(secondCall.alreadyProcessed).toBe(true);
    expect((await getWalletOverview(user.id)).balanceCents).toBe(1000);
  });

  it('22. Deve garantir integridade em requisições simultâneas e impedir que um usuário acesse dados de outro (isolamento)', async () => {
    const userA = await createTestUserWithCompleteProfile('usera@teste.com');
    const userB = await createTestUserWithCompleteProfile('userb@teste.com');

    // Configura limite de apenas 3 gratuitas e 0 pendências permitidas para testar corrida nas 3 gratuitas
    await updateCommercialSettings(userA.id, {
      freeMonthlyQuota: 3,
      trustMaxPendingApplications: 0,
    });

    // Dispara 5 gerações simultaneamente para userA -> exatamente 3 devem passar e 2 devem ser bloqueadas!
    const results = await Promise.allSettled([
      createApplicationAndGenerateResume({ userId: userA.id, rawInput: SAMPLE_JOB_INPUT }),
      createApplicationAndGenerateResume({ userId: userA.id, rawInput: SAMPLE_JOB_INPUT }),
      createApplicationAndGenerateResume({ userId: userA.id, rawInput: SAMPLE_JOB_INPUT }),
      createApplicationAndGenerateResume({ userId: userA.id, rawInput: SAMPLE_JOB_INPUT }),
      createApplicationAndGenerateResume({ userId: userA.id, rawInput: SAMPLE_JOB_INPUT }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(3);
    expect(rejected.length).toBe(2);

    // Isolamento de dados: userB tenta acessar ou editar a candidatura de userA -> ForbiddenError (403)
    const userAAppId = (
      fulfilled[0] as PromiseFulfilledResult<{ id: string }>
    ).value.id;

    await expect(
      getApplicationByIdForUser(userB.id, userAAppId)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      updateApplicationForUser({
        userId: userB.id,
        applicationId: userAAppId,
        status: 'APROVADO',
      })
    ).rejects.toThrow(ForbiddenError);

    const profileA = await getOrCreateProfileByUserId(userA.id);
    const profileB = await getOrCreateProfileByUserId(userB.id);
    expect(profileA.id).not.toBe(profileB.id);
  });
});

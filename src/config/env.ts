export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Currículo Mestre',
  DATABASE_URL: process.env.DATABASE_URL || '',
  AUTH_SECRET:
    process.env.AUTH_SECRET ||
    'cm_jwt_secret_key_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@curriculomestre.com.br',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_MAX_OUTPUT_TOKENS: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 4096),
  GEMINI_INPUT_PRICE_PER_1M_CENTS: Number(
    process.env.GEMINI_INPUT_PRICE_PER_1M_CENTS || 90
  ),
  GEMINI_OUTPUT_PRICE_PER_1M_CENTS: Number(
    process.env.GEMINI_OUTPUT_PRICE_PER_1M_CENTS || 350
  ),
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mercadopago',
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  PAYMENT_WEBHOOK_SECRET:
    process.env.PAYMENT_WEBHOOK_SECRET ||
    'whsec_curriculo_mestre_homologacao_secret_2026',
};

export interface CommercialSettings {
  freeMonthlyQuota: number;
  monthlyContributionCents: number;
  monthlyContributionQuota: number;
  additionalApplicationCents: number;
  trustMaxPendingApplications: number;
  trustWindowDays: number;
  debtDueDays: number;
  blockAfterOverdueDays: boolean;
  creditPriorityOrder: Array<
    | 'PROMOTIONAL'
    | 'FREE_QUOTA'
    | 'MONTHLY_CONTRIBUTION'
    | 'WALLET_BALANCE'
    | 'TRUST_DEBT'
  >;
  aiRequestsPerHourLimit: number;
}

export const DEFAULT_COMMERCIAL_SETTINGS: CommercialSettings = {
  freeMonthlyQuota: 3,
  monthlyContributionCents: 300, // R$ 3,00
  monthlyContributionQuota: 30, // Até 30 candidaturas no ciclo mensal (incluindo as 3 gratuitas)
  additionalApplicationCents: 10, // R$ 0,10 por candidatura
  trustMaxPendingApplications: 100, // Até 100 candidaturas pendentes em janela móvel de 30 dias (R$ 10,00 máx)
  trustWindowDays: 30,
  debtDueDays: 30, // Vencimento individual de 30 dias por pendência
  blockAfterOverdueDays: false, // Configurável conforme decisão de produto da Seção 3.4 do PRD
  creditPriorityOrder: [
    'PROMOTIONAL',
    'FREE_QUOTA',
    'MONTHLY_CONTRIBUTION',
    'WALLET_BALANCE',
    'TRUST_DEBT',
  ],
  aiRequestsPerHourLimit: 40,
};

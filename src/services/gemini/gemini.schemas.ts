import { z } from 'zod';

export const extractedJobRequirementsSchema = z.object({
  position: z.string().default('Cargo não especificado'),
  company: z.string().nullable().default(null),
  responsibilities: z.array(z.string()).default([]),
  mandatoryRequirements: z.array(z.string()).default([]),
  desirableRequirements: z.array(z.string()).default([]),
  technicalSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  toolsAndTechnologies: z.array(z.string()).default([]),
  educationAndExperience: z.array(z.string()).default([]),
  atsKeywords: z.array(z.string()).default([]),
});

export type ExtractedJobRequirements = z.infer<
  typeof extractedJobRequirementsSchema
>;

export const compatibilityAnalysisSchema = z.object({
  compatibilityScore: z.number().min(0).max(100),
  orientationDisclaimer: z
    .string()
    .default(
      'Este percentual é uma estimativa orientativa de aderência textual e técnica aos requisitos informados, não representando garantia ou previsão da decisão do recrutador.'
    ),
  scoreJustification: z.string(),
  mainAdherencePoints: z.array(z.string()).default([]),
  strengths: z.object({
    relatedExperiences: z.array(z.string()).default([]),
    compatibleSkills: z.array(z.string()).default([]),
    relevantAchievements: z.array(z.string()).default([]),
    matchingTools: z.array(z.string()).default([]),
  }),
  gaps: z.object({
    missingRequirements: z.array(z.string()).default([]),
    skillsToDevelop: z.array(z.string()).default([]),
    informationToConfirm: z.array(z.string()).default([]),
  }),
  recommendations: z.object({
    experiencesToHighlight: z.array(z.string()).default([]),
    atsKeywordsToInclude: z.array(z.string()).default([]),
    additionalInfoToStrengthen: z.array(z.string()).default([]),
  }),
});

export type CompatibilityAnalysis = z.infer<typeof compatibilityAnalysisSchema>;

export const generatedResumeContentSchema = z.object({
  header: z.object({
    fullName: z.string(),
    targetRole: z.string(),
    location: z.string().nullable().default(null),
    email: z.string().nullable().default(null),
    phone: z.string().nullable().default(null),
    linkedinUrl: z.string().nullable().default(null),
    portfolioUrl: z.string().nullable().default(null),
  }),
  professionalSummary: z.string(),
  experiences: z
    .array(
      z.object({
        company: z.string(),
        position: z.string(),
        period: z.string(),
        descriptionBullets: z.array(z.string()),
        toolsUsed: z.array(z.string()).default([]),
      })
    )
    .default([]),
  educations: z
    .array(
      z.object({
        institution: z.string(),
        course: z.string(),
        degree: z.string(),
        period: z.string(),
        status: z.string(),
      })
    )
    .default([]),
  skills: z.object({
    technical: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    certifications: z.array(z.string()).default([]),
  }),
  atsKeywordsApplied: z.array(z.string()).default([]),
  factualIntegrityNote: z
    .string()
    .default(
      'Currículo elaborado estritamente a partir dos fatos declarados pelo candidato em seu perfil profissional.'
    ),
});

export type GeneratedResumeContent = z.infer<
  typeof generatedResumeContentSchema
>;

export interface AiOperationUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  estimatedCostUsd: number;
}

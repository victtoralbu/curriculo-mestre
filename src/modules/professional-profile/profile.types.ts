import { z } from 'zod';

export const experienceSchema = z.object({
  id: z.string().optional(),
  company: z.string().trim().min(1, 'Informe a empresa.'),
  position: z.string().trim().min(1, 'Informe o cargo.'),
  employment_type: z.string().trim().optional().nullable(),
  start_date: z.string().trim().min(1, 'Informe a data inicial.'),
  end_date: z.string().trim().optional().nullable(),
  description: z.string().trim().min(1, 'Descreva as atividades realizadas.'),
  achievements: z.string().trim().optional().nullable(),
  tools: z.string().trim().optional().nullable(),
});

export const educationSchema = z.object({
  id: z.string().optional(),
  institution: z.string().trim().min(1, 'Informe a instituição.'),
  course: z.string().trim().min(1, 'Informe o curso.'),
  degree: z.string().trim().min(1, 'Informe o grau de formação.'),
  start_date: z.string().trim().optional().nullable(),
  end_date: z.string().trim().optional().nullable(),
  status: z.string().trim().min(1, 'Informe a situação do curso.'),
});

export const skillSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Informe o nome da competência.'),
  category: z.enum(['TECHNICAL', 'SOFT', 'TOOL', 'LANGUAGE', 'CERTIFICATION']),
  proficiency: z.string().trim().optional().nullable(),
});

export const updateProfileSchema = z.object({
  full_name: z.string().trim().optional().nullable(),
  contact_email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  professional_summary: z.string().trim().optional().nullable(),
  target_roles: z.string().trim().optional().nullable(),
  experience_years: z.string().trim().optional().nullable(),
  specialties: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  linkedin_url: z.string().trim().optional().nullable(),
  portfolio_url: z.string().trim().optional().nullable(),
  experiences: z.array(experienceSchema).optional(),
  educations: z.array(educationSchema).optional(),
  skills: z.array(skillSchema).optional(),
});

export type ExperienceItem = z.infer<typeof experienceSchema> & { id: string };
export type EducationItem = z.infer<typeof educationSchema> & { id: string };
export type SkillItem = z.infer<typeof skillSchema> & { id: string };

export interface FullProfessionalProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  contact_email: string | null;
  phone: string | null;
  professional_summary: string | null;
  target_roles: string | null;
  experience_years: string | null;
  specialties: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  experiences: ExperienceItem[];
  educations: EducationItem[];
  skills: SkillItem[];
  isComplete: boolean;
}

import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(120, 'Nome muito longo.'),
  email: z
    .string()
    .trim()
    .email('Informe um endereço de e-mail válido.')
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(6, 'A senha deve possuir pelo menos 6 caracteres.')
    .max(100, 'Senha muito longa.'),
  lgpdConsent: z
    .boolean()
    .refine((v) => v === true, 'É necessário aceitar os Termos de Uso e Política de Privacidade (LGPD).'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Informe um e-mail válido.')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Informe sua senha.'),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2, 'Nome inválido.').max(120).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.').optional(),
});

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
}

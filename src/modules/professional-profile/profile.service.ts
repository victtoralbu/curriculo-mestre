import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { recordAuditLog } from '@/modules/administration/audit.service';
import {
  EducationItem,
  educationSchema,
  ExperienceItem,
  experienceSchema,
  FullProfessionalProfile,
  SkillItem,
  skillSchema,
  updateProfileSchema,
} from './profile.types';

interface ProfileRow {
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
}

export async function getOrCreateProfileByUserId(
  userId: string
): Promise<FullProfessionalProfile> {
  let profileRes = await db.query<ProfileRow>(
    `SELECT * FROM professional_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (profileRes.rows.length === 0) {
    const userRes = await db.query<{ name: string; email: string }>(
      `SELECT name, email FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (userRes.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado.');
    }
    const u = userRes.rows[0];
    const newId = randomUUID();
    await db.query(
      `INSERT INTO professional_profiles (id, user_id, full_name, contact_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [newId, userId, u.name, u.email]
    );
    profileRes = await db.query<ProfileRow>(
      `SELECT * FROM professional_profiles WHERE id = $1`,
      [newId]
    );
  }

  const profile = profileRes.rows[0];

  const [expRes, eduRes, skillRes] = await Promise.all([
    db.query<ExperienceItem>(
      `SELECT id, company, position, employment_type, start_date, end_date, description, achievements, tools
       FROM professional_experiences
       WHERE profile_id = $1
       ORDER BY created_at DESC`,
      [profile.id]
    ),
    db.query<EducationItem>(
      `SELECT id, institution, course, degree, start_date, end_date, status
       FROM educations
       WHERE profile_id = $1
       ORDER BY created_at DESC`,
      [profile.id]
    ),
    db.query<SkillItem>(
      `SELECT id, name, category, proficiency
       FROM skills
       WHERE profile_id = $1
       ORDER BY category ASC, name ASC`,
      [profile.id]
    ),
  ]);

  const isComplete = Boolean(
    profile.full_name &&
      (profile.professional_summary || profile.target_roles) &&
      (expRes.rows.length > 0 || eduRes.rows.length > 0 || skillRes.rows.length > 0)
  );

  return {
    ...profile,
    experiences: expRes.rows,
    educations: eduRes.rows,
    skills: skillRes.rows,
    isComplete,
  };
}

/**
 * Garante isolamento de dados: valida se um profileId pertence ao userId autenticado
 */
export async function assertProfileOwnership(
  userId: string,
  profileId: string
): Promise<void> {
  const res = await db.query<{ user_id: string }>(
    `SELECT user_id FROM professional_profiles WHERE id = $1 LIMIT 1`,
    [profileId]
  );
  if (res.rows.length === 0) {
    throw new NotFoundError('Perfil profissional não encontrado.');
  }
  if (res.rows[0].user_id !== userId) {
    throw new ForbiddenError('Acesso negado ao perfil de outro usuário.');
  }
}

export async function saveFullProfessionalProfile(
  userId: string,
  rawInput: unknown
): Promise<FullProfessionalProfile> {
  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados do perfil inválidos.',
      parsed.error.flatten()
    );
  }

  const data = parsed.data;
  const current = await getOrCreateProfileByUserId(userId);

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE professional_profiles
       SET full_name = COALESCE($1, full_name),
           contact_email = COALESCE($2, contact_email),
           phone = COALESCE($3, phone),
           professional_summary = COALESCE($4, professional_summary),
           target_roles = COALESCE($5, target_roles),
           experience_years = COALESCE($6, experience_years),
           specialties = COALESCE($7, specialties),
           location = COALESCE($8, location),
           linkedin_url = COALESCE($9, linkedin_url),
           portfolio_url = COALESCE($10, portfolio_url),
           updated_at = NOW()
       WHERE id = $11 AND user_id = $12`,
      [
        data.full_name !== undefined ? data.full_name : current.full_name,
        data.contact_email !== undefined ? data.contact_email : current.contact_email,
        data.phone !== undefined ? data.phone : current.phone,
        data.professional_summary !== undefined
          ? data.professional_summary
          : current.professional_summary,
        data.target_roles !== undefined ? data.target_roles : current.target_roles,
        data.experience_years !== undefined
          ? data.experience_years
          : current.experience_years,
        data.specialties !== undefined ? data.specialties : current.specialties,
        data.location !== undefined ? data.location : current.location,
        data.linkedin_url !== undefined ? data.linkedin_url : current.linkedin_url,
        data.portfolio_url !== undefined ? data.portfolio_url : current.portfolio_url,
        current.id,
        userId,
      ]
    );

    if (data.experiences !== undefined) {
      await tx.query(`DELETE FROM professional_experiences WHERE profile_id = $1`, [
        current.id,
      ]);
      for (const exp of data.experiences) {
        await tx.query(
          `INSERT INTO professional_experiences
           (id, profile_id, company, position, employment_type, start_date, end_date, description, achievements, tools, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
          [
            exp.id || randomUUID(),
            current.id,
            exp.company,
            exp.position,
            exp.employment_type || null,
            exp.start_date,
            exp.end_date || null,
            exp.description,
            exp.achievements || null,
            exp.tools || null,
          ]
        );
      }
    }

    if (data.educations !== undefined) {
      await tx.query(`DELETE FROM educations WHERE profile_id = $1`, [current.id]);
      for (const edu of data.educations) {
        await tx.query(
          `INSERT INTO educations
           (id, profile_id, institution, course, degree, start_date, end_date, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            edu.id || randomUUID(),
            current.id,
            edu.institution,
            edu.course,
            edu.degree,
            edu.start_date || null,
            edu.end_date || null,
            edu.status,
          ]
        );
      }
    }

    if (data.skills !== undefined) {
      await tx.query(`DELETE FROM skills WHERE profile_id = $1`, [current.id]);
      for (const sk of data.skills) {
        await tx.query(
          `INSERT INTO skills
           (id, profile_id, name, category, proficiency, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            sk.id || randomUUID(),
            current.id,
            sk.name,
            sk.category,
            sk.proficiency || null,
          ]
        );
      }
    }

    await recordAuditLog(
      {
        actorUserId: userId,
        action: 'PROFILE_UPDATED',
        entity: 'professional_profiles',
        entityId: current.id,
      },
      tx
    );
  });

  return getOrCreateProfileByUserId(userId);
}

export async function addExperienceItem(
  userId: string,
  rawInput: unknown
): Promise<ExperienceItem> {
  const parsed = experienceSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados de experiência inválidos.'
    );
  }
  const profile = await getOrCreateProfileByUserId(userId);
  const id = randomUUID();
  const exp = parsed.data;
  await db.query(
    `INSERT INTO professional_experiences
     (id, profile_id, company, position, employment_type, start_date, end_date, description, achievements, tools, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
    [
      id,
      profile.id,
      exp.company,
      exp.position,
      exp.employment_type || null,
      exp.start_date,
      exp.end_date || null,
      exp.description,
      exp.achievements || null,
      exp.tools || null,
    ]
  );
  return { ...exp, id };
}

export async function deleteExperienceItem(
  userId: string,
  experienceId: string
): Promise<void> {
  const profile = await getOrCreateProfileByUserId(userId);
  const res = await db.query<{ profile_id: string }>(
    `SELECT profile_id FROM professional_experiences WHERE id = $1 LIMIT 1`,
    [experienceId]
  );
  if (res.rows.length === 0) {
    throw new NotFoundError('Experiência não encontrada.');
  }
  if (res.rows[0].profile_id !== profile.id) {
    throw new ForbiddenError('Você não tem permissão para remover este item.');
  }
  await db.query(`DELETE FROM professional_experiences WHERE id = $1`, [
    experienceId,
  ]);
}

export async function addEducationItem(
  userId: string,
  rawInput: unknown
): Promise<EducationItem> {
  const parsed = educationSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados de formação inválidos.'
    );
  }
  const profile = await getOrCreateProfileByUserId(userId);
  const id = randomUUID();
  const edu = parsed.data;
  await db.query(
    `INSERT INTO educations
     (id, profile_id, institution, course, degree, start_date, end_date, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      id,
      profile.id,
      edu.institution,
      edu.course,
      edu.degree,
      edu.start_date || null,
      edu.end_date || null,
      edu.status,
    ]
  );
  return { ...edu, id };
}

export async function deleteEducationItem(
  userId: string,
  educationId: string
): Promise<void> {
  const profile = await getOrCreateProfileByUserId(userId);
  const res = await db.query<{ profile_id: string }>(
    `SELECT profile_id FROM educations WHERE id = $1 LIMIT 1`,
    [educationId]
  );
  if (res.rows.length === 0) {
    throw new NotFoundError('Formação não encontrada.');
  }
  if (res.rows[0].profile_id !== profile.id) {
    throw new ForbiddenError('Você não tem permissão para remover este item.');
  }
  await db.query(`DELETE FROM educations WHERE id = $1`, [educationId]);
}

export async function addSkillItem(
  userId: string,
  rawInput: unknown
): Promise<SkillItem> {
  const parsed = skillSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message || 'Dados de competência inválidos.'
    );
  }
  const profile = await getOrCreateProfileByUserId(userId);
  const id = randomUUID();
  const sk = parsed.data;
  await db.query(
    `INSERT INTO skills (id, profile_id, name, category, proficiency, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, profile.id, sk.name, sk.category, sk.proficiency || null]
  );
  return { ...sk, id };
}

export async function deleteSkillItem(
  userId: string,
  skillId: string
): Promise<void> {
  const profile = await getOrCreateProfileByUserId(userId);
  const res = await db.query<{ profile_id: string }>(
    `SELECT profile_id FROM skills WHERE id = $1 LIMIT 1`,
    [skillId]
  );
  if (res.rows.length === 0) {
    throw new NotFoundError('Competência não encontrada.');
  }
  if (res.rows[0].profile_id !== profile.id) {
    throw new ForbiddenError('Você não tem permissão para remover este item.');
  }
  await db.query(`DELETE FROM skills WHERE id = $1`, [skillId]);
}

'use client';

import React, { useEffect, useState } from 'react';
import {
  Award,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

interface ExperienceForm {
  id?: string;
  company: string;
  position: string;
  employment_type?: string | null;
  start_date: string;
  end_date?: string | null;
  description: string;
  achievements?: string | null;
  tools?: string | null;
}

interface EducationForm {
  id?: string;
  institution: string;
  course: string;
  degree: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
}

interface SkillForm {
  id?: string;
  name: string;
  category: 'TECHNICAL' | 'SOFT' | 'TOOL' | 'LANGUAGE' | 'CERTIFICATION';
  proficiency?: string | null;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<
    'personal' | 'experiences' | 'educations' | 'skills' | 'import'
  >('personal');
  const [fullName, setFullName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [professionalSummary, setProfessionalSummary] = useState('');
  const [experiences, setExperiences] = useState<ExperienceForm[]>([]);
  const [educations, setEducations] = useState<EducationForm[]>([]);
  const [skills, setSkills] = useState<SkillForm[]>([]);

  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] =
    useState<SkillForm['category']>('TECHNICAL');
  const [newSkillProficiency, setNewSkillProficiency] = useState('');

  const [importText, setImportText] = useState('');
  const [importedPreview, setImportedPreview] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [importing, setImporting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          const p = data.profile;
          setFullName(p.full_name || '');
          setContactEmail(p.contact_email || '');
          setPhone(p.phone || '');
          setLocation(p.location || '');
          setLinkedinUrl(p.linkedin_url || '');
          setPortfolioUrl(p.portfolio_url || '');
          setTargetRoles(p.target_roles || '');
          setExperienceYears(p.experience_years || '');
          setSpecialties(p.specialties || '');
          setProfessionalSummary(p.professional_summary || '');
          setExperiences(p.experiences || []);
          setEducations(p.educations || []);
          setSkills(p.skills || []);
        }
      });
  }, []);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          contact_email: contactEmail,
          phone,
          location,
          linkedin_url: linkedinUrl,
          portfolio_url: portfolioUrl,
          target_roles: targetRoles,
          experience_years: experienceYears,
          specialties,
          professional_summary: professionalSummary,
          experiences,
          educations,
          skills,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao salvar perfil.');
        return;
      }
      setFeedback('Perfil profissional salvo com sucesso!');
    } catch {
      setError('Falha ao salvar perfil profissional.');
    } finally {
      setSaving(false);
    }
  };

  const handleImportResume = async (file?: File) => {
    setImporting(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch('/api/profile/import', {
          method: 'POST',
          body: fd,
        });
      } else {
        res = await fetch('/api/profile/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: importText }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao extrair dados do currículo.');
        return;
      }
      setImportedPreview(data.suggestedProfile);
    } catch {
      setError('Erro ao processar importação.');
    } finally {
      setImporting(false);
    }
  };

  const applyImportedPreviewWithoutOverwriting = () => {
    if (!importedPreview) return;
    if (!fullName && importedPreview.full_name)
      setFullName(String(importedPreview.full_name));
    if (!contactEmail && importedPreview.contact_email)
      setContactEmail(String(importedPreview.contact_email));
    if (!phone && importedPreview.phone)
      setPhone(String(importedPreview.phone));
    if (!location && importedPreview.location)
      setLocation(String(importedPreview.location));
    if (!linkedinUrl && importedPreview.linkedin_url)
      setLinkedinUrl(String(importedPreview.linkedin_url));
    if (!professionalSummary && importedPreview.professional_summary)
      setProfessionalSummary(String(importedPreview.professional_summary));
    if (!targetRoles && importedPreview.target_roles)
      setTargetRoles(String(importedPreview.target_roles));

    if (Array.isArray(importedPreview.experiences)) {
      setExperiences((prev) => [
        ...prev,
        ...(importedPreview.experiences as ExperienceForm[]),
      ]);
    }
    if (Array.isArray(importedPreview.educations)) {
      setEducations((prev) => [
        ...prev,
        ...(importedPreview.educations as EducationForm[]),
      ]);
    }
    if (Array.isArray(importedPreview.skills)) {
      setSkills((prev) => [
        ...prev,
        ...(importedPreview.skills as SkillForm[]),
      ]);
    }

    setImportedPreview(null);
    setActiveTab('personal');
    setFeedback(
      'Dados importados adicionados ao formulário (sem sobrescrever seus campos já preenchidos). Revise e clique em Salvar Perfil!'
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Perfil Profissional Reutilizável
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              A IA utiliza apenas os fatos reais cadastrados aqui para adaptar
              seu currículo a cada vaga.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveProfile()}
            className="min-h-[48px] px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Salvando...' : 'Salvar Perfil Completo'}</span>
          </button>
        </div>

        {feedback && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Abas Mobile-First */}
        <div className="flex overflow-x-auto gap-2 pb-1">
          {[
            { id: 'personal', label: '1. Dados & Resumo', icon: User },
            {
              id: 'experiences',
              label: `2. Experiências (${experiences.length})`,
              icon: Briefcase,
            },
            {
              id: 'educations',
              label: `3. Formação (${educations.length})`,
              icon: GraduationCap,
            },
            {
              id: 'skills',
              label: `4. Competências (${skills.length})`,
              icon: Award,
            },
            { id: 'import', label: '5. Importar Currículo', icon: Upload },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id as
                      | 'personal'
                      | 'experiences'
                      | 'educations'
                      | 'skills'
                      | 'import'
                  )
                }
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Aba 1: Dados Pessoais & Resumo */}
        {activeTab === 'personal' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Dados Pessoais e Resumo Profissional
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cidade e Estado (ex: São Paulo - SP)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail de Contato no Currículo
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL do LinkedIn
                </label>
                <input
                  type="text"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/seu-perfil"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Portfólio ou Site
                </label>
                <input
                  type="text"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/seu-usuario"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Objetivo Profissional / Cargos Alvo *
                </label>
                <input
                  type="text"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="Ex: Desenvolvedor Full-Stack, Analista de Dados"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempo de Experiência
                </label>
                <input
                  type="text"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="Ex: 5 anos / Em busca do 1º emprego"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Áreas de Atuação e Principais Especialidades
              </label>
              <input
                type="text"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="Ex: Desenvolvimento Web, Gestão de Projetos, Finanças, Atendimento"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resumo Profissional *
              </label>
              <textarea
                rows={4}
                value={professionalSummary}
                onChange={(e) => setProfessionalSummary(e.target.value)}
                placeholder="Descreva de forma autêntica sua trajetória, principais pontos fortes e objetivos..."
                className="w-full p-3.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>
        )}

        {/* Aba 2: Experiências Profissionais */}
        {activeTab === 'experiences' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Experiências Profissionais
                </h2>
                <p className="text-xs text-slate-500">
                  Informe as empresas, cargos, atividades reais e resultados que
                  você alcançou.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExperiences((prev) => [
                    ...prev,
                    {
                      company: '',
                      position: '',
                      employment_type: 'CLT',
                      start_date: '',
                      end_date: 'Atual',
                      description: '',
                      achievements: '',
                      tools: '',
                    },
                  ])
                }
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Adicionar Experiência
              </button>
            </div>

            {experiences.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Nenhuma experiência cadastrada ainda. Clique em &ldquo;Adicionar
                Experiência&rdquo; acima.
              </p>
            ) : (
              <div className="space-y-4">
                {experiences.map((exp, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-500">
                        Experiência #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExperiences((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="min-h-[36px] px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Empresa *"
                        value={exp.company}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].company = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Cargo *"
                        value={exp.position}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].position = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Tipo (CLT, PJ, Estágio, Freelance)"
                        value={exp.employment_type || ''}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].employment_type = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Data Inicial (ex: 03/2022) *"
                        value={exp.start_date}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].start_date = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Data Final (ou Atual)"
                        value={exp.end_date || ''}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].end_date = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Ferramentas utilizadas (separadas por vírgula)"
                        value={exp.tools || ''}
                        onChange={(e) => {
                          const copy = [...experiences];
                          copy[idx].tools = e.target.value;
                          setExperiences(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>

                    <textarea
                      rows={3}
                      placeholder="Descrição das atividades realizadas *"
                      value={exp.description}
                      onChange={(e) => {
                        const copy = [...experiences];
                        copy[idx].description = e.target.value;
                        setExperiences(copy);
                      }}
                      className="w-full p-3 rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Resultados e indicadores reais alcançados (opcional)"
                      value={exp.achievements || ''}
                      onChange={(e) => {
                        const copy = [...experiences];
                        copy[idx].achievements = e.target.value;
                        setExperiences(copy);
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba 3: Formação Acadêmica */}
        {activeTab === 'educations' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Formação Acadêmica
                </h2>
                <p className="text-xs text-slate-500">
                  Registre ensino médio, técnico, graduação, pós-graduação ou
                  cursos relevantes.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEducations((prev) => [
                    ...prev,
                    {
                      institution: '',
                      course: '',
                      degree: 'Graduação / Bacharelado',
                      start_date: '',
                      end_date: '',
                      status: 'Concluído',
                    },
                  ])
                }
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Adicionar Formação
              </button>
            </div>

            {educations.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Nenhuma formação acadêmica registrada.
              </p>
            ) : (
              <div className="space-y-4">
                {educations.map((edu, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-500">
                        Formação #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEducations((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="min-h-[36px] px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Instituição *"
                        value={edu.institution}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].institution = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Curso *"
                        value={edu.course}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].course = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Grau (ex: Bacharelado, Técnico)"
                        value={edu.degree}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].degree = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Início (ex: 2020)"
                        value={edu.start_date || ''}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].start_date = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Conclusão (ex: 2024)"
                        value={edu.end_date || ''}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].end_date = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Situação (Concluído, Cursando)"
                        value={edu.status}
                        onChange={(e) => {
                          const copy = [...educations];
                          copy[idx].status = e.target.value;
                          setEducations(copy);
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba 4: Competências, Ferramentas, Idiomas e Certificações */}
        {activeTab === 'skills' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Competências, Ferramentas, Idiomas e Certificações
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <input
                type="text"
                placeholder="Nome (ex: Excel, Inglês, React)"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
              <select
                value={newSkillCategory}
                onChange={(e) =>
                  setNewSkillCategory(
                    e.target.value as SkillForm['category']
                  )
                }
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="TECHNICAL">Competência Técnica</option>
                <option value="TOOL">Ferramenta / Software</option>
                <option value="SOFT">Competência Comportamental</option>
                <option value="LANGUAGE">Idioma</option>
                <option value="CERTIFICATION">Certificação</option>
              </select>
              <input
                type="text"
                placeholder="Nível (ex: Avançado, Fluente)"
                value={newSkillProficiency}
                onChange={(e) => setNewSkillProficiency(e.target.value)}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newSkillName.trim()) return;
                  setSkills((prev) => [
                    ...prev,
                    {
                      name: newSkillName.trim(),
                      category: newSkillCategory,
                      proficiency: newSkillProficiency.trim() || null,
                    },
                  ]);
                  setNewSkillName('');
                  setNewSkillProficiency('');
                }}
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Adicionar Item
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map((sk, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800"
                >
                  <span className="font-bold">{sk.name}</span>
                  <span className="text-slate-500">({sk.category})</span>
                  {sk.proficiency && (
                    <span className="text-brand-700">• {sk.proficiency}</span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setSkills((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-red-600 ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aba 5: Importação Assistida de Currículo */}
        {activeTab === 'import' && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Importar Currículo Existente (DOCX ou Texto)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Envie seu arquivo <code>.docx</code> ou cole o texto do seu
              currículo atual. Os dados serão extraídos para sua revisão e{' '}
              <strong>não sobrescreverão automaticamente</strong> o que você já
              cadastrou.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Enviar arquivo DOCX ou TXT:
              </label>
              <input
                type="file"
                accept=".docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportResume(file);
                }}
                className="block w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Ou cole o texto completo do seu currículo abaixo:
              </label>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Cole aqui o texto do seu currículo atual..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="button"
                disabled={importing || importText.trim().length < 20}
                onClick={() => handleImportResume()}
                className="min-h-[44px] px-4 py-2.5 bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
              >
                {importing
                  ? 'Extraindo informações com IA...'
                  : 'Extrair Dados para Revisão'}
              </button>
            </div>

            {importedPreview && (
              <div className="p-4 rounded-xl bg-brand-50 border border-brand-200 space-y-3">
                <h3 className="text-sm font-bold text-brand-900">
                  Dados Identificados — Confirme para Incorporar ao Perfil
                </h3>
                <pre className="text-xs bg-white p-3 rounded-lg border border-brand-100 overflow-x-auto max-h-60">
                  {JSON.stringify(importedPreview, null, 2)}
                </pre>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyImportedPreviewWithoutOverwriting}
                    className="min-h-[44px] px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
                  >
                    Confirmar e Incorporar Dados ao Formulário
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportedPreview(null)}
                    className="min-h-[44px] px-4 py-2 bg-white text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

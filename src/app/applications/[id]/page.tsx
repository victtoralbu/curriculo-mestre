'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  Lightbulb,
  Save,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  CompatibilityAnalysis,
  ExtractedJobRequirements,
  GeneratedResumeContent,
} from '@/services/gemini/gemini.schemas';
import { ApplicationStatus } from '@/modules/resume-generation/application.service';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  EM_PREPARACAO: 'Em preparação',
  CURRICULO_GERADO: 'Currículo gerado',
  CANDIDATADO: 'Candidatado',
  EM_PROCESSO_SELETIVO: 'Em processo seletivo',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  ENCERRADO: 'Encerrado',
};

export default function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeView, setActiveView] = useState<'analysis' | 'editor'>(
    'analysis'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState('');
  const [company, setCompany] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>('CURRICULO_GERADO');
  const [creditSource, setCreditSource] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [analysis, setAnalysis] = useState<CompatibilityAnalysis | null>(null);
  const [requirements, setRequirements] =
    useState<ExtractedJobRequirements | null>(null);
  const [resume, setResume] = useState<GeneratedResumeContent | null>(null);

  useEffect(() => {
    fetch(`/api/applications/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !data.application) {
          setError(data.error?.message || 'Candidatura não encontrada.');
          return;
        }
        const app = data.application;
        setPosition(app.position);
        setCompany(app.company);
        setStatus(app.status);
        setCreditSource(app.credit_source);
        setScore(app.compatibility_score);
        setAnalysis(app.analysis);
        setRequirements(app.extracted_requirements);
        setResume(app.resume_content);
      })
      .catch(() => setError('Erro ao carregar candidatura.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveEdits = async () => {
    if (!resume) return;
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resumeContent: resume,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao salvar edições.');
        return;
      }
      setFeedback(
        'Alterações do currículo e status salvas com sucesso (sem custo adicional).'
      );
    } catch {
      setError('Falha ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-slate-600">
          Carregando análise e currículo personalizado...
        </div>
      </AppShell>
    );
  }

  if (error && !resume) {
    return (
      <AppShell>
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-700 space-y-3">
          <p className="font-bold">{error}</p>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao histórico
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabeçalho da Candidatura + Exportação DOCX/PDF */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Link
                  href="/history"
                  className="hover:text-slate-900 inline-flex items-center gap-1 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Histórico
                </Link>
                <span>•</span>
                <span>Origem do crédito: {creditSource || 'Cota'}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {position}
                {company ? ` — ${company}` : ''}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                aria-label="Status da candidatura"
                className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    Status: {label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdits}
                className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>

              <a
                href={`/api/applications/${id}/export?format=docx`}
                className="min-h-[44px] px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Baixar DOCX</span>
              </a>

              <a
                href={`/api/applications/${id}/export?format=pdf`}
                className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Baixar PDF</span>
              </a>
            </div>
          </div>

          {feedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          {/* Seletor Mobile-First entre Análise de Compatibilidade e Editor de Currículo */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActiveView('analysis')}
              className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 ${
                activeView === 'analysis'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>1. Compatibilidade & Lacunas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('editor')}
              className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 ${
                activeView === 'editor'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>2. Editor de Currículo ATS</span>
            </button>
          </div>
        </div>

        {/* Visão 1: Resultado da Análise de Compatibilidade */}
        {activeView === 'analysis' && analysis && (
          <div className="space-y-5">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase text-brand-700">
                    Compatibilidade Geral Estimada
                  </span>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {score}% de aderência ao perfil da vaga
                  </h2>
                  <p className="text-xs text-slate-500 italic">
                    {analysis.orientationDisclaimer}
                  </p>
                </div>
                <div className="w-full sm:w-48 bg-slate-100 h-4 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                  />
                </div>
              </div>

              <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {analysis.scoreJustification}
              </p>

              {requirements && requirements.atsKeywords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">
                    Palavras-chave ATS Identificadas na Vaga
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {requirements.atsKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-800 border border-brand-200 text-xs font-medium"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Pontos Fortes (Fatos Declarados) */}
              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3>Pontos Fortes Reais</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Fatos já declarados no seu perfil que atendem à vaga:
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc pl-4">
                  {[
                    ...analysis.strengths.relatedExperiences,
                    ...analysis.strengths.compatibleSkills,
                    ...analysis.strengths.relevantAchievements,
                    ...analysis.strengths.matchingTools,
                  ].map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Lacunas Identificadas */}
              <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3>Lacunas & Confirmações</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Requisitos ausentes no seu perfil (não inventados pela IA):
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc pl-4">
                  {[
                    ...analysis.gaps.missingRequirements,
                    ...analysis.gaps.skillsToDevelop,
                    ...analysis.gaps.informationToConfirm,
                  ].map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Recomendações Estratégicas */}
              <div className="bg-white p-5 rounded-2xl border border-brand-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-brand-900 font-bold text-base">
                  <Lightbulb className="w-5 h-5 text-brand-600" />
                  <h3>Recomendações</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Orientações para fortalecer sua apresentação:
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc pl-4">
                  {[
                    ...analysis.recommendations.experiencesToHighlight,
                    ...analysis.recommendations.additionalInfoToStrengthen,
                  ].map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Visão 2: Editor de Currículo Personalizado ATS */}
        {activeView === 'editor' && resume && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-700" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Editor de Currículo (Formato Coluna Única ATS)
                  </h2>
                  <p className="text-xs text-slate-500">
                    {resume.factualIntegrityNote}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdits}
                className="min-h-[44px] px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
              >
                {saving ? 'Salvando...' : 'Salvar Currículo'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome no Cabeçalho
                </label>
                <input
                  type="text"
                  value={resume.header.fullName}
                  onChange={(e) =>
                    setResume({
                      ...resume,
                      header: { ...resume.header, fullName: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título / Cargo Alvo no Cabeçalho
                </label>
                <input
                  type="text"
                  value={resume.header.targetRole}
                  onChange={(e) =>
                    setResume({
                      ...resume,
                      header: { ...resume.header, targetRole: e.target.value },
                    })
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resumo Profissional Adaptado à Vaga
              </label>
              <textarea
                rows={4}
                value={resume.professionalSummary}
                onChange={(e) =>
                  setResume({ ...resume, professionalSummary: e.target.value })
                }
                className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Experiências no Currículo
              </h3>
              {resume.experiences.map((exp, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={exp.position}
                      onChange={(e) => {
                        const copy = [...resume.experiences];
                        copy[idx] = { ...copy[idx], position: e.target.value };
                        setResume({ ...resume, experiences: copy });
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                    />
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const copy = [...resume.experiences];
                        copy[idx] = { ...copy[idx], company: e.target.value };
                        setResume({ ...resume, experiences: copy });
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      value={exp.period}
                      onChange={(e) => {
                        const copy = [...resume.experiences];
                        copy[idx] = { ...copy[idx], period: e.target.value };
                        setResume({ ...resume, experiences: copy });
                      }}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={exp.descriptionBullets.join('\n')}
                    onChange={(e) => {
                      const copy = [...resume.experiences];
                      copy[idx] = {
                        ...copy[idx],
                        descriptionBullets: e.target.value
                          .split('\n')
                          .filter(Boolean),
                      };
                      setResume({ ...resume, experiences: copy });
                    }}
                    className="w-full p-3 rounded-lg border border-slate-300 bg-white text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

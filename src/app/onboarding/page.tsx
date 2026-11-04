'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  FileText,
  LogOut,
  Paperclip,
  Send,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  ChatActionButton,
  ChatMessageItem,
  OnboardingSessionOverview,
} from '@/modules/onboarding/onboarding.types';
import { GeneratedResumeContent } from '@/services/gemini/gemini.schemas';

const SECTION_LABELS: Array<{
  key: keyof OnboardingSessionOverview['sectionStates'];
  label: string;
}> = [
  { key: 'personal', label: 'Dados pessoais' },
  { key: 'positioning', label: 'Posicionamento' },
  { key: 'summary', label: 'Resumo profissional' },
  { key: 'experiences', label: 'Experiências' },
  { key: 'education', label: 'Formação' },
  { key: 'skills', label: 'Competências' },
  { key: 'languages', label: 'Idiomas' },
];

function formatStatusLabel(status: 'pending' | 'in_progress' | 'completed') {
  if (status === 'completed') return 'concluído';
  if (status === 'in_progress') return 'em andamento';
  return 'pendente';
}

export default function OnboardingChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<OnboardingSessionOverview | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [previewMasterModal, setPreviewMasterModal] =
    useState<GeneratedResumeContent | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/onboarding')
      .then(async (res) => {
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (data.ok && data.session) {
          setSession(data.session);
        } else {
          setError(data.error?.message || 'Erro ao carregar conversa.');
        }
      })
      .catch(() => {
        setError('Não foi possível conectar ao servidor.');
      })
      .finally(() => setLoadingInitial(false));
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, sending, uploading]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const handleSendMessage = async (textOverride?: string, actionId?: string) => {
    const messageToSend =
      textOverride !== undefined ? textOverride : inputText.trim();
    if (!messageToSend && !actionId) return;
    if (sending || uploading) return;

    setError(null);
    setSending(true);
    if (textOverride === undefined) {
      setInputText('');
    }

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          actionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Não foi possível enviar sua resposta.');
        return;
      }
      setSession(data.session);
    } catch {
      setError('Falha de comunicação ao enviar mensagem. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setError('Formato inválido. Por favor, envie um arquivo PDF (.pdf) ou Word (.docx).');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error?.message ||
            'Não foi possível ler o arquivo enviado. Tente enviar em DOCX ou PDF textual.'
        );
        return;
      }
      setSession(data.session);
    } catch {
      setError('Falha de conexão durante o envio do currículo.');
    } finally {
      setUploading(false);
    }
  };

  const handleActionClick = (action: ChatActionButton, msg: ChatMessageItem) => {
    if (action.type === 'file_upload') {
      fileInputRef.current?.click();
      return;
    }
    if (action.type === 'message') {
      handleSendMessage(action.value || action.label, action.id);
      return;
    }
    if (action.type === 'preview_master') {
      const resumeToPreview =
        msg.metadata.masterResumePreview || session?.masterResume;
      if (resumeToPreview) {
        setPreviewMasterModal(resumeToPreview);
      }
      return;
    }
    if (action.type === 'download_pdf' || action.type === 'download_docx') {
      if (action.href) {
        window.open(action.href, '_blank');
      }
      return;
    }
    if (action.type === 'navigate' && action.href) {
      router.push(action.href);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">
            Iniciando sua consultoria de carreira com IA...
          </p>
        </div>
      </div>
    );
  }

  const completedCount = session
    ? SECTION_LABELS.filter(
        (s) => session.sectionStates[s.key] === 'completed'
      ).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Hidden File Input for PDF / DOCX */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Minimalist Career Consultant Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">
                  Currículo Mestre
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Consultora IA
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Construção guiada e estratégica do seu currículo mestre
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact Progress Trigger */}
            {session && (
              <button
                type="button"
                onClick={() => setShowProgressDetails((prev) => !prev)}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-2 transition"
              >
                <span>
                  Progresso: {completedCount}/{SECTION_LABELS.length}
                </span>
                {showProgressDetails ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
            )}

            {/* Somente após a conclusão do currículo mestre habilita Nova Candidatura e Painel */}
            {session?.onboardingCompleted && (
              <>
                <Link
                  href="/applications/new"
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Nova candidatura</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium hidden sm:flex items-center"
                >
                  Painel
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-slate-100 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Progress Bar & Collapsible Section Status (Seção 5) */}
        {session && (
          <div className="border-t border-slate-100 bg-slate-50/80">
            <div className="max-w-4xl mx-auto px-4 py-2">
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
                {SECTION_LABELS.map((item) => {
                  const st = session.sectionStates[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 ${
                        st === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : st === 'in_progress'
                            ? 'bg-brand-50 text-brand-800 border border-brand-200 font-semibold'
                            : 'text-slate-500'
                      }`}
                    >
                      {st === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : st === 'in_progress' ? (
                        <Clock className="w-3.5 h-3.5 text-brand-600" />
                      ) : (
                        <Circle className="w-3 h-3 text-slate-300" />
                      )}
                      <span>{item.label}:</span>
                      <span className="font-semibold">
                        {formatStatusLabel(st)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {showProgressDetails && (
                <div className="mt-2 pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pb-1">
                  <div className="font-bold text-slate-900 sm:col-span-2">
                    Construção do seu currículo mestre
                  </div>
                  {SECTION_LABELS.map((item) => {
                    const st = session.sectionStates[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200"
                      >
                        <span>{item.label}</span>
                        <span
                          className={`font-semibold ${
                            st === 'completed'
                              ? 'text-emerald-700'
                              : st === 'in_progress'
                                ? 'text-brand-700'
                                : 'text-slate-400'
                          }`}
                        >
                          {formatStatusLabel(st)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Conversational Stream */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-5 overflow-y-auto">
        {session?.messages.map((msg) => {
          const isAi = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-2xl w-full rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${
                  isAi
                    ? 'bg-white border border-slate-200 text-slate-800'
                    : 'bg-brand-700 text-white ml-auto max-w-xl'
                }`}
              >
                {/* Sender Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isAi ? (
                      <>
                        <div className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">
                          Consultora de Carreira IA
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-brand-100">
                        Você
                      </span>
                    )}
                  </div>
                  {msg.metadata?.fileInfo && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-800 text-brand-100 text-[11px]">
                      <FileText className="w-3 h-3" />
                      {msg.metadata.fileInfo.fileName}
                    </span>
                  )}
                </div>

                {/* Message Paragraphs */}
                <div className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line">
                  {msg.content}
                </div>

                {/* Educational Box ("Como estamos melhorando esta experiência?" / Dicas ATS) */}
                {isAi && msg.metadata?.educationalBox && (
                  <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                      <BookOpen className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{msg.metadata.educationalBox.title}</span>
                    </div>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-amber-950 list-disc pl-4">
                      {msg.metadata.educationalBox.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Structured Section Preview Card */}
                {isAi && msg.metadata?.sectionPreview && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {msg.metadata.sectionPreview.title}
                      </span>
                      {msg.metadata.sectionPreview.statusBadge && (
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-[11px] font-semibold">
                          {msg.metadata.sectionPreview.statusBadge}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                      {msg.metadata.sectionPreview.lines.map((line, i) => (
                        <p key={i} className="leading-relaxed">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline Master Resume Preview Summary when completed */}
                {isAi && msg.metadata?.masterResumePreview && (
                  <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="font-bold text-sm text-slate-900">
                          Currículo Mestre Consolidado —{' '}
                          {msg.metadata.masterResumePreview.header.fullName}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        100% Confirmado
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-brand-700">
                      {msg.metadata.masterResumePreview.header.targetRole}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-3">
                      {msg.metadata.masterResumePreview.professionalSummary}
                    </p>
                  </div>
                )}

                {/* Contextual Action Buttons inside the message */}
                {isAi &&
                  msg.metadata?.actions &&
                  msg.metadata.actions.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2.5">
                      {msg.metadata.actions.map((act) => {
                        const isPrimary = act.variant === 'primary' || !act.variant;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            disabled={sending || uploading}
                            onClick={() => handleActionClick(act, msg)}
                            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-sm disabled:opacity-50 ${
                              isPrimary
                                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                : act.variant === 'secondary'
                                  ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                  : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {act.type === 'file_upload' && (
                              <Upload className="w-4 h-4" />
                            )}
                            {act.type === 'preview_master' && (
                              <Eye className="w-4 h-4" />
                            )}
                            {(act.type === 'download_pdf' ||
                              act.type === 'download_docx') && (
                              <Download className="w-4 h-4" />
                            )}
                            {act.id === 'new_application' && (
                              <FilePlus2 className="w-4 h-4" />
                            )}
                            {act.id === 'edit_info' && (
                              <Edit3 className="w-4 h-4" />
                            )}
                            <span>{act.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {/* Processing Indicator */}
        {(sending || uploading) && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 text-xs sm:text-sm text-slate-600">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <span>
                {uploading
                  ? 'Lendo seu documento PDF/DOCX e organizando suas informações...'
                  : 'Analisando sua resposta e preparando a próxima orientação...'}
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs sm:text-sm text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Bottom Conversational Input Bar */}
      <footer className="sticky bottom-0 z-20 bg-white border-t border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <button
              type="button"
              disabled={sending || uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Enviar currículo em PDF ou DOCX"
              className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 text-xs font-semibold shrink-0 transition disabled:opacity-50"
            >
              <Paperclip className="w-4 h-4 text-brand-600" />
              <span className="hidden sm:inline">Anexar PDF/DOCX</span>
            </button>

            <input
              type="text"
              value={inputText}
              disabled={sending || uploading}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Responda aqui para a Consultora IA..."
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
            />

            <button
              type="submit"
              disabled={sending || uploading || !inputText.trim()}
              className="min-h-[48px] px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center gap-2 shadow-sm transition shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </footer>

      {/* Modal de Prévia Completa do Currículo Mestre (Seção 6) */}
      {previewMasterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Prévia do seu Currículo Mestre
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMasterModal(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm text-slate-800">
              <div className="border-b border-slate-200 pb-4 space-y-1">
                <h3 className="text-xl font-bold text-slate-900">
                  {previewMasterModal.header.fullName}
                </h3>
                <p className="text-sm font-semibold text-brand-700">
                  {previewMasterModal.header.targetRole}
                </p>
                <p className="text-xs text-slate-500">
                  {[
                    previewMasterModal.header.location,
                    previewMasterModal.header.email,
                    previewMasterModal.header.phone,
                    previewMasterModal.header.linkedinUrl,
                  ]
                    .filter(Boolean)
                    .join('  |  ')}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Resumo Profissional
                </h4>
                <p className="text-sm leading-relaxed">
                  {previewMasterModal.professionalSummary}
                </p>
              </div>

              {previewMasterModal.experiences.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Experiências Profissionais
                  </h4>
                  {previewMasterModal.experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-slate-900">
                          {exp.position} — {exp.company}
                        </span>
                        <span className="text-xs text-slate-500">
                          {exp.period}
                        </span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm text-slate-700">
                        {exp.descriptionBullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                      {exp.toolsUsed.length > 0 && (
                        <p className="text-xs text-slate-500 italic">
                          Ferramentas: {exp.toolsUsed.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {previewMasterModal.educations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Formação Acadêmica
                  </h4>
                  {previewMasterModal.educations.map((ed, idx) => (
                    <div key={idx} className="text-xs sm:text-sm">
                      <strong>
                        {ed.degree} em {ed.course}
                      </strong>{' '}
                      — {ed.institution} ({ed.status})
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Competências, Ferramentas e Idiomas
                </h4>
                {previewMasterModal.skills.technical.length > 0 && (
                  <p className="text-xs sm:text-sm">
                    <strong>Competências Técnicas:</strong>{' '}
                    {previewMasterModal.skills.technical.join(', ')}
                  </p>
                )}
                {previewMasterModal.skills.tools.length > 0 && (
                  <p className="text-xs sm:text-sm">
                    <strong>Ferramentas:</strong>{' '}
                    {previewMasterModal.skills.tools.join(', ')}
                  </p>
                )}
                {previewMasterModal.skills.soft.length > 0 && (
                  <p className="text-xs sm:text-sm">
                    <strong>Comportamentais:</strong>{' '}
                    {previewMasterModal.skills.soft.join(', ')}
                  </p>
                )}
                {previewMasterModal.skills.languages.length > 0 && (
                  <p className="text-xs sm:text-sm">
                    <strong>Idiomas:</strong>{' '}
                    {previewMasterModal.skills.languages.join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/profile/export?format=pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Baixar em PDF
                </a>
                <a
                  href="/api/profile/export?format=docx"
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Baixar em DOCX
                </a>
              </div>
              <Link
                href="/applications/new"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <FilePlus2 className="w-4 h-4" />
                Nova candidatura
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

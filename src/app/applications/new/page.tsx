'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FilePlus2,
  Link as LinkIcon,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  ApplicationChatOverview,
  ChatActionButton,
} from '@/modules/onboarding/onboarding.types';

export default function NewApplicationPage() {
  const router = useRouter();
  const [session, setSession] = useState<ApplicationChatOverview | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const initNewSession = (forceNew = false) => {
    setLoadingInitial(true);
    setError(null);
    fetch(`/api/applications/chat${forceNew ? '?new=1' : ''}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (data.error?.message?.includes('Currículo Mestre')) {
            router.replace('/onboarding');
            return;
          }
          setError(data.error?.message || 'Erro ao iniciar nova candidatura.');
          return;
        }
        setSession(data.session);
      })
      .catch(() => {
        setError('Não foi possível conectar ao servidor.');
      })
      .finally(() => setLoadingInitial(false));
  };

  useEffect(() => {
    initNewSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, sending]);

  const handleSendMessage = async (textOverride?: string, actionId?: string) => {
    if (!session) return;
    const messageToSend =
      textOverride !== undefined ? textOverride : inputText.trim();
    if (!messageToSend && !actionId) return;
    if (sending) return;

    setError(null);
    setSending(true);
    if (textOverride === undefined) {
      setInputText('');
    }

    try {
      const res = await fetch('/api/applications/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: session.conversationId,
          message: messageToSend,
          actionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error?.message ||
            'Não foi possível processar a vaga e gerar o currículo.'
        );
        return;
      }
      setSession(data.session);
    } catch {
      setError('Falha de comunicação ao processar sua solicitação.');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    e.target.value = '';

    setError(null);
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('conversationId', session.conversationId);
      fd.append('file', file);

      const res = await fetch('/api/applications/chat', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao ler o arquivo do anúncio.');
        return;
      }
      setSession(data.session);
    } catch {
      setError('Falha ao enviar arquivo com o anúncio da vaga.');
    } finally {
      setSending(false);
    }
  };

  const handleActionClick = (action: ChatActionButton) => {
    if (action.type === 'message') {
      handleSendMessage(action.value || action.label, action.id);
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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Nova Candidatura Orientada por IA
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Seu Currículo Mestre é nossa referência. Envie o link da vaga para
              gerarmos uma versão direcionada sem alterar seu currículo original.
            </p>
          </div>

          {session?.flowState === 'application_completed' && (
            <button
              type="button"
              onClick={() => initNewSession(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Analisar Outra Vaga</span>
            </button>
          )}
        </div>

        {/* Conversational Stream */}
        {loadingInitial ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-600">
              Preparando consultoria para sua nova candidatura...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {session?.messages.map((msg) => {
              const isAi = msg.role === 'assistant';
              const appResult = msg.metadata?.applicationResult;

              return (
                <div
                  key={msg.id}
                  className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`w-full max-w-3xl rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${
                      isAi
                        ? 'bg-white border border-slate-200 text-slate-800'
                        : 'bg-brand-700 text-white ml-auto max-w-xl'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isAi ? (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">
                            Especialista IA em Candidaturas
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-brand-100">
                          Você
                        </span>
                      )}
                    </div>

                    <div className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </div>

                    {/* Section Preview Card */}
                    {isAi && msg.metadata?.sectionPreview && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {msg.metadata.sectionPreview.title}
                          </span>
                          {msg.metadata.sectionPreview.statusBadge && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                              {msg.metadata.sectionPreview.statusBadge}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-xs sm:text-sm text-slate-700">
                          {msg.metadata.sectionPreview.lines.map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Complete Application Result Card (Seção 7) */}
                    {isAi && appResult && (
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <h3 className="font-bold text-base text-slate-900">
                              {appResult.position}
                              {appResult.company ? ` • ${appResult.company}` : ''}
                            </h3>
                            <p className="text-xs text-slate-500">
                              Versão personalizada salva de forma independente
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                            Aderência orientativa: {appResult.compatibility_score}%
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                            <p className="font-bold text-slate-900">
                              Principais Requisitos Identificados
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                              {(appResult.extracted_requirements
                                .mandatoryRequirements.length > 0
                                ? appResult.extracted_requirements
                                    .mandatoryRequirements
                                : appResult.extracted_requirements.atsKeywords
                              )
                                .slice(0, 5)
                                .map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                            </ul>
                          </div>

                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                            <p className="font-bold text-slate-900">
                              Competências Priorizadas do seu Perfil
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                              {appResult.analysis.strengths.compatibleSkills
                                .slice(0, 5)
                                .map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                            </ul>
                          </div>
                        </div>

                        {/* Prévia do Currículo Personalizado */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                              Currículo Personalizado para a Vaga
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                          <p className="font-bold text-sm text-slate-900">
                            {appResult.resume_content.header.fullName} —{' '}
                            {appResult.resume_content.header.targetRole}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {appResult.resume_content.professionalSummary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {isAi &&
                      msg.metadata?.actions &&
                      msg.metadata.actions.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-2.5">
                          {msg.metadata.actions.map((act) => {
                            const isPrimary =
                              act.variant === 'primary' || !act.variant;
                            return (
                              <button
                                key={act.id}
                                type="button"
                                disabled={sending}
                                onClick={() => handleActionClick(act)}
                                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-sm disabled:opacity-50 ${
                                  isPrimary
                                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                                    : act.variant === 'secondary'
                                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                      : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {(act.type === 'download_pdf' ||
                                  act.type === 'download_docx') && (
                                  <Download className="w-4 h-4" />
                                )}
                                {act.type === 'navigate' && (
                                  <ExternalLink className="w-4 h-4" />
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

            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                  <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <span>
                    Analisando requisitos da vaga e comparando com seu Currículo
                    Mestre...
                  </span>
                </div>
              </div>
            )}

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
          </div>
        )}

        {/* Contextual Input Area */}
        {session && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
          >
            {session.flowState === 'awaiting_job_link' ? (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                  <input
                    type="text"
                    value={inputText}
                    disabled={sending}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Cole aqui o link da vaga (https://...)"
                    className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="min-h-[48px] px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Link da Vaga</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <textarea
                  rows={4}
                  value={inputText}
                  disabled={sending}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    session.flowState === 'awaiting_job_description'
                      ? 'Cole aqui a descrição completa da vaga (cargo, responsabilidades, requisitos)...'
                      : 'Digite sua resposta para a IA...'
                  }
                  className="w-full p-3.5 rounded-xl border border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Paperclip className="w-4 h-4 text-brand-600" />
                    <span>Enviar anúncio em PDF/DOCX</span>
                  </button>

                  <button
                    type="submit"
                    disabled={sending || !inputText.trim()}
                    className="min-h-[42px] px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar para Análise</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </AppShell>
  );
}

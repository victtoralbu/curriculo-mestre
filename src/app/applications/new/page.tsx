'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatCentsToBRL } from '@/lib/utils';

export default function NewApplicationPage() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [walletSummary, setWalletSummary] = useState<{
    freeQuotaRemaining: number;
    promotionalCreditsRemaining: number;
    monthlyContributionActive: boolean;
    monthlyContributionQuotaRemaining: number;
    balanceCents: number;
    trustCreditsRemaining: number;
  } | null>(null);

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => {
        if (data.wallet) setWalletSummary(data.wallet);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company || null,
          position: position || null,
          sourceUrl: sourceUrl || null,
          jobDescription,
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
      router.push(`/applications/${data.application.id}`);
    } catch {
      setError('Falha de comunicação ao gerar candidatura. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Nova Candidatura & Análise de Vaga
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Informe a descrição da oportunidade. Vamos comparar com seu perfil
            profissional, identificar pontos fortes e lacunas reais e gerar uma
            versão personalizada do seu currículo para sistemas ATS.
          </p>

          {walletSummary && (
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              {walletSummary.promotionalCreditsRemaining > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-800 font-semibold border border-brand-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" />
                  Você possui {walletSummary.promotionalCreditsRemaining}{' '}
                  crédito(s) promocional(is) ativo(s) (sem custo)
                </span>
              ) : walletSummary.freeQuotaRemaining > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Cota Gratuita Mensal disponível ({walletSummary.freeQuotaRemaining}{' '}
                  restante(s) sem cobrança)
                </span>
              ) : walletSummary.monthlyContributionActive &&
                walletSummary.monthlyContributionQuotaRemaining > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  Cota Mensal Ativa ({walletSummary.monthlyContributionQuotaRemaining}{' '}
                  restantes no ciclo)
                </span>
              ) : walletSummary.balanceCents >= 10 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold">
                  Uso adicional: R$ 0,10 (Saldo disponível:{' '}
                  {formatCentsToBRL(walletSummary.balanceCents)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 font-semibold border border-amber-200">
                  Crédito de Confiança disponível: R$ 0,10 com prazo de 30 dias
                  ({walletSummary.trustCreditsRemaining} usos restantes na
                  janela)
                </span>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5"
        >
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                {error.includes('perfil profissional') && (
                  <Link
                    href="/profile"
                    className="inline-block underline font-bold text-red-800"
                  >
                    Ir para o Perfil Profissional →
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cargo da Oportunidade (opcional, a IA também identifica)
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ex: Analista Financeiro Pleno"
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Empresa (opcional)
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Empresa XYZ"
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link da Vaga (opcional)
            </label>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Atenção: plataformas que exigem login (como LinkedIn ou Glassdoor)
              bloqueiam acesso automático. Recomendamos colar o texto da vaga
              abaixo.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição Completa da Vaga *
            </label>
            <textarea
              rows={9}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Cole aqui o texto completo da vaga (responsabilidades, requisitos obrigatórios, desejáveis, ferramentas)..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 text-base transition"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {loading
                ? 'Analisando requisitos e gerando currículo personalizado...'
                : 'Analisar Vaga e Gerar Currículo Personalizado'}
            </span>
          </button>
        </form>
      </div>
    </AppShell>
  );
}

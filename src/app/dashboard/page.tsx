'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  FileText,
  Sparkles,
  Ticket,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatCentsToBRL, formatDateBR } from '@/lib/utils';

interface DashboardApplication {
  id: string;
  company: string | null;
  position: string;
  compatibility_score: number;
  status: string;
  credit_source: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [profileComplete, setProfileComplete] = useState(true);
  const [wallet, setWallet] = useState<{
    balanceCents: number;
    promotionalCreditsRemaining: number;
    currentCycleKey: string;
    monthlyContributionActive: boolean;
    usedInCurrentCycle: number;
    freeQuotaRemaining: number;
    monthlyContributionQuotaRemaining: number;
    activePendingDebtsCount: number;
    activePendingDebtsCents: number;
    overdueDebtsCount: number;
  } | null>(null);
  const [applications, setApplications] = useState<DashboardApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
      fetch('/api/wallet').then((r) => r.json()),
      fetch('/api/applications').then((r) => r.json()),
    ])
      .then(([meData, profData, walData, appData]) => {
        if (meData.user) setUserName(meData.user.name);
        if (profData.profile) setProfileComplete(Boolean(profData.profile.isComplete));
        if (walData.wallet) setWallet(walData.wallet);
        if (appData.applications) setApplications(appData.applications);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Saudação e Ação Principal Mobile-First */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Olá, {userName || 'Profissional'}!
            </h1>
            <p className="text-sm text-slate-600">
              Acompanhe suas cotas mensais e crie currículos personalizados para
              cada vaga.
            </p>
          </div>
          <Link
            href="/applications/new"
            className="min-h-[48px] px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base transition shrink-0"
          >
            <FilePlus2 className="w-5 h-5" />
            <span>Nova Candidatura</span>
          </Link>
        </div>

        {/* Alerta caso o perfil esteja incompleto */}
        {!loading && !profileComplete && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">
                  Complete seu Perfil Profissional antes da primeira vaga
                </p>
                <p className="text-xs text-amber-800">
                  Para que a IA elabore seu currículo sem inventar informações,
                  cadastre seu resumo e pelo menos uma experiência, formação ou
                  competência.
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              className="min-h-[44px] px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shrink-0"
            >
              <UserCheck className="w-4 h-4" />
              Preencher Perfil
            </Link>
          </div>
        )}

        {/* Cards de Resumo de Cotas e Carteira */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Cota Gratuita do Mês</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {wallet ? wallet.freeQuotaRemaining : '—'}{' '}
              <span className="text-sm font-normal text-slate-500">
                disponíveis
              </span>
            </p>
            <p className="text-xs text-slate-500">
              {wallet?.monthlyContributionActive
                ? `Cota mensal R$ 3 ativa (${wallet.monthlyContributionQuotaRemaining} restantes no ciclo)`
                : `${wallet?.usedInCurrentCycle ?? 0} realizada(s) no ciclo ${wallet?.currentCycleKey ?? ''}`}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Créditos Promocionais</span>
              <Ticket className="w-4 h-4 text-brand-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {wallet ? wallet.promotionalCreditsRemaining : '—'}
            </p>
            <Link
              href="/coupons"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              Resgatar cupom promocional
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Saldo na Carteira</span>
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {wallet ? formatCentsToBRL(wallet.balanceCents) : 'R$ 0,00'}
            </p>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              Ver extrato e contribuições
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase">
              <span>Pendências em Aberto</span>
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {wallet
                ? formatCentsToBRL(wallet.activePendingDebtsCents)
                : 'R$ 0,00'}
            </p>
            <p className="text-xs text-slate-500">
              {wallet && wallet.activePendingDebtsCount > 0
                ? `${wallet.activePendingDebtsCount} pendência(s) • prazo de 30 dias cada`
                : 'Nenhuma pendência financeira'}
            </p>
          </div>
        </div>

        {/* Últimas Candidaturas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Suas Últimas Candidaturas
              </h2>
              <p className="text-xs text-slate-500">
                Consulte a análise de compatibilidade e baixe o currículo em
                DOCX ou PDF sem custo extra.
              </p>
            </div>
            <Link
              href="/history"
              className="text-xs sm:text-sm font-semibold text-brand-700 hover:underline"
            >
              Ver histórico completo
            </Link>
          </div>

          {applications.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                Você ainda não gerou nenhuma candidatura personalizada.
              </p>
              <Link
                href="/applications/new"
                className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-brand-600 text-white text-xs sm:text-sm font-semibold rounded-xl"
              >
                <FilePlus2 className="w-4 h-4" />
                Analisar Primeira Vaga
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {applications.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {app.position}
                      </span>
                      {app.company && (
                        <span className="text-xs text-slate-500">
                          • {app.company}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Criada em {formatDateBR(app.created_at)}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-semibold">
                        Compatibilidade orientativa: {app.compatibility_score}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/applications/${app.id}`}
                      className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <span>Abrir Currículo & Análise</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

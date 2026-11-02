'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  DollarSign,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatCentsToBRL, formatDateBR, formatDateTimeBR } from '@/lib/utils';
import { AdminDashboardData } from '@/modules/administration/admin.service';

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'coupons' | 'settings' | 'users' | 'debts' | 'audit'
  >('overview');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Coupon form state
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponType, setCouponType] = useState<
    'CREDITS' | 'EXTENDED_ACCESS_DAYS' | 'TEMP_LIMIT_BOOST'
  >('CREDITS');
  const [couponValue, setCouponValue] = useState(10);
  const [couponMaxRedemptions, setCouponMaxRedemptions] = useState(100);
  const [couponMaxPerUser, setCouponMaxPerUser] = useState(1);
  const [couponExpiresAt, setCouponExpiresAt] = useState('2027-12-31');
  const [couponActive, setCouponActive] = useState(true);

  const loadAdmin = useCallback(() => {
    setLoading(true);
    fetch('/api/admin')
      .then((r) => r.json())
      .then((res) => {
        if (!res.ok) {
          setError(
            res.error?.message ||
              'Acesso negado ao painel administrativo.'
          );
          return;
        }
        setData(res);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const runAdminAction = async (
    action: string,
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setFeedback(null);
    setError(null);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error?.message || 'Erro ao executar ação administrativa.');
      return;
    }
    setFeedback(successMsg);
    loadAdmin();
  };

  if (loading && !data) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-slate-600">
          Carregando indicadores administrativos...
        </div>
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-semibold">
          {error}
        </div>
      </AppShell>
    );
  }

  const m = data?.metrics;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-bold">
              Painel Administrativo — Currículo Mestre
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-300">
            Sustentabilidade financeira, controle de custos de IA (Gemini API),
            gestão de cupons, parâmetros comerciais e trilha de auditoria.
          </p>
        </div>

        {feedback && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Abas Administrativas Mobile-First */}
        <div className="flex overflow-x-auto gap-2 pb-1">
          {[
            { id: 'overview', label: 'Indicadores & IA', icon: Activity },
            { id: 'coupons', label: 'Cupons', icon: Ticket },
            {
              id: 'settings',
              label: 'Parâmetros Comerciais',
              icon: Settings,
            },
            { id: 'users', label: 'Usuários & Créditos', icon: Users },
            {
              id: 'debts',
              label: 'Pendências & Pagamentos',
              icon: DollarSign,
            },
            { id: 'audit', label: 'Auditoria', icon: Cpu },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    t.id as
                      | 'overview'
                      | 'coupons'
                      | 'settings'
                      | 'users'
                      | 'debts'
                      | 'audit'
                  )
                }
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 ${
                  activeTab === t.id
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Aba 1: Indicadores Gerais, Financeiros e Custos de IA */}
        {activeTab === 'overview' && m && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Usuários Cadastrados / Ativos
                </span>
                <p className="text-2xl font-bold text-slate-900">
                  {m.totalUsers}{' '}
                  <span className="text-sm font-normal text-emerald-700">
                    ({m.activeUsers} ativos)
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Bloqueados: {m.blockedUsers}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Candidaturas Realizadas
                </span>
                <p className="text-2xl font-bold text-slate-900">
                  {m.totalApplications}
                </p>
                <p className="text-xs text-slate-500">
                  Grátis: {m.freeApplications} • Pagas: {m.paidApplications} •
                  Promo: {m.promotionalApplications}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Contribuições Recebidas
                </span>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCentsToBRL(m.totalContributionsCents)}
                </p>
                <p className="text-xs text-slate-500">
                  Saldo total carteiras:{' '}
                  {formatCentsToBRL(m.totalWalletBalanceCents)}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Pendências & Regularizações
                </span>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCentsToBRL(m.activeDebtsCents)}
                </p>
                <p className="text-xs text-slate-500">
                  {m.activeDebtsCount} ativas ({m.overdueDebtsCount} vencidas) •
                  Regularização: {m.regularizationRatePercent}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Custo Estimado Total de IA (Gemini)
                </span>
                <p className="text-2xl font-bold text-indigo-700">
                  {formatCentsToBRL(m.totalAiCostCents)}
                </p>
                <p className="text-xs text-slate-500">
                  Tokens: {m.totalAiInputTokens} entrada /{' '}
                  {m.totalAiOutputTokens} saída
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Custo Médio de IA por Candidatura
                </span>
                <p className="text-2xl font-bold text-slate-900">
                  {formatCentsToBRL(m.avgAiCostPerApplicationCents)}
                </p>
                <p className="text-xs text-slate-500">
                  Custo por usuário ativo:{' '}
                  {formatCentsToBRL(m.avgAiCostPerActiveUserCents)}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Cupons Ativos & Resgates
                </span>
                <p className="text-2xl font-bold text-brand-700">
                  {m.activeCouponsCount} cupons ativos
                </p>
                <p className="text-xs text-slate-500">
                  Total de resgates realizados: {m.totalCouponRedemptions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Aba 2: Gerenciamento de Cupons */}
        {activeTab === 'coupons' && data && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                Criar ou Atualizar Cupom Promocional
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Código (ex: BETA50)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-bold uppercase"
                />
                <input
                  type="text"
                  placeholder="Descrição"
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
                <select
                  value={couponType}
                  onChange={(e) =>
                    setCouponType(
                      e.target.value as
                        | 'CREDITS'
                        | 'EXTENDED_ACCESS_DAYS'
                        | 'TEMP_LIMIT_BOOST'
                    )
                  }
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white"
                >
                  <option value="CREDITS">Créditos de Candidatura</option>
                  <option value="EXTENDED_ACCESS_DAYS">
                    Acesso Ampliado por Dias
                  </option>
                  <option value="TEMP_LIMIT_BOOST">
                    Ampliação Temporária de Limite
                  </option>
                </select>
                <input
                  type="number"
                  placeholder="Quantidade de créditos/dias"
                  value={couponValue}
                  onChange={(e) => setCouponValue(Number(e.target.value))}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="number"
                  placeholder="Limite total de resgates"
                  value={couponMaxRedemptions}
                  onChange={(e) =>
                    setCouponMaxRedemptions(Number(e.target.value))
                  }
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="number"
                  placeholder="Limite por usuário"
                  value={couponMaxPerUser}
                  onChange={(e) => setCouponMaxPerUser(Number(e.target.value))}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
                <input
                  type="date"
                  value={couponExpiresAt}
                  onChange={(e) => setCouponExpiresAt(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-2">
                  <input
                    type="checkbox"
                    checked={couponActive}
                    onChange={(e) => setCouponActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Cupom Ativo
                </label>
                <button
                  type="button"
                  onClick={() =>
                    runAdminAction(
                      'upsert_coupon',
                      {
                        code: couponCode,
                        description: couponDesc,
                        benefit_type: couponType,
                        benefit_value: couponValue,
                        max_redemptions: couponMaxRedemptions,
                        max_per_user: couponMaxPerUser,
                        starts_at: new Date().toISOString(),
                        expires_at: new Date(couponExpiresAt).toISOString(),
                        active: couponActive,
                      },
                      'Cupom salvo e auditado com sucesso!'
                    )
                  }
                  className="min-h-[44px] px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl"
                >
                  Salvar Cupom
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
              {data.coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {c.code} — {c.benefit_value} ({c.benefit_type}){' '}
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${
                          c.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Resgates: {c.redemptions_count ?? 0} / {c.max_redemptions}{' '}
                      • Expira em {formatDateBR(c.expires_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        'upsert_coupon',
                        {
                          ...c,
                          active: !c.active,
                        },
                        `Status do cupom ${c.code} alterado.`
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                  >
                    {c.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aba 3: Parâmetros Comerciais Centralizados */}
        {activeTab === 'settings' && data && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Parâmetros Comerciais e Limites Dinâmicos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cota Gratuita Mensal
                </label>
                <input
                  type="number"
                  value={data.commercialSettings.freeMonthlyQuota}
                  onChange={(e) =>
                    setData({
                      ...data,
                      commercialSettings: {
                        ...data.commercialSettings,
                        freeMonthlyQuota: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contribuição Mensal (em centavos, 300 = R$ 3,00)
                </label>
                <input
                  type="number"
                  value={data.commercialSettings.monthlyContributionCents}
                  onChange={(e) =>
                    setData({
                      ...data,
                      commercialSettings: {
                        ...data.commercialSettings,
                        monthlyContributionCents: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Limite de Candidaturas na Contribuição Mensal
                </label>
                <input
                  type="number"
                  value={data.commercialSettings.monthlyContributionQuota}
                  onChange={(e) =>
                    setData({
                      ...data,
                      commercialSettings: {
                        ...data.commercialSettings,
                        monthlyContributionQuota: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor Candidatura Adicional (centavos, 10 = R$ 0,10)
                </label>
                <input
                  type="number"
                  value={data.commercialSettings.additionalApplicationCents}
                  onChange={(e) =>
                    setData({
                      ...data,
                      commercialSettings: {
                        ...data.commercialSettings,
                        additionalApplicationCents: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Limite de Confiança (máx pendentes em 30d)
                </label>
                <input
                  type="number"
                  value={data.commercialSettings.trustMaxPendingApplications}
                  onChange={(e) =>
                    setData({
                      ...data,
                      commercialSettings: {
                        ...data.commercialSettings,
                        trustMaxPendingApplications: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={data.commercialSettings.blockAfterOverdueDays}
                    onChange={(e) =>
                      setData({
                        ...data,
                        commercialSettings: {
                          ...data.commercialSettings,
                          blockAfterOverdueDays: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4"
                  />
                  Bloquear novas dívidas quando houver pendência vencida (&gt;30d)
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                runAdminAction(
                  'update_settings',
                  data.commercialSettings as unknown as Record<string, unknown>,
                  'Parâmetros comerciais atualizados e auditados com sucesso!'
                )
              }
              className="min-h-[44px] px-5 py-2.5 bg-brand-600 text-white text-xs sm:text-sm font-semibold rounded-xl"
            >
              Salvar Configurações Comerciais
            </button>
          </div>
        )}

        {/* Aba 4: Gestão de Usuários e Créditos Promocionais */}
        {activeTab === 'users' && data && (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
            {data.users.map((u) => (
              <div
                key={u.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {u.name} ({u.email}){' '}
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px]">
                      {u.role} • {u.status}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Candidaturas: {u.applications_count} • Saldo:{' '}
                    {formatCentsToBRL(u.wallet_balance)} • Pendências:{' '}
                    {formatCentsToBRL(u.pending_debts_cents)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        'grant_credits',
                        {
                          userId: u.id,
                          creditsAmount: 10,
                          reason: 'Concessão via Painel Admin',
                        },
                        `+10 créditos promocionais liberados para ${u.email}.`
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-semibold"
                  >
                    +10 Créditos Promo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      runAdminAction(
                        'set_user_status',
                        {
                          userId: u.id,
                          status:
                            u.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED',
                        },
                        `Status do usuário ${u.email} alterado.`
                      )
                    }
                    className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                  >
                    {u.status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Aba 5: Pendências e Pagamentos */}
        {activeTab === 'debts' && data && (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
            {data.recentDebts.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhuma pendência registrada.
              </div>
            ) : (
              data.recentDebts.map((d) => (
                <div
                  key={d.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {d.user_name} ({d.user_email}) —{' '}
                      {formatCentsToBRL(d.remaining_amount)} ({d.status})
                    </p>
                    <p className="text-xs text-slate-500">
                      Criada em {formatDateBR(d.created_at)} • Vence em{' '}
                      {formatDateBR(d.due_at)}
                    </p>
                  </div>
                  {d.status !== 'SETTLED' && (
                    <button
                      type="button"
                      onClick={() =>
                        runAdminAction(
                          'release_debt',
                          { debtId: d.id },
                          'Pendência liberada administrativamente.'
                        )
                      }
                      className="min-h-[40px] px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-semibold"
                    >
                      Liberar / Baixar Pendência
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Aba 6: Trilha de Auditoria */}
        {activeTab === 'audit' && data && (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200">
            {data.auditLogs.map((log) => (
              <div key={log.id} className="p-4 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {log.action} ({log.entity})
                  </span>
                  <span className="text-slate-500">
                    {formatDateTimeBR(log.created_at)}
                  </span>
                </div>
                <p className="text-slate-600">
                  Ator: {log.actor_email || 'Sistema / Anonimizado'} • ID:{' '}
                  {log.entity_id || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

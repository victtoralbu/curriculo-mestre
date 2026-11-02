'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatCentsToBRL, formatDateBR, formatDateTimeBR } from '@/lib/utils';

interface WalletData {
  walletId: string;
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
  overdueDebtsCents: number;
  trustCreditsRemaining: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    created_at: string;
  }>;
  debts: Array<{
    id: string;
    amount: number;
    remaining_amount: number;
    status: string;
    created_at: string;
    due_at: string;
    settled_at: string | null;
    isOverdue: boolean;
  }>;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [customAmountBRL, setCustomAmountBRL] = useState('5,00');
  const [creatingPix, setCreatingPix] = useState(false);
  const [pixPayment, setPixPayment] = useState<{
    id: string;
    external_payment_id: string;
    amount: number;
    purpose: string;
    pix_copy_paste: string | null;
    isSandboxMode: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((data) => {
        if (data.wallet) setWallet(data.wallet);
      });
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleCreatePix = async (
    purpose: 'MONTHLY_CONTRIBUTION' | 'FREE_CONTRIBUTION'
  ) => {
    setCreatingPix(true);
    setError(null);
    setFeedback(null);
    try {
      let amountCents = 300;
      if (purpose === 'FREE_CONTRIBUTION') {
        const numeric = parseFloat(
          customAmountBRL.replace(/\./g, '').replace(',', '.')
        );
        if (Number.isNaN(numeric) || numeric < 0.1) {
          setError('Informe um valor válido (mínimo R$ 0,10).');
          setCreatingPix(false);
          return;
        }
        amountCents = Math.round(numeric * 100);
      }

      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose, amountCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao gerar cobrança Pix.');
        return;
      }
      setPixPayment(data.payment);
    } catch {
      setError('Falha ao criar pagamento Pix.');
    } finally {
      setCreatingPix(false);
    }
  };

  const handleDispatchSandboxWebhook = async () => {
    if (!pixPayment) return;
    setCreatingPix(true);
    try {
      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sandbox_webhook_dispatch',
          externalPaymentId: pixPayment.external_payment_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao processar webhook.');
        return;
      }
      setFeedback(
        'Webhook de confirmação recebido e processado com sucesso! Pendências regularizadas e saldo atualizado.'
      );
      setPixPayment(null);
      loadWallet();
    } finally {
      setCreatingPix(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <WalletIcon className="w-6 h-6 text-brand-700" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Carteira de Contribuições & Cotas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Você conta com <strong>3 candidaturas gratuitas por mês</strong> sem
            nenhum custo. As contribuições são opcionais e ajudam a manter a
            plataforma acessível para todos.
          </p>
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

        {/* Resumo Financeiro Transparente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Saldo Disponível
            </span>
            <p className="text-2xl font-bold text-slate-900">
              {wallet ? formatCentsToBRL(wallet.balanceCents) : 'R$ 0,00'}
            </p>
            <p className="text-xs text-slate-500">
              Uso exclusivo na plataforma (R$ 0,10 por vaga adicional)
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Cotas do Ciclo ({wallet?.currentCycleKey})
            </span>
            <p className="text-2xl font-bold text-emerald-700">
              {wallet?.monthlyContributionActive
                ? `${wallet.monthlyContributionQuotaRemaining} / 30`
                : `${wallet?.freeQuotaRemaining ?? 3} / 3`}
            </p>
            <p className="text-xs text-slate-500">
              {wallet?.monthlyContributionActive
                ? 'Contribuição mensal R$ 3 ativa neste ciclo'
                : 'Cota gratuita mensal (renovada todo mês)'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Créditos Promocionais
            </span>
            <p className="text-2xl font-bold text-brand-700">
              {wallet ? wallet.promotionalCreditsRemaining : 0}
            </p>
            <p className="text-xs text-slate-500">
              Prioridade máxima de uso (sem custo e sem pendência)
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Pendências (Crédito Confiança)
            </span>
            <p className="text-2xl font-bold text-amber-700">
              {wallet
                ? formatCentsToBRL(wallet.activePendingDebtsCents)
                : 'R$ 0,00'}
            </p>
            <p className="text-xs text-slate-500">
              {wallet?.activePendingDebtsCount ?? 0} pendência(s) • limite de{' '}
              {wallet?.trustCreditsRemaining ?? 100} restantes em 30d
            </p>
          </div>
        </div>

        {/* Opções de Contribuição Pix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Contribuição Mensal R$ 3,00 */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-200 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 rounded-full bg-brand-50 text-brand-800 text-xs font-bold">
                Ciclo Mensal Ampliado
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Contribuição Mensal — R$ 3,00
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Libera até <strong>30 candidaturas no total durante o mês</strong>{' '}
                (incluindo as 3 gratuitas). Não é assinatura automática e não
                acumula para o mês seguinte.
              </p>
            </div>
            <button
              type="button"
              disabled={creatingPix || wallet?.monthlyContributionActive}
              onClick={() => handleCreatePix('MONTHLY_CONTRIBUTION')}
              className="w-full min-h-[48px] bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition"
            >
              {wallet?.monthlyContributionActive
                ? 'Ciclo Mensal de R$ 3,00 já está ativo neste mês'
                : 'Contribuir R$ 3,00 via Pix'}
            </button>
          </div>

          {/* Contribuição Livre / Regularização */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                Valor Livre & Regularização
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Contribuição Livre ou Quitação de Pendências
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Escolha qualquer valor. Após confirmação do provedor, o valor
                quita automaticamente as pendências mais antigas e o excedente
                fica como saldo positivo na carteira.
              </p>
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor em Reais (R$):
                </label>
                <input
                  type="text"
                  value={customAmountBRL}
                  onChange={(e) => setCustomAmountBRL(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={creatingPix}
              onClick={() => handleCreatePix('FREE_CONTRIBUTION')}
              className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition"
            >
              Gerar Pix de Contribuição Livre
            </button>
          </div>
        </div>

        {/* Modal / Card de Pagamento Pix Criado */}
        {pixPayment && (
          <div className="bg-brand-950 text-white p-5 sm:p-6 rounded-2xl space-y-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-6 h-6 text-brand-400" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold">
                    Pagamento Pix Gerado —{' '}
                    {formatCentsToBRL(pixPayment.amount)}
                  </h3>
                  <p className="text-xs text-slate-300">
                    ID da transação: {pixPayment.external_payment_id} •
                    Aguardando confirmação via Webhook do provedor
                  </p>
                </div>
              </div>
            </div>

            {pixPayment.pix_copy_paste && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Código Pix Copia e Cola:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixPayment.pix_copy_paste}
                    className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        pixPayment.pix_copy_paste || ''
                      );
                      setFeedback('Código Pix copiado!');
                    }}
                    className="min-h-[44px] px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Código
                  </button>
                </div>
              </div>
            )}

            {pixPayment.isSandboxMode && (
              <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-700/80 space-y-2">
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong>Ambiente de Homologação / Teste Identificado:</strong>{' '}
                  Como a variável <code>MERCADOPAGO_ACCESS_TOKEN</code> ainda
                  não foi configurada para produção, a confirmação não ocorre no
                  navegador. Você pode disparar abaixo o Webhook assinado (HMAC)
                  de homologação para testar a confirmação pelo backend:
                </p>
                <button
                  type="button"
                  disabled={creatingPix}
                  onClick={handleDispatchSandboxWebhook}
                  className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Disparar Webhook Autenticado de Confirmação (Teste)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pendências e Vencimentos (Prazo individual de 30 dias) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Pendências e Prazos de Vencimento (30 dias cada)
            </h2>
            <p className="text-xs text-slate-500">
              Cada candidatura em crédito de confiança possui valor de R$ 0,10 e
              prazo individual de 30 dias.
            </p>
          </div>
          {!wallet || wallet.debts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Você não possui pendências registradas.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {wallet.debts.map((debt) => (
                <div
                  key={debt.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        Candidatura adicional —{' '}
                        {formatCentsToBRL(debt.remaining_amount)}{' '}
                        {debt.remaining_amount < debt.amount &&
                          `(original ${formatCentsToBRL(debt.amount)})`}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          debt.status === 'SETTLED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : debt.isOverdue
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {debt.status === 'SETTLED'
                          ? 'Regularizada'
                          : debt.isOverdue
                            ? 'Vencida'
                            : debt.status === 'PARTIALLY_SETTLED'
                              ? 'Parcialmente Regularizada'
                              : 'Pendente'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Criada em: {formatDateBR(debt.created_at)}</span>
                      <span>•</span>
                      <span>Vencimento: {formatDateBR(debt.due_at)}</span>
                      {debt.settled_at && (
                        <>
                          <span>•</span>
                          <span>
                            Quitada em: {formatDateBR(debt.settled_at)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extrato Imutável da Carteira */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Extrato de Movimentações
            </h2>
            <p className="text-xs text-slate-500">
              Histórico auditável de contribuições, débitos e regularizações.
            </p>
          </div>
          {!wallet || wallet.transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhuma movimentação financeira registrada até o momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {wallet.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 flex items-center justify-between gap-4 text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {tx.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTimeBR(tx.created_at)}
                    </p>
                  </div>
                  <span
                    className={`font-bold shrink-0 ${
                      tx.amount > 0 ? 'text-emerald-700' : 'text-slate-700'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {formatCentsToBRL(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

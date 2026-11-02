'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, Ticket } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatDateBR, formatDateTimeBR } from '@/lib/utils';

export default function CouponsPage() {
  const [code, setCode] = useState('');
  const [redemptions, setRedemptions] = useState<
    Array<{
      id: string;
      code: string;
      description: string | null;
      benefit_type: string;
      credits_granted: number;
      created_at: string;
    }>
  >([]);
  const [promotionalCredits, setPromotionalCredits] = useState<
    Array<{
      id: string;
      source: string;
      benefit_type: string;
      original_amount: number;
      remaining_amount: number;
      expires_at: string | null;
      created_at: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCoupons = useCallback(() => {
    fetch('/api/coupons')
      .then((r) => r.json())
      .then((data) => {
        if (data.redemptions) setRedemptions(data.redemptions);
        if (data.promotionalCredits)
          setPromotionalCredits(data.promotionalCredits);
      });
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao resgatar cupom.');
        return;
      }
      setFeedback(
        `Cupom ${data.redemption.code} resgatado com sucesso! Você recebeu +${data.redemption.creditsGranted} créditos promocionais (sem custo e sem gerar dívida).`
      );
      setCode('');
      loadCoupons();
    } catch {
      setError('Falha ao resgatar cupom.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-brand-700" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Resgate de Cupons Promocionais
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Insira seu código promocional para liberar créditos de candidatura
            gratuitos. Os créditos promocionais possuem prioridade máxima de uso
            e nunca geram pendências financeiras.
          </p>
        </div>

        <form
          onSubmit={handleRedeem}
          className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
        >
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

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: BETA10, BETA30, BETA100, FUNDADOR30"
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 font-bold uppercase tracking-wider"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="min-h-[48px] px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loading ? 'Validando...' : 'Resgatar Cupom'}</span>
            </button>
          </div>
        </form>

        {/* Créditos Promocionais Ativos */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Seus Lotes de Créditos Promocionais
            </h2>
          </div>
          {promotionalCredits.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Nenhum lote de crédito promocional ativo no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {promotionalCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">{credit.source}</p>
                    <p className="text-xs text-slate-500">
                      Concedido em {formatDateTimeBR(credit.created_at)}
                      {credit.expires_at
                        ? ` • Válido até ${formatDateBR(credit.expires_at)}`
                        : ''}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-800 font-bold text-xs">
                    Restantes: {credit.remaining_amount} /{' '}
                    {credit.original_amount} candidaturas
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de Resgates */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Histórico de Cupons Resgatados
            </h2>
          </div>
          {redemptions.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Você ainda não resgatou nenhum cupom.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="p-4 flex items-center justify-between gap-4 text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {r.code}{' '}
                      {r.description && (
                        <span className="font-normal text-slate-600">
                          — {r.description}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Resgatado em {formatDateTimeBR(r.created_at)}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-700">
                    +{r.credits_granted} créditos
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

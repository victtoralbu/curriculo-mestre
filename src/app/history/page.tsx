'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Download,
  FilePlus2,
  History as HistoryIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { formatDateBR } from '@/lib/utils';

interface HistoryApplication {
  id: string;
  company: string | null;
  position: string;
  compatibility_score: number;
  status: string;
  credit_source: string | null;
  created_at: string;
}

const STATUS_NAMES: Record<string, string> = {
  ALL: 'Todos os status',
  EM_PREPARACAO: 'Em preparação',
  CURRICULO_GERADO: 'Currículo gerado',
  CANDIDATADO: 'Candidatado',
  EM_PROCESSO_SELETIVO: 'Em processo seletivo',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  ENCERRADO: 'Encerrado',
};

const SOURCE_NAMES: Record<string, string> = {
  FREE_QUOTA: 'Cota Gratuita Mensal',
  MONTHLY_CONTRIBUTION: 'Cota Mensal R$ 3',
  PROMOTIONAL: 'Crédito Promocional (Cupom)',
  WALLET_BALANCE: 'Saldo da Carteira (R$ 0,10)',
  TRUST_DEBT: 'Crédito de Confiança (R$ 0,10)',
};

export default function HistoryPage() {
  const [applications, setApplications] = useState<HistoryApplication[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/applications')
      .then((r) => r.json())
      .then((data) => {
        if (data.applications) setApplications(data.applications);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filterStatus === 'ALL'
      ? applications
      : applications.filter((a) => a.status === filterStatus);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Histórico de Candidaturas
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Consulte, edite o status e baixe seus currículos anteriores em
              DOCX ou PDF sem qualquer cobrança adicional.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
            >
              {Object.entries(STATUS_NAMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Link
              href="/applications/new"
              className="min-h-[44px] px-4 py-2 bg-brand-600 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Nova Vaga</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Carregando histórico...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <HistoryIcon className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600">
                Nenhuma candidatura encontrada para o filtro selecionado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filtered.map((app) => (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {app.position}
                      </span>
                      {app.company && (
                        <span className="text-xs font-medium text-slate-500">
                          • {app.company}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {STATUS_NAMES[app.status] || app.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Data: {formatDateBR(app.created_at)}</span>
                      <span>•</span>
                      <span className="text-brand-700 font-semibold">
                        Compatibilidade: {app.compatibility_score}%
                      </span>
                      <span>•</span>
                      <span>
                        Origem:{' '}
                        {app.credit_source
                          ? SOURCE_NAMES[app.credit_source] || app.credit_source
                          : 'Gratuita'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/applications/${app.id}/export?format=docx`}
                      className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      DOCX
                    </a>
                    <a
                      href={`/api/applications/${app.id}/export?format=pdf`}
                      className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </a>
                    <Link
                      href={`/applications/${app.id}`}
                      className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                    >
                      <span>Revisar / Editar</span>
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

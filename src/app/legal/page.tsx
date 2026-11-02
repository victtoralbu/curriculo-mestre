import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-brand-700" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Termos de Uso e Política de Privacidade (LGPD)
            </h1>
          </div>
          <Link
            href="/"
            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 rounded-xl flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        <section className="space-y-3 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            1. Tratamento de Dados Pessoais (Lei nº 13.709/2018 — LGPD)
          </h2>
          <p>
            O <strong>Currículo Mestre</strong> coleta e armazena exclusivamente
            as informações pessoais e profissionais que você declara
            voluntariamente em seu perfil (nome, contato, resumo, experiências,
            formação e competências) com a finalidade estrita de analisar vagas
            e gerar seus currículos personalizados.
          </p>
          <p>
            <strong>Compromisso de Isolamento e Privacidade:</strong> Seus dados
            jamais são compartilhados com outros usuários, vendidos a terceiros
            ou utilizados para treinar modelos públicos. Apenas os trechos
            estruturados essenciais do seu perfil são processados pela camada de
            Inteligência Artificial (Google Gemini API) no momento em que você
            solicita uma análise ou geração de currículo.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            2. Direito de Exclusão e Portabilidade
          </h2>
          <p>
            A qualquer momento, você pode editar seus dados, exportar seus
            currículos em formato DOCX e PDF ou solicitar a{' '}
            <strong>exclusão completa e imediata da sua conta</strong> através
            do menu <em>Minha Conta / Privacidade (LGPD)</em> no painel. Ao
            confirmar a exclusão, seu perfil, experiências, histórico de vagas e
            currículos são removidos permanentemente do banco de dados.
          </p>
        </section>

        <section className="space-y-3 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900">
            3. Regras de Utilização, Cotas Gratuitas e Carteira Interna
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Todo usuário dispõe de <strong>3 candidaturas gratuitas por mês</strong>,
              sem qualquer cobrança ou geração de dívida.
            </li>
            <li>
              A contribuição mensal opcional de <strong>R$ 3,00</strong> libera
              até 30 candidaturas dentro do ciclo mensal vigente.
            </li>
            <li>
              Candidaturas adicionais avulsas têm custo de{' '}
              <strong>R$ 0,10</strong> por geração concluída. Visualizações,
              edições e exportações em DOCX ou PDF são ilimitadas e gratuitas.
            </li>
            <li>
              Caso uma geração de currículo falhe por motivo técnico, nenhum
              crédito ou valor é debitado.
            </li>
            <li>
              O saldo da carteira interna é de uso exclusivo dentro da
              plataforma, não constituindo conta bancária e não sendo passível
              de saque ou transferência entre contas.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

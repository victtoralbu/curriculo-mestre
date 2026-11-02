import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileCheck2,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header Mobile-First */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base sm:text-lg block leading-tight">
                Currículo Mestre
              </span>
              <span className="text-[11px] text-slate-500 block">
                Candidaturas estratégicas com IA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="min-h-[44px] px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 flex items-center"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="min-h-[44px] px-4 py-2.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 transition"
            >
              <span>Começar Grátis</span>
              <ArrowRight className="w-4 h-4 hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section Mobile-First */}
        <section className="py-10 sm:py-16 lg:py-20 px-4 sm:px-6 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs sm:text-sm font-medium">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Inteligência Artificial Ética + Leitura 100% ATS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
              Transforme sua trajetória real em{' '}
              <span className="text-brand-700">
                candidaturas personalizadas
              </span>{' '}
              para cada vaga
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Construa seu perfil profissional uma única vez, analise os
              requisitos de qualquer oportunidade, descubra seus pontos fortes e
              lacunas reais e exporte currículos em DOCX e PDF prontos para
              sistemas de recrutamento (ATS).
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="min-h-[48px] px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 text-base transition"
              >
                <span>Criar Conta Gratuita</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#modelo-acessivel"
                className="min-h-[48px] px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-medium rounded-xl border border-slate-300 flex items-center justify-center text-base transition"
              >
                Conhecer o modelo gratuito e solidário
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-3xl mx-auto">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    3 candidaturas grátis/mês
                  </p>
                  <p className="text-xs text-slate-600">
                    Renovadas todo ciclo mensal sem cartão de crédito.
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Zero invenção de dados
                  </p>
                  <p className="text-xs text-slate-600">
                    A IA trabalha exclusivamente com os fatos que você declarou.
                  </p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-start gap-3">
                <FileCheck2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Exportação DOCX e PDF
                  </p>
                  <p className="text-xs text-slate-600">
                    Coluna única limpa e revisável antes de baixar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Como Funciona */}
        <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Como o Currículo Mestre funciona
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Poucos passos, direto ao ponto e pensado para funcionar
              perfeitamente no celular ou computador.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Cadastre seu Perfil Base
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Registre suas experiências, conquistas, formação acadêmica,
                idiomas e ferramentas uma única vez — ou importe seu currículo
                atual para revisão assistida.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Analise a Vaga e Compatibilidade
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cole a descrição da oportunidade. Nossa IA identifica
                palavras-chave ATS, pontos de aderência, forças reais do seu
                perfil e lacunas que merecem atenção.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Edite e Exporte em DOCX ou PDF
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receba uma versão personalizada do seu currículo priorizando o
                que importa para aquela vaga, revise cada seção e baixe quantas
                vezes quiser sem cobrança extra.
              </p>
            </div>
          </div>
        </section>

        {/* Explicação transparente do modelo gratuito e de contribuição */}
        <section
          id="modelo-acessivel"
          className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-900 text-white"
        >
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-900 text-brand-200 text-xs font-medium">
                <HeartHandshake className="w-4 h-4" />
                <span>Transparência e Democratização</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold">
                Modelo Gratuito, Acessível e com Crédito de Confiança
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Sabemos que quem busca recolocação ou o primeiro emprego não
                pode ser bloqueado por assinaturas caras. Por isso criamos um
                modelo sustentável e transparente:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Cota Gratuita
                </span>
                <p className="text-2xl font-bold">R$ 0,00</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>3 candidaturas completas por mês</strong> renovadas
                  automaticamente, sem cobrança e sem gerar pendência.
                </p>
              </div>

              <div className="bg-slate-800/90 border border-brand-500/60 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                  Contribuição Mensal
                </span>
                <p className="text-2xl font-bold">R$ 3,00 / mês</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Libera até <strong>30 candidaturas no ciclo mensal</strong>{' '}
                  (incluindo as 3 gratuitas) via Pix.
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Uso Adicional Avulso
                </span>
                <p className="text-2xl font-bold">R$ 0,10</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Apenas dez centavos por candidatura adicional utilizando saldo
                  da carteira ou contribuição livre.
                </p>
              </div>

              <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Crédito de Confiança
                </span>
                <p className="text-2xl font-bold">Até 100 vagas</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sem saldo no momento? Você pode gerar até{' '}
                  <strong>100 candidaturas adicionais</strong> em 30 dias (R$
                  0,10 cada) e regularizar depois em até 30 dias.
                </p>
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-slate-300">
                  <strong>Possui um cupom de testador Beta?</strong> Após criar
                  sua conta, acesse a aba <em>Cupons</em> e resgate códigos como{' '}
                  <code className="bg-slate-900 px-1.5 py-0.5 rounded text-brand-300">
                    BETA10
                  </code>{' '}
                  ou{' '}
                  <code className="bg-slate-900 px-1.5 py-0.5 rounded text-brand-300">
                    BETA30
                  </code>{' '}
                  sem nenhum custo.
                </p>
              </div>
              <Link
                href="/register"
                className="min-h-[44px] px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shrink-0 flex items-center"
              >
                Começar Agora
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} Currículo Mestre. Todos os direitos
            reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/legal" className="hover:text-slate-900 underline">
              Termos de Uso & Política de Privacidade (LGPD)
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Entrar
            </Link>
            <Link href="/register" className="hover:text-slate-900">
              Criar Conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Briefcase, KeyRound, Mail } from 'lucide-react';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao solicitar recuperação.');
        return;
      }
      if (data.resetToken) {
        setToken(data.resetToken);
      }
      setMessage(data.message);
      setStep('confirm');
    } catch {
      setError('Falha ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Erro ao redefinir senha.');
        return;
      }
      setMessage(data.message);
    } catch {
      setError('Falha ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center px-4 py-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 justify-center"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-slate-900">
              Currículo Mestre
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Recuperação de senha
          </h1>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-800">
              {message}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Informe seu e-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl"
              >
                {loading ? 'Solicitando...' : 'Gerar Token de Recuperação'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Token de verificação
                </label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full min-h-[48px] pl-11 pr-4 py-2.5 rounded-xl border border-slate-300"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl"
              >
                {loading ? 'Salvando...' : 'Redefinir Senha'}
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              Voltar para o Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

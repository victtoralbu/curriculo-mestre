'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  FilePlus2,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  UserCheck,
  Wallet,
} from 'lucide-react';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [deletingLgpd, setDeletingLgpd] = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/auth/me'), fetch('/api/profile')])
      .then(async ([meRes, profRes]) => {
        if (!meRes.ok) {
          router.replace('/login');
          return;
        }
        const meData = await meRes.json();
        setUser(meData.user);

        if (profRes.ok) {
          const profData = await profRes.json();
          if (
            meData.user?.role !== 'ADMIN' &&
            profData.profile &&
            !profData.profile.isComplete
          ) {
            router.replace('/onboarding');
            return;
          }
        }
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  const handleDeleteAccountLgpd = async () => {
    if (
      !window.confirm(
        'Tem certeza que deseja excluir permanentemente sua conta e todos os seus dados pessoais e currículos (LGPD)? Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    setDeletingLgpd(true);
    try {
      const res = await fetch('/api/auth/me', { method: 'DELETE' });
      if (res.ok) {
        router.replace('/');
      }
    } finally {
      setDeletingLgpd(false);
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Início', icon: LayoutDashboard },
    { href: '/onboarding', label: 'Consultora IA', icon: Sparkles },
    { href: '/profile', label: 'Perfil', icon: UserCheck },
    { href: '/applications/new', label: 'Nova Vaga', icon: FilePlus2 },
    { href: '/history', label: 'Histórico', icon: History },
    { href: '/wallet', label: 'Carteira', icon: Wallet },
    { href: '/coupons', label: 'Cupons', icon: Ticket },
    ...(user?.role === 'ADMIN'
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]
      : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">
            Carregando seu ambiente no Currículo Mestre...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Top Bar Mobile-First */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">
            <Briefcase className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-base">
            Currículo Mestre
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAccountModal(true)}
            className="min-h-[44px] px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Minha Conta
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair da conta"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-red-600 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-white z-20">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight block leading-none">
              Currículo Mestre
            </span>
            <span className="text-xs text-slate-400">
              Carreira & ATS com IA
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-sm font-medium text-white truncate">
              {user?.name}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="flex-1 min-h-[44px] px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition"
            >
              Privacidade / LGPD
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] px-3 py-2 text-xs font-medium bg-red-950/60 hover:bg-red-900/80 text-red-200 rounded-lg flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area (with padding bottom for mobile nav bar) */}
      <main className="flex-1 md:pl-64 pb-24 md:pb-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar Mobile-First (< md) */}
      <nav
        aria-label="Navegação principal mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-1 py-1 flex items-center justify-around shadow-lg"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-h-[48px] min-w-[48px] px-2 py-1 rounded-lg text-[11px] font-medium transition ${
                isActive
                  ? 'text-brand-700 bg-brand-50 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Modal de Conta e Exclusão LGPD */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              Sua Conta & Privacidade (LGPD)
            </h2>
            <div className="text-sm text-slate-600 space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p>
                <strong>Nome:</strong> {user?.name}
              </p>
              <p>
                <strong>E-mail:</strong> {user?.email}
              </p>
              <p>
                <strong>Perfil de acesso:</strong>{' '}
                {user?.role === 'ADMIN' ? 'Administrador' : 'Profissional'}
              </p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Seus dados profissionais são utilizados exclusivamente para
              estruturar suas candidaturas e currículos sob sua solicitação,
              nunca sendo compartilhados entre contas.
            </p>
            <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row gap-2 justify-between">
              <button
                type="button"
                disabled={deletingLgpd}
                onClick={handleDeleteAccountLgpd}
                className="min-h-[44px] px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletingLgpd
                  ? 'Excluindo dados...'
                  : 'Excluir conta e todos os dados (LGPD)'}
              </button>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="min-h-[44px] px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

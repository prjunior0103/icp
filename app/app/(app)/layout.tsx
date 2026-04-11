"use client";

import React, { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  FileText,
  Shield,
} from "lucide-react";
import { CicloProvider, useCiclo } from "@/app/lib/ciclo-context";
import { STATUS_BADGE, STATUS_LABEL } from "@/app/lib/status";

const NAV_ITEMS = [
  { href: "/colaboradores", label: "Colaboradores", icon: Users, roles: ["GUARDIAO","BP","GESTOR","COLABORADOR"] },
  { href: "/metas", label: "Metas", icon: Target, roles: ["GUARDIAO","BP","GESTOR","COLABORADOR"] },
  { href: "/apuracao", label: "Apuração", icon: BarChart3, roles: ["GUARDIAO","BP","GESTOR","COLABORADOR"] },
  { href: "/relatorios", label: "Relatórios", icon: FileText, roles: ["GUARDIAO","BP","GESTOR","COLABORADOR","CLIENTE"] },
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["GUARDIAO","BP","GESTOR","COLABORADOR","CLIENTE"] },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["GUARDIAO","BP"] },
];

const NAV_GUARDIAO = [
  { href: "/auditoria", label: "Auditoria", icon: Shield },
];


function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const role = (session?.user as { role?: string })?.role;
  const { ciclos, cicloAtivo, setCicloAtivo } = useCiclo();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") return null;

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white h-14 flex items-center px-4 gap-4 shadow-md z-10">
        <div className="flex items-center gap-2 min-w-max">
          <div className="w-8 h-8 bg-blue-400 rounded flex items-center justify-center font-bold text-xs">
            ICP
          </div>
          <span className="font-semibold text-sm hidden sm:block">Sistema ICP</span>
        </div>

        <div className="w-px h-6 bg-blue-700" />

        {/* Seletor de ciclo */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            <Building2 size={14} className="text-blue-300" />
            <span className="text-white font-medium">
              {cicloAtivo ? `Ciclo ${cicloAtivo.anoFiscal}` : "Selecionar ciclo"}
            </span>
            {cicloAtivo && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[cicloAtivo.status] ?? ""}`}>
                {STATUS_LABEL[cicloAtivo.status] ?? cicloAtivo.status}
              </span>
            )}
            <ChevronDown size={14} className="text-blue-300" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-48 py-1 z-50">
              {ciclos.length === 0 ? (
                <p className="px-4 py-2 text-sm text-gray-500">Nenhum ciclo cadastrado</p>
              ) : (
                ciclos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCicloAtivo(c);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      cicloAtivo?.id === c.id ? "text-blue-700 font-medium" : "text-gray-700"
                    }`}
                  >
                    <span>Ciclo {c.anoFiscal}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-tight">{session?.user?.name}</p>
            <p className="text-xs text-blue-300 leading-tight">
              {(session?.user as { role?: string })?.role ?? ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-blue-300 hover:text-white transition-colors text-sm"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-4">
          <nav className="flex-1 px-2 space-y-0.5">
            {[...NAV_ITEMS.filter(item => item.roles.includes(role ?? "COLABORADOR")), ...(role === "GUARDIAO" ? NAV_GUARDIAO : [])].map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CicloProvider>
      <AppShell>{children}</AppShell>
    </CicloProvider>
  );
}

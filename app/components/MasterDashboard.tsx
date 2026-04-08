"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface DashboardData {
  totalColaboradores: number;
  totalMetasAtivas: number;
  workflowPendente: number;
  bonusPoolUsado: number;
  bonusPoolTotal: number | null;
  alertasEngajamento: string[];
  topColaboradores: { id: number; nome: string; cargo: string; notaMedia: number; premioYTD: number }[];
  realizacoesMes: number;
  janelaAtual: { id: number; mesReferencia: number; anoReferencia: number; status: string; isOpen: boolean } | null;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CORES = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export default function MasterDashboard({ cicloId }: { cicloId: number | null }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!cicloId) return;
    setData(null);
    setLoading(true);
    fetch(`/api/dashboard?cicloId=${cicloId}`)
      .then((r) => r.json())
      .then((r) => { if (r.data) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cicloId]);

  useEffect(() => { load(); }, [load]);

  if (!cicloId) return <div className="text-center text-gray-400 py-16 text-sm">Selecione um ciclo ativo para ver o Master Dashboard.</div>;
  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando dashboard...</div>;
  if (!data) return <div className="text-center py-16 text-gray-400 text-sm">Sem dados para este ciclo.</div>;

  const poolPct = data.bonusPoolTotal && data.bonusPoolTotal > 0
    ? Math.min((data.bonusPoolUsado / data.bonusPoolTotal) * 100, 100)
    : 0;

  const poolSaldoR = (data.bonusPoolTotal ?? 0) - data.bonusPoolUsado;

  const pieData = [
    { name: "Utilizado", value: data.bonusPoolUsado },
    { name: "Disponível", value: Math.max(poolSaldoR, 0) },
  ];

  return (
    <div className="space-y-6">
      {/* Janela atual + status */}
      {data.janelaAtual && (
        <div className={`rounded-xl px-5 py-3 flex items-center justify-between border ${data.janelaAtual.isOpen ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${data.janelaAtual.isOpen ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-sm font-semibold text-gray-800">
              Janela {MESES[data.janelaAtual.mesReferencia - 1]}/{data.janelaAtual.anoReferencia}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.janelaAtual.isOpen ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
              {data.janelaAtual.isOpen ? "ABERTA" : data.janelaAtual.status}
            </span>
          </div>
          <span className="text-xs text-gray-500">{data.realizacoesMes} realizações lançadas no mês</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Colaboradores Ativos", value: data.totalColaboradores, icon: "👥", color: "text-blue-700" },
          { label: "Metas Aprovadas", value: data.totalMetasAtivas, icon: "🎯", color: "text-green-700" },
          { label: "Pendências Workflow", value: data.workflowPendente, icon: "⏳", color: data.workflowPendente > 0 ? "text-orange-600" : "text-gray-500" },
          { label: "Realizações no Mês", value: data.realizacoesMes, icon: "📊", color: "text-purple-700" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span>{kpi.icon}</span>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</p>
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Bonus Pool */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">💰 Medidor de Budget (Bonus Pool)</h3>
          {data.bonusPoolTotal ? (
            <>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Utilizado: <strong className="text-blue-700">{formatBRL(data.bonusPoolUsado)}</strong></span>
                <span>Total: <strong>{formatBRL(data.bonusPoolTotal)}</strong></span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4 relative overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${poolPct > 90 ? "bg-red-500" : poolPct > 70 ? "bg-yellow-400" : "bg-blue-500"}`}
                  style={{ width: `${poolPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
                  {poolPct.toFixed(1)}% comprometido
                </span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-500">Saldo disponível:</span>
                <span className={`font-bold ${poolSaldoR < 0 ? "text-red-600" : "text-green-600"}`}>{formatBRL(poolSaldoR)}</span>
              </div>

              <div className="mt-4 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#3b82f6" : "#e5e7eb"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatBRL(Number(v))} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 py-4">Bonus Pool não configurado para este ciclo.</div>
          )}
        </div>

        {/* Top colaboradores */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">🏆 Top 5 Colaboradores</h3>
          {data.topColaboradores.length === 0 ? (
            <div className="text-sm text-gray-400 py-4">Nenhum dado disponível.</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topColaboradores.map((c) => ({ nome: c.nome.split(" ")[0], premio: Math.round(c.premioYTD), nota: c.notaMedia }))}
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => formatBRL(Number(v))} />
                  <Bar dataKey="premio" radius={[0, 4, 4, 0]}>
                    {data.topColaboradores.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Alertas de engajamento */}
      {data.alertasEngajamento.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-500 text-lg">⚠️</span>
            <h3 className="text-sm font-semibold text-orange-800">Alertas de Engajamento</h3>
          </div>
          <ul className="space-y-1">
            {data.alertasEngajamento.map((alerta, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-orange-700">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                {alerta}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.alertasEngajamento.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-green-500 text-lg">✅</span>
          <span className="text-sm text-green-700 font-medium">Todas as áreas estão com lançamentos em dia. Nenhum alerta de engajamento.</span>
        </div>
      )}
    </div>
  );
}

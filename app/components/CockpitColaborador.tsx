"use client";

import { useState, useEffect } from "react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";

interface ScorecardMeta {
  meta: {
    id: number;
    pesoNaCesta: number;
    metaAlvo: number;
    indicador: { nome: string; tipo: string; unidade: string };
  };
  realizacoes: { mesReferencia: number; valorRealizado: number; notaCalculada: number | null; premioProjetado: number | null }[];
  notaMedia: number;
  premioProjetado: number;
}

interface ScorecardData {
  colaborador: { id: number; nomeCompleto: string; matricula: string; salarioBase: number };
  cargo: { nome: string; nivelHierarquico: string; targetBonusPerc: number };
  metas: ScorecardMeta[];
  notaYTD: number;
  premioYTD: number;
  targetAnual: number;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function notaCor(nota: number) {
  if (nota >= 100) return "#10b981";
  if (nota >= 70) return "#f59e0b";
  return "#ef4444";
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export default function CockpitColaborador({ colaboradorId, cicloId }: { colaboradorId: number | null; cicloId: number | null }) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!colaboradorId || !cicloId) return;
    setLoading(true);
    fetch(`/api/scorecard?colaboradorId=${colaboradorId}&cicloId=${cicloId}`)
      .then((r) => r.json())
      .then((r) => { if (r.data) setData(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [colaboradorId, cicloId]);

  if (!colaboradorId || !cicloId) {
    return (
      <div className="text-center text-gray-400 py-16">
        <div className="text-5xl mb-4">👤</div>
        <p className="text-sm">Selecione um colaborador para ver o cockpit</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>;
  if (!data) return <div className="text-center py-16 text-gray-400 text-sm">Sem dados disponíveis</div>;

  const pctConcluido = data.targetAnual > 0 ? Math.min((data.premioYTD / data.targetAnual) * 100, 100) : 0;
  const gaugeData = [{ value: Math.min(data.notaYTD, 120), fill: notaCor(data.notaYTD) }];

  // Ofensores: metas with lowest nota
  const ofensores = [...data.metas].sort((a, b) => a.notaMedia - b.notaMedia).slice(0, 3);

  // Monthly evolution chart
  const evolucaoData = MESES.map((mes, i) => {
    const total = data.metas.reduce((sum, m) => {
      const r = m.realizacoes.find((r) => r.mesReferencia === i + 1);
      return sum + (r?.premioProjetado ?? 0);
    }, 0);
    return { mes, premio: Math.round(total) };
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho do colaborador */}
      <div className="rounded-xl p-5 text-white" style={{ background: "var(--nav-bg)" }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black flex-shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
            {data.colaborador.nomeCompleto.split(" ").slice(0, 2).map((n) => n[0]).join("")}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{data.colaborador.nomeCompleto}</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{data.cargo.nome} · {data.cargo.nivelHierarquico} · Mat. {data.colaborador.matricula}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Target: {data.cargo.targetBonusPerc}% sal. anual · Alvo: {formatBRL(data.targetAnual)}</p>
          </div>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gauge de nota */}
        <div className="bg-white icp-card p-5 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nota YTD</p>
          <div className="w-full h-36">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="70%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={gaugeData}>
                <RadialBar dataKey="value" maxBarSize={20} background={{ fill: "#f3f4f6" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-3xl font-black mt-1" style={{ color: notaCor(data.notaYTD) }}>
            {data.notaYTD.toFixed(1)}
          </div>
          <p className="text-xs text-gray-400 mt-1">de 100 pontos alvo</p>
        </div>

        {/* Prêmio projetado */}
        <div className="bg-white icp-card p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Prêmio Projetado YTD</p>
          <div className="text-3xl font-black text-blue-700 mb-1">{formatBRL(data.premioYTD)}</div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pctConcluido}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pctConcluido.toFixed(0)}% do alvo anual ({formatBRL(data.targetAnual)})</p>
        </div>

        {/* Semáforo de ofensores */}
        <div className="bg-white icp-card p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Semáforo de Ofensores</p>
          <div className="space-y-3">
            {ofensores.map((m) => (
              <div key={m.meta.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: notaCor(m.notaMedia) }} />
                  <span className="text-xs text-gray-700 truncate max-w-[130px]">{m.meta.indicador.nome}</span>
                </div>
                <span className="text-xs font-bold ml-2" style={{ color: notaCor(m.notaMedia) }}>
                  {m.notaMedia.toFixed(0)} pts
                </span>
              </div>
            ))}
            {ofensores.length === 0 && <p className="text-xs text-gray-400">Nenhuma meta lançada</p>}
          </div>
        </div>
      </div>

      {/* Tabela de metas */}
      <div className="bg-white icp-card overflow-x-auto">
        <div className="px-5 py-3 icp-card-header">
          <h3 className="text-sm font-semibold text-gray-700">A Cesta de Metas</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Indicador</th>
              <th className="px-3 py-2 text-center hidden sm:table-cell">Tipo</th>
              <th className="px-3 py-2 text-right">Peso</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">Alvo</th>
              <th className="px-3 py-2 text-right hidden md:table-cell">Último</th>
              <th className="px-3 py-2 text-right">Nota</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">Prêmio Proj.</th>
            </tr>
          </thead>
          <tbody>
            {data.metas.map((m) => {
              const last = m.realizacoes.slice(-1)[0];
              return (
                <tr key={m.meta.id}>
                  <td className="px-4 py-2 font-medium text-gray-900 text-xs">{m.meta.indicador.nome}</td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">
                    <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                      {m.meta.indicador.tipo === "VOLUME_FINANCEIRO" ? "Volume" : m.meta.indicador.tipo === "CUSTO_PRAZO" ? "Custo/Prazo" : "Projeto"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600">{m.meta.pesoNaCesta}%</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600 hidden sm:table-cell">{m.meta.metaAlvo} {m.meta.indicador.unidade}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-500 hidden md:table-cell">
                    {last ? `${last.valorRealizado} ${m.meta.indicador.unidade} (${MESES[last.mesReferencia - 1]})` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-xs font-bold" style={{ color: notaCor(m.notaMedia) }}>
                      {m.notaMedia.toFixed(0)} pts
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700 hidden sm:table-cell">
                    {formatBRL(m.premioProjetado)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-blue-50">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-xs font-bold text-blue-900">TOTAL YTD</td>
              <td className="px-3 py-2 hidden sm:table-cell"></td>
              <td className="px-3 py-2 hidden md:table-cell"></td>
              <td className="px-3 py-2 text-right text-xs font-black" style={{ color: notaCor(data.notaYTD) }}>
                {data.notaYTD.toFixed(1)} pts
              </td>
              <td className="px-3 py-2 text-right text-xs font-black text-blue-800 hidden sm:table-cell">{formatBRL(data.premioYTD)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Evolução mensal */}
      <div className="bg-white icp-card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolução Mensal do Prêmio Projetado</h3>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolucaoData} margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Bar dataKey="premio" radius={[3, 3, 0, 0]}>
                {evolucaoData.map((_, i) => (
                  <Cell key={i} fill={i < new Date().getMonth() ? "#3b82f6" : "#bfdbfe"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

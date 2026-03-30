"use client";

import { useState, useEffect } from "react";

interface ColaboradorEquipe {
  colaborador: { id: number; nomeCompleto: string; matricula: string; salarioBase: number };
  cargo: { nome: string; nivelHierarquico: string; targetMultiploSalarial: number };
  metas: {
    meta: { id: number; pesoNaCesta: number; metaAlvo: number; indicador: { nome: string; tipo: string; unidade: string } };
    notaMedia: number;
    premioProjetado: number;
  }[];
  notaYTD: number;
  premioYTD: number;
  targetAnual: number;
}

function notaCor(nota: number) {
  if (nota >= 100) return { bg: "bg-green-500", text: "text-green-700", light: "bg-green-50" };
  if (nota >= 70) return { bg: "bg-yellow-400", text: "text-yellow-700", light: "bg-yellow-50" };
  return { bg: "bg-red-500", text: "text-red-700", light: "bg-red-50" };
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export default function PainelGestor({ gestorId, cicloId, colaboradores }: {
  gestorId: number | null;
  cicloId: number | null;
  colaboradores: { id: number; nomeCompleto: string; gestorId: number | null }[];
}) {
  const [equipe, setEquipe] = useState<ColaboradorEquipe[]>([]);
  const [loading, setLoading] = useState(false);

  const subordinados = colaboradores.filter((c) => c.gestorId === gestorId);

  useEffect(() => {
    if (!cicloId || subordinados.length === 0) return;
    setLoading(true);
    Promise.all(
      subordinados.map((c) =>
        fetch(`/api/scorecard?colaboradorId=${c.id}&cicloId=${cicloId}`)
          .then((r) => r.json())
          .then((r) => r.data ?? null)
      )
    )
      .then((results) => setEquipe(results.filter(Boolean)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gestorId, cicloId, subordinados.length]);

  if (!gestorId || !cicloId) {
    return (
      <div className="text-center text-gray-400 py-16">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-sm">Selecione um gestor para ver o painel da equipe</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando equipe...</div>;

  if (subordinados.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16">
        <div className="text-5xl mb-4">👥</div>
        <p className="text-sm">Nenhum subordinado direto encontrado para este colaborador</p>
      </div>
    );
  }

  // Sort by notaYTD descending for ranking
  const sorted = [...equipe].sort((a, b) => b.notaYTD - a.notaYTD);
  const mediaEquipe = equipe.length > 0 ? equipe.reduce((s, c) => s + c.notaYTD, 0) / equipe.length : 0;
  const totalPremioEquipe = equipe.reduce((s, c) => s + c.premioYTD, 0);

  return (
    <div className="space-y-6">
      {/* Resumo da equipe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tamanho da Equipe</p>
          <p className="text-3xl font-black text-gray-900">{equipe.length}</p>
          <p className="text-xs text-gray-400">colaboradores diretos</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nota Média da Equipe</p>
          <p className="text-3xl font-black" style={{ color: mediaEquipe >= 100 ? "#10b981" : mediaEquipe >= 70 ? "#f59e0b" : "#ef4444" }}>
            {mediaEquipe.toFixed(1)}
          </p>
          <p className="text-xs text-gray-400">pontos YTD</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Prêmio Total Projetado</p>
          <p className="text-2xl font-black text-blue-700">{formatBRL(totalPremioEquipe)}</p>
          <p className="text-xs text-gray-400">soma YTD da equipe</p>
        </div>
      </div>

      {/* Heatmap da equipe */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Heatmap da Equipe — Ranking por Nota YTD</h3>
          <span className="text-xs text-gray-400 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥100</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 70–99</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;70</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Ranking</th>
                <th className="px-4 py-2 text-left">Colaborador</th>
                <th className="px-3 py-2 text-left">Cargo</th>
                <th className="px-3 py-2 text-right">Nota YTD</th>
                <th className="px-3 py-2 text-right">Prêmio YTD</th>
                <th className="px-3 py-2 text-right">Alvo Anual</th>
                <th className="px-3 py-2">Termômetro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((col, idx) => {
                const cores = notaCor(col.notaYTD);
                const pct = col.targetAnual > 0 ? Math.min((col.premioYTD / col.targetAnual) * 100, 100) : 0;
                return (
                  <tr key={col.colaborador.id} className={`${cores.light} hover:brightness-95 transition`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black text-white ${cores.bg}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{col.colaborador.nomeCompleto}</div>
                      <div className="text-xs text-gray-400">{col.colaborador.matricula}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{col.cargo.nome}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-sm font-black ${cores.text}`}>{col.notaYTD.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-gray-700">{formatBRL(col.premioYTD)}</td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">{formatBRL(col.targetAnual)}</td>
                    <td className="px-3 py-3 w-28">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className={`h-2 rounded-full ${cores.bg}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 text-center">{pct.toFixed(0)}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por indicador — visão cruzada */}
      {equipe.length > 0 && equipe[0].metas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Nota por Meta (Visão Cruzada)</h3>
          </div>
          <table className="min-w-full text-xs divide-y divide-gray-100">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-[10px]">
              <tr>
                <th className="px-4 py-2 text-left">Colaborador</th>
                {equipe[0].metas.map((m) => (
                  <th key={m.meta.id} className="px-3 py-2 text-right whitespace-nowrap" title={m.meta.indicador.nome}>
                    {m.meta.indicador.nome.substring(0, 15)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {equipe.map((col) => (
                <tr key={col.colaborador.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{col.colaborador.nomeCompleto.split(" ")[0]}</td>
                  {col.metas.map((m) => (
                    <td key={m.meta.id} className="px-3 py-2 text-right">
                      <span className="font-bold" style={{ color: m.notaMedia >= 100 ? "#10b981" : m.notaMedia >= 70 ? "#d97706" : "#ef4444" }}>
                        {m.notaMedia.toFixed(0)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

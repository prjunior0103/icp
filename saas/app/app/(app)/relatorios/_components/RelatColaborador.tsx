"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { HierarchicalAreaFilter, EMPTY_FILTERS, matchesAreaFilter, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";
import { calcMID } from "@/app/lib/calc";
import type { Atribuicao, Colaborador, Agrupamento, Indicador } from "./types";
import { NotaBadge } from "./NotaBadge";

type AreaShape = { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null; centroCusto: string };

export function RelatColaborador({
  atribuicoes,
  notasMap,
  areas,
  movimentadosSet,
}: {
  atribuicoes: Atribuicao[];
  notasMap: Map<number, number>;
  areas: AreaShape[];
  movimentadosSet: Set<string>;
}) {
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState<AreaFilters>(EMPTY_FILTERS);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  type Row = { key: string; colaborador: Colaborador; atribs: Atribuicao[]; movimentado: boolean };
  const rowsMap = new Map<string, Row>();
  for (const at of atribuicoes) {
    const c = at.colaborador;
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !c.matricula.includes(busca)) continue;
    if (!matchesAreaFilter(c, filtroArea, areas)) continue;
    const movimentado = movimentadosSet.has(c.matricula);
    const key = movimentado ? `${at.colaboradorId}-${at.agrupamentoId}` : `${at.colaboradorId}`;
    if (!rowsMap.has(key)) rowsMap.set(key, { key, colaborador: c, atribs: [], movimentado });
    rowsMap.get(key)!.atribs.push(at);
  }
  const rows = Array.from(rowsMap.values());

  function calcRow(atribs: Atribuicao[]) {
    let resultado = 0;
    const grupos: { ag: Agrupamento; pesoNaCesta: number; mids: { ind: Indicador; nota: number; peso: number; mid: number }[]; ating: number }[] = [];
    for (const at of atribs) {
      const mids: { ind: Indicador; nota: number; peso: number; mid: number }[] = [];
      let ating = 0;
      for (const ig of at.agrupamento.indicadores) {
        const nota = notasMap.get(ig.indicadorId) ?? 0;
        const mid = calcMID(nota, ig.peso);
        mids.push({ ind: ig.indicador, nota, peso: ig.peso, mid });
        ating += mid;
        resultado += mid;
      }
      grupos.push({ ag: at.agrupamento, pesoNaCesta: at.pesoNaCesta, mids, ating });
    }
    return { resultado, grupos };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <HierarchicalAreaFilter areas={areas} value={filtroArea} onChange={setFiltroArea} />
      </div>

      {rows.map(row => {
        const c = row.colaborador;
        const { resultado, grupos } = calcRow(row.atribs);
        const aberto = expandido[row.key];
        return (
          <div
            key={row.key}
            className={`bg-white rounded-xl border overflow-hidden ${row.movimentado ? "border-amber-200" : "border-gray-200"}`}
          >
            <button
              onClick={() => setExpandido(e => ({ ...e, [row.key]: !aberto }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 text-sm">{c.nome}</p>
                  {row.movimentado && (
                    <span className="text-2xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">MOVIMENTADO</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {c.matricula} · {c.cargo}{c.area?.nivel1 ? ` · ${c.area.nivel1}` : ""}
                  {row.movimentado && row.atribs[0] && (
                    <span className="text-amber-600"> · {row.atribs[0].agrupamento.nome}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Resultado</p>
                  <NotaBadge nota={resultado} />
                </div>
                {aberto ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>
            {aberto && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-4">
                {grupos.map(g => (
                  <div key={g.ag.id}>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-600">
                        {g.ag.nome} <span className="font-normal text-gray-500">({g.pesoNaCesta}% na cesta)</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Ating. <span className="font-semibold">{g.ating.toFixed(1)}%</span>
                      </p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left pb-1">Indicador</th>
                          <th className="text-right pb-1">Nota</th>
                          <th className="text-right pb-1">Peso</th>
                          <th className="text-right pb-1">MID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.mids.map(m => (
                          <tr key={m.ind.id}>
                            <td className="py-1 text-gray-700">{m.ind.codigo} — {m.ind.nome}</td>
                            <td className="py-1 text-right"><NotaBadge nota={m.nota} /></td>
                            <td className="py-1 text-right text-gray-500">{m.peso}%</td>
                            <td className="py-1 text-right font-semibold text-blue-700">
                              {m.mid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

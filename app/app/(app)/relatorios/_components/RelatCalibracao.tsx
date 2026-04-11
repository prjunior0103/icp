"use client";

import { useState } from "react";
import { calcMID } from "@/app/lib/calc";
import type { Atribuicao, Colaborador, Agrupamento } from "./types";
import { NotaBadge } from "./NotaBadge";

export function RelatCalibracao({
  atribuicoes,
  notasMap,
  movimentadosSet,
}: {
  atribuicoes: Atribuicao[];
  notasMap: Map<number, number>;
  movimentadosSet: Set<string>;
}) {
  type LinhaCalib = {
    key: string;
    colaboradorId: number;
    agrupamentoId: number;
    colab: Colaborador;
    ag: Agrupamento;
    movimentado: boolean;
  };

  const linhas: LinhaCalib[] = atribuicoes.map(a => ({
    key: `${a.colaboradorId}-${a.agrupamentoId}`,
    colaboradorId: a.colaboradorId,
    agrupamentoId: a.agrupamentoId,
    colab: a.colaborador,
    ag: a.agrupamento,
    movimentado: movimentadosSet.has(a.colaborador.matricula),
  }));

  const areas = Array.from(new Set(linhas.map(l => l.colab.area?.nivel1).filter(Boolean))) as string[];
  const [filtroArea, setFiltroArea] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const linhasFiltradas = linhas.filter(l => !filtroArea || l.colab.area?.nivel1 === filtroArea);
  const linhasMap = new Map(linhas.map(l => [l.key, l]));

  function calcResultadoLinha(key: string) {
    const l = linhasMap.get(key);
    if (!l) return 0;
    let r = 0;
    for (const ig of l.ag.indicadores)
      r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  const comparar = selecionados.length > 0 ? selecionados : linhasFiltradas.slice(0, 5).map(l => l.key);

  function toggleSel(key: string) {
    setSelecionados(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          value={filtroArea}
          onChange={e => { setFiltroArea(e.target.value); setSelecionados([]); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as áreas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="text-xs text-gray-500">Clique nos nomes para selecionar quem comparar (máx. recomendado: 6)</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {linhasFiltradas.map(l => (
          <button
            key={l.key}
            onClick={() => toggleSel(l.key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selecionados.includes(l.key)
                ? "bg-blue-600 text-white border-blue-600"
                : l.movimentado
                ? "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-500"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}
          >
            {l.colab.nome}{l.movimentado ? ` (${l.ag.nome})` : ""}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-36">Info</th>
              {comparar.map(key => {
                const l = linhasMap.get(key);
                return (
                  <th key={key} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    {l?.colab.nome ?? key}
                    {l?.movimentado && <span className="block text-2xs font-normal text-amber-600">{l.ag.nome}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {([
              { label: "Matrícula", fn: (key: string) => linhasMap.get(key)?.colab.matricula ?? "—" },
              { label: "Cargo",     fn: (key: string) => linhasMap.get(key)?.colab.cargo ?? "—" },
              { label: "Área",      fn: (key: string) => linhasMap.get(key)?.colab.area?.nivel1 ?? "—" },
              { label: "Painel",    fn: (key: string) => linhasMap.get(key)?.ag.nome ?? "—" },
              { label: "Resultado", fn: (key: string) => <NotaBadge nota={calcResultadoLinha(key)} /> },
            ] as { label: string; fn: (key: string) => React.ReactNode }[]).map(row => (
              <tr key={row.label} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-600 text-xs whitespace-nowrap">{row.label}</td>
                {comparar.map(key => (
                  <td key={key} className="px-4 py-2.5 text-center text-xs text-gray-700">{row.fn(key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

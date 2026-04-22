"use client";

import { useState } from "react";
import type { Atribuicao, Indicador } from "./types";
import { NotaBadge } from "./NotaBadge";

export function RelatContratacao({
  atribuicoes,
  indicadores,
  notasMap,
}: {
  atribuicoes: Atribuicao[];
  indicadores: Indicador[];
  notasMap: Map<number, number>;
}) {
  const [filtroInd, setFiltroInd] = useState("");

  const rows = atribuicoes.flatMap(at =>
    at.agrupamento.indicadores
      .filter(ig => !filtroInd || String(ig.indicadorId) === filtroInd)
      .map(ig => ({ at, ig }))
  );

  return (
    <div className="space-y-3">
      <select
        value={filtroInd}
        onChange={e => setFiltroInd(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
      >
        <option value="">Todos os indicadores</option>
        {indicadores.map(i => (
          <option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>
        ))}
      </select>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Indicador", "Nome Indicador", "Colaborador", "Matrícula", "Agrupamento", "Peso Ind. (%)", "Peso Cesta (%)", "% Atingimento"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ at, ig }, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ig.indicador.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{ig.indicador.nome}</td>
                <td className="px-4 py-2.5 text-gray-700">{at.colaborador.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{at.colaborador.matricula}</td>
                <td className="px-4 py-2.5 text-gray-600">{at.agrupamento.nome}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{ig.peso}%</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{at.pesoNaCesta}%</td>
                <td className="px-4 py-2.5"><NotaBadge nota={notasMap.get(ig.indicadorId)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

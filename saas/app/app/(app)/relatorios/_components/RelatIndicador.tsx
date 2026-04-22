"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { Indicador, Atribuicao } from "./types";
import { NotaBadge } from "./NotaBadge";

export function RelatIndicador({
  indicadores,
  notasMap,
  realMap,
  orcMap,
  atribuicoes,
}: {
  indicadores: Indicador[];
  notasMap: Map<number, number>;
  realMap: Map<number, number | null>;
  orcMap: Map<number, number | null>;
  atribuicoes: Atribuicao[];
}) {
  const [busca, setBusca] = useState("");
  const inds = indicadores.filter(
    i =>
      !busca ||
      i.nome.toLowerCase().includes(busca.toLowerCase()) ||
      i.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar indicador..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código", "Indicador", "Tipo", "Métrica", "Orçado", "Realizado", "% Atingimento", "Impacta"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inds.map(ind => {
              const real = realMap.get(ind.id);
              const orc = orcMap.get(ind.id);
              const nota = notasMap.get(ind.id);
              const contratantes = new Set(
                atribuicoes
                  .filter(a => a.agrupamento.indicadores.some(ig => ig.indicadorId === ind.id))
                  .map(a => a.colaboradorId)
              ).size;
              return (
                <tr key={ind.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{ind.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.tipo}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.unidade}</td>
                  <td className="px-4 py-2.5 text-sm text-orange-700 font-medium">
                    {orc != null ? orc.toLocaleString("pt-BR") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-blue-700 font-medium">
                    {real != null ? real.toLocaleString("pt-BR") : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><NotaBadge nota={nota} /></td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{contratantes} colab.</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

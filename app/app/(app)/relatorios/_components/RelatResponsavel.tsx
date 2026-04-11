"use client";

import { useState } from "react";
import { gerarPeriodos } from "@/app/lib/calc";
import type { Indicador, Realizacao } from "./types";
import { NotaBadge } from "./NotaBadge";

export function RelatResponsavel({
  indicadores,
  notasMap,
  realizacoes,
  anoFiscal,
  mesInicio,
  mesFim,
}: {
  indicadores: Indicador[];
  notasMap: Map<number, number>;
  realizacoes: Realizacao[];
  anoFiscal: number;
  mesInicio: number;
  mesFim: number;
}) {
  const [filtro, setFiltro] = useState("");

  const responsaveis = Array.from(
    new Set(indicadores.map(i => i.responsavelEnvio?.nome ?? i.analistaResp ?? "—"))
  ).sort();
  const inds = indicadores.filter(i => {
    const resp = i.responsavelEnvio?.nome ?? i.analistaResp ?? "—";
    return !filtro || resp === filtro;
  });

  return (
    <div className="space-y-3">
      <select
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
      >
        <option value="">Todos os responsáveis</option>
        {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Responsável", "Código", "Indicador", "Tipo", "Periodicidade", "Status", "% Atingimento"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inds.map(ind => {
              const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
              const preenchido = periodos.some(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p));
              const resp = ind.responsavelEnvio?.nome ?? ind.analistaResp ?? "—";
              return (
                <tr key={ind.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{resp}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                  <td className="px-4 py-2.5 text-gray-700">{ind.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.tipo}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.periodicidade}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${preenchido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {preenchido ? "Preenchido" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><NotaBadge nota={notasMap.get(ind.id)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { calcMID } from "@/app/lib/calc";
import type { Atribuicao, Colaborador } from "./types";
import { NotaBadge } from "./NotaBadge";

export function RelatGestor({
  atribuicoes,
  notasMap,
  movimentadosSet,
}: {
  atribuicoes: Atribuicao[];
  notasMap: Map<number, number>;
  movimentadosSet: Set<string>;
}) {
  const colabsMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, a.colaborador);
  const colaboradores = Array.from(colabsMap.values());
  const gestoresIds = Array.from(new Set(colaboradores.map(c => c.gestorId).filter(Boolean))) as number[];
  const gestores = colaboradores.filter(c => gestoresIds.includes(c.id));
  const [filtroGestor, setFiltroGestor] = useState(gestores[0]?.id ? String(gestores[0].id) : "");

  function calcResultadoAtrib(at: Atribuicao) {
    let r = 0;
    for (const ig of at.agrupamento.indicadores)
      r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  const linhas = atribuicoes
    .filter(a => filtroGestor ? String(a.colaborador.gestorId) === filtroGestor : false)
    .sort((a, b) => calcResultadoAtrib(b) - calcResultadoAtrib(a));

  return (
    <div className="space-y-3">
      <select
        value={filtroGestor}
        onChange={e => setFiltroGestor(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
      >
        <option value="">Selecionar gestor</option>
        {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
      {linhas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <UserCog size={36} className="mx-auto mb-2 text-gray-300" />
          Selecione um gestor para ver o painel da equipe
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Colaborador", "Matrícula", "Cargo", "Área", "Painel", "Resultado"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map(a => {
                const resultado = calcResultadoAtrib(a);
                const movimentado = movimentadosSet.has(a.colaborador.matricula);
                return (
                  <tr key={`${a.colaboradorId}-${a.agrupamentoId}`} className={`hover:bg-gray-50 ${movimentado ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{a.colaborador.nome}</p>
                      {movimentado && <span className="text-2xs font-semibold text-amber-600">MOVIMENTADO</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.colaborador.matricula}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{a.colaborador.cargo}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.colaborador.area?.nivel1 ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{a.agrupamento.nome}</td>
                    <td className="px-4 py-2.5"><NotaBadge nota={resultado} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

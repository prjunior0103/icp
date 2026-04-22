"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { gerarPeriodos } from "@/app/lib/calc";
import { labelPeriodo } from "@/app/lib/format";
import type { Indicador, Realizacao } from "./types";

export function RelatPendencias({
  indicadores,
  realizacoes,
  anoFiscal,
  mesInicio,
  mesFim,
}: {
  indicadores: Indicador[];
  realizacoes: Realizacao[];
  anoFiscal: number;
  mesInicio: number;
  mesFim: number;
}) {
  const [apenasPendentes, setApenasPendentes] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [busca, setBusca] = useState("");

  const indsBase = indicadores.filter(i => !i.numeradorId && !i.divisorId);
  const mesesCiclo = gerarPeriodos(anoFiscal, mesInicio, mesFim, "MENSAL");

  type Linha = { ind: Indicador; periodo: string; preenchido: boolean };
  const linhas: Linha[] = [];
  for (const ind of indsBase) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    for (const p of periodos) {
      const preenchido = realizacoes.some(r => r.indicadorId === ind.id && r.periodo === p);
      linhas.push({ ind, periodo: p, preenchido });
    }
  }

  const linhasFiltradas = linhas.filter(l => {
    if (apenasPendentes && l.preenchido) return false;
    if (filtroPeriodo && l.periodo !== filtroPeriodo) return false;
    if (busca && !l.ind.nome.toLowerCase().includes(busca.toLowerCase()) && !l.ind.codigo.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const totalPendentes = linhas.filter(l => !l.preenchido).length;
  const totalLinhas = linhas.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar indicador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os períodos</option>
          {mesesCiclo.map(p => <option key={p} value={p}>{labelPeriodo(p)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={apenasPendentes}
            onChange={e => setApenasPendentes(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          Apenas pendentes
        </label>
        <span className="text-xs text-gray-500 ml-auto">{totalPendentes} pendente(s) de {totalLinhas}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código", "Indicador", "Responsável", "Período", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500 text-sm">
                  {apenasPendentes ? "Nenhuma pendência encontrada 🎉" : "Nenhum resultado"}
                </td>
              </tr>
            ) : linhasFiltradas.map((l, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{l.ind.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{l.ind.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{l.ind.analistaResp ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{labelPeriodo(l.periodo)}</td>
                <td className="px-4 py-2.5">
                  {l.preenchido
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Preenchido</span>
                    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Pendente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

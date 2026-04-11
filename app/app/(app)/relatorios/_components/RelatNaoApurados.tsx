"use client";

import { AlertCircle, BarChart3 } from "lucide-react";
import { gerarPeriodos } from "@/app/lib/calc";
import { labelPeriodo } from "@/app/lib/format";
import type { Indicador, Realizacao } from "./types";

export function RelatNaoApurados({
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
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const indsBase = indicadores.filter(i => !i.numeradorId && !i.divisorId);
  const todosMeses = gerarPeriodos(anoFiscal, mesInicio, mesFim, "MENSAL");
  const periodosCiclo = new Set(todosMeses);
  const periodoRef = periodosCiclo.has(mesAtual) ? mesAtual : [...todosMeses].sort().pop() ?? mesAtual;

  const linhas = indsBase.flatMap(ind => {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    const periodoAtual = periodos.filter(p => p <= periodoRef).pop();
    if (!periodoAtual) return [];
    const preenchido = realizacoes.some(r => r.indicadorId === ind.id && r.periodo === periodoAtual);
    return preenchido ? [] : [{ ind, periodo: periodoAtual }];
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500" />
          <span className="text-sm font-semibold text-amber-700">
            {linhas.length} indicador(es) não apurado(s) em {labelPeriodo(periodoRef)}
          </span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código", "Indicador", "Responsável", "Período", "Ação"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Todos os indicadores estão apurados em {labelPeriodo(periodoRef)} 🎉
                </td>
              </tr>
            ) : linhas.map(({ ind, periodo }) => (
              <tr key={ind.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{ind.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{ind.analistaResp ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{labelPeriodo(periodo)}</td>
                <td className="px-4 py-2.5">
                  <a
                    href="/apuracao"
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors w-fit"
                  >
                    <BarChart3 size={12} /> Apurar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

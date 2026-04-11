"use client";

import { useState, useEffect } from "react";
import { Search, Target } from "lucide-react";
import { fmtValor } from "@/app/lib/format";
import type { Indicador, FaixaIndicador } from "./types";

export function AbaFormulas({ indicadores, todosIndicadores }: { indicadores: Indicador[]; todosIndicadores: Indicador[] }) {
  const [faixasPorInd, setFaixasPorInd] = useState<Record<number, FaixaIndicador[]>>({});
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (indicadores.length === 0) return;
    Promise.all(
      indicadores.map(i =>
        fetch(`/api/faixas?indicadorId=${i.id}`).then(r => r.json()).then(d => [i.id, d.faixas ?? []] as [number, FaixaIndicador[]])
      )
    ).then(entries => setFaixasPorInd(Object.fromEntries(entries)));
  }, [indicadores]);

  function descricaoFormula(ind: Indicador): string {
    if (ind.numeradorId && ind.divisorId) {
      const num = todosIndicadores.find(i => i.id === ind.numeradorId);
      const den = todosIndicadores.find(i => i.id === ind.divisorId);
      return `(${num?.nome ?? "Numerador"}) ÷ (${den?.nome ?? "Divisor"})`;
    }
    if (ind.tipo === "MAIOR_MELHOR") return "(Realizado ÷ Meta Alvo) × 100";
    if (ind.tipo === "MENOR_MELHOR") return "(Meta Alvo ÷ Realizado) × 100";
    if (ind.tipo === "PROJETO_MARCO") return "100 se Realizado ≥ 1, senão 0";
    return "—";
  }

  const TIPO_COLOR: Record<string,string> = {
    MAIOR_MELHOR: "bg-green-100 text-green-700",
    MENOR_MELHOR: "bg-orange-100 text-orange-700",
    PROJETO_MARCO: "bg-purple-100 text-purple-700",
  };
  const TIPO_LABEL: Record<string,string> = {
    MAIOR_MELHOR: "Maior é Melhor",
    MENOR_MELHOR: "Menor é Melhor",
    PROJETO_MARCO: "Projeto/Marco",
  };

  const inds = indicadores.filter(i =>
    !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.codigo.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar indicador..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>

      {inds.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Target size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum indicador encontrado
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {inds.map(ind => {
            const faixas = faixasPorInd[ind.id] ?? [];
            return (
              <div key={ind.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{ind.nome}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{ind.codigo}</p>
                  </div>
                  <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TIPO_COLOR[ind.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                    {TIPO_LABEL[ind.tipo] ?? ind.tipo}
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-2xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Fórmula</p>
                  <p className="text-xs text-gray-700 font-mono">{descricaoFormula(ind)}</p>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center">
                  {[["Mínima", ind.metaMinima], ["Alvo", ind.metaAlvo], ["Máxima", ind.metaMaxima]].map(([label, val]) => (
                    <div key={label as string} className="bg-gray-50 rounded px-2 py-1.5">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide">{label as string}</p>
                      <p className="text-xs font-semibold text-gray-700">{val != null ? fmtValor(val as number, ind.unidade) : "—"}</p>
                    </div>
                  ))}
                </div>

                {faixas.length > 0 && (
                  <div>
                    <p className="text-2xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Faixas</p>
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-400">
                        <th className="text-left pb-0.5">De</th><th className="text-left pb-0.5">Até</th><th className="text-left pb-0.5">Nota</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {faixas.map((f, i) => (
                          <tr key={i}>
                            <td className="py-0.5 text-gray-600">{fmtValor(f.de, ind.unidade)}</td>
                            <td className="py-0.5 text-gray-600">{fmtValor(f.ate, ind.unidade)}</td>
                            <td className="py-0.5 font-semibold text-blue-700">{f.nota}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex gap-2 text-2xs text-gray-400 border-t border-gray-100 pt-2">
                  <span>Teto: <strong className="text-gray-600">120%</strong></span>
                  <span>·</span>
                  <span>Piso: <strong className="text-gray-600">0%</strong> abaixo do mínimo</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

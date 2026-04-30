"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { calcMID } from "@/app/lib/calc";
import type { Atribuicao, Colaborador, Agrupamento } from "./types";
import { NotaBadge } from "./NotaBadge";
import { HierarchicalAreaFilter, EMPTY_FILTERS, matchesAreaFilter, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";

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

  // Build deduplicated area objects for HierarchicalAreaFilter
  const areasList = Array.from(
    new Map(
      linhas
        .filter(l => l.colab.area)
        .map(l => {
          const a = l.colab.area!;
          const key = `${a.nivel1}|${a.nivel2 ?? ""}|${a.nivel3 ?? ""}|${a.nivel4 ?? ""}|${a.nivel5 ?? ""}`;
          return [key, {
            nivel1: a.nivel1,
            nivel2: a.nivel2 ?? null,
            nivel3: a.nivel3 ?? null,
            nivel4: a.nivel4 ?? null,
            nivel5: a.nivel5 ?? null,
            centroCusto: l.colab.centroCusto ?? "",
          }];
        })
    ).values()
  );

  const [filtroArea, setFiltroArea] = useState<AreaFilters>(EMPTY_FILTERS);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [buscaLista, setBuscaLista] = useState("");

  const linhasFiltradas = linhas.filter(l => matchesAreaFilter(l.colab, filtroArea));
  const linhasBuscadas = buscaLista.trim()
    ? linhasFiltradas.filter(l => l.colab.nome.toLowerCase().includes(buscaLista.toLowerCase()))
    : linhasFiltradas;

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

  function selectAll() {
    setSelecionados(linhasFiltradas.map(l => l.key));
  }

  function clearSel() {
    setSelecionados([]);
  }

  return (
    <div className="space-y-3">
      {/* Filtros de área */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Filtrar por área:</span>
        <HierarchicalAreaFilter areas={areasList} value={filtroArea} onChange={v => { setFiltroArea(v); setSelecionados([]); }} />
      </div>

      {/* Listbox de seleção */}
      <div className="flex gap-3 items-start">
        <div className="flex-shrink-0 w-64">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-600">Selecionar para comparar</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Todos</button>
              {selecionados.length > 0 && (
                <button onClick={clearSel} className="text-xs text-gray-400 hover:underline">Limpar</button>
              )}
            </div>
          </div>
          <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
            <div className="p-1.5 border-b border-gray-100">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={buscaLista}
                  onChange={e => setBuscaLista(e.target.value)}
                  placeholder="Pesquisar..."
                  className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {linhasBuscadas.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">Nenhum resultado</p>
              )}
              {linhasBuscadas.map(l => (
                <label key={l.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selecionados.includes(l.key)}
                    onChange={() => toggleSel(l.key)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-xs ${l.movimentado ? "text-amber-700" : "text-gray-700"}`}>
                    {l.colab.nome}
                    {l.movimentado && <span className="text-2xs ml-1 text-amber-500">({l.ag.nome})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {selecionados.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">{selecionados.length} selecionado(s)</p>
          )}
        </div>

        {/* Tabela de calibração */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
          {comparar.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-gray-400">Selecione colaboradores na lista ao lado</div>
          )}
        </div>
      </div>
    </div>
  );
}

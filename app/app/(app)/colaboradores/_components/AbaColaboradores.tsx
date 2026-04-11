"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Upload, Download, FileDown, Users, Search } from "lucide-react";
import { HierarchicalAreaFilter, EMPTY_FILTERS, matchesAreaFilter, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";
import { useConfirm } from "@/app/components/ConfirmModal";
import { SearchInput } from "@/app/components/SearchInput";
import type { Area, Colaborador } from "./types";
import { STATUS_COLORS } from "./types";
import { ModalColaborador } from "./ModalColaborador";
import { ModalImport } from "./ModalImport";

export interface MovimentacaoResumo {
  matricula: string; tipo: string; requerNovoPainel: boolean;
  painelAnteriorNome: string | null; painelNovoNome: string | null;
  dadosAntigos: string | null; statusTratamento: string;
}

export function AbaColaboradores({ cicloId }: { cicloId: number }) {
  const confirm = useConfirm();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState<AreaFilters>(EMPTY_FILTERS);
  const [modalColab, setModalColab] = useState<Colaborador | null | "new">(null);
  const [modalImport, setModalImport] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [excluindoMassa, setExcluindoMassa] = useState(false);

  const carregar = useCallback(() => {
    fetch(`/api/colaboradores?cicloId=${cicloId}&busca=${encodeURIComponent(busca)}`)
      .then((r) => r.json()).then((d) => setColaboradores(d.colaboradores ?? []));
    fetch(`/api/areas?cicloId=${cicloId}`).then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
    // Buscar movimentações com troca de painel para duplicar linhas
    fetch(`/api/movimentacoes?cicloId=${cicloId}`)
      .then(r => r.json()).then(d => setMovimentacoes((d.movimentacoes ?? []).filter((m: MovimentacaoResumo) => m.requerNovoPainel)));
  }, [cicloId, busca]);

  useEffect(() => { carregar(); setSelecionados(new Set()); }, [carregar]);

  function excluir(id: number) {
    confirm.request("Excluir este colaborador?", async () => {
      setExcluindo(id);
      await fetch(`/api/colaboradores?id=${id}`, { method: "DELETE" });
      setExcluindo(null);
      carregar();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }

  function excluirSelecionados() {
    confirm.request(`Excluir ${selecionados.size} colaborador(es)?`, async () => {
      setExcluindoMassa(true);
      await Promise.all([...selecionados].map(id => fetch(`/api/colaboradores?id=${id}`, { method: "DELETE" })));
      setSelecionados(new Set());
      setExcluindoMassa(false);
      carregar();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }

  function toggleSel(id: number) {
    setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleTodos() {
    setSelecionados(s => s.size === colaboradores.length ? new Set() : new Set(colaboradores.map(c => c.id)));
  }

  // Montar mapa de movimentações por matrícula
  const movPorMatricula = new Map<string, MovimentacaoResumo[]>();
  for (const m of movimentacoes) {
    const arr = movPorMatricula.get(m.matricula) ?? [];
    arr.push(m);
    movPorMatricula.set(m.matricula, arr);
  }

  // Montar lista expandida: colaboradores normais + linhas duplicadas para movimentados
  type LinhaColab = Colaborador & { _movimentado?: boolean; _situacao?: string; _painelNome?: string; _dadosAnteriores?: Record<string, string> };
  const linhas: LinhaColab[] = [];
  for (const c of colaboradores) {
    if (!matchesAreaFilter(c, filtroArea, areas)) continue;
    const movs = movPorMatricula.get(c.matricula);
    if (movs && movs.length > 0) {
      // Linha "anterior" com dados antigos
      for (const m of movs) {
        const antigos = m.dadosAntigos ? JSON.parse(m.dadosAntigos) : {};
        linhas.push({
          ...c,
          centroCusto: antigos.centroCusto ?? c.centroCusto,
          nomeGestor: antigos.nomeGestor ?? c.nomeGestor,
          matriculaGestor: antigos.matriculaGestor ?? c.matriculaGestor,
          _movimentado: true,
          _situacao: "anterior",
          _painelNome: m.painelAnteriorNome ?? "—",
        });
      }
      // Linha "atual" com dados novos
      linhas.push({
        ...c,
        _movimentado: true,
        _situacao: "atual",
        _painelNome: movs[movs.length - 1].painelNovoNome ?? "—",
      });
    } else {
      linhas.push(c);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome ou matrícula..."
          className="flex-1 min-w-48"
        />
        <HierarchicalAreaFilter areas={areas} value={filtroArea} onChange={setFiltroArea} />
        {selecionados.size > 0 && (
          <button onClick={excluirSelecionados} disabled={excluindoMassa}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm px-3 py-2 rounded-lg">
            <Trash2 size={15} /> {excluindoMassa ? "Excluindo..." : `Excluir ${selecionados.size}`}
          </button>
        )}
        <button onClick={() => window.location.href = `/api/colaboradores/export?cicloId=${cicloId}`} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <FileDown size={15} /> Exportar Base
        </button>
        <button onClick={() => window.location.href = `/api/colaboradores/export-consolidada?cicloId=${cicloId}`} className="flex items-center gap-2 border border-green-300 text-green-700 text-sm px-3 py-2 rounded-lg hover:bg-green-50">
          <FileDown size={15} /> Base Consolidada
        </button>
        <button onClick={() => window.location.href = "/api/colaboradores/template"} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Download size={15} /> Template
        </button>
        <button onClick={() => setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Upload size={15} /> Importar
        </button>
        <button onClick={() => setModalColab("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg">
          <Plus size={15} /> Novo
        </button>
      </div>

      {linhas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-2 text-gray-300" />
          Nenhum colaborador neste ciclo
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5">
                  <input type="checkbox" checked={selecionados.size === colaboradores.length} onChange={toggleTodos} className="rounded" aria-label="Selecionar todos" />
                </th>
                {["Matrícula", "Nome", "Cargo / Grade", "CC / Gestor", "Status", "Situação", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((c, idx) => {
                const isMovimentado = !!(c as LinhaColab)._movimentado;
                const situacao = (c as LinhaColab)._situacao;
                const painelNome = (c as LinhaColab)._painelNome;
                return (
                  <tr key={`${c.id}-${situacao ?? "normal"}-${idx}`} className={`hover:bg-gray-50 ${selecionados.has(c.id) ? "bg-blue-50" : ""} ${isMovimentado ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-2.5">
                      {!isMovimentado || situacao === "atual" ? (
                        <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggleSel(c.id)} className="rounded" aria-label={`Selecionar ${c.nome}`} />
                      ) : <span />}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.matricula}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{c.nome}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-gray-700">{c.cargo}</p>
                      {c.grade && <p className="text-xs text-gray-400">{c.grade}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <p className="text-gray-700">{c.centroCusto ?? "—"}</p>
                      <p className="text-gray-400">{c.nomeGestor ?? "—"}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {isMovimentado ? (
                        <div>
                          <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            MOVIMENTADO
                          </span>
                          <span className="text-2xs text-gray-400 ml-1">({situacao})</span>
                          {painelNome && <p className="text-2xs text-gray-500 mt-0.5">Painel: {painelNome}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(!isMovimentado || situacao === "atual") && (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setModalColab(c)} aria-label="Editar colaborador" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                          <button onClick={() => excluir(c.id)} disabled={excluindo === c.id} aria-label="Excluir colaborador" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalColab !== null && (
        <ModalColaborador
          colab={modalColab === "new" ? null : modalColab}
          cicloId={cicloId}
          areas={areas}
          onSave={carregar}
          onClose={() => setModalColab(null)}
        />
      )}
      {modalImport && (
        <ModalImport tipo="colaboradores" cicloId={cicloId} onDone={carregar} onClose={() => setModalImport(false)} />
      )}
      {confirm.modal}
    </div>
  );
}

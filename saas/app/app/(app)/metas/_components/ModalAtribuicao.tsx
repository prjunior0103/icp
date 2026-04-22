"use client";

import { useState, useEffect, useMemo } from "react";
import { Upload, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { HierarchicalAreaFilter, matchesAreaFilter, EMPTY_FILTERS, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";
import { ModalWrapper } from "@/app/components/ModalWrapper";
import type { Indicador, Agrupamento, Colaborador, Atribuicao } from "./types";

// ─── Modal Importação ─────────────────────────────────────
export function ModalImport({ cicloId, onDone, onClose }: { cicloId: number; onDone: () => void; onClose: () => void; }) {
  const [file, setFile] = useState<File|null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{criados:number;erros:string[]}|null>(null);
  async function importar() {
    if (!file) return; setEnviando(true);
    const fd = new FormData(); fd.append("file",file); fd.append("cicloId",String(cicloId));
    const res = await fetch("/api/indicadores/import",{method:"POST",body:fd});
    const data = await res.json(); setResultado(data); setEnviando(false);
    if (data.criados > 0) onDone();
  }
  return (
    <ModalWrapper title="Importar Indicadores" onClose={onClose} size="md">
        {!resultado ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={32} className="text-gray-300 mx-auto mb-2"/>
              <p className="text-sm text-gray-500 mb-3">Selecione o arquivo .xlsx</p>
              <input type="file" accept=".xlsx" onChange={e=>setFile(e.target.files?.[0]??null)} className="text-sm"/>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={importar} disabled={!file||enviando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{enviando?"Importando...":"Importar"}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg"><CheckCircle2 size={18}/><span className="text-sm font-medium">{resultado.criados} importado(s)</span></div>
            {resultado.erros.length > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><div className="flex items-center gap-1.5 text-red-700 text-sm font-medium mb-1"><AlertCircle size={15}/>{resultado.erros.length} erro(s):</div>{resultado.erros.map((e,i)=><p key={i} className="text-xs text-red-600">{e}</p>)}</div>}
            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg">Fechar</button>
          </div>
        )}
    </ModalWrapper>
  );
}

// ─── Modal Atribuição ─────────────────────────────────────
type ModoAtrib = "colaborador" | "grade" | "nivel" | "todos" | "gestor";

const MODOS: { id: ModoAtrib; label: string }[] = [
  { id: "colaborador", label: "Por Colaborador" },
  { id: "grade",       label: "Por Grade" },
  { id: "nivel",       label: "Por Nível" },
  { id: "todos",       label: "Para Todos" },
  { id: "gestor",      label: "Por Gestor" },
];

type AreaShape = { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null; centroCusto: string };

export function ModalAtribuicao({ cicloId, agrupamentos, atrib, colaboradores, areas, onSave, onClose }: {
  cicloId: number; agrupamentos: Agrupamento[]; atrib: Atribuicao | null;
  colaboradores: Colaborador[]; areas: AreaShape[];
  onSave: () => void; onClose: () => void;
}) {
  const editando = atrib !== null;

  // Modo — só relevante para novo
  const [modo, setModo] = useState<ModoAtrib>("colaborador");

  // Seletores por modo
  const [colaboradorId, setColaboradorId] = useState(atrib ? String(atrib.colaboradorId) : "");
  const [grade, setGrade] = useState("");
  const [filtroArea, setFiltroArea] = useState<AreaFilters>(EMPTY_FILTERS);
  const [gestorId, setGestorId] = useState("");
  const [cascata, setCascata] = useState<"DIRETOS"|"DIRETOS_E_INDIRETOS">("DIRETOS");

  // Agrupamentos selecionados: Map<agrupamentoId, pesoNaCesta>
  const [selecionados, setSelecionados] = useState<Map<number, number>>(
    atrib ? new Map([[atrib.agrupamentoId, atrib.pesoNaCesta]]) : new Map()
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Grades únicas
  const grades = useMemo(() =>
    [...new Set(colaboradores.map(c => c.grade).filter(Boolean) as string[])].sort()
  , [colaboradores]);

  // Gestores: colaboradores que têm subordinados
  const gestoresIds = useMemo(() =>
    new Set(colaboradores.map(c => c.gestorId).filter(Boolean))
  , [colaboradores]);
  const gestores = useMemo(() =>
    colaboradores.filter(c => gestoresIds.has(c.id))
  , [colaboradores, gestoresIds]);

  // Prévia de impactados (client-side)
  function getSubordinadosRec(gId: number, todos: Colaborador[], indiretos: boolean): Colaborador[] {
    const diretos = todos.filter(c => c.gestorId === gId);
    if (!indiretos) return diretos;
    return diretos.flatMap(d => [d, ...getSubordinadosRec(d.id, todos, true)]);
  }

  const impactados = useMemo((): Colaborador[] => {
    if (editando) return atrib ? [atrib.colaborador] : [];
    switch (modo) {
      case "colaborador":
        return colaboradorId ? colaboradores.filter(c => String(c.id) === colaboradorId) : [];
      case "grade":
        return grade ? colaboradores.filter(c => c.grade === grade) : [];
      case "nivel": {
        const hasFilter = Object.values(filtroArea).some(Boolean);
        return hasFilter ? colaboradores.filter(c => matchesAreaFilter(c, filtroArea, areas)) : [];
      }
      case "todos":
        return colaboradores;
      case "gestor":
        if (!gestorId) return [];
        return getSubordinadosRec(Number(gestorId), colaboradores, cascata === "DIRETOS_E_INDIRETOS");
      default:
        return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, atrib, modo, colaboradorId, grade, filtroArea, gestorId, cascata, colaboradores, areas]);

  function toggleAg(agId: number, peso: number) {
    setSelecionados(m => {
      const n = new Map(m);
      n.has(agId) ? n.delete(agId) : n.set(agId, peso);
      return n;
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (selecionados.size === 0) { setErro("Selecione ao menos um agrupamento"); return; }
    if (!editando) {
      if (modo === "colaborador" && !colaboradorId) { setErro("Selecione um colaborador"); return; }
      if (modo === "grade" && !grade) { setErro("Selecione um grade"); return; }
      if (modo === "nivel" && !Object.values(filtroArea).some(Boolean)) { setErro("Selecione ao menos um filtro de nível"); return; }
      if (modo === "gestor" && !gestorId) { setErro("Selecione um gestor"); return; }
      if (impactados.length === 0 && modo !== "gestor") { setErro("Nenhum colaborador encontrado para os critérios"); return; }
    }
    setSalvando(true); setErro("");
    try {
      if (!editando && modo === "gestor") {
        // Backend faz cascata recursiva
        for (const [agrupamentoId, pesoNaCesta] of selecionados) {
          const res = await fetch("/api/atribuicoes", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cicloId, colaboradorId: Number(gestorId), agrupamentoId, pesoNaCesta, cascata }),
          });
          if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao atribuir"); setSalvando(false); return; }
        }
      } else {
        const targets = editando ? [atrib!.colaboradorId] : impactados.map(c => c.id);
        await Promise.all(
          targets.flatMap(colabId =>
            [...selecionados].map(([agrupamentoId, pesoNaCesta]) =>
              fetch("/api/atribuicoes", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cicloId, colaboradorId: colabId, agrupamentoId, pesoNaCesta, cascata: "NENHUM" }),
              })
            )
          )
        );
      }
      onSave(); onClose();
    } catch { setErro("Erro ao salvar"); setSalvando(false); }
  }

  return (
    <ModalWrapper title={editando ? "Editar Atribuição" : "Nova Atribuição"} onClose={onClose} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          {/* Seletor de modo — só para novo */}
          {!editando && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Modo de atribuição</label>
              <div className="flex flex-wrap gap-1.5">
                {MODOS.map(m => (
                  <button key={m.id} type="button" onClick={() => { setModo(m.id); setErro(""); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      modo === m.id
                        ? "bg-blue-700 text-white border-blue-700"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seleção por modo */}
          {!editando && modo === "colaborador" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colaborador *</label>
              <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecionar...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.matricula})</option>)}
              </select>
            </div>
          )}

          {!editando && modo === "grade" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade *</label>
              {grades.length === 0
                ? <p className="text-xs text-gray-500">Nenhum grade cadastrado nos colaboradores</p>
                : <select value={grade} onChange={e => setGrade(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecionar...</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
              }
            </div>
          )}

          {!editando && modo === "nivel" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Filtro de Nível *</label>
              <HierarchicalAreaFilter areas={areas} value={filtroArea} onChange={setFiltroArea} />
            </div>
          )}

          {!editando && modo === "todos" && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
              Atribuição será feita para todos os {colaboradores.length} colaboradores do ciclo.
            </div>
          )}

          {!editando && modo === "gestor" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gestor *</label>
                {gestores.length === 0
                  ? <p className="text-xs text-gray-500">Nenhum gestor identificado (colaboradores sem subordinados)</p>
                  : <select value={gestorId} onChange={e => setGestorId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecionar...</option>
                      {gestores.map(g => <option key={g.id} value={g.id}>{g.nome} ({g.matricula})</option>)}
                    </select>
                }
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cascata</label>
                <select value={cascata} onChange={e => setCascata(e.target.value as "DIRETOS"|"DIRETOS_E_INDIRETOS")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="DIRETOS">Diretos (1 nível)</option>
                  <option value="DIRETOS_E_INDIRETOS">Diretos e Indiretos (todos os níveis)</option>
                </select>
              </div>
            </div>
          )}

          {/* Prévia de impactados — só contagem */}
          {!editando && (
            <div className={`rounded-lg px-3 py-2 text-sm ${impactados.length > 0 ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-500 italic"}`}>
              {impactados.length > 0
                ? `${impactados.length} colaborador${impactados.length !== 1 ? "es" : ""} serão impactados`
                : "Nenhum colaborador selecionado"}
            </div>
          )}

          {/* Agrupamentos */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Agrupamentos *</label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {agrupamentos.map(ag => {
                const somaPeso = ag.indicadores.reduce((s, i) => s + i.peso, 0);
                const sel = selecionados.has(ag.id);
                return (
                  <div key={ag.id} className={`flex items-center gap-2 px-3 py-2 ${sel ? "bg-blue-50" : ""}`}>
                    <input type="checkbox" checked={sel}
                      disabled={editando && ag.id !== atrib?.agrupamentoId}
                      onChange={() => !editando && toggleAg(ag.id, somaPeso)}
                      className="rounded" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{ag.nome}</p>
                      <p className="text-xs text-gray-500">{ag.tipo} — {somaPeso.toFixed(2)}%</p>
                    </div>
                    {sel && (
                      <input type="number" min="0" max="100" step="0.01"
                        value={selecionados.get(ag.id) ?? somaPeso}
                        onChange={e => setSelecionados(m => { const n = new Map(m); n.set(ag.id, Number(e.target.value)); return n; })}
                        className="w-20 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Peso %" />
                    )}
                  </div>
                );
              })}
              {agrupamentos.length === 0 && <p className="text-xs text-gray-500 p-3">Nenhum agrupamento cadastrado</p>}
            </div>
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
              {salvando ? "Salvando..." : editando ? "Salvar" : impactados.length > 0 || modo === "gestor" ? `Atribuir${impactados.length > 0 ? ` (${impactados.length})` : ""}` : "Atribuir"}
            </button>
          </div>
        </form>
    </ModalWrapper>
  );
}

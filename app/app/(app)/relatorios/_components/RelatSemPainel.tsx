"use client";

import { useState } from "react";
import { Search, UserX, Plus } from "lucide-react";
import type { ColaboradorBasico, AgrupamentoBasico, Atribuicao } from "./types";
import { ModalWrapper } from "@/app/components/ModalWrapper";

export function RelatSemPainel({
  colaboradoresAll,
  atribuicoes,
  agrupamentos,
  cicloId,
  onAtribuir,
  readOnly,
}: {
  colaboradoresAll: ColaboradorBasico[];
  atribuicoes: Atribuicao[];
  agrupamentos: AgrupamentoBasico[];
  cicloId: number;
  onAtribuir: () => void;
  readOnly?: boolean;
}) {
  const atribuidosSet = new Set(atribuicoes.map(a => a.colaboradorId));
  const semPainel = colaboradoresAll.filter(c => !atribuidosSet.has(c.id));
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ColaboradorBasico | null>(null);
  const [agrupId, setAgrupId] = useState("");
  const [peso, setPeso] = useState("100");
  const [salvando, setSalvando] = useState(false);

  const filtrados = semPainel.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.matricula.includes(busca)
  );

  async function atribuir() {
    if (!modal || !agrupId) return;
    setSalvando(true);
    await fetch("/api/atribuicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId, colaboradorId: modal.id, agrupamentoId: Number(agrupId), pesoNaCesta: Number(peso) }),
    });
    setSalvando(false);
    setModal(null);
    setAgrupId("");
    setPeso("100");
    onAtribuir();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <UserX size={16} className="text-red-500" />
          <span className="text-sm font-semibold text-red-700">{semPainel.length} colaborador(es) sem painel</span>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Nome", "Matrícula", "Cargo", "Área", "Ação"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500 text-sm">
                  {semPainel.length === 0 ? "Todos os colaboradores têm painel atribuído 🎉" : "Nenhum resultado"}
                </td>
              </tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{c.nome}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.matricula}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{c.cargo}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.area?.nivel1 ?? "—"}</td>
                {!readOnly ? (
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setModal(c)}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={12} /> Atribuir
                    </button>
                  </td>
                ) : <td className="px-4 py-2.5" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <ModalWrapper title="Atribuir Painel" onClose={() => setModal(null)} size="md">
            <p className="text-sm text-gray-600">{modal.nome} · {modal.matricula}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Agrupamento</label>
                <select
                  value={agrupId}
                  onChange={e => setAgrupId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar agrupamento</option>
                  {agrupamentos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Peso na Cesta (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={peso}
                  onChange={e => setPeso(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button
                onClick={atribuir}
                disabled={salvando || !agrupId}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
              >
                {salvando ? "Salvando..." : "Atribuir"}
              </button>
            </div>
        </ModalWrapper>
      )}
    </div>
  );
}

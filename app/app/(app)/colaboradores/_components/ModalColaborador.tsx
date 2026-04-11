"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Colaborador, Area } from "./types";

export function ModalColaborador({ colab, cicloId, areas, onSave, onClose }: {
  colab: Colaborador | null; cicloId: number; areas: Area[]; onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    nome: colab?.nome ?? "", email: colab?.email ?? "", matricula: colab?.matricula ?? "",
    cargo: colab?.cargo ?? "", grade: colab?.grade ?? "",
    salarioBase: colab?.salarioBase?.toString() ?? "", target: colab?.target?.toString() ?? "",
    centroCusto: colab?.centroCusto ?? "", codEmpresa: colab?.codEmpresa ?? "",
    admissao: colab?.admissao ? colab.admissao.slice(0, 10) : "",
    areaId: colab?.areaId?.toString() ?? "", matriculaGestor: colab?.matriculaGestor ?? "",
    nomeGestor: colab?.nomeGestor ?? "", status: colab?.status ?? "ATIVO",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro("");
    const body = { ...(colab ? { id: colab.id } : { cicloId }), ...form,
      areaId: form.areaId ? Number(form.areaId) : null,
      salarioBase: Number(form.salarioBase), target: Number(form.target),
      admissao: form.admissao || null };
    const res = await fetch("/api/colaboradores", { method: colab ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao salvar"); setSalvando(false); return; }
    onSave(); onClose();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{colab ? "Editar Colaborador" : "Novo Colaborador"}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input required value={form.nome} onChange={set("nome")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Matrícula *</label>
              <input required value={form.matricula} onChange={set("matricula")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set("email")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Cargo *</label>
              <input required value={form.cargo} onChange={set("cargo")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <input value={form.grade} onChange={set("grade")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Salário Base *</label>
              <input required type="number" min="0" step="0.01" value={form.salarioBase} onChange={set("salarioBase")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Target (múltiplo) *</label>
              <input required type="number" min="0" step="0.01" value={form.target} onChange={set("target")} placeholder="ex: 1.5" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Área</label>
              <select value={form.areaId} onChange={set("areaId")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sem área</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nivel1}{a.nivel2 ? ` / ${a.nivel2}` : ""} ({a.centroCusto})</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Admissão</label>
              <input type="date" value={form.admissao} onChange={set("admissao")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Centro de Custo</label>
              <input value={form.centroCusto} onChange={set("centroCusto")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Cód. Empresa</label>
              <input value={form.codEmpresa} onChange={set("codEmpresa")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Matrícula Gestor</label>
              <input value={form.matriculaGestor} onChange={set("matriculaGestor")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome Gestor</label>
              <input value={form.nomeGestor} onChange={set("nomeGestor")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={set("status")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option><option value="AFASTADO">Afastado</option>
              </select></div>
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

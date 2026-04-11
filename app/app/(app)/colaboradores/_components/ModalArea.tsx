"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Area } from "./types";

export function ModalArea({ area, cicloId, onSave, onClose }: {
  area: Area | null; cicloId: number; onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    centroCusto: area?.centroCusto ?? "", codEmpresa: area?.codEmpresa ?? "",
    nivel1: area?.nivel1 ?? "", nivel2: area?.nivel2 ?? "", nivel3: area?.nivel3 ?? "",
    nivel4: area?.nivel4 ?? "", nivel5: area?.nivel5 ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro("");
    const method = area ? "PUT" : "POST";
    const body = area ? { id: area.id, ...form } : { cicloId, ...form };
    const res = await fetch("/api/areas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setErro("Erro ao salvar"); setSalvando(false); return; }
    onSave(); onClose();
  }

  const campo = (label: string, key: keyof typeof form, obrigatorio = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{obrigatorio && " *"}</label>
      <input required={obrigatorio} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{area ? "Editar Área" : "Nova Área"}</h3>
          <button onClick={onClose} aria-label="Fechar"><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {campo("Centro de Custo", "centroCusto", true)}
            {campo("Cód. Empresa", "codEmpresa", true)}
            {campo("Nível 1", "nivel1", true)}
            {campo("Nível 2", "nivel2")}
            {campo("Nível 3", "nivel3")}
            {campo("Nível 4", "nivel4")}
            {campo("Nível 5", "nivel5")}
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

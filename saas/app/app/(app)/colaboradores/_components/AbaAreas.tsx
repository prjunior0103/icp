"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Download, Upload, Pencil, Trash2, Building2 } from "lucide-react";
import { useConfirm } from "@/app/components/ConfirmModal";
import type { Area } from "./types";
import { ModalArea } from "./ModalArea";
import { ModalImport } from "./ModalImport";

export function AbaAreas({ cicloId }: { cicloId: number }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [modalArea, setModalArea] = useState<Area | null | "new">(null);
  const [modalImport, setModalImport] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const confirm = useConfirm();

  const carregar = useCallback(() => {
    fetch(`/api/areas?cicloId=${cicloId}`).then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
  }, [cicloId]);

  useEffect(() => { carregar(); }, [carregar]);

  function excluir(id: number) {
    confirm.request("Excluir esta área?", async () => {
      setExcluindo(id);
      await fetch(`/api/areas?id=${id}`, { method: "DELETE" });
      setExcluindo(null);
      carregar();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }

  function baixarTemplate() {
    window.location.href = "/api/areas/template";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <button onClick={baixarTemplate} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Download size={15} /> Template
        </button>
        <button onClick={() => setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Upload size={15} /> Importar
        </button>
        <button onClick={() => setModalArea("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg">
          <Plus size={15} /> Nova Área
        </button>
      </div>

      {areas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
          <Building2 size={36} className="mx-auto mb-2 text-gray-300" />
          Nenhuma área cadastrada neste ciclo
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Centro Custo", "Cód. Empresa", "Nível 1", "Nível 2", "Nível 3", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{a.centroCusto}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.codEmpresa}</td>
                  <td className="px-4 py-2.5 text-gray-700">{a.nivel1}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.nivel2 ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.nivel3 ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModalArea(a)} aria-label="Editar área" className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                      <button onClick={() => excluir(a.id)} disabled={excluindo === a.id} aria-label="Excluir área" className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalArea !== null && (
        <ModalArea
          area={modalArea === "new" ? null : modalArea}
          cicloId={cicloId}
          onSave={carregar}
          onClose={() => setModalArea(null)}
        />
      )}
      {modalImport && (
        <ModalImport tipo="areas" cicloId={cicloId} onDone={carregar} onClose={() => setModalImport(false)} />
      )}
      {confirm.modal}
    </div>
  );
}

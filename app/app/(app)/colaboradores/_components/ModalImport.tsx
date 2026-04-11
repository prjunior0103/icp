"use client";

import { useState } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { ModalWrapper } from "@/app/components/ModalWrapper";

export function ModalImport({ tipo, cicloId, onDone, onClose }: {
  tipo: "colaboradores" | "areas"; cicloId: number; onDone: () => void; onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ criados: number; erros: string[] } | null>(null);

  async function importar() {
    if (!file) return;
    setEnviando(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("cicloId", String(cicloId));
    const res = await fetch(`/api/${tipo}/import`, { method: "POST", body: fd });
    const data = await res.json();
    setResultado(data); setEnviando(false);
    if (data.criados > 0) onDone();
  }

  return (
    <ModalWrapper title={`Importar ${tipo === "areas" ? "Áreas" : "Colaboradores"}`} onClose={onClose} size="md">
        {!resultado ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">Selecione o arquivo .xlsx</p>
              <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-600" />
            </div>
            {file && <p className="text-xs text-gray-500">Arquivo: {file.name}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={importar} disabled={!file || enviando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
                {enviando ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle2 size={18} /><span className="text-sm font-medium">{resultado.criados} registro(s) importado(s)</span>
            </div>
            {resultado.erros.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-red-700 text-sm font-medium mb-1"><AlertCircle size={15} />{resultado.erros.length} erro(s):</div>
                {resultado.erros.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg">Fechar</button>
          </div>
        )}
    </ModalWrapper>
  );
}

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Indicador, Agrupamento } from "./types";
import { ModalWrapper } from "@/app/components/ModalWrapper";

export function ModalAgrupamento({ ag, cicloId, indicadores, onSave, onClose }: {
  ag: Agrupamento | null; cicloId: number; indicadores: Indicador[]; onSave: () => void; onClose: () => void;
}) {
  const [nome, setNome] = useState(ag?.nome ?? "");
  const [tipo, setTipo] = useState(ag?.tipo ?? "CORPORATIVO");
  const [selecionados, setSelecionados] = useState<{indicadorId:number;peso:number}[]>(ag?.indicadores.map(i => ({indicadorId:i.indicadorId,peso:i.peso})) ?? []);
  const [salvando, setSalvando] = useState(false);

  function toggleInd(id: number) {
    setSelecionados(s => s.find(x => x.indicadorId===id) ? s.filter(x => x.indicadorId!==id) : [...s,{indicadorId:id,peso:0}]);
  }
  function setPeso(id: number, v: string) {
    setSelecionados(s => s.map(x => x.indicadorId===id ? {...x,peso:Number(v)} : x));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true);
    const body = ag ? { id: ag.id, nome, tipo, indicadores: selecionados } : { cicloId, nome, tipo };
    const res = await fetch("/api/agrupamentos", { method: ag ? "PUT" : "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (!res.ok) { setSalvando(false); return; }
    if (!ag) {
      // set indicadores no novo agrupamento
      const d = await res.json();
      if (selecionados.length > 0) await fetch("/api/agrupamentos", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id:d.agrupamento.id,nome,tipo,indicadores:selecionados}) });
    }
    onSave(); onClose();
  }

  return (
    <ModalWrapper title={ag ? "Editar Agrupamento" : "Novo Agrupamento"} onClose={onClose} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input required value={nome} onChange={e=>setNome(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="CORPORATIVO">Corporativo</option><option value="AREA">Área</option></select></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">Indicadores e pesos</p>
              {(() => {
                const total = selecionados.reduce((s,x)=>s+x.peso,0);
                const cor = Math.abs(total-100)<0.01 ? "text-green-600 bg-green-50" : total>100 ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50";
                return selecionados.length>0 ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`}>Total: {total.toFixed(2)}%</span> : null;
              })()}
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {indicadores.map(ind => {
                const sel = selecionados.find(x => x.indicadorId===ind.id);
                return (
                  <div key={ind.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={!!sel} onChange={()=>toggleInd(ind.id)} className="rounded"/>
                    <span className="flex-1 text-sm text-gray-700">{ind.codigo} — {ind.nome}</span>
                    {sel && <input type="number" min="0" max="100" step="0.01" value={sel.peso} onChange={e=>setPeso(ind.id,e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="%"/>}
                  </div>
                );
              })}
              {indicadores.length===0 && <p className="text-xs text-gray-500 p-2">Nenhum indicador cadastrado</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando?"Salvando...":"Salvar"}</button>
          </div>
        </form>
    </ModalWrapper>
  );
}

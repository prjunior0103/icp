"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Indicador, FaixaIndicador, Colaborador } from "./types";
import { ModalWrapper } from "@/app/components/ModalWrapper";
import { TIPOS, ABRANGENCIA, PERIODICIDADE, CRITERIO, UNIDADES } from "./types";

export function ModalIndicador({ ind, cicloId, colaboradores, todosIndicadores, onSave, onClose }: {
  ind: Indicador | null; cicloId: number; colaboradores: Colaborador[];
  todosIndicadores: Indicador[]; onSave: () => void; onClose: () => void;
}) {
  const empty = { codigo:"", nome:"", tipo:"MAIOR_MELHOR", abrangencia:"CORPORATIVO", unidade:"%", metaMinima:"", metaAlvo:"", metaMaxima:"", baseline:"", metrica:"", piso:"", teto:"", gatilho:"", bonusMetaZero:"", periodicidade:"MENSAL", criterioApuracao:"ULTIMA_POSICAO", origemDado:"", analistaResp:"", numeradorId:"", divisorId:"", statusJanela:"FECHADA", status:"DRAFT", descricao:"" };
  const [form, setForm] = useState(ind ? { ...empty, ...Object.fromEntries(Object.entries(ind).map(([k,v]) => [k, v == null ? "" : String(v)])) } : empty);
  const [faixas, setFaixas] = useState<FaixaIndicador[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f => ({...f,[k]:e.target.value}));

  useEffect(() => {
    if (ind?.id) {
      fetch(`/api/faixas?indicadorId=${ind.id}`).then(r=>r.json()).then(d=>setFaixas(d.faixas??[]));
    }
  }, [ind?.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro("");
    const body = ind ? { id: ind.id, ...form } : { cicloId, ...form };
    const res = await fetch("/api/indicadores", { method: ind ? "PUT" : "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro"); setSalvando(false); return; }
    const { indicador: saved } = await res.json();
    // Salvar faixas se houver
    if (faixas.length > 0) {
      await fetch("/api/faixas", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(faixas.map(f => ({ indicadorId: saved.id, de: f.de, ate: f.ate, nota: f.nota }))) });
    } else if (ind?.id) {
      await fetch(`/api/faixas?indicadorId=${ind.id}`, { method:"DELETE" });
    }
    onSave(); onClose();
  }

  function addFaixa() { setFaixas(f => [...f, { de: 0, ate: 0, nota: 0 }]); }
  function removeFaixa(i: number) { setFaixas(f => f.filter((_,idx) => idx!==i)); }
  function setFaixa(i: number, k: keyof FaixaIndicador, v: string) {
    setFaixas(f => f.map((fx,idx) => idx===i ? {...fx,[k]:Number(v)} : fx));
  }

  const input = (label: string, k: string, type="text", req=false) => (
    <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}{req?" *":""}</label>
    <input required={req} type={type} value={form[k as keyof typeof form]} onChange={set(k)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
  );
  const sel = (label: string, k: string, opts: string[]) => (
    <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <select value={form[k as keyof typeof form]} onChange={set(k)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      {opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
  );
  const outrosInds = todosIndicadores.filter(i => i.id !== ind?.id);

  return (
    <ModalWrapper title={ind ? "Editar Indicador" : "Novo Indicador"} onClose={onClose} size="lg">
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {ind && (
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
              <input readOnly value={form.codigo} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-500 cursor-default"/></div>
            )}
            {input("Nome","nome",undefined,true)}
            {sel("Tipo","tipo",TIPOS)}
            {sel("Abrangência","abrangencia",ABRANGENCIA)}
            {sel("Unidade","unidade",UNIDADES)}
            {input("Métrica","metrica")}
            {input("Meta Mínima","metaMinima","number")}
            {input("Meta Alvo","metaAlvo","number")}
            {input("Meta Máxima","metaMaxima","number")}
            {input("Baseline","baseline","number")}
            {sel("Periodicidade","periodicidade",PERIODICIDADE)}
            {sel("Critério Apuração","criterioApuracao",CRITERIO)}
            {input("Origem do Dado","origemDado")}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Analista Resp.</label>
              <input list="analista-list" value={form.analistaResp} onChange={set("analistaResp")} placeholder="Pesquisar colaborador..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <datalist id="analista-list">{colaboradores.map(c => <option key={c.id} value={c.nome}>{c.matricula} — {c.nome}</option>)}</datalist>
            </div>
            {sel("Janela","statusJanela",["ABERTA","FECHADA","PRORROGADA"])}
            {sel("Status","status",["DRAFT","ATIVO"])}
          </div>

          {/* Parâmetros de Cálculo */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Parâmetros de Cálculo</p>
            <p className="text-xs text-gray-500">Fórmula: 1 + P × (Realizado − Meta) / |Meta|. Deixe em branco para usar os defaults (piso=0%, teto=150%, sem gatilho, bônus meta zero=100%).</p>
            <div className="grid grid-cols-2 gap-3">
              {input("Piso (decimal, ex: 0.0)","piso","number")}
              {input("Teto (decimal, ex: 1.5)","teto","number")}
              {input("Gatilho (decimal, ex: 0.8)","gatilho","number")}
              {input("Bônus meta zero (decimal, ex: 1.0)","bonusMetaZero","number")}
            </div>
          </div>

          {/* Indicador Composto */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Indicador Composto (opcional)</p>
            <p className="text-xs text-gray-500">Se preenchido, valor = Numerador ÷ Divisor</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Numerador</label>
              <select value={form.numeradorId} onChange={set("numeradorId")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nenhum —</option>
                {outrosInds.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>)}
              </select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Divisor</label>
              <select value={form.divisorId} onChange={set("divisorId")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Nenhum —</option>
                {outrosInds.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>)}
              </select></div>
            </div>
          </div>

          {/* Faixas de Atingimento */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600">Faixas de Atingimento (opcional)</p>
              <button type="button" onClick={addFaixa} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/>Adicionar faixa</button>
            </div>
            {faixas.length > 0 && (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-1 text-xs text-gray-500 font-medium px-1">
                  <span>De (%)</span><span>Até (%)</span><span>Nota</span><span></span>
                </div>
                {faixas.map((f,i) => (
                  <div key={i} className="grid grid-cols-4 gap-1 items-center">
                    <input type="number" value={f.de} onChange={e=>setFaixa(i,"de",e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    <input type="number" value={f.ate} onChange={e=>setFaixa(i,"ate",e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    <input type="number" value={f.nota} onChange={e=>setFaixa(i,"nota",e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                    <button type="button" onClick={()=>removeFaixa(i)} className="text-red-400 hover:text-red-600 text-xs flex justify-center"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            )}
            {faixas.length === 0 && <p className="text-xs text-gray-500">Sem faixas — usa cálculo linear</p>}
          </div>

          <div><label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
          <textarea value={form.descricao} onChange={set("descricao")} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando?"Salvando...":"Salvar"}</button>
          </div>
        </form>
    </ModalWrapper>
  );
}

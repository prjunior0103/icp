"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Pencil, Trash2, Upload, Download, Search, Target, BarChart3, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCiclo } from "@/app/lib/ciclo-context";

// ─── Types ────────────────────────────────────────────────
interface Indicador { id: number; cicloId: number; codigo: string; nome: string; tipo: string; abrangencia: string; unidade: string; metaMinima?: number | null; metaAlvo?: number | null; metaMaxima?: number | null; baseline?: number | null; metrica?: string | null; periodicidade: string; criterioApuracao: string; origemDado?: string | null; analistaResp?: string | null; numeradorId?: number | null; divisorId?: number | null; statusJanela: string; status: string; descricao?: string | null; }
interface FaixaIndicador { id?: number; de: number; ate: number; nota: number; }
interface IndicadorNoGrupo { id: number; indicadorId: number; peso: number; indicador: Indicador; }
interface Agrupamento { id: number; cicloId: number; nome: string; tipo: string; descricao?: string | null; indicadores: IndicadorNoGrupo[]; }
interface Colaborador { id: number; nome: string; matricula: string; }
interface Atribuicao { id: number; colaboradorId: number; agrupamentoId: number; pesoNaCesta: number; cascata: string; colaborador: Colaborador; agrupamento: Agrupamento; }

const TIPOS = ["MAIOR_MELHOR","MENOR_MELHOR","PROJETO_MARCO"];
const ABRANGENCIA = ["CORPORATIVO","AREA","INDIVIDUAL"];
const PERIODICIDADE = ["MENSAL","TRIMESTRAL","SEMESTRAL","ANUAL"];
const CRITERIO = ["SOMA","MEDIA","ULTIMA_POSICAO"];
const STATUS_JANELA_COLOR: Record<string,string> = { ABERTA:"bg-green-100 text-green-700", FECHADA:"bg-gray-100 text-gray-500", PRORROGADA:"bg-yellow-100 text-yellow-700" };

// ─── Modal Indicador ──────────────────────────────────────
function ModalIndicador({ ind, cicloId, colaboradores, todosIndicadores, onSave, onClose }: {
  ind: Indicador | null; cicloId: number; colaboradores: Colaborador[];
  todosIndicadores: Indicador[]; onSave: () => void; onClose: () => void;
}) {
  const empty = { codigo:"", nome:"", tipo:"MAIOR_MELHOR", abrangencia:"CORPORATIVO", unidade:"%", metaMinima:"", metaAlvo:"", metaMaxima:"", baseline:"", metrica:"", periodicidade:"MENSAL", criterioApuracao:"ULTIMA_POSICAO", origemDado:"", analistaResp:"", numeradorId:"", divisorId:"", statusJanela:"FECHADA", status:"DRAFT", descricao:"" };
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{ind ? "Editar Indicador" : "Novo Indicador"}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {ind && (
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
              <input readOnly value={form.codigo} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-500 cursor-default"/></div>
            )}
            {input("Nome","nome",undefined,true)}
            {sel("Tipo","tipo",TIPOS)}
            {sel("Abrangência","abrangencia",ABRANGENCIA)}
            {input("Unidade","unidade")}
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

          {/* Indicador Composto */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Indicador Composto (opcional)</p>
            <p className="text-xs text-gray-400">Se preenchido, valor = Numerador ÷ Divisor</p>
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
            {faixas.length === 0 && <p className="text-xs text-gray-400">Sem faixas — usa cálculo linear</p>}
          </div>

          <div><label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
          <textarea value={form.descricao} onChange={set("descricao")} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando?"Salvando...":"Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Agrupamento ────────────────────────────────────
function ModalAgrupamento({ ag, cicloId, indicadores, onSave, onClose }: { ag: Agrupamento | null; cicloId: number; indicadores: Indicador[]; onSave: () => void; onClose: () => void; }) {
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{ag?"Editar Agrupamento":"Novo Agrupamento"}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
        </div>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input required value={nome} onChange={e=>setNome(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={tipo} onChange={e=>setTipo(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="CORPORATIVO">Corporativo</option><option value="AREA">Área</option></select></div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Indicadores e pesos</p>
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {indicadores.map(ind => {
                const sel = selecionados.find(x => x.indicadorId===ind.id);
                return (
                  <div key={ind.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={!!sel} onChange={()=>toggleInd(ind.id)} className="rounded"/>
                    <span className="flex-1 text-sm text-gray-700">{ind.codigo} — {ind.nome}</span>
                    {sel && <input type="number" min="0" max="100" value={sel.peso} onChange={e=>setPeso(ind.id,e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs" placeholder="%"/>}
                  </div>
                );
              })}
              {indicadores.length===0 && <p className="text-xs text-gray-400 p-2">Nenhum indicador cadastrado</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando?"Salvando...":"Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Atribuição ─────────────────────────────────────
function ModalAtribuicao({ cicloId, agrupamentos, onSave, onClose }: { cicloId: number; agrupamentos: Agrupamento[]; onSave: () => void; onClose: () => void; }) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [form, setForm] = useState({ colaboradorId:"", agrupamentoId:"", pesoNaCesta:"", cascata:"NENHUM" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => { fetch(`/api/colaboradores?cicloId=${cicloId}`).then(r=>r.json()).then(d=>setColaboradores(d.colaboradores??[])); },[cicloId]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro("");
    const res = await fetch("/api/atribuicoes", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({...form, cicloId, colaboradorId:Number(form.colaboradorId), agrupamentoId:Number(form.agrupamentoId), pesoNaCesta:Number(form.pesoNaCesta)}) });
    if (!res.ok) { setErro("Erro ao atribuir"); setSalvando(false); return; }
    onSave(); onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Nova Atribuição</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Colaborador / Gestor *</label>
          <select required value={form.colaboradorId} onChange={e=>setForm(f=>({...f,colaboradorId:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecionar...</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.matricula})</option>)}
          </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Agrupamento *</label>
          <select required value={form.agrupamentoId} onChange={e=>{
            const ag = agrupamentos.find(a=>String(a.id)===e.target.value);
            const soma = ag ? ag.indicadores.reduce((s,i)=>s+i.peso,0) : 0;
            setForm(f=>({...f, agrupamentoId:e.target.value, pesoNaCesta: ag ? String(soma) : ""}));
          }} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Selecionar...</option>
            {agrupamentos.map(a => {
              const soma = a.indicadores.reduce((s,i)=>s+i.peso,0);
              return <option key={a.id} value={a.id}>{a.nome} ({a.tipo}) — {soma}%</option>;
            })}
          </select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Peso na Cesta (%)</label>
          <input readOnly type="number" value={form.pesoNaCesta} className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-sm text-gray-500 cursor-default"/></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Cascata</label>
          <select value={form.cascata} onChange={e=>setForm(f=>({...f,cascata:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="NENHUM">Nenhum (somente este)</option>
            <option value="DIRETOS">Diretos</option>
            <option value="DIRETOS_E_INDIRETOS">Diretos e Indiretos</option>
          </select></div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">{salvando?"Atribuindo...":"Atribuir"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Importação ─────────────────────────────────────
function ModalImport({ cicloId, onDone, onClose }: { cicloId: number; onDone: () => void; onClose: () => void; }) {
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Importar Indicadores</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400"/></button>
        </div>
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
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function MetasPage() {
  const { cicloAtivo } = useCiclo();
  const [aba, setAba] = useState<"indicadores"|"agrupamentos"|"atribuicoes">("indicadores");
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [agrupamentos, setAgrupamentos] = useState<Agrupamento[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [busca, setBusca] = useState("");
  const [modalInd, setModalInd] = useState<Indicador|null|"new">(null);
  const [modalAg, setModalAg] = useState<Agrupamento|null|"new">(null);
  const [modalAtrib, setModalAtrib] = useState(false);
  const [modalImport, setModalImport] = useState(false);

  const carregarInds = useCallback(() => {
    if (!cicloAtivo) return;
    fetch(`/api/indicadores?cicloId=${cicloAtivo.id}`).then(r=>r.json()).then(d=>setIndicadores(d.indicadores??[]));
  },[cicloAtivo?.id]);

  const carregarAgs = useCallback(() => {
    if (!cicloAtivo) return;
    fetch(`/api/agrupamentos?cicloId=${cicloAtivo.id}`).then(r=>r.json()).then(d=>setAgrupamentos(d.agrupamentos??[]));
  },[cicloAtivo?.id]);

  const carregarAtribs = useCallback(() => {
    if (!cicloAtivo) return;
    fetch(`/api/atribuicoes?cicloId=${cicloAtivo.id}`).then(r=>r.json()).then(d=>setAtribuicoes(d.atribuicoes??[]));
  },[cicloAtivo?.id]);

  useEffect(() => {
    carregarInds(); carregarAgs(); carregarAtribs();
    if (cicloAtivo) {
      fetch(`/api/colaboradores?cicloId=${cicloAtivo.id}`).then(r=>r.json()).then(d=>setColaboradores(d.colaboradores??[]));
    }
  },[carregarInds,carregarAgs,carregarAtribs,cicloAtivo?.id]);

  async function excluirInd(id: number) {
    if (!confirm("Excluir indicador?")) return;
    const res = await fetch(`/api/indicadores?id=${id}`,{method:"DELETE"});
    if (!res.ok) { const d = await res.json(); alert(d.error ?? "Erro ao excluir"); return; }
    carregarInds();
  }
  async function excluirAg(id: number) {
    if (!confirm("Excluir agrupamento?")) return;
    await fetch(`/api/agrupamentos?id=${id}`,{method:"DELETE"}); carregarAgs();
  }
  async function excluirAtrib(id: number) {
    if (!confirm("Remover atribuição?")) return;
    await fetch(`/api/atribuicoes?id=${id}`,{method:"DELETE"}); carregarAtribs();
  }

  if (!cicloAtivo) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Target size={40} className="mb-3 text-gray-300"/>
      <p className="font-medium">Selecione um ciclo no header para continuar</p>
    </div>
  );

  const indsFiltrados = indicadores.filter(i => !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.codigo.toLowerCase().includes(busca.toLowerCase()));

  // Validação soma por colaborador
  const somasPorColab: Record<number,number> = {};
  for (const a of atribuicoes) somasPorColab[a.colaboradorId] = (somasPorColab[a.colaboradorId]??0) + a.pesoNaCesta;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Metas</h1>
        <p className="text-gray-500 text-sm mt-1">Ciclo {cicloAtivo.anoFiscal} — {cicloAtivo.status}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([["indicadores","Indicadores",<Target size={14}/>],["agrupamentos","Agrupamentos",<BarChart3 size={14}/>],["atribuicoes","Atribuições",<Users size={14}/>]] as const).map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>setAba(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${aba===tab?"border-blue-600 text-blue-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── ABA INDICADORES ── */}
      {aba==="indicadores" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por código ou nome..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <button onClick={()=>window.location.href=`/api/indicadores/export?cicloId=${cicloAtivo.id}`} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Download size={15}/>Exportar</button>
            <button onClick={()=>window.location.href="/api/indicadores/template"} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Download size={15}/>Template</button>
            <button onClick={()=>setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Upload size={15}/>Importar</button>
            <button onClick={()=>setModalInd("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Novo</button>
          </div>
          {indsFiltrados.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400"><Target size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum indicador cadastrado</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{["Código","Nome","Tipo","Alvo","Janela","Status",""].map(h=><th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {indsFiltrados.map(i=>(
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{i.codigo}</td>
                      <td className="px-4 py-2.5"><p className="font-medium text-gray-800">{i.nome}</p>{i.metrica&&<p className="text-xs text-gray-400">{i.metrica}</p>}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{i.tipo}</td>
                      <td className="px-4 py-2.5 text-gray-700">{i.metaAlvo!=null?`${i.metaAlvo}${i.unidade}`:"—"}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_JANELA_COLOR[i.statusJanela]??""}`}>{i.statusJanela}</span></td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${i.status==="ATIVO"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{i.status}</span></td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 justify-end"><button onClick={()=>setModalInd(i)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14}/></button><button onClick={()=>excluirInd(i.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA AGRUPAMENTOS ── */}
      {aba==="agrupamentos" && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={()=>setModalAg("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Novo Agrupamento</button></div>
          {agrupamentos.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400"><BarChart3 size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum agrupamento cadastrado</div>
          ) : (
            <div className="space-y-3">
              {agrupamentos.map(ag=>(
                <div key={ag.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="font-semibold text-gray-800">{ag.nome}</p><span className="text-xs text-gray-400">{ag.tipo}</span></div>
                    <div className="flex gap-1"><button onClick={()=>setModalAg(ag)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14}/></button><button onClick={()=>excluirAg(ag.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button></div>
                  </div>
                  {ag.indicadores.length>0 ? (
                    <div className="flex flex-wrap gap-2">{ag.indicadores.map(i=><span key={i.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{i.indicador.codigo} — {i.peso}%</span>)}</div>
                  ) : <p className="text-xs text-gray-400">Nenhum indicador vinculado</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA ATRIBUIÇÕES ── */}
      {aba==="atribuicoes" && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={()=>setModalAtrib(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Nova Atribuição</button></div>
          {atribuicoes.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400"><Users size={36} className="mx-auto mb-2 text-gray-300"/>Nenhuma atribuição cadastrada</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{["Colaborador","Agrupamento","Peso","Cascata","Soma Total",""].map(h=><th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {atribuicoes.map(a=>{
                    const soma = somasPorColab[a.colaboradorId]??0;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5"><p className="font-medium text-gray-800">{a.colaborador.nome}</p><p className="text-xs text-gray-400">{a.colaborador.matricula}</p></td>
                        <td className="px-4 py-2.5 text-gray-700">{a.agrupamento.nome}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{a.pesoNaCesta}%</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.cascata}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${soma===100?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{soma}%</span></td>
                        <td className="px-4 py-2.5"><button onClick={()=>excluirAtrib(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalInd!==null && <ModalIndicador ind={modalInd==="new"?null:modalInd} cicloId={cicloAtivo.id} colaboradores={colaboradores} todosIndicadores={indicadores} onSave={carregarInds} onClose={()=>setModalInd(null)}/>}
      {modalAg!==null && <ModalAgrupamento ag={modalAg==="new"?null:modalAg} cicloId={cicloAtivo.id} indicadores={indicadores} onSave={carregarAgs} onClose={()=>setModalAg(null)}/>}
      {modalAtrib && <ModalAtribuicao cicloId={cicloAtivo.id} agrupamentos={agrupamentos} onSave={carregarAtribs} onClose={()=>setModalAtrib(false)}/>}
      {modalImport && <ModalImport cicloId={cicloAtivo.id} onDone={carregarInds} onClose={()=>setModalImport(false)}/>}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Upload, Download, Target, BarChart3, Users } from "lucide-react";
import { useCiclo } from "@/app/lib/ciclo-context";
import { HierarchicalAreaFilter, EMPTY_FILTERS, matchesAreaFilter, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";
import { fmtValor } from "@/app/lib/format";
import { useConfirm } from "@/app/components/ConfirmModal";
import { SearchInput } from "@/app/components/SearchInput";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";
import { ModalIndicador } from "./_components/ModalIndicador";
import { ModalAgrupamento } from "./_components/ModalAgrupamento";
import { ModalAtribuicao, ModalImport } from "./_components/ModalAtribuicao";
import { AbaFormulas } from "./_components/AbaFormulas";
import type { Indicador, Agrupamento, Colaborador, Atribuicao } from "./_components/types";
import { STATUS_JANELA_COLOR } from "./_components/types";

export default function MetasPage() {
  const { cicloAtivo } = useCiclo();
  const confirm = useConfirm();
  const abortRef = useRef<AbortController | null>(null);
  const [aba, setAba] = useState<"indicadores"|"agrupamentos"|"atribuicoes"|"formulas">("indicadores");
  const [loading, setLoading] = useState(false);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [agrupamentos, setAgrupamentos] = useState<Agrupamento[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<{id:number;nivel1:string;nivel2?:string|null;nivel3?:string|null;nivel4?:string|null;nivel5?:string|null;centroCusto:string}[]>([]);
  const [busca, setBusca] = useState("");
  const [modalInd, setModalInd] = useState<Indicador|null|"new">(null);
  const [modalAg, setModalAg] = useState<Agrupamento|null|"new">(null);
  const [modalAtrib, setModalAtrib] = useState<Atribuicao | null | "new">(null);
  const [modalImport, setModalImport] = useState(false);
  const [selAtribs, setSelAtribs] = useState<Set<number>>(new Set());
  const [excluindoAtribs, setExcluindoAtribs] = useState(false);
  const [atribuindoAg, setAtribuindoAg] = useState<Set<number>>(new Set());
  const [filtroAreaAtrib, setFiltroAreaAtrib] = useState<AreaFilters>(EMPTY_FILTERS);
  const [toast, setToast] = useState<{ msg: string; tipo: "error" | "info" } | null>(null);
  function showToast(msg: string, tipo: "error" | "info" = "error") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  }

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
    if (!cicloAtivo) return;

    // Cancel any in-flight request from previous ciclo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    Promise.all([
      fetch(`/api/indicadores?cicloId=${cicloAtivo.id}`, { signal }).then(r=>r.json()).then(d=>setIndicadores(d.indicadores??[])),
      fetch(`/api/agrupamentos?cicloId=${cicloAtivo.id}`, { signal }).then(r=>r.json()).then(d=>setAgrupamentos(d.agrupamentos??[])),
      fetch(`/api/atribuicoes?cicloId=${cicloAtivo.id}`, { signal }).then(r=>r.json()).then(d=>setAtribuicoes(d.atribuicoes??[])),
      fetch(`/api/colaboradores?cicloId=${cicloAtivo.id}`, { signal }).then(r=>r.json()).then(d=>setColaboradores(d.colaboradores??[])),
      fetch(`/api/areas?cicloId=${cicloAtivo.id}`, { signal }).then(r=>r.json()).then(d=>setAreas(d.areas??[])),
    ]).catch(err => {
      if (err.name !== "AbortError") console.error(err);
    }).finally(() => setLoading(false));

    return () => controller.abort();
  },[cicloAtivo?.id]);

  function excluirInd(id: number) {
    confirm.request("Excluir indicador?", async () => {
      const res = await fetch(`/api/indicadores?id=${id}`,{method:"DELETE"});
      if (!res.ok) { const d = await res.json(); showToast(d.error ?? "Erro ao excluir"); return; }
      carregarInds();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }
  function excluirAg(id: number) {
    confirm.request("Excluir agrupamento?", async () => {
      await fetch(`/api/agrupamentos?id=${id}`,{method:"DELETE"}); carregarAgs();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }
  function excluirAtrib(id: number) {
    confirm.request("Remover atribuição?", async () => {
      await fetch(`/api/atribuicoes?id=${id}`,{method:"DELETE"}); carregarAtribs();
    }, { confirmLabel: "Remover", variant: "danger" });
  }
  function atribuirATodos(ag: Agrupamento) {
    if (colaboradores.length === 0) { showToast("Nenhum colaborador neste ciclo.", "info"); return; }
    const peso = Math.round(ag.indicadores.reduce((s, i) => s + i.peso, 0) * 100) / 100;
    confirm.request(
      `Atribuir "${ag.nome}" a ${colaboradores.length} colaborador(es) com peso ${peso}%?`,
      async () => {
        setAtribuindoAg(s => new Set(s).add(ag.id));
        const cid = cicloAtivo!.id;
        await Promise.all(
          colaboradores.map(c =>
            fetch("/api/atribuicoes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cicloId: cid, colaboradorId: c.id, agrupamentoId: ag.id, pesoNaCesta: peso, cascata: "NENHUM" }),
            })
          )
        );
        setAtribuindoAg(s => { const n = new Set(s); n.delete(ag.id); return n; });
        carregarAtribs();
      },
      { confirmLabel: "Atribuir", variant: "primary" }
    );
  }

  function excluirAtribsMassa() {
    confirm.request(`Excluir ${selAtribs.size} atribuição(ões)?`, async () => {
      setExcluindoAtribs(true);
      await Promise.all([...selAtribs].map(id => fetch(`/api/atribuicoes?id=${id}`,{method:"DELETE"})));
      setSelAtribs(new Set()); setExcluindoAtribs(false); carregarAtribs();
    }, { confirmLabel: "Excluir", variant: "danger" });
  }
  function toggleSelAtrib(id: number) {
    setSelAtribs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (!cicloAtivo) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
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
        {([["indicadores","Indicadores",<Target size={14}/>],["agrupamentos","Agrupamentos",<BarChart3 size={14}/>],["atribuicoes","Atribuições",<Users size={14}/>],["formulas","Fórmulas",<Target size={14}/>]] as const).map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>setAba(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${aba===tab?"border-blue-600 text-blue-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {loading && (
        <LoadingSpinner text="Carregando..." />
      )}

      {/* ── ABA INDICADORES ── */}
      {!loading && aba==="indicadores" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por código ou nome..."
              className="flex-1"
            />
            <button onClick={()=>window.location.href=`/api/indicadores/export?cicloId=${cicloAtivo.id}`} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Download size={15}/>Exportar</button>
            <button onClick={()=>window.location.href="/api/indicadores/template"} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Download size={15}/>Template</button>
            <button onClick={()=>setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50"><Upload size={15}/>Importar</button>
            <button onClick={()=>setModalInd("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Novo</button>
          </div>
          {indsFiltrados.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500"><Target size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum indicador cadastrado</div>
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
                      <td className="px-4 py-2.5"><p className="font-medium text-gray-800">{i.nome}</p>{i.metrica&&<p className="text-xs text-gray-500">{i.metrica}</p>}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{i.tipo}</td>
                      <td className="px-4 py-2.5 text-gray-700">{fmtValor(i.metaAlvo, i.unidade)}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_JANELA_COLOR[i.statusJanela]??""}`}>{i.statusJanela}</span></td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${i.status==="ATIVO"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{i.status}</span></td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 justify-end"><button onClick={()=>setModalInd(i)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14}/></button><button onClick={()=>excluirInd(i.id)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA AGRUPAMENTOS ── */}
      {!loading && aba==="agrupamentos" && (
        <div className="space-y-4">
          <div className="flex justify-end"><button onClick={()=>setModalAg("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Novo Agrupamento</button></div>
          {agrupamentos.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500"><BarChart3 size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum agrupamento cadastrado</div>
          ) : (
            <div className="space-y-3">
              {agrupamentos.map(ag=>(
                <div key={ag.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{ag.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{ag.tipo}</span>
                        {ag.indicadores.length>0 && (() => {
                          const total = ag.indicadores.reduce((s,i)=>s+i.peso,0);
                          const cor = Math.abs(total-100)<0.01 ? "text-green-600 bg-green-50" : total>100 ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50";
                          return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cor}`}>Total: {total.toFixed(2)}%</span>;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>atribuirATodos(ag)} disabled={atribuindoAg.has(ag.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-50 rounded">
                        <Users size={12}/>{atribuindoAg.has(ag.id) ? "Atribuindo..." : "Atribuir a Todos"}
                      </button>
                      <button onClick={()=>setModalAg(ag)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14}/></button>
                      <button onClick={()=>excluirAg(ag.id)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  {ag.indicadores.length>0 ? (
                    <div className="flex flex-wrap gap-2">{ag.indicadores.map(i=><span key={i.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{i.indicador.codigo} — {i.peso}%</span>)}</div>
                  ) : <p className="text-xs text-gray-500">Nenhum indicador vinculado</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA ATRIBUIÇÕES ── */}
      {!loading && aba==="atribuicoes" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HierarchicalAreaFilter areas={areas} value={filtroAreaAtrib} onChange={setFiltroAreaAtrib} />
            <div className="flex-1"/>
            {selAtribs.size > 0 && (
              <button onClick={excluirAtribsMassa} disabled={excluindoAtribs}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm px-3 py-2 rounded-lg">
                <Trash2 size={15}/>{excluindoAtribs ? "Excluindo..." : `Excluir ${selAtribs.size}`}
              </button>
            )}
            <button onClick={()=>setModalAtrib("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg"><Plus size={15}/>Nova Atribuição</button>
          </div>
          {atribuicoes.length===0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500"><Users size={36} className="mx-auto mb-2 text-gray-300"/>Nenhuma atribuição cadastrada</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5"><input type="checkbox" aria-label="Selecionar todos" className="rounded"
                      checked={selAtribs.size===atribuicoes.length && atribuicoes.length>0}
                      onChange={()=>setSelAtribs(s=>s.size===atribuicoes.length?new Set():new Set(atribuicoes.map(a=>a.id)))}/></th>
                    {["Colaborador","Agrupamento","Peso","Cascata","Soma Total",""].map(h=><th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {atribuicoes.filter(a => {
                    return matchesAreaFilter(a.colaborador, filtroAreaAtrib, areas);
                  }).map(a=>{
                    const soma = somasPorColab[a.colaboradorId]??0;
                    return (
                      <tr key={a.id} className={`hover:bg-gray-50 ${selAtribs.has(a.id)?"bg-blue-50":""}`}>
                        <td className="px-4 py-2.5"><input type="checkbox" className="rounded" aria-label={`Selecionar ${a.colaborador.nome}`} checked={selAtribs.has(a.id)} onChange={()=>toggleSelAtrib(a.id)}/></td>
                        <td className="px-4 py-2.5"><p className="font-medium text-gray-800">{a.colaborador.nome}</p><p className="text-xs text-gray-500">{a.colaborador.matricula}</p></td>
                        <td className="px-4 py-2.5 text-gray-700">{a.agrupamento.nome}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{a.pesoNaCesta}%</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{a.cascata}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${soma===100?"bg-green-100 text-green-700":"bg-yellow-100 text-yellow-700"}`}>{soma}%</span></td>
                        <td className="px-4 py-2.5"><div className="flex gap-1"><button onClick={()=>setModalAtrib(a)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14}/></button><button onClick={()=>excluirAtrib(a.id)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && aba==="formulas" && <AbaFormulas indicadores={indicadores} todosIndicadores={indicadores}/>}
      {confirm.modal}

      {modalInd!==null && <ModalIndicador ind={modalInd==="new"?null:modalInd} cicloId={cicloAtivo.id} colaboradores={colaboradores} todosIndicadores={indicadores} onSave={carregarInds} onClose={()=>setModalInd(null)}/>}
      {modalAg!==null && <ModalAgrupamento ag={modalAg==="new"?null:modalAg} cicloId={cicloAtivo.id} indicadores={indicadores} onSave={carregarAgs} onClose={()=>setModalAg(null)}/>}
      {modalAtrib!==null && <ModalAtribuicao cicloId={cicloAtivo.id} agrupamentos={agrupamentos} atrib={modalAtrib==="new"?null:modalAtrib} colaboradores={colaboradores} areas={areas} onSave={carregarAtribs} onClose={()=>setModalAtrib(null)}/>}
      {modalImport && <ModalImport cicloId={cicloAtivo.id} onDone={carregarInds} onClose={()=>setModalImport(false)}/>}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-opacity ${
          toast.tipo === "error" ? "bg-red-600 text-white" : "bg-gray-800 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

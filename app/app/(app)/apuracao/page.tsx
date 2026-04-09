"use client";

import { useState, useEffect, useCallback } from "react";
import { useCiclo } from "@/app/lib/ciclo-context";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import { ClipboardList, BarChart3, Search, Save, ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────
interface Indicador {
  id: number; codigo: string; nome: string; tipo: string; unidade: string;
  metaMinima?: number | null; metaAlvo?: number | null; metaMaxima?: number | null;
  periodicidade: string; criterioApuracao: string;
  numeradorId?: number | null; divisorId?: number | null;
  faixas?: { de: number; ate: number; nota: number }[];
}
interface Realizacao { id: number; indicadorId: number; periodo: string; valorRealizado: number; }
interface MetaPeriodo { id: number; indicadorId: number; periodo: string; valorOrcado: number; }
interface IndicadorNoGrupo { indicadorId: number; peso: number; indicador: Indicador; }
interface Agrupamento { id: number; nome: string; tipo: string; indicadores: IndicadorNoGrupo[]; }
interface Colaborador { id: number; nome: string; matricula: string; cargo: string; salarioBase: number; target: number; gestorId?: number | null; area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null; }
interface Atribuicao { colaboradorId: number; agrupamentoId: number; pesoNaCesta: number; colaborador: Colaborador; agrupamento: Agrupamento; }

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function labelPeriodo(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MESES[parseInt(m[2])-1]}/${m[1]}`;
  return p;
}

/** Resolve qual período do indicador corresponde ao mês p */
function periodoDeInd(ind: Indicador, p: string, anoFiscal: number): string | null {
  const periodos = gerarPeriodos(anoFiscal, 1, 12, ind.periodicidade);
  return periodos.find(pi => {
    if (ind.periodicidade === "MENSAL") return pi === p;
    if (ind.periodicidade === "TRIMESTRAL") {
      const mn = parseInt(p.split("-")[1]);
      return pi === `${anoFiscal}-T${Math.ceil(mn / 3)}`;
    }
    if (ind.periodicidade === "SEMESTRAL") {
      const mn = parseInt(p.split("-")[1]);
      return pi === `${anoFiscal}-S${mn <= 6 ? 1 : 2}`;
    }
    return pi === `${anoFiscal}`;
  }) ?? null;
}

// ─── Aba Preenchimento ────────────────────────────────────
function AbaPreenchimento({ cicloId, anoFiscal, mesInicio, mesFim, indicadores, realizacoes, metasPeriodo, onSaved }:
  { cicloId: number; anoFiscal: number; mesInicio: number; mesFim: number;
    indicadores: Indicador[]; realizacoes: Realizacao[]; metasPeriodo: MetaPeriodo[]; onSaved: () => void }) {
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string|null>(null);
  const [draft, setDraft] = useState<Record<string,string>>({});
  const [draftOrc, setDraftOrc] = useState<Record<string,string>>({});

  useEffect(() => {
    const init: Record<string,string> = {};
    for (const r of realizacoes) init[`${r.indicadorId}_${r.periodo}`] = String(r.valorRealizado);
    setDraft(init);
  }, [realizacoes]);

  useEffect(() => {
    const init: Record<string,string> = {};
    for (const m of metasPeriodo) init[`${m.indicadorId}_${m.periodo}`] = String(m.valorOrcado);
    setDraftOrc(init);
  }, [metasPeriodo]);

  async function salvarReal(indicadorId: number, periodo: string) {
    const key = `${indicadorId}_${periodo}`;
    const val = draft[key];
    if (val === "" || val == null) return;
    setSalvando(`real_${key}`);
    await fetch("/api/realizacoes", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ cicloId, indicadorId, periodo, valorRealizado: Number(val) }) });
    setSalvando(null);
    onSaved();
  }

  async function salvarOrc(indicadorId: number, periodo: string) {
    const key = `${indicadorId}_${periodo}`;
    const val = draftOrc[key];
    if (val === "" || val == null) return;
    setSalvando(`orc_${key}`);
    await fetch("/api/meta-periodos", { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ cicloId, indicadorId, periodo, valorOrcado: Number(val) }) });
    setSalvando(null);
    onSaved();
  }

  const mesesCiclo = gerarPeriodos(anoFiscal, mesInicio, mesFim, "MENSAL");

  const inds = indicadores.filter(i =>
    !i.numeradorId && !i.divisorId &&
    (!busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.codigo.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar indicador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
      </div>

      {inds.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum indicador encontrado
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase" rowSpan={2}>Indicador</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase" rowSpan={2}>Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase" rowSpan={2}>Nota</th>
                {mesesCiclo.map(p => (
                  <th key={p} className="text-center px-2 py-2 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-l border-gray-200" colSpan={1}>
                    {labelPeriodo(p)}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200">
                {mesesCiclo.map(p => (
                  <td key={p} className="border-l border-gray-200 px-1 py-1">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-center font-semibold text-orange-600 bg-orange-50 rounded px-1">Orçado</span>
                      <span className="text-[9px] text-center font-semibold text-blue-600 bg-blue-50 rounded px-1">Realizado</span>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {inds.map((ind, idx) => {
                const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
                // Nota usando orçado como alvo quando disponível
                const valsReal = periodos.map(p => {
                  const k = `${ind.id}_${p}`;
                  return draft[k] !== undefined ? Number(draft[k]) : null;
                }).filter((v): v is number => v !== null);
                const valsOrc = periodos.map(p => {
                  const k = `${ind.id}_${p}`;
                  return draftOrc[k] !== undefined ? Number(draftOrc[k]) : null;
                }).filter((v): v is number => v !== null);
                const realAgregado = agregarRealizacoes(valsReal, ind.criterioApuracao);
                const orcAgregado = agregarRealizacoes(valsOrc, ind.criterioApuracao);
                const indParaNota = orcAgregado != null
                  ? { ...ind, metaAlvo: orcAgregado, faixas: ind.faixas ?? [] }
                  : { ...ind, faixas: ind.faixas ?? [] };
                const nota = realAgregado != null ? calcNota(indParaNota, realAgregado) : null;

                return (
                  <tr key={ind.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 text-sm">{ind.nome}</p>
                      <p className="text-xs text-gray-400 font-mono">{ind.codigo}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{ind.tipo}</td>
                    <td className="px-4 py-2.5">
                      {nota != null ? (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${nota >= 100 ? "bg-green-100 text-green-700" : nota > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
                          {nota.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {mesesCiclo.map(p => {
                      const pi = periodoDeInd(ind, p, anoFiscal);
                      if (!pi) return (
                        <td key={p} className="border-l border-gray-100 px-1 py-1 text-center text-gray-200 text-xs">—</td>
                      );
                      const keyOrc = `${ind.id}_${pi}`;
                      const keyReal = `${ind.id}_${pi}`;
                      const savingOrc = salvando === `orc_${keyOrc}`;
                      const savingReal = salvando === `real_${keyReal}`;
                      return (
                        <td key={p} className="border-l border-gray-100 px-1 py-1">
                          <div className="flex flex-col gap-1">
                            {/* Orçado */}
                            <div className="relative">
                              <input
                                type="number"
                                value={draftOrc[keyOrc] ?? ""}
                                onChange={e => setDraftOrc(d => ({...d,[keyOrc]:e.target.value}))}
                                onBlur={() => salvarOrc(ind.id, pi)}
                                className="w-20 border border-orange-300 bg-orange-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder:text-orange-300"
                                placeholder="—"
                              />
                              {savingOrc && <Save size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-400 animate-pulse"/>}
                            </div>
                            {/* Realizado */}
                            <div className="relative">
                              <input
                                type="number"
                                value={draft[keyReal] ?? ""}
                                onChange={e => setDraft(d => ({...d,[keyReal]:e.target.value}))}
                                onBlur={() => salvarReal(ind.id, pi)}
                                className="w-20 border border-blue-300 bg-blue-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-blue-300"
                                placeholder="—"
                              />
                              {savingReal && <Save size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-400 animate-pulse"/>}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Aba Resultados ────────────────────────────────────────
function AbaResultados({ indicadores, realizacoes, metasPeriodo, agrupamentos, atribuicoes, anoFiscal, mesInicio, mesFim }:
  { indicadores: Indicador[]; realizacoes: Realizacao[]; metasPeriodo: MetaPeriodo[]; agrupamentos: Agrupamento[];
    atribuicoes: Atribuicao[]; anoFiscal: number; mesInicio: number; mesFim: number; }) {

  const [filtroGestor, setFiltroGestor] = useState("");
  const [filtroColaborador, setFiltroColaborador] = useState("");
  const [filtroIndicador, setFiltroIndicador] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");
  const [expandido, setExpandido] = useState<Record<number,boolean>>({});

  // Calcular nota de cada indicador — usa orçado como meta quando disponível
  const notasPorIndicador = new Map<number, number>();
  for (const ind of indicadores) {
    let valorFinal: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
      const valsNum = periodos.map(p => realizacoes.find(r => r.indicadorId===ind.numeradorId && r.periodo===p)?.valorRealizado).filter((v): v is number => v!=null);
      const valsDen = periodos.map(p => realizacoes.find(r => r.indicadorId===ind.divisorId && r.periodo===p)?.valorRealizado).filter((v): v is number => v!=null);
      const num = agregarRealizacoes(valsNum, ind.criterioApuracao);
      const den = agregarRealizacoes(valsDen, ind.criterioApuracao);
      if (num != null && den != null && den !== 0) valorFinal = num / den;
    } else {
      const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
      const vals = periodos.map(p => realizacoes.find(r => r.indicadorId===ind.id && r.periodo===p)?.valorRealizado).filter((v): v is number => v!=null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    if (valorFinal != null) {
      // Usar orçado agregado como metaAlvo quando disponível
      const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
      const valsOrc = periodos.map(p => metasPeriodo.find(m => m.indicadorId===ind.id && m.periodo===p)?.valorOrcado).filter((v): v is number => v!=null);
      const orcAgregado = agregarRealizacoes(valsOrc, ind.criterioApuracao);
      const indParaNota = orcAgregado != null
        ? { ...ind, metaAlvo: orcAgregado, faixas: ind.faixas ?? [] }
        : { ...ind, faixas: ind.faixas ?? [] };
      notasPorIndicador.set(ind.id, calcNota(indParaNota, valorFinal));
    }
  }

  const colaboradoresMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colaboradoresMap.set(a.colaboradorId, a.colaborador);
  const colaboradores = Array.from(colaboradoresMap.values());

  const gestoresIds = new Set(colaboradores.map(c => c.gestorId).filter(Boolean));
  const gestores = colaboradores.filter(c => gestoresIds.has(c.id));

  const colabsFiltrados = colaboradores.filter(c => {
    if (filtroGestor && String(c.gestorId) !== filtroGestor) return false;
    if (filtroColaborador && !c.nome.toLowerCase().includes(filtroColaborador.toLowerCase())) return false;
    if (filtroNivel && !([c.area?.nivel1,c.area?.nivel2,c.area?.nivel3,c.area?.nivel4,c.area?.nivel5].some(n => n?.toLowerCase().includes(filtroNivel.toLowerCase())))) return false;
    return true;
  });

  // Resultado = soma(MIDs por agrupamento × pesoNaCesta/100)
  // MID = nota × peso_indicador / 100
  function calcResultadoColab(colaboradorId: number) {
    const atribs = atribuicoes.filter(a => a.colaboradorId === colaboradorId);
    let resultado = 0;
    const detalhes: { agrupamento: Agrupamento; atingimento: number; pesoNaCesta: number; contribuicao: number; mids: { ind: Indicador; nota: number; peso: number; mid: number }[] }[] = [];
    for (const at of atribs) {
      const ag = at.agrupamento;
      const mids: { ind: Indicador; nota: number; peso: number; mid: number }[] = [];
      let atingAg = 0;
      for (const ig of ag.indicadores) {
        if (filtroIndicador && String(ig.indicadorId) !== filtroIndicador) continue;
        const nota = notasPorIndicador.get(ig.indicadorId) ?? 0;
        const mid = calcMID(nota, ig.peso);
        mids.push({ ind: ig.indicador, nota, peso: ig.peso, mid });
        atingAg += mid;
      }
      resultado += atingAg;
      detalhes.push({ agrupamento: ag, atingimento: atingAg, pesoNaCesta: at.pesoNaCesta, contribuicao: atingAg, mids });
    }
    return { resultado, detalhes };
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={filtroColaborador} onChange={e=>setFiltroColaborador(e.target.value)} placeholder="Colaborador..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <select value={filtroGestor} onChange={e=>setFiltroGestor(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os gestores</option>
          {gestores.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <select value={filtroIndicador} onChange={e=>setFiltroIndicador(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os indicadores</option>
          {indicadores.map(i=><option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>)}
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={filtroNivel} onChange={e=>setFiltroNivel(e.target.value)} placeholder="Nível (N1–N5)..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
      </div>

      {colabsFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <BarChart3 size={36} className="mx-auto mb-2 text-gray-300"/>Nenhum resultado encontrado
        </div>
      ) : (
        <div className="space-y-2">
          {colabsFiltrados.map(c => {
            const { resultado, detalhes } = calcResultadoColab(c.id);
            const premio = c.salarioBase * (c.target / 100) * (resultado / 100);
            const aberto = expandido[c.id];
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={()=>setExpandido(e=>({...e,[c.id]:!aberto}))}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.matricula} · {c.cargo}</p>
                    </div>
                    {c.area?.nivel1 && <span className="text-xs text-gray-400 hidden sm:block">{c.area.nivel1}</span>}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Resultado</p>
                      <p className={`text-sm font-bold ${resultado >= 100 ? "text-green-600" : resultado > 0 ? "text-yellow-600" : "text-gray-400"}`}>
                        {resultado.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Prêmio Projetado</p>
                      <p className="text-sm font-bold text-blue-700">
                        {premio.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })}
                      </p>
                    </div>
                    {aberto ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                  </div>
                </button>

                {aberto && (
                  <div className="border-t border-gray-100 px-5 py-3 space-y-3">
                    {detalhes.map(d => (
                      <div key={d.agrupamento.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-600">
                            {d.agrupamento.nome}
                            <span className="font-normal text-gray-400"> ({d.pesoNaCesta}% na cesta)</span>
                          </p>
                          <div className="flex items-center gap-3 text-xs text-right">
                            <span className="text-gray-500">Ating. <span className="font-semibold text-gray-700">{d.atingimento.toFixed(1)}%</span></span>
                            <span className="text-gray-400">→</span>
                            <span className="text-gray-500">Contrib. <span className="font-semibold text-blue-700">{d.contribuicao.toFixed(1)}%</span></span>
                          </div>
                        </div>
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-400">
                            <th className="text-left pb-1">Indicador</th>
                            <th className="text-right pb-1">Nota</th>
                            <th className="text-right pb-1">Peso</th>
                            <th className="text-right pb-1">MID</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-50">
                            {d.mids.map(m => (
                              <tr key={m.ind.id}>
                                <td className="py-1 text-gray-700">{m.ind.codigo} — {m.ind.nome}</td>
                                <td className="py-1 text-right font-medium">{m.nota.toFixed(1)}%</td>
                                <td className="py-1 text-right text-gray-500">{m.peso}%</td>
                                <td className="py-1 text-right font-semibold text-blue-700">{m.mid.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────
export default function ApuracaoPage() {
  const { cicloAtivo } = useCiclo();
  const [aba, setAba] = useState<"preenchimento"|"resultados">("preenchimento");
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [realizacoes, setRealizacoes] = useState<Realizacao[]>([]);
  const [metasPeriodo, setMetasPeriodo] = useState<MetaPeriodo[]>([]);
  const [agrupamentos, setAgrupamentos] = useState<Agrupamento[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);

  const carregar = useCallback(() => {
    if (!cicloAtivo) return;
    const cid = cicloAtivo.id;
    fetch(`/api/indicadores?cicloId=${cid}`).then(r=>r.json()).then(async d => {
      const inds: Indicador[] = d.indicadores ?? [];
      const comFaixas = await Promise.all(inds.map(async i => {
        const fr = await fetch(`/api/faixas?indicadorId=${i.id}`);
        const fd = await fr.json();
        return { ...i, faixas: fd.faixas ?? [] };
      }));
      setIndicadores(comFaixas);
    });
    fetch(`/api/realizacoes?cicloId=${cid}`).then(r=>r.json()).then(d=>setRealizacoes(d.realizacoes??[]));
    fetch(`/api/meta-periodos?cicloId=${cid}`).then(r=>r.json()).then(d=>setMetasPeriodo(d.metasPeriodo??[]));
    fetch(`/api/agrupamentos?cicloId=${cid}`).then(r=>r.json()).then(d=>setAgrupamentos(d.agrupamentos??[]));
    fetch(`/api/atribuicoes?cicloId=${cid}`).then(r=>r.json()).then(d=>setAtribuicoes(d.atribuicoes??[]));
  }, [cicloAtivo?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!cicloAtivo) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <ClipboardList size={40} className="mb-3 text-gray-300"/>
      <p className="font-medium">Selecione um ciclo no header para continuar</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Apuração</h1>
        <p className="text-gray-500 text-sm mt-1">Ciclo {cicloAtivo.anoFiscal} — {cicloAtivo.status}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([["preenchimento","Preenchimento",<ClipboardList size={14}/>],["resultados","Resultados",<BarChart3 size={14}/>]] as const).map(([tab,label,icon])=>(
          <button key={tab} onClick={()=>setAba(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${aba===tab?"border-blue-600 text-blue-700":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {aba === "preenchimento" && (
        <AbaPreenchimento
          cicloId={cicloAtivo.id}
          anoFiscal={cicloAtivo.anoFiscal}
          mesInicio={cicloAtivo.mesInicio}
          mesFim={cicloAtivo.mesFim}
          indicadores={indicadores}
          realizacoes={realizacoes}
          metasPeriodo={metasPeriodo}
          onSaved={carregar}
        />
      )}

      {aba === "resultados" && (
        <AbaResultados
          indicadores={indicadores}
          realizacoes={realizacoes}
          metasPeriodo={metasPeriodo}
          agrupamentos={agrupamentos}
          atribuicoes={atribuicoes}
          anoFiscal={cicloAtivo.anoFiscal}
          mesInicio={cicloAtivo.mesInicio}
          mesFim={cicloAtivo.mesFim}
        />
      )}
    </div>
  );
}

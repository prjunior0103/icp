"use client";

import { useState, useEffect, useCallback } from "react";
import { useCiclo } from "@/app/lib/ciclo-context";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import { FileText, Search, Download, Users, BarChart3, GitBranch, UserCheck, ChevronDown, ChevronUp, UserCog, LayoutGrid } from "lucide-react";
import { AreaCCCombobox } from "@/app/components/AreaCCCombobox";

// ─── Types ────────────────────────────────────────────────
interface Indicador { id: number; codigo: string; nome: string; tipo: string; unidade: string; metaMinima?: number | null; metaAlvo?: number | null; metaMaxima?: number | null; periodicidade: string; criterioApuracao: string; numeradorId?: number | null; divisorId?: number | null; faixas?: { de: number; ate: number; nota: number }[]; analistaResp?: string | null; responsavelEnvio?: { id: number; nome: string } | null; }
interface Realizacao { id: number; indicadorId: number; periodo: string; valorRealizado: number; }
interface MetaPeriodo { id: number; indicadorId: number; periodo: string; valorOrcado: number; }
interface IndicadorNoGrupo { indicadorId: number; peso: number; indicador: Indicador; }
interface Agrupamento { id: number; nome: string; tipo: string; indicadores: IndicadorNoGrupo[]; }
interface Colaborador { id: number; nome: string; matricula: string; cargo: string; salarioBase: number; target: number; gestorId?: number | null; centroCusto?: string | null; area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null; }
interface Atribuicao { colaboradorId: number; agrupamentoId: number; pesoNaCesta: number; colaborador: Colaborador; agrupamento: Agrupamento; }

type AbaId = "colaborador" | "indicador" | "contratacao" | "responsavel" | "gestor" | "calibracao" | "pendencias";

const ABAS: { id: AbaId; label: string; icon: React.ReactNode }[] = [
  { id: "colaborador", label: "Por Colaborador", icon: <Users size={14}/> },
  { id: "indicador",   label: "Por Indicador",   icon: <BarChart3 size={14}/> },
  { id: "contratacao", label: "Contratação",      icon: <GitBranch size={14}/> },
  { id: "responsavel", label: "Por Responsável",  icon: <UserCheck size={14}/> },
  { id: "gestor",      label: "Painel do Gestor", icon: <UserCog size={14}/> },
  { id: "calibracao",  label: "Calibração",       icon: <LayoutGrid size={14}/> },
  { id: "pendencias",  label: "Pendências",        icon: <FileText size={14}/> },
];

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function labelPeriodo(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MESES[parseInt(m[2])-1]}/${m[1]}`;
  return p;
}

// ─── Utilitários ─────────────────────────────────────────
function useCalcEngine(indicadores: Indicador[], realizacoes: Realizacao[], metasPeriodo: MetaPeriodo[], anoFiscal: number, mesInicio: number, mesFim: number) {
  const notasMap = new Map<number, number>();
  const realMap = new Map<number, number | null>();
  const orcMap = new Map<number, number | null>();

  for (const ind of indicadores) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    let valorFinal: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const vN = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.numeradorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const vD = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.divisorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const n = agregarRealizacoes(vN, ind.criterioApuracao);
      const d = agregarRealizacoes(vD, ind.criterioApuracao);
      if (n != null && d != null && d !== 0) valorFinal = n / d;
    } else {
      const vals = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    realMap.set(ind.id, valorFinal);
    const vO = periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.id && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
    const orc = agregarRealizacoes(vO, ind.criterioApuracao);
    orcMap.set(ind.id, orc);
    if (valorFinal != null) {
      const indC = orc != null ? { ...ind, metaAlvo: orc, faixas: ind.faixas ?? [] } : { ...ind, faixas: ind.faixas ?? [] };
      notasMap.set(ind.id, calcNota(indC, valorFinal));
    }
  }
  return { notasMap, realMap, orcMap };
}

function NotaBadge({ nota }: { nota: number | null | undefined }) {
  if (nota == null) return <span className="text-gray-300 text-xs">—</span>;
  const cls = nota >= 100 ? "bg-green-100 text-green-700" : nota > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600";
  return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{nota.toFixed(1)}%</span>;
}

// ─── R1: Por Colaborador ─────────────────────────────────
function RelatColaborador({ atribuicoes, notasMap, areas }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; areas: {nivel1:string;nivel2?:string|null;nivel3?:string|null;nivel4?:string|null;nivel5?:string|null;centroCusto:string}[]; }) {
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});

  const colabsMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, a.colaborador);
  const colabs = Array.from(colabsMap.values()).filter(c => {
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !c.matricula.includes(busca)) return false;
    if (filtroArea) {
      const matchArea = [c.area?.nivel1,c.area?.nivel2,c.area?.nivel3,c.area?.nivel4,c.area?.nivel5].some(n => n === filtroArea);
      if (!matchArea && c.centroCusto !== filtroArea) return false;
    }
    return true;
  });

  function calcColab(id: number) {
    const atribs = atribuicoes.filter(a => a.colaboradorId === id);
    let resultado = 0;
    const grupos: { ag: Agrupamento; pesoNaCesta: number; mids: { ind: Indicador; nota: number; peso: number; mid: number }[]; ating: number }[] = [];
    for (const at of atribs) {
      const mids: { ind: Indicador; nota: number; peso: number; mid: number }[] = [];
      let ating = 0;
      for (const ig of at.agrupamento.indicadores) {
        const nota = notasMap.get(ig.indicadorId) ?? 0;
        const mid = calcMID(nota, ig.peso);
        mids.push({ ind: ig.indicador, nota, peso: ig.peso, mid });
        ating += mid;
        resultado += mid;
      }
      grupos.push({ ag: at.agrupamento, pesoNaCesta: at.pesoNaCesta, mids, ating });
    }
    return { resultado, grupos };
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <AreaCCCombobox areas={areas} value={filtroArea} onChange={setFiltroArea} size="md" />
      </div>

      {colabs.map(c => {
        const { resultado, grupos } = calcColab(c.id);
        const aberto = expandido[c.id];
        return (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setExpandido(e => ({ ...e, [c.id]: !aberto }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className="text-left">
                <p className="font-semibold text-gray-800 text-sm">{c.nome}</p>
                <p className="text-xs text-gray-400">{c.matricula} · {c.cargo} {c.area?.nivel1 ? `· ${c.area.nivel1}` : ""}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Resultado</p>
                  <NotaBadge nota={resultado}/>
                </div>
                {aberto ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
              </div>
            </button>
            {aberto && (
              <div className="border-t border-gray-100 px-5 py-3 space-y-4">
                {grupos.map(g => (
                  <div key={g.ag.id}>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-600">{g.ag.nome} <span className="font-normal text-gray-400">({g.pesoNaCesta}% na cesta)</span></p>
                      <p className="text-xs text-gray-600">Ating. <span className="font-semibold">{g.ating.toFixed(1)}%</span></p>
                    </div>
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-400">
                        <th className="text-left pb-1">Indicador</th>
                        <th className="text-right pb-1">Nota</th>
                        <th className="text-right pb-1">Peso</th>
                        <th className="text-right pb-1">MID</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {g.mids.map(m => (
                          <tr key={m.ind.id}>
                            <td className="py-1 text-gray-700">{m.ind.codigo} — {m.ind.nome}</td>
                            <td className="py-1 text-right"><NotaBadge nota={m.nota}/></td>
                            <td className="py-1 text-right text-gray-500">{m.peso}%</td>
                            <td className="py-1 text-right font-semibold text-blue-700">{m.mid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
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
  );
}

// ─── R2: Por Indicador ────────────────────────────────────
function RelatIndicador({ indicadores, notasMap, realMap, orcMap, atribuicoes }: {
  indicadores: Indicador[]; notasMap: Map<number, number>; realMap: Map<number, number | null>; orcMap: Map<number, number | null>; atribuicoes: Atribuicao[];
}) {
  const [busca, setBusca] = useState("");
  const inds = indicadores.filter(i =>
    !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || i.codigo.toLowerCase().includes(busca.toLowerCase())
  );
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar indicador..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código","Indicador","Tipo","Métrica","Orçado","Realizado","% Atingimento","Impacta"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inds.map(ind => {
              const real = realMap.get(ind.id);
              const orc = orcMap.get(ind.id);
              const nota = notasMap.get(ind.id);
              const contratantes = new Set(atribuicoes.filter(a => a.agrupamento.indicadores.some(ig => ig.indicadorId === ind.id)).map(a => a.colaboradorId)).size;
              return (
                <tr key={ind.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{ind.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.tipo}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.unidade}</td>
                  <td className="px-4 py-2.5 text-sm text-orange-700 font-medium">{orc != null ? orc.toLocaleString("pt-BR") : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-sm text-blue-700 font-medium">{real != null ? real.toLocaleString("pt-BR") : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5"><NotaBadge nota={nota}/></td>
                  <td className="px-4 py-2.5 text-sm text-gray-600">{contratantes} colab.</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── R3: Contratação ─────────────────────────────────────
function RelatContratacao({ atribuicoes, indicadores, notasMap }: { atribuicoes: Atribuicao[]; indicadores: Indicador[]; notasMap: Map<number, number>; }) {
  const [filtroInd, setFiltroInd] = useState("");

  const rows = atribuicoes.flatMap(at =>
    at.agrupamento.indicadores
      .filter(ig => !filtroInd || String(ig.indicadorId) === filtroInd)
      .map(ig => ({ at, ig }))
  );

  return (
    <div className="space-y-3">
      <select value={filtroInd} onChange={e => setFiltroInd(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
        <option value="">Todos os indicadores</option>
        {indicadores.map(i => <option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>)}
      </select>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Indicador","Nome Indicador","Colaborador","Matrícula","Agrupamento","Peso Ind. (%)","Peso Cesta (%)","% Atingimento"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ at, ig }, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ig.indicador.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{ig.indicador.nome}</td>
                <td className="px-4 py-2.5 text-gray-700">{at.colaborador.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{at.colaborador.matricula}</td>
                <td className="px-4 py-2.5 text-gray-600">{at.agrupamento.nome}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{ig.peso}%</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{at.pesoNaCesta}%</td>
                <td className="px-4 py-2.5"><NotaBadge nota={notasMap.get(ig.indicadorId)}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── R4: Por Responsável ─────────────────────────────────
function RelatResponsavel({ indicadores, notasMap, realizacoes, anoFiscal, mesInicio, mesFim }: {
  indicadores: Indicador[]; notasMap: Map<number, number>; realizacoes: Realizacao[]; anoFiscal: number; mesInicio: number; mesFim: number;
}) {
  const [filtro, setFiltro] = useState("");

  const responsaveis = Array.from(new Set(indicadores.map(i => i.responsavelEnvio?.nome ?? i.analistaResp ?? "—"))).sort();
  const inds = indicadores.filter(i => {
    const resp = i.responsavelEnvio?.nome ?? i.analistaResp ?? "—";
    return !filtro || resp === filtro;
  });

  return (
    <div className="space-y-3">
      <select value={filtro} onChange={e => setFiltro(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
        <option value="">Todos os responsáveis</option>
        {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Responsável","Código","Indicador","Tipo","Periodicidade","Status","% Atingimento"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inds.map(ind => {
              const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
              const preenchido = periodos.some(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p));
              const resp = ind.responsavelEnvio?.nome ?? ind.analistaResp ?? "—";
              return (
                <tr key={ind.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{resp}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                  <td className="px-4 py-2.5 text-gray-700">{ind.nome}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.tipo}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{ind.periodicidade}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${preenchido ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {preenchido ? "Preenchido" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5"><NotaBadge nota={notasMap.get(ind.id)}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── R5: Painel do Gestor ────────────────────────────────
function RelatGestor({ atribuicoes, notasMap }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; }) {
  const colabsMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, a.colaborador);
  const colaboradores = Array.from(colabsMap.values());
  const gestoresIds = Array.from(new Set(colaboradores.map(c => c.gestorId).filter(Boolean))) as number[];
  const gestores = colaboradores.filter(c => gestoresIds.includes(c.id));
  const [filtroGestor, setFiltroGestor] = useState(gestores[0]?.id ? String(gestores[0].id) : "");

  function calcResultado(id: number) {
    let r = 0;
    for (const at of atribuicoes.filter(a => a.colaboradorId === id))
      for (const ig of at.agrupamento.indicadores)
        r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  const subordinados = colaboradores.filter(c => filtroGestor ? String(c.gestorId) === filtroGestor : false);

  return (
    <div className="space-y-3">
      <select value={filtroGestor} onChange={e => setFiltroGestor(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
        <option value="">Selecionar gestor</option>
        {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
      {subordinados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <UserCog size={36} className="mx-auto mb-2 text-gray-300"/>Selecione um gestor para ver o painel da equipe
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{["Colaborador","Matrícula","Cargo","Área","Resultado"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subordinados.sort((a,b) => calcResultado(b.id) - calcResultado(a.id)).map(c => {
                const resultado = calcResultado(c.id);
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.nome}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.matricula}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{c.cargo}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.area?.nivel1 ?? "—"}</td>
                    <td className="px-4 py-2.5"><NotaBadge nota={resultado}/></td>
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

// ─── R6: Calibração ──────────────────────────────────────
function RelatCalibracao({ atribuicoes, notasMap }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; }) {
  const colabsMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, a.colaborador);
  const colaboradores = Array.from(colabsMap.values());
  const areas = Array.from(new Set(colaboradores.map(c => c.area?.nivel1).filter(Boolean))) as string[];
  const [filtroArea, setFiltroArea] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const colabsFiltrados = colaboradores.filter(c => !filtroArea || c.area?.nivel1 === filtroArea);

  function calcResultado(id: number) {
    let r = 0;
    for (const at of atribuicoes.filter(a => a.colaboradorId === id))
      for (const ig of at.agrupamento.indicadores)
        r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  const comparar = selecionados.length > 0 ? selecionados : colabsFiltrados.slice(0, 5).map(c => c.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select value={filtroArea} onChange={e => { setFiltroArea(e.target.value); setSelecionados([]); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas as áreas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="text-xs text-gray-400">Clique nos nomes para selecionar quem comparar (máx. recomendado: 6)</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {colabsFiltrados.map(c => (
          <button key={c.id}
            onClick={() => setSelecionados(s => s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id])}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selecionados.includes(c.id) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
            {c.nome}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-36">Info</th>
              {comparar.map(id => (
                <th key={id} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">{colabsMap.get(id)?.nome ?? id}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {([
              { label: "Matrícula",        fn: (id: number) => colabsMap.get(id)?.matricula ?? "—" },
              { label: "Cargo",            fn: (id: number) => colabsMap.get(id)?.cargo ?? "—" },
              { label: "Área",             fn: (id: number) => colabsMap.get(id)?.area?.nivel1 ?? "—" },
              { label: "Resultado",        fn: (id: number) => <NotaBadge nota={calcResultado(id)}/> },
            ] as { label: string; fn: (id: number) => React.ReactNode }[]).map(row => (
              <tr key={row.label} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-600 text-xs whitespace-nowrap">{row.label}</td>
                {comparar.map(id => (
                  <td key={id} className="px-4 py-2.5 text-center text-xs text-gray-700">{row.fn(id)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── R7: Pendências ──────────────────────────────────────
function RelatPendencias({ indicadores, realizacoes, anoFiscal, mesInicio, mesFim }: {
  indicadores: Indicador[]; realizacoes: Realizacao[];
  anoFiscal: number; mesInicio: number; mesFim: number;
}) {
  const [apenasPendentes, setApenasPendentes] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [busca, setBusca] = useState("");

  const indsBase = indicadores.filter(i => !i.numeradorId && !i.divisorId);
  const mesesCiclo = gerarPeriodos(anoFiscal, mesInicio, mesFim, "MENSAL");

  type Linha = { ind: Indicador; periodo: string; preenchido: boolean };
  const linhas: Linha[] = [];
  for (const ind of indsBase) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    for (const p of periodos) {
      const preenchido = realizacoes.some(r => r.indicadorId === ind.id && r.periodo === p);
      linhas.push({ ind, periodo: p, preenchido });
    }
  }

  const linhasFiltradas = linhas.filter(l => {
    if (apenasPendentes && l.preenchido) return false;
    if (filtroPeriodo && l.periodo !== filtroPeriodo) return false;
    if (busca && !l.ind.nome.toLowerCase().includes(busca.toLowerCase()) && !l.ind.codigo.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const totalPendentes = linhas.filter(l => !l.preenchido).length;
  const totalLinhas = linhas.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar indicador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os períodos</option>
          {mesesCiclo.map(p => <option key={p} value={p}>{labelPeriodo(p)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={apenasPendentes} onChange={e => setApenasPendentes(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"/>
          Apenas pendentes
        </label>
        <span className="text-xs text-gray-400 ml-auto">{totalPendentes} pendente(s) de {totalLinhas}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código","Indicador","Responsável","Período","Status"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhasFiltradas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                {apenasPendentes ? "Nenhuma pendência encontrada 🎉" : "Nenhum resultado"}
              </td></tr>
            ) : linhasFiltradas.map((l, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{l.ind.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{l.ind.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{l.ind.analistaResp ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{labelPeriodo(l.periodo)}</td>
                <td className="px-4 py-2.5">
                  {l.preenchido
                    ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Preenchido</span>
                    : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Pendente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { cicloAtivo } = useCiclo();
  const [aba, setAba] = useState<AbaId>("colaborador");
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [realizacoes, setRealizacoes] = useState<Realizacao[]>([]);
  const [metasPeriodo, setMetasPeriodo] = useState<MetaPeriodo[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [areas, setAreas] = useState<{nivel1:string;nivel2?:string|null;nivel3?:string|null;nivel4?:string|null;nivel5?:string|null;centroCusto:string}[]>([]);
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(() => {
    if (!cicloAtivo) return;
    const cid = cicloAtivo.id;
    fetch(`/api/indicadores?cicloId=${cid}`).then(r => r.json()).then(async d => {
      const inds: Indicador[] = d.indicadores ?? [];
      const comFaixas = await Promise.all(inds.map(async i => {
        const fr = await fetch(`/api/faixas?indicadorId=${i.id}`);
        const fd = await fr.json();
        return { ...i, faixas: fd.faixas ?? [] };
      }));
      setIndicadores(comFaixas);
    });
    fetch(`/api/realizacoes?cicloId=${cid}`).then(r => r.json()).then(d => setRealizacoes(d.realizacoes ?? []));
    fetch(`/api/meta-periodos?cicloId=${cid}`).then(r => r.json()).then(d => setMetasPeriodo(d.metasPeriodo ?? []));
    fetch(`/api/atribuicoes?cicloId=${cid}`).then(r => r.json()).then(d => setAtribuicoes(d.atribuicoes ?? []));
    fetch(`/api/areas?cicloId=${cid}`).then(r => r.json()).then(d => setAreas(d.areas ?? []));
  }, [cicloAtivo?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function exportarExcel() {
    if (!cicloAtivo) return;
    setExportando(true);
    const res = await fetch(`/api/export?cicloId=${cicloAtivo.id}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ICP-Ciclo${cicloAtivo.anoFiscal}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setExportando(false);
  }

  if (!cicloAtivo) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <FileText size={40} className="mb-3 text-gray-300"/>
      <p className="font-medium">Selecione um ciclo para ver os relatórios</p>
    </div>
  );

  const { notasMap, realMap, orcMap } = useCalcEngine(indicadores, realizacoes, metasPeriodo, cicloAtivo.anoFiscal, cicloAtivo.mesInicio, cicloAtivo.mesFim);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Ciclo {cicloAtivo.anoFiscal} — {cicloAtivo.status}</p>
        </div>
        <button onClick={exportarExcel} disabled={exportando}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Download size={15}/>
          {exportando ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${aba === id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {aba === "colaborador" && <RelatColaborador atribuicoes={atribuicoes} notasMap={notasMap} areas={areas}/>}
      {aba === "indicador"   && <RelatIndicador indicadores={indicadores} notasMap={notasMap} realMap={realMap} orcMap={orcMap} atribuicoes={atribuicoes}/>}
      {aba === "contratacao" && <RelatContratacao atribuicoes={atribuicoes} indicadores={indicadores} notasMap={notasMap}/>}
      {aba === "responsavel" && <RelatResponsavel indicadores={indicadores} notasMap={notasMap} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim}/>}
      {aba === "gestor"      && <RelatGestor atribuicoes={atribuicoes} notasMap={notasMap}/>}
      {aba === "calibracao"  && <RelatCalibracao atribuicoes={atribuicoes} notasMap={notasMap}/>}
      {aba === "pendencias"  && <RelatPendencias indicadores={indicadores} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim}/>}
    </div>
  );
}

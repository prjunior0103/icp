"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCiclo } from "@/app/lib/ciclo-context";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import { FileText, Search, Download, Users, BarChart3, GitBranch, UserCheck, ChevronDown, ChevronUp, UserCog, LayoutGrid, ArrowLeftRight, UserX, AlertCircle, X, Plus, Presentation, Mail } from "lucide-react";
import { HierarchicalAreaFilter, EMPTY_FILTERS, matchesAreaFilter, type AreaFilters } from "@/app/components/HierarchicalAreaFilter";

// ─── Types ────────────────────────────────────────────────
interface Indicador { id: number; codigo: string; nome: string; tipo: string; unidade: string; metaMinima?: number | null; metaAlvo?: number | null; metaMaxima?: number | null; periodicidade: string; criterioApuracao: string; numeradorId?: number | null; divisorId?: number | null; faixas?: { de: number; ate: number; nota: number }[]; analistaResp?: string | null; responsavelEnvio?: { id: number; nome: string } | null; }
interface Realizacao { id: number; indicadorId: number; periodo: string; valorRealizado: number; }
interface MetaPeriodo { id: number; indicadorId: number; periodo: string; valorOrcado: number; }
interface IndicadorNoGrupo { indicadorId: number; peso: number; indicador: Indicador; }
interface Agrupamento { id: number; nome: string; tipo: string; indicadores: IndicadorNoGrupo[]; }
interface Colaborador { id: number; nome: string; matricula: string; cargo: string; salarioBase: number; target: number; gestorId?: number | null; centroCusto?: string | null; area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null; }
interface Atribuicao { colaboradorId: number; agrupamentoId: number; pesoNaCesta: number; colaborador: Colaborador; agrupamento: Agrupamento; }

type AbaId = "colaborador" | "indicador" | "contratacao" | "responsavel" | "gestor" | "calibracao" | "pendencias" | "movimentacoes" | "sem-painel" | "nao-apurados" | "ppt" | "carta";

const ABAS: { id: AbaId; label: string; icon: React.ReactNode }[] = [
  { id: "colaborador", label: "Por Colaborador", icon: <Users size={14}/> },
  { id: "indicador",   label: "Por Indicador",   icon: <BarChart3 size={14}/> },
  { id: "contratacao", label: "Contratação",      icon: <GitBranch size={14}/> },
  { id: "responsavel", label: "Por Responsável",  icon: <UserCheck size={14}/> },
  { id: "gestor",      label: "Painel do Gestor", icon: <UserCog size={14}/> },
  { id: "calibracao",  label: "Calibração",       icon: <LayoutGrid size={14}/> },
  { id: "pendencias",  label: "Pendências",        icon: <FileText size={14}/> },
  { id: "movimentacoes", label: "Movimentações",   icon: <ArrowLeftRight size={14}/> },
  { id: "sem-painel",    label: "Sem Painel",       icon: <UserX size={14}/> },
  { id: "nao-apurados",  label: "Não Apurados",     icon: <AlertCircle size={14}/> },
  { id: "ppt",           label: "Gerar PPT",        icon: <Presentation size={14}/> },
  { id: "carta",         label: "Carta PDF",        icon: <Mail size={14}/> },
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
function RelatColaborador({ atribuicoes, notasMap, areas, movimentadosSet }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; areas: {nivel1:string;nivel2?:string|null;nivel3?:string|null;nivel4?:string|null;nivel5?:string|null;centroCusto:string}[]; movimentadosSet: Set<string>; }) {
  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState<AreaFilters>(EMPTY_FILTERS);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  // Agrupa atribuições em rows: movimentados → 1 card por atribuição; não-movimentados → 1 card com todos agrupamentos
  type Row = { key: string; colaborador: Colaborador; atribs: Atribuicao[]; movimentado: boolean };
  const rowsMap = new Map<string, Row>();
  for (const at of atribuicoes) {
    const c = at.colaborador;
    if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase()) && !c.matricula.includes(busca)) continue;
    if (!matchesAreaFilter(c, filtroArea, areas)) continue;
    const movimentado = movimentadosSet.has(c.matricula);
    const key = movimentado ? `${at.colaboradorId}-${at.agrupamentoId}` : `${at.colaboradorId}`;
    if (!rowsMap.has(key)) rowsMap.set(key, { key, colaborador: c, atribs: [], movimentado });
    rowsMap.get(key)!.atribs.push(at);
  }
  const rows = Array.from(rowsMap.values());

  function calcRow(atribs: Atribuicao[]) {
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
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <HierarchicalAreaFilter areas={areas} value={filtroArea} onChange={setFiltroArea} />
      </div>

      {rows.map(row => {
        const c = row.colaborador;
        const { resultado, grupos } = calcRow(row.atribs);
        const aberto = expandido[row.key];
        return (
          <div key={row.key} className={`bg-white rounded-xl border overflow-hidden ${row.movimentado ? "border-amber-200" : "border-gray-200"}`}>
            <button onClick={() => setExpandido(e => ({ ...e, [row.key]: !aberto }))}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 text-sm">{c.nome}</p>
                  {row.movimentado && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">MOVIMENTADO</span>}
                </div>
                <p className="text-xs text-gray-400">
                  {c.matricula} · {c.cargo}{c.area?.nivel1 ? ` · ${c.area.nivel1}` : ""}
                  {row.movimentado && row.atribs[0] && <span className="text-amber-600"> · {row.atribs[0].agrupamento.nome}</span>}
                </p>
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
function RelatGestor({ atribuicoes, notasMap, movimentadosSet }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; movimentadosSet: Set<string>; }) {
  const colabsMap = new Map<number, Colaborador>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, a.colaborador);
  const colaboradores = Array.from(colabsMap.values());
  const gestoresIds = Array.from(new Set(colaboradores.map(c => c.gestorId).filter(Boolean))) as number[];
  const gestores = colaboradores.filter(c => gestoresIds.includes(c.id));
  const [filtroGestor, setFiltroGestor] = useState(gestores[0]?.id ? String(gestores[0].id) : "");

  function calcResultadoAtrib(at: Atribuicao) {
    let r = 0;
    for (const ig of at.agrupamento.indicadores)
      r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  // Uma linha por atribuição — colaborador com 2 painéis aparece 2x
  const linhas = atribuicoes
    .filter(a => filtroGestor ? String(a.colaborador.gestorId) === filtroGestor : false)
    .sort((a, b) => calcResultadoAtrib(b) - calcResultadoAtrib(a));

  return (
    <div className="space-y-3">
      <select value={filtroGestor} onChange={e => setFiltroGestor(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
        <option value="">Selecionar gestor</option>
        {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
      </select>
      {linhas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <UserCog size={36} className="mx-auto mb-2 text-gray-300"/>Selecione um gestor para ver o painel da equipe
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{["Colaborador","Matrícula","Cargo","Área","Painel","Resultado"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map(a => {
                const resultado = calcResultadoAtrib(a);
                const movimentado = movimentadosSet.has(a.colaborador.matricula);
                return (
                  <tr key={`${a.colaboradorId}-${a.agrupamentoId}`} className={`hover:bg-gray-50 ${movimentado ? "bg-amber-50/40" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{a.colaborador.nome}</p>
                      {movimentado && <span className="text-[10px] font-semibold text-amber-600">MOVIMENTADO</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.colaborador.matricula}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{a.colaborador.cargo}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{a.colaborador.area?.nivel1 ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{a.agrupamento.nome}</td>
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
function RelatCalibracao({ atribuicoes, notasMap, movimentadosSet }: { atribuicoes: Atribuicao[]; notasMap: Map<number, number>; movimentadosSet: Set<string>; }) {
  // Chave única: "colaboradorId-agrupamentoId" para suportar movimentados com 2 painéis
  type LinhaCalib = { key: string; colaboradorId: number; agrupamentoId: number; colab: Colaborador; ag: Agrupamento; movimentado: boolean };

  const linhas: LinhaCalib[] = atribuicoes.map(a => ({
    key: `${a.colaboradorId}-${a.agrupamentoId}`,
    colaboradorId: a.colaboradorId,
    agrupamentoId: a.agrupamentoId,
    colab: a.colaborador,
    ag: a.agrupamento,
    movimentado: movimentadosSet.has(a.colaborador.matricula),
  }));

  const areas = Array.from(new Set(linhas.map(l => l.colab.area?.nivel1).filter(Boolean))) as string[];
  const [filtroArea, setFiltroArea] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const linhasFiltradas = linhas.filter(l => !filtroArea || l.colab.area?.nivel1 === filtroArea);
  const linhasMap = new Map(linhas.map(l => [l.key, l]));

  function calcResultadoLinha(key: string) {
    const l = linhasMap.get(key);
    if (!l) return 0;
    let r = 0;
    for (const ig of l.ag.indicadores)
      r += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
    return r;
  }

  const comparar = selecionados.length > 0 ? selecionados : linhasFiltradas.slice(0, 5).map(l => l.key);

  function toggleSel(key: string) {
    setSelecionados(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);
  }

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
        {linhasFiltradas.map(l => (
          <button key={l.key} onClick={() => toggleSel(l.key)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selecionados.includes(l.key) ? "bg-blue-600 text-white border-blue-600" : l.movimentado ? "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-500" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
            {l.colab.nome}{l.movimentado ? ` (${l.ag.nome})` : ""}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase w-36">Info</th>
              {comparar.map(key => {
                const l = linhasMap.get(key);
                return (
                  <th key={key} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    {l?.colab.nome ?? key}
                    {l?.movimentado && <span className="block text-[10px] font-normal text-amber-600">{l.ag.nome}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {([
              { label: "Matrícula", fn: (key: string) => linhasMap.get(key)?.colab.matricula ?? "—" },
              { label: "Cargo",     fn: (key: string) => linhasMap.get(key)?.colab.cargo ?? "—" },
              { label: "Área",      fn: (key: string) => linhasMap.get(key)?.colab.area?.nivel1 ?? "—" },
              { label: "Painel",    fn: (key: string) => linhasMap.get(key)?.ag.nome ?? "—" },
              { label: "Resultado", fn: (key: string) => <NotaBadge nota={calcResultadoLinha(key)}/> },
            ] as { label: string; fn: (key: string) => React.ReactNode }[]).map(row => (
              <tr key={row.label} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-600 text-xs whitespace-nowrap">{row.label}</td>
                {comparar.map(key => (
                  <td key={key} className="px-4 py-2.5 text-center text-xs text-gray-700">{row.fn(key)}</td>
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

// ─── Relatório Movimentações ─────────────────────────────
interface MovRel {
  id: number; matricula: string; tipo: string; dataEfetiva: string;
  dadosAntigos: string | null; dadosNovos: string | null;
  requerNovoPainel: boolean; painelAnteriorNome: string | null; painelNovoNome: string | null;
  statusTratamento: string; nomeColaborador: string | null;
}

const MOV_TIPO_LABEL: Record<string, string> = {
  ADMISSAO:"Admissão", DESLIGAMENTO:"Desligamento", POSSIVEL_DESLIGAMENTO:"Possível Desligamento",
  AFASTAMENTO:"Afastamento", RETORNO:"Retorno", MUDANCA_FUNCAO:"Mud. Função",
  MUDANCA_AREA:"Mud. Área", MUDANCA_GESTOR:"Mud. Gestor",
  MUDANCA_AREA_GESTOR:"Mud. Área+Gestor", MOVIMENTACAO:"Movimentação",
};
const MOV_TIPO_COR: Record<string, string> = {
  ADMISSAO:"bg-green-100 text-green-700", DESLIGAMENTO:"bg-red-100 text-red-700",
  POSSIVEL_DESLIGAMENTO:"bg-red-50 text-red-600", AFASTAMENTO:"bg-orange-100 text-orange-700",
  RETORNO:"bg-blue-100 text-blue-700", MUDANCA_FUNCAO:"bg-purple-100 text-purple-700",
  MUDANCA_AREA:"bg-yellow-100 text-yellow-700", MUDANCA_GESTOR:"bg-indigo-100 text-indigo-700",
  MUDANCA_AREA_GESTOR:"bg-pink-100 text-pink-700", MOVIMENTACAO:"bg-gray-100 text-gray-700",
};

function RelatMovimentacoes({ cicloId }: { cicloId: number }) {
  const [movs, setMovs] = useState<MovRel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/movimentacoes?cicloId=${cicloId}`).then(r => r.json()).then(d => {
      setMovs(d.movimentacoes ?? []);
      setLoading(false);
    });
  }, [cicloId]);

  if (loading) return <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>;

  // Resumo por tipo
  const porTipo = new Map<string, number>();
  for (const m of movs) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);

  // Status tratamento
  const pendentes = movs.filter(m => m.statusTratamento === "PENDENTE").length;
  const tratados = movs.filter(m => m.statusTratamento === "TRATADO").length;
  const ignorados = movs.filter(m => m.statusTratamento === "IGNORADO").length;
  const requerPainel = movs.filter(m => m.requerNovoPainel && m.statusTratamento === "PENDENTE").length;

  return (
    <div className="space-y-5">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900">{movs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase font-medium">Pendentes</p>
          <p className="text-2xl font-bold text-amber-700">{pendentes}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 uppercase font-medium">Tratados</p>
          <p className="text-2xl font-bold text-green-700">{tratados}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-blue-600 uppercase font-medium">Requerem Painel</p>
          <p className="text-2xl font-bold text-blue-700">{requerPainel}</p>
        </div>
      </div>

      {/* Resumo por tipo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Tipo</h3>
        <div className="flex flex-wrap gap-2">
          {[...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => (
            <div key={tipo} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${MOV_TIPO_COR[tipo] ?? "bg-gray-100 text-gray-600"}`}>
              {MOV_TIPO_LABEL[tipo] ?? tipo}: {qtd}
            </div>
          ))}
        </div>
      </div>

      {/* Tabela detalhada */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Data", "Colaborador", "Matrícula", "Tipo", "Painel", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movs.filter(m => m.tipo !== "ADMISSAO").map(m => (
              <tr key={m.id} className={`hover:bg-gray-50 ${m.statusTratamento === "PENDENTE" ? "bg-amber-50/30" : ""}`}>
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(m.dataEfetiva).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{m.nomeColaborador ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{m.matricula}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${MOV_TIPO_COR[m.tipo] ?? "bg-gray-100"}`}>
                    {MOV_TIPO_LABEL[m.tipo] ?? m.tipo}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {m.requerNovoPainel ? (
                    <div>
                      {m.painelAnteriorNome && <span className="text-red-500 line-through mr-1">{m.painelAnteriorNome}</span>}
                      {m.painelNovoNome ? <span className="text-green-700 font-medium">{m.painelNovoNome}</span> : <span className="text-amber-600 font-medium">Pendente</span>}
                    </div>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    m.statusTratamento === "PENDENTE" ? "bg-amber-100 text-amber-700" :
                    m.statusTratamento === "TRATADO" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {m.statusTratamento}
                  </span>
                </td>
              </tr>
            ))}
            {movs.filter(m => m.tipo !== "ADMISSAO").length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">Nenhuma movimentação (exceto admissões do primeiro import)</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Botão exportar */}
      <div className="flex justify-end">
        <button onClick={() => window.location.href = `/api/colaboradores/export-consolidada?cicloId=${cicloId}`}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <Download size={15} /> Exportar Base Consolidada
        </button>
      </div>
    </div>
  );
}

// ─── R9: Sem Painel ─────────────────────────────────────
interface ColaboradorBasico { id: number; nome: string; matricula: string; cargo: string; area?: { nivel1: string } | null; }
interface AgrupamentoBasico { id: number; nome: string; tipo: string; }

function RelatSemPainel({ colaboradoresAll, atribuicoes, agrupamentos, cicloId, onAtribuir, readOnly }: {
  colaboradoresAll: ColaboradorBasico[];
  atribuicoes: Atribuicao[];
  agrupamentos: AgrupamentoBasico[];
  cicloId: number;
  onAtribuir: () => void;
  readOnly?: boolean;
}) {
  const atribuidosSet = new Set(atribuicoes.map(a => a.colaboradorId));
  const semPainel = colaboradoresAll.filter(c => !atribuidosSet.has(c.id));
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ColaboradorBasico | null>(null);
  const [agrupId, setAgrupId] = useState("");
  const [peso, setPeso] = useState("100");
  const [salvando, setSalvando] = useState(false);

  const filtrados = semPainel.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.matricula.includes(busca)
  );

  async function atribuir() {
    if (!modal || !agrupId) return;
    setSalvando(true);
    await fetch("/api/atribuicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId, colaboradorId: modal.id, agrupamentoId: Number(agrupId), pesoNaCesta: Number(peso) }),
    });
    setSalvando(false);
    setModal(null);
    setAgrupId("");
    setPeso("100");
    onAtribuir();
  }

  return (
    <div className="space-y-3">
      {/* Resumo */}
      <div className="flex items-center gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <UserX size={16} className="text-red-500"/>
          <span className="text-sm font-semibold text-red-700">{semPainel.length} colaborador(es) sem painel</span>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar colaborador..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Nome","Matrícula","Cargo","Área","Ação"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                {semPainel.length === 0 ? "Todos os colaboradores têm painel atribuído 🎉" : "Nenhum resultado"}
              </td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{c.nome}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.matricula}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{c.cargo}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{c.area?.nivel1 ?? "—"}</td>
                {!readOnly && (
                  <td className="px-4 py-2.5">
                    <button onClick={() => setModal(c)}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                      <Plus size={12}/> Atribuir
                    </button>
                  </td>
                )}
                {readOnly && <td className="px-4 py-2.5"/>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal atribuir */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Atribuir Painel</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <p className="text-sm text-gray-600">{modal.nome} · {modal.matricula}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Agrupamento</label>
                <select value={agrupId} onChange={e => setAgrupId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecionar agrupamento</option>
                  {agrupamentos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Peso na Cesta (%)</label>
                <input type="number" min="0" max="100" value={peso} onChange={e => setPeso(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={atribuir} disabled={salvando || !agrupId}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors">
                {salvando ? "Salvando..." : "Atribuir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── R10: Não Apurados ────────────────────────────────────
function RelatNaoApurados({ indicadores, realizacoes, anoFiscal, mesInicio, mesFim }: {
  indicadores: Indicador[]; realizacoes: Realizacao[]; anoFiscal: number; mesInicio: number; mesFim: number;
}) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const indsBase = indicadores.filter(i => !i.numeradorId && !i.divisorId);
  const todosMeses = gerarPeriodos(anoFiscal, mesInicio, mesFim, "MENSAL");
  const periodosCiclo = new Set(todosMeses);
  const periodoRef = periodosCiclo.has(mesAtual) ? mesAtual : [...todosMeses].sort().pop() ?? mesAtual;

  const linhas = indsBase.flatMap(ind => {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    const periodoAtual = periodos.filter(p => p <= periodoRef).pop();
    if (!periodoAtual) return [];
    const preenchido = realizacoes.some(r => r.indicadorId === ind.id && r.periodo === periodoAtual);
    return preenchido ? [] : [{ ind, periodo: periodoAtual }];
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500"/>
          <span className="text-sm font-semibold text-amber-700">{linhas.length} indicador(es) não apurado(s) em {labelPeriodo(periodoRef)}</span>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Código","Indicador","Responsável","Período","Ação"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {linhas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Todos os indicadores estão apurados em {labelPeriodo(periodoRef)} 🎉</td></tr>
            ) : linhas.map(({ ind, periodo }) => (
              <tr key={ind.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{ind.codigo}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{ind.nome}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{ind.analistaResp ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{labelPeriodo(periodo)}</td>
                <td className="px-4 py-2.5">
                  <a href="/apuracao" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors w-fit">
                    <BarChart3 size={12}/> Apurar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── R11: Gerar PPT ──────────────────────────────────────
// ─── R12: Carta PDF ──────────────────────────────────────
function RelatCartaPDF({ atribuicoes, cicloId }: { atribuicoes: Atribuicao[]; cicloId: number }) {
  const [tipo, setTipo] = useState<"todos" | "colaborador">("todos");
  const [colaboradorId, setColaboradorId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const colabsMap = new Map<number, { id: number; nome: string }>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, { id: a.colaboradorId, nome: a.colaborador.nome });
  const colaboradores = Array.from(colabsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

  async function gerar() {
    setErro("");
    setGerando(true);
    try {
      const params = new URLSearchParams({ cicloId: String(cicloId) });
      if (tipo === "colaborador" && colaboradorId) params.set("colaboradorId", colaboradorId);
      const res = await fetch(`/api/carta-pdf?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? `Erro ${res.status} ao gerar PDF`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `carta-icp.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de conexão ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-blue-500"/>
          <h3 className="font-semibold text-gray-800">Gerar Carta PDF</h3>
        </div>
        <p className="text-sm text-gray-500">Gera a carta de incentivo individual com painel, indicadores e critérios. Configure os parâmetros em <strong>Configurações → Carta ICP</strong>.</p>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Escopo</label>
          <select value={tipo} onChange={e => { setTipo(e.target.value as typeof tipo); setColaboradorId(""); setErro(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos os colaboradores</option>
            <option value="colaborador">Colaborador específico</option>
          </select>
        </div>
        {tipo === "colaborador" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Colaborador</label>
            <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar...</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
        <button onClick={gerar} disabled={gerando || (tipo === "colaborador" && !colaboradorId)}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Mail size={15}/> {gerando ? "Gerando..." : "Baixar PDF"}
        </button>
      </div>
    </div>
  );
}

function RelatPPT({ atribuicoes, cicloId }: { atribuicoes: Atribuicao[]; cicloId: number }) {
  const [tipo, setTipo] = useState<"todos" | "colaborador" | "gestor" | "area">("todos");
  const [filtroId, setFiltroId] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [gerando, setGerando] = useState(false);

  const colabsMap = new Map<number, { id: number; nome: string; gestorId?: number | null }>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, { id: a.colaboradorId, nome: a.colaborador.nome, gestorId: a.colaborador.gestorId });
  const colaboradores = Array.from(colabsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

  const gestoresIds = new Set(colaboradores.map(c => c.gestorId).filter(Boolean));
  const gestores = colaboradores.filter(c => gestoresIds.has(c.id));

  const areas = Array.from(new Set(atribuicoes.map(a => a.colaborador.area?.nivel1).filter(Boolean))) as string[];

  async function gerar() {
    setGerando(true);
    const params = new URLSearchParams({ cicloId: String(cicloId), tipo });
    if ((tipo === "colaborador" || tipo === "gestor") && filtroId) params.set("filtroId", filtroId);
    if (tipo === "area" && filtroArea) params.set("filtroArea", filtroArea);
    const res = await fetch(`/api/ppt?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `ICP-PPT-${tipo}.pptx`; a.click();
      URL.revokeObjectURL(url);
    }
    setGerando(false);
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Presentation size={18} className="text-blue-500"/>
          <h3 className="font-semibold text-gray-800">Gerar PPT Executivo</h3>
        </div>
        <p className="text-sm text-gray-500">Gera uma apresentação com um slide por colaborador contendo painel, indicadores, atingimento, MID total e YTD.</p>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Escopo</label>
          <select value={tipo} onChange={e => { setTipo(e.target.value as typeof tipo); setFiltroId(""); setFiltroArea(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos os colaboradores</option>
            <option value="colaborador">Colaborador específico</option>
            <option value="gestor">Equipe de um gestor</option>
            <option value="area">Área específica</option>
          </select>
        </div>

        {tipo === "colaborador" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Colaborador</label>
            <select value={filtroId} onChange={e => setFiltroId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar...</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}

        {tipo === "gestor" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Gestor</label>
            <select value={filtroId} onChange={e => setFiltroId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar...</option>
              {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        )}

        {tipo === "area" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Área</label>
            <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecionar...</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        <button onClick={gerar} disabled={gerando || (tipo === "colaborador" && !filtroId) || (tipo === "gestor" && !filtroId) || (tipo === "area" && !filtroArea)}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          <Presentation size={15}/>
          {gerando ? "Gerando..." : "Baixar PPT"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function RelatoriosPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "COLABORADOR";
  const isCliente = role === "CLIENTE";
  const { cicloAtivo } = useCiclo();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaId>((searchParams.get("aba") as AbaId) ?? "colaborador");
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [realizacoes, setRealizacoes] = useState<Realizacao[]>([]);
  const [metasPeriodo, setMetasPeriodo] = useState<MetaPeriodo[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [areas, setAreas] = useState<{nivel1:string;nivel2?:string|null;nivel3?:string|null;nivel4?:string|null;nivel5?:string|null;centroCusto:string}[]>([]);
  const [exportando, setExportando] = useState(false);
  const [movimentadosSet, setMovimentadosSet] = useState<Set<string>>(new Set());
  const [colaboradoresAll, setColaboradoresAll] = useState<ColaboradorBasico[]>([]);
  const [agrupamentosAll, setAgrupamentosAll] = useState<AgrupamentoBasico[]>([]);

  const carregar = useCallback(async () => {
    if (!cicloAtivo) return;
    const cid = cicloAtivo.id;
    const [dInds, dReal, dMeta, dAtrib, dAreas, dColabs, dAgrup, dMovs] = await Promise.all([
      fetch(`/api/indicadores?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/realizacoes?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/meta-periodos?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/atribuicoes?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/areas?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/colaboradores?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/agrupamentos?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/movimentacoes?cicloId=${cid}`).then(r => r.json()),
    ]);
    const inds: Indicador[] = dInds.indicadores ?? [];
    const comFaixas = await Promise.all(inds.map(async i => {
      const fd = await fetch(`/api/faixas?indicadorId=${i.id}`).then(r => r.json());
      return { ...i, faixas: fd.faixas ?? [] };
    }));
    setIndicadores(comFaixas);
    setRealizacoes(dReal.realizacoes ?? []);
    setMetasPeriodo(dMeta.metasPeriodo ?? []);
    setAtribuicoes(dAtrib.atribuicoes ?? []);
    setAreas(dAreas.areas ?? []);
    setColaboradoresAll(dColabs.colaboradores ?? []);
    setAgrupamentosAll(dAgrup.agrupamentos ?? []);
    const movs: { matricula: string; requerNovoPainel: boolean; statusTratamento: string }[] = dMovs.movimentacoes ?? [];
    setMovimentadosSet(new Set(movs.filter(m => m.requerNovoPainel && m.statusTratamento === "TRATADO").map(m => m.matricula)));
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

  const { notasMap, realMap, orcMap } = useCalcEngine(
    indicadores, realizacoes, metasPeriodo,
    cicloAtivo?.anoFiscal ?? 0,
    cicloAtivo?.mesInicio ?? 1,
    cicloAtivo?.mesFim ?? 12
  );

  if (!cicloAtivo) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <FileText size={40} className="mb-3 text-gray-300"/>
      <p className="font-medium">Selecione um ciclo para ver os relatórios</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Ciclo {cicloAtivo.anoFiscal} — {cicloAtivo.status}</p>
        </div>
        <button onClick={exportarExcel} disabled={exportando}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Download size={15}/>
          {exportando ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {ABAS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1 whitespace-nowrap ${aba === id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {aba === "colaborador" && <RelatColaborador atribuicoes={atribuicoes} notasMap={notasMap} areas={areas} movimentadosSet={movimentadosSet}/>}
      {aba === "indicador"   && <RelatIndicador indicadores={indicadores} notasMap={notasMap} realMap={realMap} orcMap={orcMap} atribuicoes={atribuicoes}/>}
      {aba === "contratacao" && <RelatContratacao atribuicoes={atribuicoes} indicadores={indicadores} notasMap={notasMap}/>}
      {aba === "responsavel" && <RelatResponsavel indicadores={indicadores} notasMap={notasMap} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim}/>}
      {aba === "gestor"      && <RelatGestor atribuicoes={atribuicoes} notasMap={notasMap} movimentadosSet={movimentadosSet}/>}
      {aba === "calibracao"  && <RelatCalibracao atribuicoes={atribuicoes} notasMap={notasMap} movimentadosSet={movimentadosSet}/>}
      {aba === "pendencias"  && <RelatPendencias indicadores={indicadores} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim}/>}
      {aba === "movimentacoes" && <RelatMovimentacoes cicloId={cicloAtivo.id}/>}
      {aba === "sem-painel"  && <RelatSemPainel colaboradoresAll={colaboradoresAll} atribuicoes={atribuicoes} agrupamentos={agrupamentosAll} cicloId={cicloAtivo.id} onAtribuir={carregar} readOnly={isCliente}/>}
      {aba === "nao-apurados" && <RelatNaoApurados indicadores={indicadores} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim}/>}
      {aba === "ppt"          && <RelatPPT atribuicoes={atribuicoes} cicloId={cicloAtivo.id}/>}
      {aba === "carta"        && <RelatCartaPDF atribuicoes={atribuicoes} cicloId={cicloAtivo.id}/>}
    </div>
  );
}

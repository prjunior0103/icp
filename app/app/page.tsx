"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "dashboard" | "scorecard" | "metas" | "realizacoes" | "colaboradores" | "workflow";

interface Cargo { id: number; nome: string; nivelHierarquico: string; targetBonusPerc: number; }
interface CentroCusto { id: number; nome: string; codigo: string; }
interface Empresa { id: number; nome: string; }
interface Colaborador {
  id: number; matricula: string; nomeCompleto: string; email: string;
  salarioBase: number; ativo: boolean;
  cargo: Cargo; centroCusto: CentroCusto; empresa: Empresa;
}
interface CicloICP { id: number; anoFiscal: number; status: string; bonusPool: number | null; }
interface Indicador { id: number; codigo: string; nome: string; tipo: string; abrangencia: string; status: string; }
interface Meta {
  id: number; pesoNaCesta: number; metaAlvo: number; metaMinima: number | null;
  metaMaxima: number | null; status: string;
  indicador: Indicador; centroCusto: CentroCusto | null;
  _count: { colaboradores: number; realizacoes: number };
}
interface Realizacao {
  id: number; mesReferencia: number; anoReferencia: number;
  valorRealizado: number; notaCalculada: number | null;
  premioProjetado: number | null; status: string;
  meta: Meta & { indicador: Indicador };
  colaborador: Colaborador | null;
}
interface WorkflowItem {
  id: number; tipo: string; status: string; descricao: string;
  criadoEm: string; comentario: string | null;
  meta: Meta | null; realizacao: Realizacao | null;
  solicitante: { id: string; name: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtN = (v: number) => `${v.toFixed(1)}%`;
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function notaColor(nota: number | null) {
  if (nota === null) return "text-gray-400";
  if (nota >= 100) return "text-green-600 font-semibold";
  if (nota >= 70) return "text-yellow-600 font-semibold";
  return "text-red-600 font-semibold";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-600",
    ATIVO: "bg-blue-100 text-blue-700",
    APROVADO: "bg-green-100 text-green-700",
    REJEITADO: "bg-red-100 text-red-700",
    PENDENTE: "bg-yellow-100 text-yellow-700",
    RASCUNHO: "bg-gray-100 text-gray-600",
    SUBMETIDO: "bg-blue-100 text-blue-700",
    ENCERRADO: "bg-gray-200 text-gray-500",
    SETUP: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [ciclos, setCiclos] = useState<CicloICP[]>([]);
  const [cicloAtivo, setCicloAtivo] = useState<CicloICP | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [realizacoes, setRealizacoes] = useState<Realizacao[]>([]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [selectedColaborador, setSelectedColaborador] = useState<number | null>(null);
  const [scorecardData, setScorecardData] = useState<{
    notaYTD: number; premioYTD: number; targetAnual: number;
    metas: { meta: Meta; indicador: Indicador; realizacoes: Realizacao[]; notaMedia: number; premioProjetado: number }[];
  } | null>(null);

  // Realizacoes form state
  const [showRealizacaoForm, setShowRealizacaoForm] = useState(false);
  const [realizacaoForm, setRealizacaoForm] = useState({
    metaId: "", colaboradorId: "", mesReferencia: "", anoReferencia: "2026", valorRealizado: "",
  });
  const [filterColabId, setFilterColabId] = useState<string>("");
  const [filterMes, setFilterMes] = useState<string>("");

  const role = "GUARDIAO";

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadCiclos = useCallback(async () => {
    const res = await fetch("/api/ciclos").then((r) => r.json()).catch(() => ({ data: [] }));
    const list: CicloICP[] = res.data ?? [];
    setCiclos(list);
    const ativo = list.find((c) => c.status === "ATIVO") ?? list[0] ?? null;
    setCicloAtivo(ativo);
    return ativo;
  }, []);

  const loadColaboradores = useCallback(async () => {
    const res = await fetch("/api/colaboradores").then((r) => r.json()).catch(() => ({ data: [] }));
    setColaboradores(res.data ?? []);
  }, []);

  const loadMetas = useCallback(async (cicloId?: number) => {
    const url = cicloId ? `/api/metas?cicloId=${cicloId}` : "/api/metas";
    const res = await fetch(url).then((r) => r.json()).catch(() => ({ data: [] }));
    setMetas(res.data ?? []);
  }, []);

  const loadRealizacoes = useCallback(async () => {
    const res = await fetch("/api/realizacoes").then((r) => r.json()).catch(() => ({ data: [] }));
    setRealizacoes(res.data ?? []);
  }, []);

  const loadWorkflow = useCallback(async () => {
    const res = await fetch("/api/workflow?status=PENDENTE").then((r) => r.json()).catch(() => ({ data: [] }));
    setWorkflowItems(res.data ?? []);
  }, []);

  const checkSeeded = useCallback(async () => {
    // Quick check: if there are colaboradores, we're seeded
    const res = await fetch("/api/colaboradores").then((r) => r.json()).catch(() => ({ data: [] }));
    setSeeded((res.data ?? []).length > 0);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ativo = await loadCiclos();
      await Promise.all([loadColaboradores(), loadMetas(ativo?.id), loadRealizacoes(), loadWorkflow(), checkSeeded()]);
      setLoading(false);
    })();
  }, [loadCiclos, loadColaboradores, loadMetas, loadRealizacoes, loadWorkflow, checkSeeded]);

  async function handleSeed() {
    setSeedLoading(true);
    await fetch("/api/seed", { method: "POST" });
    const ativo = await loadCiclos();
    await Promise.all([loadColaboradores(), loadMetas(ativo?.id), loadRealizacoes(), loadWorkflow()]);
    setSeeded(true);
    setSeedLoading(false);
  }

  async function loadScorecard(colaboradorId: number, cicloId: number) {
    const res = await fetch(`/api/scorecard?colaboradorId=${colaboradorId}&cicloId=${cicloId}`)
      .then((r) => r.json()).catch(() => null);
    if (res?.data) setScorecardData(res.data);
  }

  useEffect(() => {
    if (selectedColaborador && cicloAtivo) {
      loadScorecard(selectedColaborador, cicloAtivo.id);
    } else {
      setScorecardData(null);
    }
  }, [selectedColaborador, cicloAtivo]);

  async function handleApproveMeta(id: number) {
    await fetch("/api/metas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "APROVADO" }),
    });
    loadMetas(cicloAtivo?.id);
  }

  async function handleWorkflowAction(id: number, status: "APROVADO" | "REJEITADO") {
    await fetch("/api/workflow", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadWorkflow();
    loadMetas(cicloAtivo?.id);
  }

  async function handleLancarRealizacao(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/realizacoes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...realizacaoForm,
        mesReferencia: Number(realizacaoForm.mesReferencia),
        anoReferencia: Number(realizacaoForm.anoReferencia),
        valorRealizado: Number(realizacaoForm.valorRealizado),
        colaboradorId: realizacaoForm.colaboradorId ? Number(realizacaoForm.colaboradorId) : undefined,
      }),
    });
    setShowRealizacaoForm(false);
    setRealizacaoForm({ metaId: "", colaboradorId: "", mesReferencia: "", anoReferencia: "2026", valorRealizado: "" });
    loadRealizacoes();
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const realizacoesFiltradas = realizacoes.filter((r) => {
    if (filterColabId && String(r.colaborador?.id) !== filterColabId) return false;
    if (filterMes && String(r.mesReferencia) !== filterMes) return false;
    return true;
  });

  const pendingCount = workflowItems.length;

  // Dashboard top colaboradores mock
  const topColaboradores = colaboradores.slice(0, 5).map((c) => ({
    ...c,
    notaYTD: Math.random() * 40 + 70,
    premioYTD: c.salarioBase * 12 * (c.cargo.targetBonusPerc / 100) * 0.85,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-400 rounded flex items-center justify-center font-bold text-sm">ICP</div>
            <span className="font-semibold text-base">Sistema ICP</span>
          </div>

          {/* Ciclo selector */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-blue-300 text-xs">Ciclo:</span>
            <select
              value={cicloAtivo?.id ?? ""}
              onChange={(e) => {
                const c = ciclos.find((x) => x.id === Number(e.target.value));
                if (c) { setCicloAtivo(c); loadMetas(c.id); }
              }}
              className="bg-blue-800 border border-blue-600 text-white text-sm rounded px-2 py-1"
            >
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>{c.anoFiscal} — {c.status}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="bg-purple-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">{role}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-blue-200 hover:text-white text-sm border border-blue-600 hover:border-blue-400 rounded px-3 py-1 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Seed Banner */}
      {!seeded && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-amber-800 text-sm">
              Banco de dados vazio. Carregue os dados de demonstração para explorar o sistema.
            </p>
            <button
              onClick={handleSeed}
              disabled={seedLoading}
              className="ml-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
            >
              {seedLoading ? "Carregando..." : "Carregar Dados Demo"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {(["dashboard","scorecard","metas","realizacoes","colaboradores","workflow"] as TabId[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors capitalize flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "workflow" ? "Workflow" :
                 tab === "realizacoes" ? "Realizações" :
                 tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "workflow" && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

        {/* ── DASHBOARD ─────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Colaboradores", value: colaboradores.length, color: "blue" },
                { label: "Metas Ativas", value: metas.filter((m) => m.status !== "DRAFT").length, color: "green" },
                { label: "Realizações no Mês", value: realizacoes.filter((r) => r.mesReferencia === new Date().getMonth() + 1).length, color: "indigo" },
                { label: "Pendências Workflow", value: pendingCount, color: "amber" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-sm text-gray-500">{kpi.label}</p>
                  <p className={`text-3xl font-bold mt-1 text-${kpi.color}-600`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Top Colaboradores */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Top Colaboradores — Prêmio Projetado YTD</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Nome","Cargo","Centro de Custo","Nota YTD","Prêmio YTD"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topColaboradores.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nomeCompleto}</td>
                        <td className="px-4 py-3 text-gray-600">{c.cargo.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{c.centroCusto.nome}</td>
                        <td className={`px-4 py-3 ${notaColor(c.notaYTD)}`}>{fmtN(c.notaYTD)}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{fmt(c.premioYTD)}</td>
                      </tr>
                    ))}
                    {topColaboradores.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum dado disponível</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SCORECARD ─────────────────────────────────────────────────── */}
        {activeTab === "scorecard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Scorecard Individual</h2>
              <select
                value={selectedColaborador ?? ""}
                onChange={(e) => setSelectedColaborador(e.target.value ? Number(e.target.value) : null)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecionar colaborador...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>
                ))}
              </select>
            </div>

            {!selectedColaborador && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                Selecione um colaborador para ver o scorecard
              </div>
            )}

            {selectedColaborador && scorecardData && (
              <>
                {/* Hero cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm col-span-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Nota YTD</p>
                    <p className={`text-4xl font-bold mt-1 ${notaColor(scorecardData.notaYTD)}`}>
                      {fmtN(scorecardData.notaYTD)}
                    </p>
                  </div>
                  <div className="bg-blue-900 text-white rounded-xl p-6 shadow-sm col-span-2">
                    <p className="text-xs text-blue-300 uppercase tracking-wide">Prêmio Projetado YTD</p>
                    <p className="text-4xl font-bold mt-1">{fmt(scorecardData.premioYTD)}</p>
                    <p className="text-blue-300 text-sm mt-2">
                      Target anual: {fmt(scorecardData.targetAnual)}
                    </p>
                  </div>
                </div>

                {/* Metas table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">Metas e Resultados</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {["Indicador","Peso","Alvo","Realizado (últ.)","Nota Média","Prêmio"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scorecardData.metas.map((item, i) => {
                          const lastR = item.realizacoes[item.realizacoes.length - 1];
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">{item.indicador.nome}</td>
                              <td className="px-4 py-3 text-gray-600">{item.meta.pesoNaCesta}%</td>
                              <td className="px-4 py-3 text-gray-600">{item.meta.metaAlvo.toLocaleString("pt-BR")}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {lastR ? lastR.valorRealizado.toLocaleString("pt-BR") : "—"}
                              </td>
                              <td className={`px-4 py-3 ${notaColor(item.notaMedia)}`}>{fmtN(item.notaMedia)}</td>
                              <td className="px-4 py-3 text-gray-800 font-medium">{fmt(item.premioProjetado)}</td>
                            </tr>
                          );
                        })}
                        {scorecardData.metas.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sem metas vinculadas</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── METAS ─────────────────────────────────────────────────────── */}
        {activeTab === "metas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Metas</h2>
              <p className="text-sm text-gray-500">{metas.length} metas encontradas</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["#","Indicador","CC","Peso","Alvo","Colaboradores","Status",""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metas.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{m.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{m.indicador.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{m.centroCusto?.nome ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{m.pesoNaCesta}%</td>
                        <td className="px-4 py-3 text-gray-600">{m.metaAlvo.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 text-gray-600">{m._count.colaboradores}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-3">
                          {role === "GUARDIAO" && m.status === "DRAFT" && (
                            <button
                              onClick={() => handleApproveMeta(m.id)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded transition-colors"
                            >
                              Aprovar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {metas.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhuma meta cadastrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REALIZAÇÕES ───────────────────────────────────────────────── */}
        {activeTab === "realizacoes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-800">Realizações</h2>
              <div className="flex items-center gap-3">
                {/* Filters */}
                <select
                  value={filterColabId}
                  onChange={(e) => setFilterColabId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Todos os colaboradores</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nomeCompleto}</option>
                  ))}
                </select>
                <select
                  value={filterMes}
                  onChange={(e) => setFilterMes(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Todos os meses</option>
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRealizacaoForm(!showRealizacaoForm)}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  + Lançar Realização
                </button>
              </div>
            </div>

            {/* Inline form */}
            {showRealizacaoForm && (
              <form onSubmit={handleLancarRealizacao} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meta</label>
                  <select required value={realizacaoForm.metaId} onChange={(e) => setRealizacaoForm({ ...realizacaoForm, metaId: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Selecionar...</option>
                    {metas.map((m) => (
                      <option key={m.id} value={m.id}>#{m.id} — {m.indicador.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Colaborador (opcional)</label>
                  <select value={realizacaoForm.colaboradorId} onChange={(e) => setRealizacaoForm({ ...realizacaoForm, colaboradorId: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Corporativo</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>{c.nomeCompleto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mês</label>
                  <select required value={realizacaoForm.mesReferencia} onChange={(e) => setRealizacaoForm({ ...realizacaoForm, mesReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Selecionar...</option>
                    {MESES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ano</label>
                  <input type="number" required value={realizacaoForm.anoReferencia}
                    onChange={(e) => setRealizacaoForm({ ...realizacaoForm, anoReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor Realizado</label>
                  <input type="number" step="any" required value={realizacaoForm.valorRealizado}
                    onChange={(e) => setRealizacaoForm({ ...realizacaoForm, valorRealizado: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setShowRealizacaoForm(false)}
                    className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-1.5 rounded transition-colors hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Meta / Indicador","Colaborador","Mês/Ano","Realizado","Nota","Prêmio","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {realizacoesFiltradas.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.meta?.indicador?.nome ?? `Meta #${r.meta?.id}`}</td>
                        <td className="px-4 py-3 text-gray-600">{r.colaborador?.nomeCompleto ?? "Corporativo"}</td>
                        <td className="px-4 py-3 text-gray-600">{MESES[(r.mesReferencia ?? 1) - 1]}/{r.anoReferencia}</td>
                        <td className="px-4 py-3 text-gray-600">{r.valorRealizado?.toLocaleString("pt-BR")}</td>
                        <td className={`px-4 py-3 ${notaColor(r.notaCalculada)}`}>
                          {r.notaCalculada !== null ? fmtN(r.notaCalculada) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{r.premioProjetado ? fmt(r.premioProjetado) : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                    {realizacoesFiltradas.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhuma realização encontrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── COLABORADORES ─────────────────────────────────────────────── */}
        {activeTab === "colaboradores" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Colaboradores</h2>
              <button
                onClick={() => alert("Funcionalidade em desenvolvimento. Use a API POST /api/colaboradores.")}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                + Novo Colaborador
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Matrícula","Nome","Cargo","Centro de Custo","Salário Base","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colaboradores.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.matricula}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nomeCompleto}</td>
                        <td className="px-4 py-3 text-gray-600">{c.cargo.nome}
                          <span className="ml-1.5 text-xs text-gray-400">{c.cargo.nivelHierarquico}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.centroCusto.nome}</td>
                        <td className="px-4 py-3 text-gray-800">{fmt(c.salarioBase)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {c.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {colaboradores.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum colaborador cadastrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── WORKFLOW ──────────────────────────────────────────────────── */}
        {activeTab === "workflow" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Workflow — Caixa de Entrada
                {pendingCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-sm rounded-full px-2 py-0.5">{pendingCount}</span>
                )}
              </h2>
            </div>

            {role !== "GUARDIAO" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
                Apenas o papel GUARDIÃO pode visualizar e agir sobre o workflow.
              </div>
            )}

            {role === "GUARDIAO" && (
              <div className="space-y-3">
                {workflowItems.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                          {item.tipo.replace(/_/g, " ")}
                        </span>
                        <StatusBadge status={item.status} />
                        <span className="text-xs text-gray-400">
                          {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
                      {item.comentario && (
                        <p className="text-xs text-gray-500 mt-1">{item.comentario}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Solicitante: {item.solicitante?.name ?? "Sistema"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleWorkflowAction(item.id, "APROVADO")}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleWorkflowAction(item.id, "REJEITADO")}
                        className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                      >
                        Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
                {workflowItems.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    <p className="text-lg mb-1">Nenhuma pendência</p>
                    <p className="text-sm">Todos os itens foram processados.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-center text-xs text-gray-400">
        Sistema ICP — Incentivo de Curto Prazo {cicloAtivo ? `| Ciclo ${cicloAtivo.anoFiscal}` : ""}
      </footer>
    </div>
  );
}

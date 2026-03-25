"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "dashboard" | "scorecard" | "metas" | "realizacoes" | "colaboradores" | "workflow" | "janelas" | "importacao";

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
interface JanelaApuracao {
  id: number; cicloId: number; mesReferencia: number; anoReferencia: number;
  dataAbertura: string; dataFechamento: string; status: string;
  isOpen: boolean; waiversPendentes: number;
}
interface Waiver {
  id: number; janelaId: number; colaboradorId: number; justificativa: string;
  novaDataLimite: string; status: string; criadoEm: string;
  janela: { id: number; mesReferencia: number; anoReferencia: number };
  colaborador: { id: number; nomeCompleto: string; matricula: string } | null;
}
interface DashboardData {
  totalColaboradores: number; totalMetasAtivas: number; workflowPendente: number;
  bonusPoolUsado: number; bonusPoolTotal: number | null;
  alertasEngajamento: string[];
  topColaboradores: { id: number; nome: string; cargo: string; notaMedia: number; premioYTD: number }[];
  realizacoesMes: number;
  janelaAtual: (JanelaApuracao & { isOpen: boolean }) | null;
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
    ABERTA: "bg-green-100 text-green-700",
    FECHADA: "bg-red-100 text-red-700",
    PRORROGADA: "bg-orange-100 text-orange-700",
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

  // Janelas state
  const [janelas, setJanelas] = useState<JanelaApuracao[]>([]);
  const [showJanelaForm, setShowJanelaForm] = useState(false);
  const [janelaForm, setJanelaForm] = useState({
    mesReferencia: "", anoReferencia: "2026", dataAbertura: "", dataFechamento: "",
  });

  // Waivers state
  const [waivers, setWaivers] = useState<Waiver[]>([]);

  // Dashboard API state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Bulk import state
  const [importForm, setImportForm] = useState({
    mesReferencia: "", anoReferencia: "2026", csvText: "",
  });
  const [importResult, setImportResult] = useState<{ processed: number; erros: { matricula: string; motivo: string }[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const role: string = "GUARDIAO";

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

  const loadJanelas = useCallback(async (cicloId?: number) => {
    if (!cicloId) return;
    const res = await fetch(`/api/janelas?cicloId=${cicloId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setJanelas(res.data ?? []);
  }, []);

  const loadWaivers = useCallback(async () => {
    const res = await fetch("/api/waivers?status=PENDENTE").then((r) => r.json()).catch(() => ({ data: [] }));
    setWaivers(res.data ?? []);
  }, []);

  const loadDashboard = useCallback(async (cicloId?: number) => {
    if (!cicloId) return;
    const res = await fetch(`/api/dashboard?cicloId=${cicloId}`).then((r) => r.json()).catch(() => ({ data: null }));
    if (res.data) setDashboardData(res.data);
  }, []);

  const checkSeeded = useCallback(async () => {
    const res = await fetch("/api/colaboradores").then((r) => r.json()).catch(() => ({ data: [] }));
    setSeeded((res.data ?? []).length > 0);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ativo = await loadCiclos();
      await Promise.all([
        loadColaboradores(), loadMetas(ativo?.id), loadRealizacoes(),
        loadWorkflow(), checkSeeded(), loadJanelas(ativo?.id),
        loadWaivers(), loadDashboard(ativo?.id),
      ]);
      setLoading(false);
    })();
  }, [loadCiclos, loadColaboradores, loadMetas, loadRealizacoes, loadWorkflow, checkSeeded, loadJanelas, loadWaivers, loadDashboard]);

  async function handleSeed() {
    setSeedLoading(true);
    await fetch("/api/seed", { method: "POST" });
    const ativo = await loadCiclos();
    await Promise.all([
      loadColaboradores(), loadMetas(ativo?.id), loadRealizacoes(),
      loadWorkflow(), loadJanelas(ativo?.id), loadWaivers(), loadDashboard(ativo?.id),
    ]);
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

  async function handleCreateJanela(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    await fetch("/api/janelas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cicloId: cicloAtivo.id,
        mesReferencia: Number(janelaForm.mesReferencia),
        anoReferencia: Number(janelaForm.anoReferencia),
        dataAbertura: janelaForm.dataAbertura,
        dataFechamento: janelaForm.dataFechamento,
      }),
    });
    setShowJanelaForm(false);
    setJanelaForm({ mesReferencia: "", anoReferencia: "2026", dataAbertura: "", dataFechamento: "" });
    loadJanelas(cicloAtivo.id);
  }

  async function handleFecharJanela(id: number) {
    await fetch("/api/janelas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "FECHADA" }),
    });
    loadJanelas(cicloAtivo?.id);
  }

  async function handleWaiverAction(id: number, status: "APROVADO" | "REJEITADO") {
    await fetch("/api/waivers", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadWaivers();
    loadJanelas(cicloAtivo?.id);
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    setImportLoading(true);
    setImportResult(null);
    const rows = importForm.csvText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [matricula, metaCodigo, valorRealizado, observacao] = line.split(";");
        return { matricula, metaCodigo, valorRealizado: Number(valorRealizado), observacao };
      });
    const res = await fetch("/api/bulk-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cicloId: cicloAtivo.id,
        mesReferencia: Number(importForm.mesReferencia),
        anoReferencia: Number(importForm.anoReferencia),
        rows,
      }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.data) setImportResult(res.data);
    setImportLoading(false);
    loadRealizacoes();
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const realizacoesFiltradas = realizacoes.filter((r) => {
    if (filterColabId && String(r.colaborador?.id) !== filterColabId) return false;
    if (filterMes && String(r.mesReferencia) !== filterMes) return false;
    return true;
  });

  const pendingCount = workflowItems.length;

  const janelaAtualHeader = janelas.find((j) => j.isOpen) ?? null;

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
                if (c) { setCicloAtivo(c); loadMetas(c.id); loadJanelas(c.id); loadDashboard(c.id); }
              }}
              className="bg-blue-800 border border-blue-600 text-white text-sm rounded px-2 py-1"
            >
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>{c.anoFiscal} — {c.status}</option>
              ))}
            </select>
          </div>

          {/* Janela status indicator */}
          {janelaAtualHeader ? (
            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">
              Janela {MESES[janelaAtualHeader.mesReferencia - 1]} ABERTA
            </span>
          ) : (
            <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full font-medium">
              Sem janela aberta
            </span>
          )}

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
            {(["dashboard","scorecard","metas","realizacoes","colaboradores","workflow","janelas","importacao"] as TabId[]).map((tab) => (
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
                 tab === "janelas" ? "Janelas" :
                 tab === "importacao" ? "Importação BP" :
                 tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "workflow" && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
                {tab === "workflow" && waivers.length > 0 && (
                  <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {waivers.length}
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
                { label: "Total Colaboradores", value: dashboardData?.totalColaboradores ?? colaboradores.length, color: "blue" },
                { label: "Metas Ativas", value: dashboardData?.totalMetasAtivas ?? metas.filter((m) => m.status !== "DRAFT").length, color: "green" },
                { label: "Realizações no Mês", value: dashboardData?.realizacoesMes ?? realizacoes.filter((r) => r.mesReferencia === new Date().getMonth() + 1).length, color: "indigo" },
                { label: "Pendências Workflow", value: dashboardData?.workflowPendente ?? pendingCount, color: "amber" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-sm text-gray-500">{kpi.label}</p>
                  <p className={`text-3xl font-bold mt-1 text-${kpi.color}-600`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Bonus Pool Card */}
            {dashboardData && dashboardData.bonusPoolTotal !== null && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Bonus Pool</h3>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-500">Utilizado</span>
                  <span className="font-medium">{fmt(dashboardData.bonusPoolUsado)} / {fmt(dashboardData.bonusPoolTotal)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (dashboardData.bonusPoolUsado / dashboardData.bonusPoolTotal) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {((dashboardData.bonusPoolUsado / dashboardData.bonusPoolTotal) * 100).toFixed(1)}% utilizado
                </p>
              </div>
            )}

            {/* Alertas de Engajamento */}
            {dashboardData && dashboardData.alertasEngajamento.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
                <h3 className="font-semibold text-orange-800 mb-2">Alertas de Engajamento</h3>
                <p className="text-sm text-orange-700 mb-2">
                  Centros de custo sem realizações nos últimos 2 meses:
                </p>
                <div className="flex flex-wrap gap-2">
                  {dashboardData.alertasEngajamento.map((cc) => (
                    <span key={cc} className="bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-full font-medium">{cc}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Colaboradores */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Top Colaboradores — Prêmio Projetado YTD</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Nome","Cargo","Nota Média","Prêmio YTD"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(dashboardData?.topColaboradores ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nome}</td>
                        <td className="px-4 py-3 text-gray-600">{c.cargo}</td>
                        <td className={`px-4 py-3 ${notaColor(c.notaMedia)}`}>{fmtN(c.notaMedia)}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{fmt(c.premioYTD)}</td>
                      </tr>
                    ))}
                    {(dashboardData?.topColaboradores ?? []).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum dado disponível</td></tr>
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
                    <p className="text-blue-300 text-sm mt-2">Target anual: {fmt(scorecardData.targetAnual)}</p>
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
              <>
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
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                      <p className="text-lg mb-1">Nenhuma pendência</p>
                      <p className="text-sm">Todos os itens foram processados.</p>
                    </div>
                  )}
                </div>

                {/* Waivers section */}
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    Solicitações de Prorrogação (Waivers)
                    {waivers.length > 0 && (
                      <span className="bg-orange-500 text-white text-xs rounded-full px-2 py-0.5">{waivers.length} pendente(s)</span>
                    )}
                  </h3>
                  {waivers.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                      Sem solicitações de prorrogação pendentes.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {["Colaborador","Janela","Justificativa","Nova Data Limite","Ações"].map((h) => (
                                <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {waivers.map((w) => (
                              <tr key={w.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-800">
                                  {w.colaborador?.nomeCompleto ?? `#${w.colaboradorId}`}
                                  <br /><span className="text-xs text-gray-400 font-mono">{w.colaborador?.matricula}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {MESES[(w.janela.mesReferencia ?? 1) - 1]}/{w.janela.anoReferencia}
                                </td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{w.justificativa}</td>
                                <td className="px-4 py-3 text-gray-600">
                                  {new Date(w.novaDataLimite).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleWaiverAction(w.id, "APROVADO")}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-2.5 py-1 rounded transition-colors"
                                    >
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => handleWaiverAction(w.id, "REJEITADO")}
                                      className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded transition-colors"
                                    >
                                      Rejeitar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── JANELAS ───────────────────────────────────────────────────── */}
        {activeTab === "janelas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Janelas de Apuração</h2>
              {role === "GUARDIAO" && (
                <button
                  onClick={() => setShowJanelaForm(!showJanelaForm)}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  + Nova Janela
                </button>
              )}
            </div>

            {showJanelaForm && (
              <form onSubmit={handleCreateJanela} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mês</label>
                  <select required value={janelaForm.mesReferencia}
                    onChange={(e) => setJanelaForm({ ...janelaForm, mesReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Selecionar...</option>
                    {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ano</label>
                  <input type="number" required value={janelaForm.anoReferencia}
                    onChange={(e) => setJanelaForm({ ...janelaForm, anoReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Abertura</label>
                  <input type="date" required value={janelaForm.dataAbertura}
                    onChange={(e) => setJanelaForm({ ...janelaForm, dataAbertura: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Fechamento</label>
                  <input type="date" required value={janelaForm.dataFechamento}
                    onChange={(e) => setJanelaForm({ ...janelaForm, dataFechamento: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2 md:col-span-4 flex gap-2">
                  <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors">
                    Criar Janela
                  </button>
                  <button type="button" onClick={() => setShowJanelaForm(false)}
                    className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-1.5 rounded hover:bg-gray-50 transition-colors">
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
                      {["Mês","Ano","Abertura","Fechamento","Status","Waivers","Ação"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {janelas.map((j) => (
                      <tr key={j.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{MESES[j.mesReferencia - 1]}</td>
                        <td className="px-4 py-3 text-gray-600">{j.anoReferencia}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(j.dataAbertura).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(j.dataFechamento).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={j.status} />
                          {j.isOpen && <span className="ml-1.5 text-xs text-green-600 font-medium">• ao vivo</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {j.waiversPendentes > 0 ? (
                            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                              {j.waiversPendentes} pendente(s)
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {role === "GUARDIAO" && j.status !== "FECHADA" && (
                            <button
                              onClick={() => handleFecharJanela(j.id)}
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded transition-colors"
                            >
                              Fechar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {janelas.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhuma janela cadastrada para este ciclo</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── IMPORTAÇÃO BP ─────────────────────────────────────────────── */}
        {activeTab === "importacao" && (role === "BP" || role === "GUARDIAO") && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Importação em Lote — BP Consolidador</h2>

            <form onSubmit={handleBulkImport} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mês Referência</label>
                  <select required value={importForm.mesReferencia}
                    onChange={(e) => setImportForm({ ...importForm, mesReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Selecionar...</option>
                    {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ano Referência</label>
                  <input type="number" required value={importForm.anoReferencia}
                    onChange={(e) => setImportForm({ ...importForm, anoReferencia: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Dados CSV <span className="text-gray-400 font-normal">(formato: matricula;codigo_indicador;valor_realizado[;observacao])</span>
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder={"EMP001;REC-001;1500000;Resultado forte\nEMP002;EBITDA-001;25.5"}
                  value={importForm.csvText}
                  onChange={(e) => setImportForm({ ...importForm, csvText: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={importLoading}
                className="bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {importLoading ? "Processando..." : "Processar Importação"}
              </button>
            </form>

            {importResult && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 text-green-700 rounded-lg p-3 text-center min-w-[80px]">
                    <p className="text-2xl font-bold">{importResult.processed}</p>
                    <p className="text-xs">processados</p>
                  </div>
                  {importResult.erros.length > 0 && (
                    <div className="bg-red-100 text-red-700 rounded-lg p-3 text-center min-w-[80px]">
                      <p className="text-2xl font-bold">{importResult.erros.length}</p>
                      <p className="text-xs">erros</p>
                    </div>
                  )}
                </div>

                {importResult.erros.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2">Erros de importação:</h4>
                    <div className="space-y-1.5">
                      {importResult.erros.map((err, i) => (
                        <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm flex gap-3">
                          <span className="font-mono text-red-700 font-medium">{err.matricula}</span>
                          <span className="text-red-600">{err.motivo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "importacao" && role !== "BP" && role !== "GUARDIAO" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center text-yellow-800">
            Acesso restrito a papéis BP e GUARDIÃO.
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

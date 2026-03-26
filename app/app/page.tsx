"use client";

import React, { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import CockpitColaborador from "@/components/CockpitColaborador";
import PainelGestor from "@/components/PainelGestor";
import MasterDashboard from "@/components/MasterDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "dashboard" | "cockpit" | "gestor" | "scorecard" | "indicadores" | "metas" | "atingimento" | "elegiveis" | "relatorio" | "conferencia" | "movimentacoes" | "realizacoes" | "colaboradores" | "workflow" | "janelas" | "importacao" | "cadastros" | "ajuda";

interface Cargo { id: number; nome: string; codigo: string; nivelHierarquico: string; targetBonusPerc: number; salarioTeto?: number | null; _count?: { colaboradores: number }; }
interface CentroCusto { id: number; nome: string; codigo: string; nivel?: number; empresaId?: number; empresa?: { id: number; nome: string; codigo: string }; _count?: { colaboradores: number; metas: number }; }
interface Empresa { id: number; nome: string; codigo: string; _count?: { colaboradores: number; centrosCusto: number }; }
interface Colaborador {
  id: number; matricula: string; nomeCompleto: string; email: string;
  salarioBase: number; ativo: boolean;
  cargo: Cargo; centroCusto: CentroCusto; empresa: Empresa;
}
interface CicloICP { id: number; anoFiscal: number; status: string; bonusPool: number | null; mesInicio: number; mesFim: number; }
interface Indicador { id: number; codigo: string; nome: string; tipo: string; polaridade: string; abrangencia: string; unidade: string; status: string; diretivo?: string; analistaResp?: string; origemDado?: string; divisorId?: number | null; divisor?: { id: number; nome: string } | null; }
interface Meta {
  id: number; pesoNaCesta: number; metaAlvo: number; metaMinima: number | null;
  metaMaxima: number | null; status: string; smart?: string | null;
  indicador: Indicador; centroCusto: CentroCusto | null;
  _count: { colaboradores: number; realizacoes: number; filhas: number };
  colaboradorIds: number[];
  parentMetaId: number | null;
  parentMeta: { id: number; indicador: { nome: string }; centroCusto: { nome: string } | null } | null;
}
interface MetaHistorico { id: number; metaId: number; campo: string; valorAntes: string | null; valorDepois: string | null; usuario: string | null; criadoEm: string; }
interface PlanoAcao { id: number; metaId: number; descricao: string; responsavel: string | null; prazo: string | null; status: string; criadoEm: string; }
interface BibliotecaMeta { id: number; nome: string; descricao: string | null; indicadorNome: string; unidade: string; tipo: string; polaridade: string; abrangencia: string; metaMinima: number | null; metaAlvo: number | null; metaMaxima: number | null; pesoSugerido: number; }
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
interface MovimentacaoRH {
  id: number; tipo: string; dataEfetiva: string; status: string; criadoEm: string;
  colaboradorId: number;
  colaborador: { id: number; nomeCompleto: string; matricula: string; cargo: Cargo; centroCusto: CentroCusto };
  cargoAnterior: Cargo | null; cargoNovo: Cargo | null;
  ccAnterior: CentroCusto | null; ccNovo: CentroCusto | null;
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
  type BadgeStyle = { bg: string; text: string; border: string };
  const map: Record<string, BadgeStyle> = {
    DRAFT:      { bg: "var(--muted-bg)",  text: "var(--muted-text)", border: "var(--muted-border)" },
    RASCUNHO:   { bg: "var(--muted-bg)",  text: "var(--muted-text)", border: "var(--muted-border)" },
    ENCERRADO:  { bg: "var(--muted-bg)",  text: "var(--muted-text)", border: "var(--muted-border)" },
    CANCELADO:  { bg: "var(--muted-bg)",  text: "var(--muted-text)", border: "var(--muted-border)" },
    ATIVO:      { bg: "var(--info-bg)",   text: "var(--info-text)",  border: "var(--info-border)"  },
    SUBMETIDO:  { bg: "var(--info-bg)",   text: "var(--info-text)",  border: "var(--info-border)"  },
    APROVADO:   { bg: "var(--ok-bg)",     text: "var(--ok-text)",    border: "var(--ok-border)"    },
    ABERTA:     { bg: "var(--ok-bg)",     text: "var(--ok-text)",    border: "var(--ok-border)"    },
    REJEITADO:  { bg: "var(--err-bg)",    text: "var(--err-text)",   border: "var(--err-border)"   },
    FECHADA:    { bg: "var(--err-bg)",    text: "var(--err-text)",   border: "var(--err-border)"   },
    PENDENTE:   { bg: "var(--warn-bg)",   text: "var(--warn-text)",  border: "var(--warn-border)"  },
    PRORROGADA: { bg: "var(--warn-bg)",   text: "var(--warn-text)",  border: "var(--warn-border)"  },
    SETUP:      { bg: "#f5f3ff",          text: "#6d28d9",           border: "rgba(109,40,217,0.2)" },
  };
  const s = map[status] ?? map.DRAFT;
  return (
    <span
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded tracking-wide"
    >
      {status}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-medium text-sm" style={{ color: "var(--ink)" }}>{title}</p>
      <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--ink-muted)" }}>{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4 text-xs">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Sidebar navigation groups ────────────────────────────────────────────────

interface NavGroup {
  name: string;
  tabs: { id: TabId; label: string }[];
}

const TAB_GROUPS: NavGroup[] = [
  {
    name: "Análise",
    tabs: [
      { id: "dashboard",   label: "Dashboard" },
      { id: "cockpit",     label: "Cockpit" },
      { id: "gestor",      label: "Painel Gestor" },
      { id: "scorecard",   label: "Scorecard" },
    ],
  },
  {
    name: "Operações",
    tabs: [
      { id: "indicadores", label: "Indicadores" },
      { id: "metas",       label: "Metas" },
      { id: "realizacoes", label: "Realizações" },
      { id: "atingimento", label: "Atingimento" },
    ],
  },
  {
    name: "Pessoas",
    tabs: [
      { id: "colaboradores",  label: "Colaboradores" },
      { id: "elegiveis",      label: "Elegíveis" },
      { id: "movimentacoes",  label: "Movimentações RH" },
    ],
  },
  {
    name: "Controle",
    tabs: [
      { id: "conferencia", label: "Conferência" },
      { id: "workflow",    label: "Workflow" },
      { id: "janelas",     label: "Janelas" },
      { id: "relatorio",   label: "Relatório" },
    ],
  },
  {
    name: "Configuração",
    tabs: [
      { id: "importacao",  label: "Importação BP" },
      { id: "cadastros",   label: "Cadastros" },
      { id: "ajuda",       label: "Ajuda" },
    ],
  },
];

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
  const [cockpitColId, setCockpitColId] = useState<number | null>(null);
  const [gestorColId, setGestorColId] = useState<number | null>(null);
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

  // Indicadores state
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);

  // Novo Indicador form state
  const [showIndicadorForm, setShowIndicadorForm] = useState(false);
  const [indicadorForm, setIndicadorForm] = useState({
    codigo: "", nome: "", tipo: "VOLUME_FINANCEIRO", polaridade: "MAIOR_MELHOR",
    abrangencia: "CORPORATIVO", unidade: "%", descricao: "",
    diretivo: "", analistaResp: "", origemDado: "",
    isDivisivel: false, divisorId: "",
  });

  // MetaColaborador assignment
  const [assigningMetaId, setAssigningMetaId] = useState<number | null>(null);
  const [assignColabId, setAssignColabId] = useState<string>("");

  // Nova Meta form state
  const [showMetaForm, setShowMetaForm] = useState(false);
  const [metaForm, setMetaForm] = useState({
    indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "",
    metaMinima: "", metaMaxima: "", parentMetaId: "",
    smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "",
  });
  const [cascateandoMetaId, setCascateandoMetaId] = useState<number | null>(null);
  const [cloningMetaId, setCloningMetaId] = useState<number | null>(null);

  // Reset
  const [resetLoading, setResetLoading] = useState(false);
  async function handleReset() {
    if (!confirm("Isso apaga TODOS os dados do banco. Confirma?")) return;
    setResetLoading(true);
    const res = await fetch("/api/reset", { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (res?.data) {
      addToast("Banco limpo com sucesso.", "ok");
      const ativo = await loadCiclos();
      await Promise.all([loadColaboradores(), loadMetas(ativo?.id), loadRealizacoes(), loadWorkflow(), loadIndicadores(ativo?.id), loadCentrosCusto()]);
      setSeeded(false);
    } else {
      addToast("Erro ao limpar banco.", "err");
    }
    setResetLoading(false);
  }

  // Toast notifications
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "ok" | "err" | "info" }[]>([]);
  function addToast(msg: string, type: "ok" | "err" | "info" = "ok") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState<{ metaId: number; field: "pesoNaCesta" | "metaAlvo" | "metaMinima" | "metaMaxima"; value: string } | null>(null);

  // Meta tree view toggle
  const [showMetaTree, setShowMetaTree] = useState(false);

  // Planos de Ação
  const [planosAcao, setPlanosAcao] = useState<PlanoAcao[]>([]);
  const [expandedPlanoMetaId, setExpandedPlanoMetaId] = useState<number | null>(null);
  const [planoForm, setPlanoForm] = useState({ descricao: "", responsavel: "", prazo: "" });
  const [showPlanoForm, setShowPlanoForm] = useState<number | null>(null);

  // Histórico de metas
  const [historico, setHistorico] = useState<MetaHistorico[]>([]);
  const [expandedHistoricoMetaId, setExpandedHistoricoMetaId] = useState<number | null>(null);

  // Biblioteca de metas
  const [biblioteca, setBiblioteca] = useState<BibliotecaMeta[]>([]);
  const [showBibliotecaTab, setShowBibliotecaTab] = useState(false);
  const [bibForm, setBibForm] = useState({
    nome: "", descricao: "", indicadorNome: "", unidade: "%", tipo: "VOLUME_FINANCEIRO",
    polaridade: "MAIOR_MELHOR", abrangencia: "CORPORATIVO",
    metaMinima: "", metaAlvo: "", metaMaxima: "", pesoSugerido: "100",
  });
  const [showBibForm, setShowBibForm] = useState(false);

  // Import metas XLSX
  const [showMetasImport, setShowMetasImport] = useState(false);
  const [metasCsvText, setMetasCsvText] = useState("");
  const [metasXlsxFile, setMetasXlsxFile] = useState<File | null>(null);
  const [metasImportResult, setMetasImportResult] = useState<{ processed: number; erros: { linha: number; motivo: string }[] } | null>(null);

  // Movimentações state
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoRH[]>([]);
  const [showMovForm, setShowMovForm] = useState(false);
  const [movForm, setMovForm] = useState({
    colaboradorId: "", tipo: "ADMISSAO", dataEfetiva: "", cargoAnteriorId: "", cargoNovoId: "", ccAnteriorId: "", ccNovoId: "",
  });
  const [cargos, setCargos] = useState<Cargo[]>([]);

  // Cadastros state (Empresa / Cargo / CC)
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cadastroSub, setCadastroSub] = useState<"empresa" | "cargo" | "cc">("empresa");
  const [empresaForm, setEmpresaForm] = useState({ codigo: "", nome: "" });
  const [showEmpresaForm, setShowEmpresaForm] = useState(false);
  const [cargoForm, setCargoForm] = useState({ codigo: "", nome: "", nivelHierarquico: "N4", targetBonusPerc: "0", salarioTeto: "" });
  const [showCargoForm, setShowCargoForm] = useState(false);
  const [ccForm, setCcForm] = useState({ codigo: "", nome: "", nivel: "1", empresaId: "" });
  const [showCcForm, setShowCcForm] = useState(false);

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

  // Colaboradores import state
  const [showColabImport, setShowColabImport] = useState(false);
  const [colabCsvText, setColabCsvText] = useState("");
  const [colabCsvFile, setColabCsvFile] = useState<File | null>(null);
  const [colabImportResult, setColabImportResult] = useState<{ processed: number; updated: number; erros: { linha: number; motivo: string }[] } | null>(null);
  const [colabImportLoading, setColabImportLoading] = useState(false);

  // Bulk import state
  const [importCsvFile, setImportCsvFile] = useState<File | null>(null);
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

  const loadIndicadores = useCallback(async (cicloId?: number) => {
    const url = cicloId ? `/api/indicadores?cicloId=${cicloId}` : "/api/indicadores";
    const res = await fetch(url).then((r) => r.json()).catch(() => ({ data: [] }));
    setIndicadores(res.data ?? []);
  }, []);

  const loadCentrosCusto = useCallback(async () => {
    const res = await fetch("/api/centros-custo").then((r) => r.json()).catch(() => ({ data: [] }));
    setCentrosCusto(res.data ?? []);
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

  const loadMovimentacoes = useCallback(async (cicloId?: number) => {
    const url = cicloId ? `/api/movimentacoes?cicloId=${cicloId}` : "/api/movimentacoes";
    const res = await fetch(url).then((r) => r.json()).catch(() => ({ data: [] }));
    setMovimentacoes(res.data ?? []);
  }, []);

  const loadCargos = useCallback(async () => {
    const res = await fetch("/api/cargos").then((r) => r.json()).catch(() => ({ data: [] }));
    setCargos(res.data ?? []);
  }, []);

  const loadEmpresas = useCallback(async () => {
    const res = await fetch("/api/empresas").then((r) => r.json()).catch(() => ({ data: [] }));
    setEmpresas(res.data ?? []);
  }, []);

  const loadBiblioteca = useCallback(async () => {
    const res = await fetch("/api/biblioteca-metas").then((r) => r.json()).catch(() => ({ data: [] }));
    setBiblioteca(res.data ?? []);
  }, []);

  const loadPlanosAcao = useCallback(async (metaId: number) => {
    const res = await fetch(`/api/planos-acao?metaId=${metaId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setPlanosAcao(res.data ?? []);
  }, []);

  const loadHistorico = useCallback(async (metaId: number) => {
    const res = await fetch(`/api/metas/historico?metaId=${metaId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setHistorico(res.data ?? []);
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
        loadIndicadores(ativo?.id), loadCentrosCusto(),
        loadWaivers(), loadDashboard(ativo?.id),
        loadMovimentacoes(ativo?.id), loadCargos(), loadEmpresas(), loadBiblioteca(),
      ]);
      setLoading(false);
    })();
  }, [loadCiclos, loadColaboradores, loadMetas, loadRealizacoes, loadWorkflow, checkSeeded, loadJanelas, loadWaivers, loadDashboard, loadIndicadores, loadCentrosCusto, loadMovimentacoes, loadCargos, loadEmpresas, loadBiblioteca]);

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
    addToast(`Meta #${id} aprovada`);
  }

  async function handleInlineEdit(metaId: number, field: string, value: string) {
    if (!value.trim()) { setInlineEdit(null); return; }
    await fetch("/api/metas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: metaId, [field]: Number(value) }),
    });
    setInlineEdit(null);
    loadMetas(cicloAtivo?.id);
    addToast("Meta atualizada");
  }

  async function handleAtribuirMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningMetaId || !assignColabId) return;
    await fetch("/api/metas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assigningMetaId, atribuirColaboradorId: Number(assignColabId) }),
    });
    setAssignColabId("");
    setAssigningMetaId(null);
    loadMetas(cicloAtivo?.id);
  }

  async function handleCriarMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    const smartObj = (metaForm.smart_e || metaForm.smart_m || metaForm.smart_a || metaForm.smart_r || metaForm.smart_t)
      ? JSON.stringify({ e: metaForm.smart_e, m: metaForm.smart_m, a: metaForm.smart_a, r: metaForm.smart_r, t: metaForm.smart_t })
      : null;
    await fetch("/api/metas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indicadorId: Number(metaForm.indicadorId),
        cicloId: cicloAtivo.id,
        centroCustoId: metaForm.centroCustoId ? Number(metaForm.centroCustoId) : null,
        pesoNaCesta: Number(metaForm.pesoNaCesta),
        metaAlvo: Number(metaForm.metaAlvo),
        metaMinima: metaForm.metaMinima ? Number(metaForm.metaMinima) : null,
        metaMaxima: metaForm.metaMaxima ? Number(metaForm.metaMaxima) : null,
        parentMetaId: metaForm.parentMetaId ? Number(metaForm.parentMetaId) : null,
        smart: smartObj,
      }),
    });
    setMetaForm({ indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "", metaMinima: "", metaMaxima: "", parentMetaId: "", smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "" });
    setShowMetaForm(false);
    setCascateandoMetaId(null);
    setCloningMetaId(null);
    loadMetas(cicloAtivo.id);
    addToast(cloningMetaId ? "Meta clonada" : cascateandoMetaId ? "Meta cascateada" : "Meta criada");
  }

  async function handleCriarIndicador(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    const autoCode = `IND-${String(indicadores.length + 1).padStart(3, "0")}`;
    await fetch("/api/indicadores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: indicadorForm.codigo || autoCode,
        nome: indicadorForm.nome,
        tipo: indicadorForm.tipo,
        polaridade: indicadorForm.polaridade,
        abrangencia: indicadorForm.abrangencia,
        unidade: indicadorForm.unidade || "%",
        descricao: indicadorForm.descricao || undefined,
        diretivo: indicadorForm.diretivo || undefined,
        analistaResp: indicadorForm.analistaResp || undefined,
        origemDado: indicadorForm.origemDado || undefined,
        divisorId: indicadorForm.isDivisivel && indicadorForm.divisorId ? Number(indicadorForm.divisorId) : null,
        cicloId: cicloAtivo.id,
        status: "ATIVO",
      }),
    });
    setIndicadorForm({ codigo: "", nome: "", tipo: "VOLUME_FINANCEIRO", polaridade: "MAIOR_MELHOR", abrangencia: "CORPORATIVO", unidade: "%", descricao: "", diretivo: "", analistaResp: "", origemDado: "", isDivisivel: false, divisorId: "" });
    setShowIndicadorForm(false);
    loadIndicadores(cicloAtivo.id);
  }

  async function handleWorkflowAction(id: number, status: "APROVADO" | "REJEITADO") {
    await fetch("/api/workflow", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadWorkflow();
    loadMetas(cicloAtivo?.id);
    addToast(status === "APROVADO" ? "Aprovado com sucesso" : "Rejeitado");
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
    addToast("Realização registrada");
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
    addToast("Janela criada");
  }

  async function handleFecharJanela(id: number) {
    await fetch("/api/janelas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "FECHADA" }),
    });
    loadJanelas(cicloAtivo?.id);
    addToast("Janela fechada", "info");
  }

  async function handleWaiverAction(id: number, status: "APROVADO" | "REJEITADO") {
    await fetch("/api/waivers", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadWaivers();
    loadJanelas(cicloAtivo?.id);
  }

  async function handleCriarMovimentacao(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/movimentacoes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        colaboradorId: Number(movForm.colaboradorId),
        tipo: movForm.tipo,
        dataEfetiva: movForm.dataEfetiva,
        cargoAnteriorId: movForm.cargoAnteriorId || null,
        cargoNovoId: movForm.cargoNovoId || null,
        ccAnteriorId: movForm.ccAnteriorId || null,
        ccNovoId: movForm.ccNovoId || null,
      }),
    });
    setMovForm({ colaboradorId: "", tipo: "ADMISSAO", dataEfetiva: "", cargoAnteriorId: "", cargoNovoId: "", ccAnteriorId: "", ccNovoId: "" });
    setShowMovForm(false);
    loadMovimentacoes(cicloAtivo?.id);
  }

  async function handleCancelarMeta(metaId: number) {
    await fetch("/api/metas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: metaId, status: "CANCELADO", usuario: "sistema" }),
    });
    loadMetas(cicloAtivo?.id);
    addToast(`Meta #${metaId} cancelada`, "info");
  }

  async function handleCriarPlanoAcao(e: React.FormEvent, metaId: number) {
    e.preventDefault();
    await fetch("/api/planos-acao", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metaId, ...planoForm, prazo: planoForm.prazo || null }),
    });
    setPlanoForm({ descricao: "", responsavel: "", prazo: "" });
    setShowPlanoForm(null);
    loadPlanosAcao(metaId);
    addToast("Plano de ação criado");
  }

  async function handleTogglePlanoStatus(plano: PlanoAcao) {
    const next = plano.status === "ABERTO" ? "EM_ANDAMENTO" : plano.status === "EM_ANDAMENTO" ? "CONCLUIDO" : "ABERTO";
    await fetch("/api/planos-acao", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: plano.id, status: next }),
    });
    loadPlanosAcao(plano.metaId);
  }

  async function handleCriarBiblioteca(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/biblioteca-metas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bibForm),
    });
    setBibForm({ nome: "", descricao: "", indicadorNome: "", unidade: "%", tipo: "VOLUME_FINANCEIRO", polaridade: "MAIOR_MELHOR", abrangencia: "CORPORATIVO", metaMinima: "", metaAlvo: "", metaMaxima: "", pesoSugerido: "100" });
    setShowBibForm(false);
    loadBiblioteca();
  }

  async function handleMetasImport(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    let rows: Record<string, string>[] = [];
    if (metasXlsxFile) {
      const XLSX = await import("xlsx");
      const buffer = await metasXlsxFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      rows = data.map((r) => { const o: Record<string, string> = {}; for (const [k,v] of Object.entries(r)) o[k.trim()] = String(v ?? "").trim(); return o; });
    } else {
      const lines = metasCsvText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const headerLine = lines[0].split(";").map((h) => h.trim());
      rows = lines.slice(1).map((line) => { const vals = line.split(";"); const obj: Record<string, string> = {}; headerLine.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); }); return obj; });
    }
    const res = await fetch("/api/import-metas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId: cicloAtivo.id, rows }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.data) setMetasImportResult(res.data);
    loadMetas(cicloAtivo.id);
  }

  function handleClonarMeta(meta: Meta) {
    setCloningMetaId(meta.id);
    setMetaForm({
      indicadorId: String(meta.indicador.id),
      centroCustoId: meta.centroCusto ? String(meta.centroCusto.id) : "",
      pesoNaCesta: String(meta.pesoNaCesta),
      metaAlvo: String(meta.metaAlvo),
      metaMinima: meta.metaMinima !== null ? String(meta.metaMinima) : "",
      metaMaxima: meta.metaMaxima !== null ? String(meta.metaMaxima) : "",
      parentMetaId: "",
      smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "",
    });
    setShowMetaForm(true);
    setCascateandoMetaId(null);
  }

  async function handleCriarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/empresas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(empresaForm),
    });
    setEmpresaForm({ codigo: "", nome: "" });
    setShowEmpresaForm(false);
    loadEmpresas();
    addToast("Empresa criada");
  }

  async function handleCriarCargo(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/cargos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cargoForm),
    });
    setCargoForm({ codigo: "", nome: "", nivelHierarquico: "N4", targetBonusPerc: "0", salarioTeto: "" });
    setShowCargoForm(false);
    loadCargos();
    addToast("Cargo criado");
  }

  async function handleCriarCC(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/centros-custo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ccForm),
    });
    setCcForm({ codigo: "", nome: "", nivel: "1", empresaId: "" });
    setShowCcForm(false);
    loadCentrosCusto();
    addToast("Centro de custo criado");
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) return;
    setImportLoading(true);
    setImportResult(null);
    let rows: { matricula: string; metaCodigo: string; valorRealizado: number; observacao?: string }[] = [];
    if (importCsvFile) {
      const XLSX = await import("xlsx");
      const buffer = await importCsvFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      rows = data.map((r) => ({
        matricula: String(r.matricula ?? "").trim(),
        metaCodigo: String(r.codigo_indicador ?? r.metaCodigo ?? "").trim(),
        valorRealizado: Number(r.valor_realizado ?? r.valorRealizado ?? 0),
        observacao: r.observacao ? String(r.observacao) : undefined,
      }));
    } else {
      rows = importForm.csvText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const [matricula, metaCodigo, valorRealizado, observacao] = line.split(";");
        return { matricula, metaCodigo, valorRealizado: Number(valorRealizado), observacao };
      });
    }
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

  async function handleColabImport(e: React.FormEvent) {
    e.preventDefault();
    setColabImportLoading(true);
    setColabImportResult(null);
    let rows: Record<string, string>[] = [];
    if (colabCsvFile) {
      const isXlsx = colabCsvFile.name.match(/\.xlsx?$/i);
      if (isXlsx) {
        const XLSX = await import("xlsx");
        const buffer = await colabCsvFile.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        rows = data.map((r) => {
          const obj: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) obj[k.trim()] = String(v ?? "").trim();
          return obj;
        });
      } else {
        const rawText = (await colabCsvFile.text()).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) { setColabImportLoading(false); return; }
        const delim = lines[0].includes(";") ? ";" : ",";
        const headerLine = lines[0].split(delim).map((h) => h.replace(/^\uFEFF/, "").trim().replace(/^"|"$/g, ""));
        rows = lines.slice(1).map((line) => {
          const vals = line.split(delim);
          const obj: Record<string, string> = {};
          headerLine.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
          return obj;
        });
      }
    } else {
      const rawText = colabCsvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { setColabImportLoading(false); return; }
      const delim = lines[0].includes(";") ? ";" : ",";
      const headerLine = lines[0].split(delim).map((h) => h.replace(/^\uFEFF/, "").trim().replace(/^"|"$/g, ""));
      rows = lines.slice(1).map((line) => {
        const vals = line.split(delim);
        const obj: Record<string, string> = {};
        headerLine.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
        return obj;
      });
    }
    const res = await fetch("/api/import-colaboradores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.data) setColabImportResult(res.data);
    setColabImportLoading(false);
    loadColaboradores();
  }

  // ── XLSX helpers ─────────────────────────────────────────────────────────
  async function downloadXlsx(data: Record<string, unknown>[], filename: string) {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, filename);
  }

  async function handleExportRelatorioCSV() {
    const data = rankingElegiveis.map((row) => ({
      "Colaborador": row.colaborador.nomeCompleto,
      "Matrícula": row.colaborador.matricula,
      "Cargo": row.colaborador.cargo.nome,
      "Nível": row.colaborador.cargo.nivelHierarquico,
      "Nota Média": Number(row.notaMedia.toFixed(1)),
      "Prêmio YTD (R$)": Number(row.premioYTD.toFixed(2)),
      "Target Anual (R$)": Number(row.targetAnual.toFixed(2)),
      "% Target": Number(row.targetAnual > 0 ? ((row.premioYTD / row.targetAnual) * 100).toFixed(1) : 0),
    }));
    await downloadXlsx(data, `relatorio-icp-${cicloAtivo?.anoFiscal ?? "ciclo"}.xlsx`);
  }

  async function handleDownloadTemplateMetaas() {
    const XLSX = await import("xlsx");
    const headers = ["indicadorCodigo","centroCustoCodigo","pesoNaCesta","metaMinima","metaAlvo","metaMaxima"];
    const example = { indicadorCodigo:"REC-LIQ-2026", centroCustoCodigo:"CC-COM", pesoNaCesta:50, metaMinima:80, metaAlvo:100, metaMaxima:120 };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas");
    XLSX.writeFile(wb, "template_metas.xlsx");
  }

  async function handleDownloadTemplateColaboradores() {
    const XLSX = await import("xlsx");
    const headers = ["matricula","nomeCompleto","cpf","email","salarioBase","dataAdmissao","empresaCodigo","cargoCodigo","centroCustoCodigo","gestorMatricula","cargoNome","nivelHierarquico","targetBonusPerc"];
    const example = { matricula:"001234", nomeCompleto:"João Silva", cpf:"123.456.789-00", email:"joao@empresa.com", salarioBase:8000, dataAdmissao:"2024-01-15", empresaCodigo:"EMP001", cargoCodigo:"GER-COM", centroCustoCodigo:"CC-VENDAS", gestorMatricula:"", cargoNome:"Gerente Comercial", nivelHierarquico:"N2", targetBonusPerc:15 };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "template_colaboradores.xlsx");
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const realizacoesFiltradas = realizacoes.filter((r) => {
    if (filterColabId && String(r.colaborador?.id) !== filterColabId) return false;
    if (filterMes && String(r.mesReferencia) !== filterMes) return false;
    return true;
  });

  const pendingCount = workflowItems.length;

  // Pro-rata factor per collaborator based on movimentações no ciclo
  function calcFatorProRata(colaboradorId: number): { fator: number; tipo: string | null; descricao: string } {
    if (!cicloAtivo) return { fator: 1, tipo: null, descricao: "Ciclo completo" };
    const totalMeses = (cicloAtivo.mesFim ?? 12) - (cicloAtivo.mesInicio ?? 1) + 1;
    const colMovs = movimentacoes.filter((m) => m.colaboradorId === colaboradorId);

    const admissao = colMovs.find((m) => m.tipo === "ADMISSAO");
    const desligamento = colMovs.find((m) => m.tipo === "DESLIGAMENTO");

    if (admissao) {
      const mes = new Date(admissao.dataEfetiva).getMonth() + 1;
      const mesesNoCiclo = (cicloAtivo.mesFim ?? 12) - mes + 1;
      const fator = Math.max(0, Math.min(1, mesesNoCiclo / totalMeses));
      return { fator, tipo: "ADMISSAO", descricao: `Admitido em ${MESES[mes - 1]} — ${(fator * 100).toFixed(0)}% do ciclo` };
    }
    if (desligamento) {
      const mes = new Date(desligamento.dataEfetiva).getMonth() + 1;
      const mesesNoCiclo = mes - (cicloAtivo.mesInicio ?? 1) + 1;
      const fator = Math.max(0, Math.min(1, mesesNoCiclo / totalMeses));
      return { fator, tipo: "DESLIGAMENTO", descricao: `Desligado em ${MESES[mes - 1]} — ${(fator * 100).toFixed(0)}% do ciclo` };
    }
    const promocao = colMovs.find((m) => m.tipo === "PROMOCAO");
    if (promocao) {
      const mes = new Date(promocao.dataEfetiva).getMonth() + 1;
      const mesesAntes = mes - (cicloAtivo.mesInicio ?? 1);
      const mesesDepois = (cicloAtivo.mesFim ?? 12) - mes + 1;
      return { fator: 1, tipo: "PROMOCAO", descricao: `Promovido em ${MESES[mes - 1]} — ${mesesAntes}m cargo anterior + ${mesesDepois}m novo cargo` };
    }
    const transferencia = colMovs.find((m) => m.tipo === "TRANSFERENCIA");
    if (transferencia) {
      const mes = new Date(transferencia.dataEfetiva).getMonth() + 1;
      const mesesAntes = mes - (cicloAtivo.mesInicio ?? 1);
      const mesesDepois = (cicloAtivo.mesFim ?? 12) - mes + 1;
      return { fator: 1, tipo: "TRANSFERENCIA", descricao: `Transferido em ${MESES[mes - 1]} — ${mesesAntes}m CC anterior + ${mesesDepois}m novo CC` };
    }
    return { fator: 1, tipo: null, descricao: "Ciclo completo" };
  }

  // Elegíveis ranking — inclui TODOS os colaboradores atribuídos a pelo menos uma meta
  type ElegívelRow = {
    colaborador: Colaborador;
    notaMedia: number;
    premioYTD: number;
    targetAnual: number;
    totalRealizacoes: number;
    metasAtribuidas: number;
  };
  const elegiveisIds = new Set(metas.flatMap((m) => m.colaboradorIds ?? []));
  const rankingElegiveis: ElegívelRow[] = colaboradores
    .filter((c) => elegiveisIds.has(c.id))
    .map((c) => {
      const colRealizacoes = realizacoes.filter((r) => r.colaborador?.id === c.id);
      const metasAtribuidas = metas.filter((m) => m.colaboradorIds?.includes(c.id)).length;
      const notaMedia = colRealizacoes.length > 0
        ? colRealizacoes.reduce((sum, r) => sum + (r.notaCalculada ?? 0), 0) / colRealizacoes.length
        : 0;
      const premioYTD = colRealizacoes.reduce((sum, r) => sum + (r.premioProjetado ?? 0), 0);
      const targetAnual = c.salarioBase * 12 * (c.cargo.targetBonusPerc / 100);
      return { colaborador: c, notaMedia, premioYTD, targetAnual, totalRealizacoes: colRealizacoes.length, metasAtribuidas };
    })
    .sort((a, b) => b.notaMedia - a.notaMedia);

  // Relatório metrics
  const totalPremioProjetado = realizacoes.reduce((sum, r) => sum + (r.premioProjetado ?? 0), 0);
  const totalRealizacoesAprovadas = realizacoes.filter((r) => r.status === "APROVADO").length;

  // Conferência — validação e consolidados
  const validacaoMetas = metas.map((m) => {
    const metaRealizacoes = realizacoes.filter((r) => r.meta?.id === m.id);
    const pendentes = metaRealizacoes.filter((r) => r.status === "SUBMETIDO").length;
    const erros: string[] = [];
    const avisos: string[] = [];
    if (m._count.colaboradores === 0) erros.push("Nenhum colaborador atribuído");
    if (m._count.realizacoes === 0) avisos.push("Sem realizações lançadas");
    if (pendentes > 0) avisos.push(`${pendentes} realização(ões) aguardando aprovação`);
    if (m.status === "DRAFT") avisos.push("Meta ainda em rascunho — não aprovada");
    if (!m.metaMinima) avisos.push("Meta mínima não definida");
    return { meta: m, erros, avisos, ok: erros.length === 0 && avisos.length === 0 };
  });

  const totalErros = validacaoMetas.reduce((s, v) => s + v.erros.length, 0);
  const totalAvisos = validacaoMetas.reduce((s, v) => s + v.avisos.length, 0);

  // Por Centro de Custo
  type CCRow = { nome: string; metas: number; colaboradores: number; premioYTD: number; notaMedia: number; realizacoesCount: number };
  const porCC = new Map<string, CCRow>();
  metas.forEach((m) => {
    const ccNome = m.centroCusto?.nome ?? "Corporativo";
    const existing = porCC.get(ccNome) ?? { nome: ccNome, metas: 0, colaboradores: 0, premioYTD: 0, notaMedia: 0, realizacoesCount: 0 };
    const metaRealizacoes = realizacoes.filter((r) => r.meta?.id === m.id);
    const notaMedia = metaRealizacoes.length > 0 ? metaRealizacoes.reduce((s, r) => s + (r.notaCalculada ?? 0), 0) / metaRealizacoes.length : 0;
    const premioYTD = metaRealizacoes.reduce((s, r) => s + (r.premioProjetado ?? 0), 0);
    porCC.set(ccNome, {
      nome: ccNome,
      metas: existing.metas + 1,
      colaboradores: existing.colaboradores + m._count.colaboradores,
      premioYTD: existing.premioYTD + premioYTD,
      notaMedia: existing.notaMedia + notaMedia,
      realizacoesCount: existing.realizacoesCount + metaRealizacoes.length,
    });
  });
  const ccRows = Array.from(porCC.values()).map((r) => ({ ...r, notaMedia: r.metas > 0 ? r.notaMedia / r.metas : 0 })).sort((a, b) => b.premioYTD - a.premioYTD);

  // Por Cargo/Nível
  type CargoRow = { cargo: string; nivel: string; count: number; notaMedia: number; premioYTD: number; targetTotal: number };
  const porCargo = new Map<string, CargoRow>();
  rankingElegiveis.forEach((row) => {
    const key = `${row.colaborador.cargo.nome}|${row.colaborador.cargo.nivelHierarquico}`;
    const ex = porCargo.get(key) ?? { cargo: row.colaborador.cargo.nome, nivel: row.colaborador.cargo.nivelHierarquico, count: 0, notaMedia: 0, premioYTD: 0, targetTotal: 0 };
    porCargo.set(key, { ...ex, count: ex.count + 1, notaMedia: ex.notaMedia + row.notaMedia, premioYTD: ex.premioYTD + row.premioYTD, targetTotal: ex.targetTotal + row.targetAnual });
  });
  const cargoRows = Array.from(porCargo.values()).map((r) => ({ ...r, notaMedia: r.count > 0 ? r.notaMedia / r.count : 0 })).sort((a, b) => b.premioYTD - a.premioYTD);

  // Evolução mês a mês
  const evolucaoMensal = MESES.map((mes, idx) => {
    const mesNum = idx + 1;
    const mesRealizacoes = realizacoes.filter((r) => r.mesReferencia === mesNum);
    const notaMedia = mesRealizacoes.length > 0 ? mesRealizacoes.reduce((s, r) => s + (r.notaCalculada ?? 0), 0) / mesRealizacoes.length : null;
    const premioTotal = mesRealizacoes.reduce((s, r) => s + (r.premioProjetado ?? 0), 0);
    return { mes, mesNum, count: mesRealizacoes.length, notaMedia, premioTotal };
  }).filter((m) => m.count > 0);

  const janelaAtualHeader = janelas.find((j) => j.isOpen) ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--canvas)" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // Computed: latest nota per meta (for progress bar)
  function getMetaUltimaNota(metaId: number): number | null {
    const r = realizacoes
      .filter((r) => r.meta?.id === metaId)
      .sort((a, b) => b.anoReferencia * 100 + b.mesReferencia - (a.anoReferencia * 100 + a.mesReferencia));
    return r[0]?.notaCalculada ?? null;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--canvas)" }}>
      {/* Toast overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 320 }}>
        {toasts.map((t) => (
          <div key={t.id} className="rounded-lg px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto flex items-center gap-2"
            style={{
              background: t.type === "ok" ? "var(--ok-bg)" : t.type === "err" ? "var(--err-bg)" : "var(--info-bg)",
              color: t.type === "ok" ? "var(--ok-text)" : t.type === "err" ? "var(--err-text)" : "var(--info-text)",
              border: `1px solid ${t.type === "ok" ? "var(--ok-border)" : t.type === "err" ? "var(--err-border)" : "var(--info-border)"}`,
            }}>
            <span>{t.type === "ok" ? "✓" : t.type === "err" ? "✗" : "ℹ"}</span>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <header style={{ background: "var(--nav-bg)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs tracking-tight select-none"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}>
              ICP
            </div>
            <span className="font-semibold text-sm tracking-tight" style={{ color: "rgba(255,255,255,0.88)" }}>
              Sistema ICP
            </span>
          </div>

          <div className="w-px h-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

          {/* Ciclo selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>Ciclo</span>
            <select
              value={cicloAtivo?.id ?? ""}
              onChange={(e) => {
                const c = ciclos.find((x) => x.id === Number(e.target.value));
                if (c) { setCicloAtivo(c); loadMetas(c.id); loadJanelas(c.id); loadDashboard(c.id); }
              }}
              className="text-xs rounded-md px-2 py-1 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.82)" }}
            >
              {ciclos.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "#0e1b2e" }}>{c.anoFiscal} — {c.status}</option>
              ))}
            </select>
          </div>

          {/* Janela status */}
          {janelaAtualHeader ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded"
              style={{ background: "rgba(5,150,105,0.18)", color: "#6ee7b7", border: "1px solid rgba(5,150,105,0.22)" }}>
              Janela {MESES[janelaAtualHeader.mesReferencia - 1]} aberta
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded"
              style={{ color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.07)" }}>
              Sem janela aberta
            </span>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: "rgba(139,92,246,0.18)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.22)" }}>
              {role}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs rounded-md px-3 py-1.5 transition-colors"
              style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Seed Banner */}
      {!seeded && (
        <div style={{ background: "var(--warn-bg)", borderBottom: "1px solid var(--warn-border)" }} className="px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--warn-text)" }}>
              Banco de dados vazio. Carregue os dados de demonstração para explorar o sistema.
            </p>
            <button
              onClick={handleSeed}
              disabled={seedLoading}
              className="ml-4 text-xs font-semibold px-4 py-1.5 rounded-md transition-colors disabled:opacity-50"
              style={{ background: "var(--warning)", color: "white" }}
            >
              {seedLoading ? "Carregando..." : "Carregar Dados Demo"}
            </button>
          </div>
        </div>
      )}

      {/* Body: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 200, background: "var(--nav-bg)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <nav className="flex-1 py-4">
            {TAB_GROUPS.map((group) => (
              <div key={group.name} className="mb-5">
                <div className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.28)" }}>
                  {group.name}
                </div>
                {group.tabs.map(({ id: tab, label }) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs transition-colors"
                      style={{
                        color: isActive ? "white" : "rgba(255,255,255,0.55)",
                        background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <span className="flex-1 truncate">{label}</span>
                      {tab === "workflow" && (pendingCount > 0 || waivers.length > 0) && (
                        <span className="text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0"
                          style={{ background: pendingCount > 0 ? "#ef4444" : "#f97316", color: "white" }}>
                          {pendingCount + waivers.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Sidebar footer — ciclo info */}
          <div className="px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-medium truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
              {cicloAtivo ? `Ciclo ${cicloAtivo.anoFiscal} · ${cicloAtivo.status}` : "Sem ciclo ativo"}
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">

        {/* ── DASHBOARD (Master) ──────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>Dashboard</h2>
            <MasterDashboard cicloId={cicloAtivo?.id ?? null} />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Colaboradores", value: dashboardData?.totalColaboradores ?? colaboradores.length, accent: "var(--accent)" },
                { label: "Metas Ativas", value: dashboardData?.totalMetasAtivas ?? metas.filter((m) => m.status !== "DRAFT").length, accent: "#059669" },
                { label: "Realizações no Mês", value: dashboardData?.realizacoesMes ?? realizacoes.filter((r) => r.mesReferencia === new Date().getMonth() + 1).length, accent: "#7c3aed" },
                { label: "Pendências Workflow", value: dashboardData?.workflowPendente ?? pendingCount, accent: "#d97706" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-lg p-5" style={{ border: "1px solid var(--border)" }}>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>{kpi.label}</p>
                  <p className="text-3xl font-bold mt-2 tabular-nums" style={{ color: kpi.accent }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Bonus Pool Card */}
            {dashboardData && dashboardData.bonusPoolTotal !== null && (
              <div className="bg-white rounded-lg p-5" style={{ border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>Bonus Pool</h3>
                <div className="flex items-center justify-between text-xs mb-2" style={{ color: "var(--ink-secondary)" }}>
                  <span>Utilizado</span>
                  <span className="font-medium tabular-nums">{fmt(dashboardData.bonusPoolUsado)} / {fmt(dashboardData.bonusPoolTotal)}</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "var(--border-strong)" }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (dashboardData.bonusPoolUsado / dashboardData.bonusPoolTotal) * 100)}%`, background: "var(--accent)" }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: "var(--ink-muted)" }}>
                  {((dashboardData.bonusPoolUsado / dashboardData.bonusPoolTotal) * 100).toFixed(1)}% utilizado
                </p>
              </div>
            )}

            {/* Alertas de Engajamento */}
            {dashboardData && dashboardData.alertasEngajamento.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-border)" }}>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--warn-text)" }}>Alertas de Engajamento</h3>
                <p className="text-xs mb-2.5" style={{ color: "var(--warn-text)", opacity: 0.8 }}>
                  Centros de custo sem realizações nos últimos 2 meses:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dashboardData.alertasEngajamento.map((cc) => (
                    <span key={cc} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: "var(--warn-border)", color: "var(--warn-text)" }}>{cc}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Top Colaboradores */}
            <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Top Colaboradores — Prêmio Projetado YTD</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Nome","Cargo","Nota Média","Prêmio YTD"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboardData?.topColaboradores ?? []).map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">{c.nome}</td>
                        <td className="px-4 py-3">{c.cargo}</td>
                        <td className={`px-4 py-3 ${notaColor(c.notaMedia)}`}>{fmtN(c.notaMedia)}</td>
                        <td className="px-4 py-3 tabular-nums font-medium" style={{ color: "var(--ink)" }}>{fmt(c.premioYTD)}</td>
                      </tr>
                    ))}
                    {(dashboardData?.topColaboradores ?? []).length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum dado disponível</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Seed / Demo */}
            <div className="rounded-lg p-4 flex items-center justify-between gap-4" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Dados de demonstração</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>Popula o banco com colaboradores, metas e realizações de exemplo.</p>
              </div>
              <button onClick={handleSeed} disabled={seedLoading} className="btn-ghost text-xs flex-shrink-0">
                {seedLoading ? "Carregando..." : "Carregar Demo"}
              </button>
            </div>
          </div>
        )}

        {/* ── SCORECARD ─────────────────────────────────────────────────── */}
        {activeTab === "scorecard" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="icp-page-title">Scorecard Individual</h2>
              <select
                value={selectedColaborador ?? ""}
                onChange={(e) => setSelectedColaborador(e.target.value ? Number(e.target.value) : null)}
                className="border rounded-md px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Selecionar colaborador...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>
                ))}
              </select>
            </div>

            {!selectedColaborador && (
              <div className="bg-white icp-card p-12 text-center text-gray-400">
                Selecione um colaborador para ver o scorecard
              </div>
            )}

            {selectedColaborador && scorecardData && (
              <>
                {/* Hero cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white icp-card p-6 shadow-sm col-span-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Nota YTD</p>
                    <p className={`text-4xl font-bold mt-1 ${notaColor(scorecardData.notaYTD)}`}>
                      {fmtN(scorecardData.notaYTD)}
                    </p>
                  </div>
                  <div className="rounded-lg p-6 col-span-2" style={{ background: "var(--nav-bg)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Prêmio Projetado YTD</p>
                    <p className="text-4xl font-bold mt-1 tabular-nums" style={{ color: "white" }}>{fmt(scorecardData.premioYTD)}</p>
                    <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>Target anual: {fmt(scorecardData.targetAnual)}</p>
                  </div>
                </div>

                {/* Metas table with sparklines */}
                <div className="bg-white icp-card overflow-hidden">
                  <div className="px-5 py-3.5 icp-card-header flex items-center justify-between">
                    <h3 className="icp-section-title">Metas e Resultados</h3>
                    <button onClick={() => window.print()} className="btn-ghost text-xs px-3 py-1">Imprimir / PDF</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {["Indicador","Peso","Alvo","Evolução","Nota Média","Prêmio"].map((h) => (
                            <th key={h} className="text-left px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scorecardData.metas.map((item, i) => {
                          const chartData = MESES.map((mes, idx) => {
                            const r = item.realizacoes.find((r) => r.mesReferencia === idx + 1);
                            return { mes, nota: r?.notaCalculada ?? null };
                          }).filter((d) => d.nota !== null);
                          const cor = item.notaMedia >= 100 ? "#059669" : item.notaMedia >= 70 ? "#d97706" : "#dc2626";
                          return (
                            <tr key={i}>
                              <td className="px-4 py-3">{item.indicador.nome}</td>
                              <td className="px-4 py-3 tabular-nums">{item.meta.pesoNaCesta}%</td>
                              <td className="px-4 py-3 tabular-nums">{item.meta.metaAlvo.toLocaleString("pt-BR")}</td>
                              <td className="px-4 py-2" style={{ width: 100, minWidth: 80 }}>
                                {chartData.length > 1 ? (
                                  <ResponsiveContainer width="100%" height={32}>
                                    <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                      <Line type="monotone" dataKey="nota" dot={false} stroke={cor} strokeWidth={1.5} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                ) : <span className="text-xs" style={{ color: "var(--ink-subtle)" }}>—</span>}
                              </td>
                              <td className={`px-4 py-3 font-semibold tabular-nums`} style={{ color: cor }}>{fmtN(item.notaMedia)}</td>
                              <td className="px-4 py-3 font-medium tabular-nums" style={{ color: "var(--ink)" }}>{fmt(item.premioProjetado)}</td>
                            </tr>
                          );
                        })}
                        {scorecardData.metas.length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--ink-muted)" }}>Sem metas vinculadas</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── INDICADORES ───────────────────────────────────────────────── */}
        {activeTab === "indicadores" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="icp-page-title">Indicadores</h2>
              <button
                onClick={() => setShowIndicadorForm(!showIndicadorForm)}
                className="btn-primary"
              >
                + Novo Indicador
              </button>
            </div>

            {showIndicadorForm && (() => {
              const autoCode = `IND-${String(indicadores.length + 1).padStart(3, "0")}`;
              const codigoDisplay = indicadorForm.codigo || autoCode;
              return (
              <form onSubmit={(e) => { if (!indicadorForm.codigo) setIndicadorForm((f) => ({ ...f, codigo: autoCode })); handleCriarIndicador(e); }}
                className="bg-white icp-card p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <h3 className="text-sm font-semibold text-blue-900">Novo Indicador</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código (auto)</label>
                  <div className="flex items-center gap-2">
                    <input value={codigoDisplay} readOnly
                      className="w-full border border-gray-200 bg-gray-100 rounded px-2 py-1.5 text-sm font-mono text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                  <input required value={indicadorForm.nome} onChange={(e) => setIndicadorForm({ ...indicadorForm, nome: e.target.value })}
                    placeholder="Ex: Volume de Vendas" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unidade *</label>
                  <select required value={indicadorForm.unidade} onChange={(e) => setIndicadorForm({ ...indicadorForm, unidade: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="%">% — Percentual</option>
                    <option value="R$">R$ — Reais</option>
                    <option value="un">un — Unidades</option>
                    <option value="dias">dias — Dias</option>
                    <option value="h">h — Horas</option>
                    <option value="pts">pts — Pontos</option>
                    <option value="#"># — Quantidade</option>
                    <option value="índice">índice</option>
                    <option value="NPS">NPS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                  <select required value={indicadorForm.tipo} onChange={(e) => setIndicadorForm({ ...indicadorForm, tipo: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="VOLUME_FINANCEIRO">Volume Financeiro</option>
                    <option value="CUSTO_PRAZO">Custo / Prazo</option>
                    <option value="PROJETO_MARCO">Projeto / Marco</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Abrangência *</label>
                  <select required value={indicadorForm.abrangencia} onChange={(e) => setIndicadorForm({ ...indicadorForm, abrangencia: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="CORPORATIVO">Corporativo</option>
                    <option value="AREA">Área</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Polaridade *</label>
                  <select required value={indicadorForm.polaridade} onChange={(e) => setIndicadorForm({ ...indicadorForm, polaridade: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="MAIOR_MELHOR">↑ Maior é Melhor (ex: vendas, receita)</option>
                    <option value="MENOR_MELHOR">↓ Menor é Melhor (ex: custo, prazo, defeitos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Analista Responsável</label>
                  <select value={indicadorForm.analistaResp} onChange={(e) => setIndicadorForm({ ...indicadorForm, analistaResp: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">— Selecionar —</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.nomeCompleto}>{c.nomeCompleto} ({c.cargo.nome})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Diretivo / Objetivo Estratégico</label>
                  <input value={indicadorForm.diretivo} onChange={(e) => setIndicadorForm({ ...indicadorForm, diretivo: e.target.value })}
                    placeholder="Ex: Crescer receita 20%" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Origem dos Dados</label>
                  <input value={indicadorForm.origemDado} onChange={(e) => setIndicadorForm({ ...indicadorForm, origemDado: e.target.value })}
                    placeholder="Ex: ERP, BI, Planilha..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                  <input value={indicadorForm.descricao} onChange={(e) => setIndicadorForm({ ...indicadorForm, descricao: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2 md:col-span-3 border-t border-blue-200 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={indicadorForm.isDivisivel}
                      onChange={(e) => setIndicadorForm({ ...indicadorForm, isDivisivel: e.target.checked, divisorId: "" })}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-sm font-medium text-gray-700">É um indicador divisível? (ex: Despesa ÷ Receita Líquida)</span>
                  </label>
                  {indicadorForm.isDivisivel && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Divisor — Indicador denominador *</label>
                      <select required={indicadorForm.isDivisivel} value={indicadorForm.divisorId}
                        onChange={(e) => setIndicadorForm({ ...indicadorForm, divisorId: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm max-w-sm">
                        <option value="">Selecionar indicador divisor...</option>
                        {indicadores.map((i) => (
                          <option key={i.id} value={i.id}>{i.codigo} — {i.nome}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Este indicador será calculado como: <strong>{indicadorForm.nome || "Indicador"}</strong> ÷ <strong>{indicadores.find((i) => String(i.id) === indicadorForm.divisorId)?.nome ?? "?"}</strong></p>
                    </div>
                  )}
                </div>
                <div className="col-span-2 md:col-span-3 flex gap-2">
                  <button type="submit" className="btn-primary">
                    Criar Indicador
                  </button>
                  <button type="button" onClick={() => setShowIndicadorForm(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5">
                    Cancelar
                  </button>
                </div>
              </form>
              );
            })()}

            <div className="bg-white icp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["#","Código","Nome","Tipo","Polaridade","Unidade","Analista","Divisor","Status","Metas"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {indicadores.map((i) => (
                      <tr key={i.id} className="">
                        <td className="px-4 py-3 text-gray-400">{i.id}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{i.codigo}</td>
                        <td className="px-4 py-3">{i.nome}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {i.tipo === "VOLUME_FINANCEIRO" ? "Volume" : i.tipo === "CUSTO_PRAZO" ? "Custo/Prazo" : "Projeto"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`font-medium ${i.polaridade === "MENOR_MELHOR" ? "text-orange-600" : "text-green-600"}`}>
                            {i.polaridade === "MENOR_MELHOR" ? "↓ Menor" : "↑ Maior"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{i.unidade}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{i.analistaResp ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {i.divisor ? <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">÷ {i.divisor.nome}</span> : "—"}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{(i as unknown as { _count?: { metas?: number } })._count?.metas ?? 0}</td>
                      </tr>
                    ))}
                    {indicadores.length === 0 && (
                      <tr><td colSpan={10}>
                        <EmptyState icon="📊" title="Nenhum indicador cadastrado"
                          description="Indicadores definem o que será medido em cada meta do ciclo."
                          action={{ label: "+ Novo Indicador", onClick: () => setShowIndicadorForm(true) }} />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── METAS ─────────────────────────────────────────────────────── */}
        {activeTab === "metas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="icp-page-title">Metas</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{metas.length} metas</p>
                <button onClick={() => setShowMetaTree((v) => !v)}
                  className="btn-ghost text-xs px-3 py-1.5">
                  Árvore
                </button>
                <button onClick={() => setShowBibliotecaTab((v) => !v)}
                  className="btn-ghost text-xs px-3 py-1.5">
                  Biblioteca
                </button>
                <button onClick={() => setShowMetasImport((v) => !v)}
                  className="btn-ghost text-xs px-3 py-1.5">
                  Importar XLSX
                </button>
                <button onClick={() => { setShowMetaForm(!showMetaForm); setCloningMetaId(null); setCascateandoMetaId(null); }}
                  className="btn-primary">
                  + Nova Meta
                </button>
              </div>
            </div>

            {/* Biblioteca de Metas */}
            {showBibliotecaTab && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-purple-800">📚 Biblioteca de Metas</h3>
                  <button onClick={() => setShowBibForm((v) => !v)} className="text-xs bg-purple-700 text-white px-3 py-1 rounded">+ Novo Template</button>
                </div>
                {showBibForm && (
                  <form onSubmit={handleCriarBiblioteca} className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white rounded-lg p-4 border border-purple-200">
                    <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Nome *</label>
                      <input required value={bibForm.nome} onChange={(e) => setBibForm((f) => ({ ...f, nome: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></div>
                    <div className="col-span-2"><label className="block text-xs text-gray-600 mb-1">Indicador</label>
                      <input value={bibForm.indicadorNome} onChange={(e) => setBibForm((f) => ({ ...f, indicadorNome: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Tipo</label>
                      <select value={bibForm.tipo} onChange={(e) => setBibForm((f) => ({ ...f, tipo: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm bg-white">
                        <option value="VOLUME_FINANCEIRO">Volume/Financeiro</option>
                        <option value="CUSTO_PRAZO">Custo/Prazo</option>
                        <option value="PROJETO_MARCO">Projeto/Marco</option>
                        <option value="QUALITATIVO">Qualitativo</option>
                      </select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Abrangência</label>
                      <select value={bibForm.abrangencia} onChange={(e) => setBibForm((f) => ({ ...f, abrangencia: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm bg-white">
                        <option value="CORPORATIVO">Corporativo</option><option value="AREA">Área</option><option value="INDIVIDUAL">Individual</option>
                      </select></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Meta Alvo</label>
                      <input type="number" value={bibForm.metaAlvo} onChange={(e) => setBibForm((f) => ({ ...f, metaAlvo: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></div>
                    <div><label className="block text-xs text-gray-600 mb-1">Peso Sugerido (%)</label>
                      <input type="number" value={bibForm.pesoSugerido} onChange={(e) => setBibForm((f) => ({ ...f, pesoSugerido: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></div>
                    <div className="col-span-2 md:col-span-4 flex gap-2">
                      <button type="submit" className="bg-purple-700 text-white text-sm px-4 py-1.5 rounded">Salvar</button>
                      <button type="button" onClick={() => setShowBibForm(false)} className="text-sm text-gray-500 px-3">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="space-y-2">
                  {biblioteca.map((b) => (
                    <div key={b.id} className="bg-white rounded-lg border border-purple-100 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{b.nome}</p>
                        <p className="text-xs text-gray-500">{b.indicadorNome} · {b.abrangencia} · Alvo: {b.metaAlvo ?? "—"} · Peso: {b.pesoSugerido}%</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setMetaForm((f) => ({ ...f, pesoNaCesta: String(b.pesoSugerido), metaAlvo: b.metaAlvo ? String(b.metaAlvo) : "", metaMinima: b.metaMinima ? String(b.metaMinima) : "", metaMaxima: b.metaMaxima ? String(b.metaMaxima) : "" }));
                          setShowMetaForm(true); setShowBibliotecaTab(false);
                        }} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Usar</button>
                        <button onClick={async () => { await fetch(`/api/biblioteca-metas?id=${b.id}`, { method: "DELETE" }); loadBiblioteca(); }} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">✕</button>
                      </div>
                    </div>
                  ))}
                  {biblioteca.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhum template na biblioteca</p>}
                </div>
              </div>
            )}

            {showMetaForm && (
              <form onSubmit={handleCriarMeta} className="bg-white icp-card p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <h3 className="text-sm font-semibold text-blue-900">
                    {cloningMetaId ? `Clonar Meta #${cloningMetaId}` : cascateandoMetaId ? `Cascatear Meta #${cascateandoMetaId}` : "Nova Meta"}
                  </h3>
                  {cascateandoMetaId && <p className="text-xs text-purple-600 mt-0.5">Filha de #{cascateandoMetaId} — {metas.find((m) => m.id === cascateandoMetaId)?.indicador.nome}</p>}
                  {cloningMetaId && <p className="text-xs text-blue-600 mt-0.5">Cópia de #{cloningMetaId} — valores pré-preenchidos, pode alterar</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Indicador *</label>
                  <select required value={metaForm.indicadorId} onChange={(e) => setMetaForm({ ...metaForm, indicadorId: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Selecionar...</option>
                    {indicadores.map((i) => (
                      <option key={i.id} value={i.id}>{i.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Centro de Custo</label>
                  <select value={metaForm.centroCustoId} onChange={(e) => setMetaForm({ ...metaForm, centroCustoId: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Corporativo</option>
                    {centrosCusto.map((cc) => (
                      <option key={cc.id} value={cc.id}>{cc.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Peso na Cesta (%) *</label>
                  <input required type="number" min="1" max="100" value={metaForm.pesoNaCesta}
                    onChange={(e) => setMetaForm({ ...metaForm, pesoNaCesta: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meta Alvo *</label>
                  <input required type="number" step="any" value={metaForm.metaAlvo}
                    onChange={(e) => setMetaForm({ ...metaForm, metaAlvo: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meta Mínima</label>
                  <input type="number" step="any" value={metaForm.metaMinima}
                    onChange={(e) => setMetaForm({ ...metaForm, metaMinima: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Meta Máxima</label>
                  <input type="number" step="any" value={metaForm.metaMaxima}
                    onChange={(e) => setMetaForm({ ...metaForm, metaMaxima: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                {!cascateandoMetaId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Meta Pai (Cascata)</label>
                    <select value={metaForm.parentMetaId} onChange={(e) => setMetaForm({ ...metaForm, parentMetaId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                      <option value="">Nenhuma (meta raiz)</option>
                      {metas.map((m) => (
                        <option key={m.id} value={m.id}>#{m.id} — {m.indicador.nome} {m.centroCusto ? `(${m.centroCusto.nome})` : "(Corp)"}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* SMART fields */}
                <div className="col-span-2 md:col-span-3 border-t border-blue-200 pt-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Critérios SMART (opcional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {[
                      { key: "smart_e" as const, label: "Específica" },
                      { key: "smart_m" as const, label: "Mensurável" },
                      { key: "smart_a" as const, label: "Atingível" },
                      { key: "smart_r" as const, label: "Relevante" },
                      { key: "smart_t" as const, label: "Temporal" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                        <input value={metaForm[key]} onChange={(e) => setMetaForm({ ...metaForm, [key]: e.target.value })}
                          placeholder={label} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 md:col-span-3 flex gap-2">
                  <button type="submit" className="btn-primary">
                    {cloningMetaId ? "Criar Cópia" : cascateandoMetaId ? "Criar Meta Cascateada" : "Criar Meta"}
                  </button>
                  <button type="button" onClick={() => { setShowMetaForm(false); setCascateandoMetaId(null); setCloningMetaId(null); setMetaForm({ indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "", metaMinima: "", metaMaxima: "", parentMetaId: "", smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "" }); }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* Import Metas XLSX */}
            {showMetasImport && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-amber-800">Importar Metas em Massa</h3>
                  <button type="button" onClick={handleDownloadTemplateMetaas} className="text-xs bg-white border border-amber-300 text-amber-700 px-3 py-1 rounded hover:bg-amber-50">Baixar Template XLSX</button>
                </div>
                <p className="text-xs text-amber-700">Colunas: indicadorCodigo · centroCustoCodigo · pesoNaCesta · metaMinima · metaAlvo · metaMaxima</p>
                <form onSubmit={handleMetasImport} className="space-y-3">
                  <div>
                    <input type="file" accept=".xlsx,.xls"
                      onChange={(e) => setMetasXlsxFile(e.target.files?.[0] ?? null)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white" />
                    {metasXlsxFile && <p className="text-xs text-green-700 mt-1 font-medium">✓ {metasXlsxFile.name}</p>}
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={!cicloAtivo || !metasXlsxFile}
                      className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">Importar</button>
                    <button type="button" onClick={() => setShowMetasImport(false)} className="text-sm text-gray-500 px-3">Cancelar</button>
                  </div>
                </form>
                {metasImportResult && (
                  <div className="space-y-1">
                    <p className="text-sm text-green-700 font-semibold">✓ {metasImportResult.processed} importadas</p>
                    {metasImportResult.erros.map((e, i) => <p key={i} className="text-xs text-red-600">Linha {e.linha}: {e.motivo}</p>)}
                  </div>
                )}
              </div>
            )}

            {/* Árvore de cascata */}
            {showMetaTree && (
              <div className="bg-white icp-card p-5">
                <h3 className="icp-section-title mb-4">Árvore de Cascata</h3>
                {(() => {
                  const roots = metas.filter((m) => !m.parentMetaId);
                  function renderNode(m: typeof metas[0], depth: number): React.ReactNode {
                    const children = metas.filter((c) => c.parentMetaId === m.id);
                    const nota = getMetaUltimaNota(m.id);
                    const cor = nota === null ? "var(--ink-subtle)" : nota >= 100 ? "#059669" : nota >= 70 ? "#d97706" : "#dc2626";
                    return (
                      <div key={m.id} style={{ marginLeft: depth * 24 }}>
                        <div className="flex items-center gap-3 py-2 group" style={{ borderBottom: "1px solid var(--border)" }}>
                          {depth > 0 && <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>↳</span>}
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                          <span className="text-sm font-medium flex-1" style={{ color: "var(--ink)" }}>{m.indicador.nome}</span>
                          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{m.centroCusto?.nome ?? "Corporativo"}</span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: cor }}>
                            {nota !== null ? `${nota.toFixed(0)} pts` : "—"}
                          </span>
                          <StatusBadge status={m.status} />
                        </div>
                        {children.map((c) => renderNode(c, depth + 1))}
                      </div>
                    );
                  }
                  return roots.length === 0
                    ? <p className="text-sm text-center py-4" style={{ color: "var(--ink-muted)" }}>Nenhuma meta com cascata definida</p>
                    : roots.map((r) => renderNode(r, 0));
                })()}
              </div>
            )}

            <div className="bg-white icp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["#","Indicador","CC","Peso","Alvo","Progresso","Status",""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {metas.map((m) => (
                      <React.Fragment key={m.id}>
                        <tr className={m.parentMetaId ? "" : ""} style={m.parentMetaId ? { background: "rgba(139,92,246,0.03)" } : {}}>
                          <td className="px-4 py-3" style={{ color: "var(--ink-muted)" }}>
                            {m.parentMetaId && <span className="mr-1" style={{ color: "#8b5cf6" }}>↳</span>}
                            {m.id}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium" style={{ color: "var(--ink)" }}>{m.indicador.nome}</p>
                            {m.parentMeta && (
                              <p className="text-xs mt-0.5" style={{ color: "#8b5cf6" }}>↑ {m.parentMeta.indicador.nome}{m.parentMeta.centroCusto ? ` (${m.parentMeta.centroCusto.nome})` : ""}</p>
                            )}
                            {m._count.filhas > 0 && (
                              <p className="text-xs mt-0.5" style={{ color: "#6366f1" }}>{m._count.filhas} cascata(s)</p>
                            )}
                          </td>
                          <td className="px-4 py-3" style={{ color: "var(--ink-secondary)" }}>{m.centroCusto?.nome ?? "—"}</td>
                          {/* Peso — inline editable */}
                          <td className="px-4 py-3">
                            {inlineEdit?.metaId === m.id && inlineEdit.field === "pesoNaCesta" ? (
                              <input autoFocus type="number" className="w-14 border rounded px-1 py-0.5 text-xs tabular-nums"
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit((p) => p ? { ...p, value: e.target.value } : null)}
                                onBlur={() => handleInlineEdit(m.id, "pesoNaCesta", inlineEdit.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleInlineEdit(m.id, "pesoNaCesta", inlineEdit.value); if (e.key === "Escape") setInlineEdit(null); }} />
                            ) : (
                              <span className="cursor-pointer rounded px-1 py-0.5 text-xs tabular-nums"
                                style={{ color: "var(--ink-secondary)" }}
                                title="Clique para editar"
                                onClick={() => setInlineEdit({ metaId: m.id, field: "pesoNaCesta", value: String(m.pesoNaCesta) })}>
                                {m.pesoNaCesta}%
                              </span>
                            )}
                          </td>
                          {/* Alvo — inline editable */}
                          <td className="px-4 py-3">
                            {inlineEdit?.metaId === m.id && inlineEdit.field === "metaAlvo" ? (
                              <input autoFocus type="number" className="w-20 border rounded px-1 py-0.5 text-xs tabular-nums"
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit((p) => p ? { ...p, value: e.target.value } : null)}
                                onBlur={() => handleInlineEdit(m.id, "metaAlvo", inlineEdit.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleInlineEdit(m.id, "metaAlvo", inlineEdit.value); if (e.key === "Escape") setInlineEdit(null); }} />
                            ) : (
                              <span className="cursor-pointer rounded px-1 py-0.5 text-xs tabular-nums"
                                style={{ color: "var(--ink-secondary)" }}
                                title="Clique para editar"
                                onClick={() => setInlineEdit({ metaId: m.id, field: "metaAlvo", value: String(m.metaAlvo) })}>
                                {m.metaAlvo.toLocaleString("pt-BR")}
                              </span>
                            )}
                          </td>
                          {/* Progresso — nota + mini progress bar */}
                          <td className="px-4 py-3">
                            {(() => {
                              const nota = getMetaUltimaNota(m.id);
                              if (nota === null) return <span className="text-xs" style={{ color: "var(--ink-subtle)" }}>—</span>;
                              const cor = nota >= 100 ? "#059669" : nota >= 70 ? "#d97706" : "#dc2626";
                              const pct = Math.min((nota / 120) * 100, 100);
                              return (
                                <div className="flex items-center gap-2 min-w-[72px]">
                                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border-strong)", minWidth: 40 }}>
                                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: cor }}>{nota.toFixed(0)}</span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {role === "GUARDIAO" && m.status === "DRAFT" && (
                                <button onClick={() => handleApproveMeta(m.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded">Aprovar</button>
                              )}
                              {m.status !== "CANCELADO" && (
                                <button onClick={() => setAssigningMetaId(assigningMetaId === m.id ? null : m.id)} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded">Atribuir</button>
                              )}
                              <button onClick={() => {
                                  setCascateandoMetaId(m.id);
                                  setMetaForm({ indicadorId: String(m.indicador.id ?? ""), centroCustoId: "", pesoNaCesta: "100", metaAlvo: String(m.metaAlvo), metaMinima: m.metaMinima ? String(m.metaMinima) : "", metaMaxima: m.metaMaxima ? String(m.metaMaxima) : "", parentMetaId: String(m.id), smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "" });
                                  setShowMetaForm(true);
                                }} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-0.5 rounded">Cascatear</button>
                              <button onClick={() => handleClonarMeta(m)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Clonar</button>
                              <button onClick={() => {
                                  const next = expandedPlanoMetaId === m.id ? null : m.id;
                                  setExpandedPlanoMetaId(next);
                                  if (next) loadPlanosAcao(next);
                                }} className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-0.5 rounded">Planos</button>
                              <button onClick={() => {
                                  const next = expandedHistoricoMetaId === m.id ? null : m.id;
                                  setExpandedHistoricoMetaId(next);
                                  if (next) loadHistorico(next);
                                }} className="text-xs bg-teal-100 hover:bg-teal-200 text-teal-700 px-2 py-0.5 rounded">Histórico</button>
                              {m.status !== "CANCELADO" && role === "GUARDIAO" && (
                                <button onClick={() => { if (confirm(`Cancelar Meta #${m.id}?`)) handleCancelarMeta(m.id); }} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded">Cancelar</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {assigningMetaId === m.id && (
                          <tr className="bg-blue-50"><td colSpan={8} className="px-4 py-2">
                            <form onSubmit={handleAtribuirMeta} className="flex items-center gap-2">
                              <select required value={assignColabId} onChange={(e) => setAssignColabId(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm flex-1">
                                <option value="">Selecionar colaborador...</option>
                                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>)}
                              </select>
                              <button type="submit" className="text-xs bg-blue-700 text-white px-3 py-1 rounded">Atribuir</button>
                              <button type="button" onClick={() => setAssigningMetaId(null)} className="text-xs text-gray-500 px-2 py-1">✕</button>
                            </form>
                          </td></tr>
                        )}
                        {expandedPlanoMetaId === m.id && (
                          <tr className="bg-orange-50"><td colSpan={8} className="px-4 py-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-orange-800">Planos de Ação — Meta #{m.id}</p>
                                <button onClick={() => setShowPlanoForm(showPlanoForm === m.id ? null : m.id)} className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded">+ Novo Plano</button>
                              </div>
                              {showPlanoForm === m.id && (
                                <form onSubmit={(e) => handleCriarPlanoAcao(e, m.id)} className="flex gap-2 flex-wrap bg-white rounded p-2 border border-orange-200">
                                  <input required placeholder="Descrição *" value={planoForm.descricao} onChange={(e) => setPlanoForm((f) => ({ ...f, descricao: e.target.value }))} className="flex-1 border rounded px-2 py-1 text-xs min-w-48" />
                                  <input placeholder="Responsável" value={planoForm.responsavel} onChange={(e) => setPlanoForm((f) => ({ ...f, responsavel: e.target.value }))} className="border rounded px-2 py-1 text-xs w-36" />
                                  <input type="date" value={planoForm.prazo} onChange={(e) => setPlanoForm((f) => ({ ...f, prazo: e.target.value }))} className="border rounded px-2 py-1 text-xs w-36" />
                                  <button type="submit" className="bg-orange-600 text-white text-xs px-3 py-1 rounded">Salvar</button>
                                </form>
                              )}
                              {planosAcao.filter((p) => p.metaId === m.id).map((p) => (
                                <div key={p.id} className="flex items-center gap-3 bg-white rounded border border-orange-100 px-3 py-2 text-xs">
                                  <button onClick={() => handleTogglePlanoStatus(p)} className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${p.status === "CONCLUIDO" ? "bg-green-500 border-green-500" : p.status === "EM_ANDAMENTO" ? "bg-yellow-400 border-yellow-400" : "bg-white border-gray-400"}`} title="Clique para avançar status" />
                                  <span className={`flex-1 ${p.status === "CONCLUIDO" ? "line-through text-gray-400" : "text-gray-700"}`}>{p.descricao}</span>
                                  {p.responsavel && <span className="text-gray-400">{p.responsavel}</span>}
                                  {p.prazo && <span className="text-gray-400">{new Date(p.prazo).toLocaleDateString("pt-BR")}</span>}
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${p.status === "CONCLUIDO" ? "bg-green-100 text-green-700" : p.status === "EM_ANDAMENTO" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{p.status.replace("_"," ")}</span>
                                  <button onClick={async () => { await fetch(`/api/planos-acao?id=${p.id}`, { method: "DELETE" }); loadPlanosAcao(m.id); }} className="text-red-400 hover:text-red-600">✕</button>
                                </div>
                              ))}
                              {planosAcao.filter((p) => p.metaId === m.id).length === 0 && <p className="text-xs text-gray-400 text-center py-2">Nenhum plano cadastrado</p>}
                            </div>
                          </td></tr>
                        )}
                        {expandedHistoricoMetaId === m.id && (
                          <tr className="bg-teal-50"><td colSpan={8} className="px-4 py-3">
                            <p className="text-xs font-semibold text-teal-800 mb-2">Histórico de Alterações — Meta #{m.id}</p>
                            {historico.filter((h) => h.metaId === m.id).length === 0
                              ? <p className="text-xs text-gray-400 text-center py-2">Nenhuma alteração registrada</p>
                              : <div className="space-y-1">
                                {historico.filter((h) => h.metaId === m.id).map((h) => (
                                  <div key={h.id} className="flex items-center gap-3 text-xs text-gray-600 bg-white rounded border border-teal-100 px-3 py-1.5">
                                    <span className="text-gray-400">{new Date(h.criadoEm).toLocaleString("pt-BR")}</span>
                                    <span className="font-medium text-teal-700">{h.campo}</span>
                                    <span className="text-red-400 line-through">{h.valorAntes ?? "—"}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600">{h.valorDepois ?? "—"}</span>
                                    {h.usuario && <span className="text-gray-400">por {h.usuario}</span>}
                                  </div>
                                ))}
                              </div>
                            }
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                    {metas.length === 0 && (
                      <tr><td colSpan={8}>
                        <EmptyState icon="🎯" title="Nenhuma meta cadastrada"
                          description="Crie metas para o ciclo ativo atribuindo indicadores e pesos a colaboradores."
                          action={{ label: "+ Nova Meta", onClick: () => setShowMetaForm(true) }} />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PAINEL ATINGIMENTO NOMINAL ────────────────────────────────── */}
        {activeTab === "atingimento" && (
          <div className="space-y-6">
            <h2 className="icp-page-title">Painel Atingimento Nominal — por Meta</h2>
            {metas.length === 0 ? (
              <div className="text-center text-gray-400 py-16">Nenhuma meta cadastrada</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {metas.map((m) => {
                  const metaRealizacoes = realizacoes.filter((r) => r.meta?.id === m.id);
                  const porColab = colaboradores.filter((c) => {
                    return metaRealizacoes.some((r) => r.colaborador?.id === c.id);
                  });
                  const melhorNota = metaRealizacoes.reduce((max, r) => Math.max(max, r.notaCalculada ?? 0), 0);
                  const mediaNota = metaRealizacoes.length > 0
                    ? metaRealizacoes.reduce((s, r) => s + (r.notaCalculada ?? 0), 0) / metaRealizacoes.length : 0;
                  const polarLabel = (m.indicador as Indicador).polaridade === "MENOR_MELHOR" ? "↓ Menor é Melhor" : "↑ Maior é Melhor";
                  const sparkData = MESES.map((mes, i) => {
                    const mesReals = metaRealizacoes.filter((r) => r.mesReferencia === i + 1);
                    const avgNota = mesReals.length > 0
                      ? mesReals.reduce((s, r) => s + (r.notaCalculada ?? 0), 0) / mesReals.length
                      : null;
                    return { mes, nota: avgNota };
                  }).filter((d) => d.nota !== null);
                  return (
                    <div key={m.id} className="bg-white icp-card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="icp-section-title">{m.indicador.nome}</h3>
                          <p className="text-xs text-gray-500">{m.centroCusto?.nome ?? "Corporativo"} · Peso: {m.pesoNaCesta}% · Alvo: {m.metaAlvo.toLocaleString("pt-BR")} {m.indicador.unidade}</p>
                          <p className="text-xs mt-0.5"><span className={`font-medium ${(m.indicador as Indicador).polaridade === "MENOR_MELHOR" ? "text-orange-600" : "text-green-600"}`}>{polarLabel}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Média: <span className={`font-bold ${mediaNota >= 100 ? "text-green-600" : mediaNota >= 70 ? "text-yellow-600" : "text-red-600"}`}>{mediaNota.toFixed(1)} pts</span></p>
                          <p className="text-xs text-gray-400">Melhor: <span className="font-bold text-blue-600">{melhorNota.toFixed(1)} pts</span></p>
                          <StatusBadge status={m.status} />
                        </div>
                      </div>
                      {metaRealizacoes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                {["Colaborador","Mês","Realizado","Nota","Prêmio Proj."].map((h) => (
                                  <th key={h} className="px-3 py-1.5 text-left text-gray-500 uppercase font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {metaRealizacoes.slice().sort((a, b) => (b.notaCalculada ?? 0) - (a.notaCalculada ?? 0)).map((r) => (
                                <tr key={r.id} className="">
                                  <td className="px-3 py-1.5 font-medium text-gray-800">{r.colaborador?.nomeCompleto ?? "Corporativo"}</td>
                                  <td className="px-3 py-1.5 text-gray-500">{MESES[r.mesReferencia - 1]}/{r.anoReferencia}</td>
                                  <td className="px-3 py-1.5 text-gray-700">{r.valorRealizado.toLocaleString("pt-BR")} {m.indicador.unidade}</td>
                                  <td className="px-3 py-1.5">
                                    <span className={`font-bold ${(r.notaCalculada ?? 0) >= 100 ? "text-green-600" : (r.notaCalculada ?? 0) >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                                      {(r.notaCalculada ?? 0).toFixed(1)} pts
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-700">{r.premioProjetado != null ? fmt(r.premioProjetado) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-3">Nenhuma realização lançada</p>
                      )}
                      {sparkData.length > 1 && (
                        <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                          <p className="text-xs font-medium mb-2" style={{ color: "var(--ink-muted)" }}>Evolução da nota (média mensal)</p>
                          <div className="h-20 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                                <Tooltip formatter={(v) => [`${Number(v).toFixed(1)} pts`, "Nota"]} />
                                <Line type="monotone" dataKey="nota" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {porColab.length === 0 && m._count.colaboradores === 0 && (
                        <p className="text-xs text-amber-600 mt-2">⚠ Nenhum colaborador atribuído a esta meta</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── REALIZAÇÕES ───────────────────────────────────────────────── */}
        {activeTab === "realizacoes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="icp-page-title">Realizações</h2>
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
                  className="btn-primary"
                >
                  + Lançar Realização
                </button>
              </div>
            </div>

            {/* Inline form */}
            {showRealizacaoForm && (
              <form onSubmit={handleLancarRealizacao} className="bg-white icp-card p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  <button type="submit" className="btn-primary">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setShowRealizacaoForm(false)}
                    className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-1.5 rounded transition-colors hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white icp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Meta / Indicador","Colaborador","Mês/Ano","Realizado","Nota","Prêmio","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {realizacoesFiltradas.map((r) => (
                      <tr key={r.id} className="">
                        <td className="px-4 py-3">{r.meta?.indicador?.nome ?? `Meta #${r.meta?.id}`}</td>
                        <td className="px-4 py-3">{r.colaborador?.nomeCompleto ?? "Corporativo"}</td>
                        <td className="px-4 py-3">{MESES[(r.mesReferencia ?? 1) - 1]}/{r.anoReferencia}</td>
                        <td className="px-4 py-3">{r.valorRealizado?.toLocaleString("pt-BR")}</td>
                        <td className={`px-4 py-3 ${notaColor(r.notaCalculada)}`}>
                          {r.notaCalculada !== null ? fmtN(r.notaCalculada) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-800">{r.premioProjetado ? fmt(r.premioProjetado) : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                    {realizacoesFiltradas.length === 0 && (
                      <tr><td colSpan={7}>
                        <EmptyState icon="📋" title="Nenhuma realização encontrada"
                          description={realizacoes.length > 0 ? "Ajuste os filtros para ver as realizações." : "Registre o valor realizado de cada indicador para calcular as notas."}
                          action={realizacoes.length === 0 ? { label: "Lançar Realização", onClick: () => setShowRealizacaoForm(true) } : undefined} />
                      </td></tr>
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="icp-page-title">Colaboradores <span className="text-sm font-normal text-gray-400">({colaboradores.length})</span></h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDownloadTemplateColaboradores}
                  className="btn-ghost text-xs"
                >
                  Baixar Template XLSX
                </button>
                <button
                  onClick={() => { setShowColabImport((v) => !v); setColabImportResult(null); }}
                  className="btn-primary"
                >
                  Importar XLSX
                </button>
              </div>
            </div>

            {/* Import form */}
            {showColabImport && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-blue-800">Importação em Massa de Colaboradores</h3>
                <p className="text-sm text-blue-700">
                  Faça o download do template, preencha e faça upload. Campos obrigatórios: <strong>matricula</strong> e <strong>nomeCompleto</strong>. Empresa, Cargo e CC são criados automaticamente se não existirem.
                </p>
                <form onSubmit={handleColabImport} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handleDownloadTemplateColaboradores} className="btn-ghost text-xs">
                      Baixar Template XLSX
                    </button>
                    <span className="text-xs" style={{ color: "var(--ink-muted)" }}>Preencha o template e faça upload abaixo</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>Arquivo XLSX</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => { setColabCsvFile(e.target.files?.[0] ?? null); setColabCsvText(""); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    {colabCsvFile && (
                      <p className="text-xs text-green-700 mt-1 font-medium">✓ {colabCsvFile.name} ({(colabCsvFile.size / 1024).toFixed(0)} KB)</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={colabImportLoading || !colabCsvFile}
                      className="btn-primary"
                    >
                      {colabImportLoading ? "Importando..." : "Importar"}
                    </button>
                    <button type="button" onClick={() => setShowColabImport(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                  </div>
                </form>
                {colabImportResult && (
                  <div className="space-y-2">
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-700 font-semibold">✓ {colabImportResult.processed} processados</span>
                      <span className="text-blue-700 font-semibold">↻ {colabImportResult.updated} atualizados</span>
                      {colabImportResult.erros.length > 0 && (
                        <span className="text-red-700 font-semibold">✗ {colabImportResult.erros.length} erros</span>
                      )}
                    </div>
                    {colabImportResult.erros.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                        {colabImportResult.erros.map((e, i) => (
                          <div key={i} className="text-xs text-red-700">Linha {e.linha}: {e.motivo}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white icp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Matrícula","Nome","Cargo","Grade","Target Bonus","Centro de Custo","Salário Base","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {colaboradores.map((c) => (
                      <tr key={c.id} className="">
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.matricula}</td>
                        <td className="px-4 py-3">{c.nomeCompleto}</td>
                        <td className="px-4 py-3">{c.cargo.nome}</td>
                        <td className="px-4 py-3">
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{c.cargo.nivelHierarquico}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${c.cargo.targetBonusPerc >= 20 ? "text-green-700" : c.cargo.targetBonusPerc >= 10 ? "text-blue-700" : "text-gray-600"}`}>
                            {c.cargo.targetBonusPerc}%
                          </span>
                          <span className="text-xs text-gray-400 ml-1">= {fmt(c.salarioBase * 12 * c.cargo.targetBonusPerc / 100)}/ano</span>
                        </td>
                        <td className="px-4 py-3">{c.centroCusto.nome}</td>
                        <td className="px-4 py-3 text-gray-800">{fmt(c.salarioBase)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {c.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {colaboradores.length === 0 && (
                      <tr><td colSpan={8}>
                        <EmptyState icon="👥" title="Nenhum colaborador cadastrado"
                          description="Importe colaboradores via CSV ou cadastre manualmente para começar."
                          action={{ label: "Importar XLSX", onClick: () => setActiveTab("colaboradores") }} />
                      </td></tr>
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
              <h2 className="icp-page-title">
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
                    <div key={item.id} className="bg-white icp-card p-5 flex items-start justify-between gap-4">
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
                    <div className="bg-white icp-card p-8 text-center text-gray-400">
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
                    <div className="bg-white icp-card p-6 text-center text-gray-400 text-sm">
                      Sem solicitações de prorrogação pendentes.
                    </div>
                  ) : (
                    <div className="bg-white icp-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              {["Colaborador","Janela","Justificativa","Nova Data Limite","Ações"].map((h) => (
                                <th key={h} className="text-left px-4 py-2.5">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="">
                            {waivers.map((w) => (
                              <tr key={w.id} className="">
                                <td className="px-4 py-3">
                                  {w.colaborador?.nomeCompleto ?? `#${w.colaboradorId}`}
                                  <br /><span className="text-xs text-gray-400 font-mono">{w.colaborador?.matricula}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {MESES[(w.janela.mesReferencia ?? 1) - 1]}/{w.janela.anoReferencia}
                                </td>
                                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{w.justificativa}</td>
                                <td className="px-4 py-3">
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
              <h2 className="icp-page-title">Janelas de Apuração</h2>
              {role === "GUARDIAO" && (
                <button
                  onClick={() => setShowJanelaForm(!showJanelaForm)}
                  className="btn-primary"
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
                  <button type="submit" className="btn-primary">
                    Criar Janela
                  </button>
                  <button type="button" onClick={() => setShowJanelaForm(false)}
                    className="bg-white border border-gray-300 text-gray-600 text-sm px-4 py-1.5 rounded hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white icp-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Mês","Ano","Abertura","Fechamento","Status","Waivers","Ação"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {janelas.map((j) => (
                      <tr key={j.id} className="">
                        <td className="px-4 py-3">{MESES[j.mesReferencia - 1]}</td>
                        <td className="px-4 py-3">{j.anoReferencia}</td>
                        <td className="px-4 py-3">{new Date(j.dataAbertura).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">{new Date(j.dataFechamento).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={j.status} />
                          {j.isOpen && <span className="ml-1.5 text-xs text-green-600 font-medium">• ao vivo</span>}
                        </td>
                        <td className="px-4 py-3">
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
                      <tr><td colSpan={7}>
                        <EmptyState icon="🗓" title="Nenhuma janela de apuração"
                          description="Janelas controlam o período em que realizações podem ser lançadas." />
                      </td></tr>
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
            <h2 className="icp-page-title">Importação em Lote — BP Consolidador</h2>

            <form onSubmit={handleBulkImport} className="bg-white icp-card p-6 space-y-4">
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

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700">
                  Arquivo XLSX <span className="text-gray-400 font-normal">(colunas: matricula · codigo_indicador · valor_realizado · observacao)</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportCsvFile(e.target.files?.[0] ?? null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                {importCsvFile && (
                  <p className="text-xs text-green-700 font-medium">✓ {importCsvFile.name} ({(importCsvFile.size / 1024).toFixed(0)} KB)</p>
                )}
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
              <div className="bg-white icp-card p-6 space-y-4">
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

        {/* ── ELEGÍVEIS ─────────────────────────────────────────────────── */}
        {activeTab === "elegiveis" && (
          <div className="space-y-6">
            <h2 className="icp-page-title">Comparação entre Elegíveis</h2>
            <p className="text-sm text-gray-500">Ranking de todos os colaboradores com realizações lançadas no ciclo, ordenado por nota média.</p>
            {rankingElegiveis.length === 0 ? (
              <div className="text-center text-gray-400 py-16">Nenhuma realização lançada ainda</div>
            ) : (
              <div className="bg-white icp-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["#","Colaborador","Cargo","Nível","Metas","Realizações","Nota Média","Prêmio YTD","Target Anual","% do Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {rankingElegiveis.map((row, idx) => {
                        const { fator, tipo: movTipo } = calcFatorProRata(row.colaborador.id);
                        const premioAjustado = row.premioYTD * fator;
                        const percTarget = row.targetAnual > 0 ? (premioAjustado / row.targetAnual) * 100 : 0;
                        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                        return (
                          <tr key={row.colaborador.id} className={idx < 3 ? "bg-amber-50" : "hover:bg-gray-50"}>
                            <td className="px-4 py-3 text-gray-500 font-medium">
                              {medal ? <span>{medal}</span> : <span className="text-gray-400">{idx + 1}</span>}
                            </td>
                            <td className="px-4 py-3">{row.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3">{row.colaborador.cargo.nome}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.cargo.nivelHierarquico}</td>
                            <td className="px-4 py-3 text-gray-500">{row.metasAtribuidas}</td>
                            <td className="px-4 py-3 text-gray-500">{row.totalRealizacoes > 0 ? row.totalRealizacoes : <span className="text-gray-300">—</span>}</td>
                            <td className={`px-4 py-3 ${row.totalRealizacoes > 0 ? notaColor(row.notaMedia) : "text-gray-300"}`}>{row.totalRealizacoes > 0 ? fmtN(row.notaMedia) : "—"}</td>
                            <td className="px-4 py-3">
                              <p className="text-blue-700 font-medium">{fmt(premioAjustado)}</p>
                              {movTipo && fator < 1 && <p className="text-xs text-amber-600">{fmt(row.premioYTD)} × {(fator * 100).toFixed(0)}%</p>}
                            </td>
                            <td className="px-4 py-3">{fmt(row.targetAnual)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px]">
                                  <div
                                    className={`h-1.5 rounded-full ${percTarget >= 100 ? "bg-green-500" : percTarget >= 70 ? "bg-yellow-500" : "bg-red-400"}`}
                                    style={{ width: `${Math.min(percTarget, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${percTarget >= 100 ? "text-green-600" : percTarget >= 70 ? "text-yellow-600" : "text-red-500"}`}>
                                  {percTarget.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RELATÓRIO DE FECHAMENTO ──────────────────────────────────────── */}
        {activeTab === "relatorio" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="icp-page-title">Relatório de Fechamento — Ciclo {cicloAtivo?.anoFiscal}</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleExportRelatorioCSV} className="btn-ghost text-xs">
                  Exportar XLSX
                </button>
                <button onClick={() => window.print()} className="btn-ghost text-xs">
                  Imprimir PDF
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Colaboradores Elegíveis", value: String(rankingElegiveis.length) },
                { label: "Metas Ativas", value: String(metas.filter((m) => m.status === "APROVADO" || m.status === "ATIVO").length) },
                { label: "Realizações Lançadas", value: String(realizacoes.length) },
                { label: "Total Prêmio Projetado", value: fmt(totalPremioProjetado) },
              ].map((card) => (
                <div key={card.label} className="bg-white icp-card p-4">
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Ciclo info */}
            <div className="bg-white icp-card p-5">
              <h3 className="font-semibold text-gray-700 mb-3">Informações do Ciclo</h3>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><dt className="text-gray-500">Ano Fiscal</dt><dd className="font-medium">{cicloAtivo?.anoFiscal}</dd></div>
                <div><dt className="text-gray-500">Status</dt><dd><StatusBadge status={cicloAtivo?.status ?? "—"} /></dd></div>
                <div><dt className="text-gray-500">Bonus Pool</dt><dd className="font-medium">{cicloAtivo?.bonusPool ? fmt(cicloAtivo.bonusPool) : "—"}</dd></div>
                <div><dt className="text-gray-500">Realizações Aprovadas</dt><dd className="font-medium">{totalRealizacoesAprovadas}</dd></div>
              </dl>
            </div>

            {/* Full elegíveis table */}
            {rankingElegiveis.length > 0 && (
              <div className="bg-white icp-card overflow-hidden">
                <div className="px-5 py-3 icp-card-header">
                  <h3 className="font-semibold text-gray-700">Atingimento por Colaborador</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Colaborador","Matrícula","Cargo","Nível","Nota Média","Prêmio YTD","Target Anual","% Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {rankingElegiveis.map((row) => {
                        const percTarget = row.targetAnual > 0 ? (row.premioYTD / row.targetAnual) * 100 : 0;
                        return (
                          <tr key={row.colaborador.id} className="">
                            <td className="px-4 py-3">{row.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.matricula}</td>
                            <td className="px-4 py-3">{row.colaborador.cargo.nome}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.cargo.nivelHierarquico}</td>
                            <td className={`px-4 py-3 ${notaColor(row.notaMedia)}`}>{fmtN(row.notaMedia)}</td>
                            <td className="px-4 py-3 text-blue-700 font-medium">{fmt(row.premioYTD)}</td>
                            <td className="px-4 py-3">{fmt(row.targetAnual)}</td>
                            <td className={`px-4 py-3 font-medium ${percTarget >= 100 ? "text-green-600" : percTarget >= 70 ? "text-yellow-600" : "text-red-500"}`}>
                              {percTarget.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold text-gray-600">TOTAL</td>
                        <td className="px-4 py-2.5 text-blue-700 font-bold">{fmt(totalPremioProjetado)}</td>
                        <td className="px-4 py-2.5 text-gray-600 font-semibold">
                          {fmt(rankingElegiveis.reduce((s, r) => s + r.targetAnual, 0))}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-gray-700">
                          {rankingElegiveis.reduce((s, r) => s + r.targetAnual, 0) > 0
                            ? ((totalPremioProjetado / rankingElegiveis.reduce((s, r) => s + r.targetAnual, 0)) * 100).toFixed(0)
                            : "0"}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Meta breakdown */}
            <div className="bg-white icp-card overflow-hidden">
              <div className="px-5 py-3 icp-card-header">
                <h3 className="font-semibold text-gray-700">Metas do Ciclo</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Indicador","CC","Polaridade","Peso","Alvo","Colaboradores","Realizações","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="">
                    {metas.map((m) => (
                      <tr key={m.id} className="">
                        <td className="px-4 py-3">{m.indicador.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{m.centroCusto?.nome ?? "Corporativo"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.indicador.polaridade === "MENOR_MELHOR" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {m.indicador.polaridade === "MENOR_MELHOR" ? "↓ Menor" : "↑ Maior"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{m.pesoNaCesta}%</td>
                        <td className="px-4 py-3">{m.metaAlvo.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 text-gray-500">{m._count.colaboradores}</td>
                        <td className="px-4 py-3 text-gray-500">{m._count.realizacoes}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFERÊNCIA E VALIDAÇÃO ───────────────────────────────────── */}
        {activeTab === "conferencia" && (
          <div className="space-y-6">
            <h2 className="icp-page-title">Conferência e Validação</h2>

            {/* Status geral */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Metas sem problemas", value: String(validacaoMetas.filter((v) => v.ok).length), color: "text-green-700", bg: "bg-green-50 border-green-200" },
                { label: "Erros críticos", value: String(totalErros), color: totalErros > 0 ? "text-red-700" : "text-gray-500", bg: totalErros > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200" },
                { label: "Avisos", value: String(totalAvisos), color: totalAvisos > 0 ? "text-amber-700" : "text-gray-500", bg: totalAvisos > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200" },
                { label: "Total de metas", value: String(metas.length), color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Checklist por meta */}
            <div className="bg-white icp-card overflow-hidden">
              <div className="px-5 py-3 icp-card-header flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Checklist por Meta</h3>
                <span className="text-xs text-gray-400">{validacaoMetas.filter((v) => v.ok).length}/{metas.length} ok</span>
              </div>
              <div className="">
                {validacaoMetas.map((v) => (
                  <div key={v.meta.id} className={`px-5 py-3 flex items-start gap-3 ${v.erros.length > 0 ? "bg-red-50" : v.avisos.length > 0 ? "bg-amber-50" : "bg-green-50"}`}>
                    <span className="text-lg mt-0.5 flex-shrink-0">
                      {v.erros.length > 0 ? "🔴" : v.avisos.length > 0 ? "🟡" : "🟢"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{v.meta.indicador.nome}
                        <span className="ml-2 text-xs text-gray-500">{v.meta.centroCusto?.nome ?? "Corporativo"} · Peso {v.meta.pesoNaCesta}%</span>
                      </p>
                      {v.erros.map((e, i) => (
                        <p key={i} className="text-xs text-red-700 mt-0.5">✗ {e}</p>
                      ))}
                      {v.avisos.map((a, i) => (
                        <p key={i} className="text-xs text-amber-700 mt-0.5">⚠ {a}</p>
                      ))}
                      {v.ok && <p className="text-xs text-green-700 mt-0.5">Tudo ok</p>}
                    </div>
                    <StatusBadge status={v.meta.status} />
                  </div>
                ))}
                {metas.length === 0 && <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma meta cadastrada</div>}
              </div>
            </div>

            {/* Por Centro de Custo */}
            {ccRows.length > 0 && (
              <div className="bg-white icp-card overflow-hidden">
                <div className="px-5 py-3 icp-card-header">
                  <h3 className="font-semibold text-gray-700">Consolidado por Centro de Custo</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Centro de Custo","Metas","Colaboradores","Realizações","Nota Média","Prêmio YTD"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {ccRows.map((row) => (
                        <tr key={row.nome} className="">
                          <td className="px-4 py-3">{row.nome}</td>
                          <td className="px-4 py-3">{row.metas}</td>
                          <td className="px-4 py-3">{row.colaboradores}</td>
                          <td className="px-4 py-3">{row.realizacoesCount}</td>
                          <td className={`px-4 py-3 ${notaColor(row.notaMedia)}`}>{row.realizacoesCount > 0 ? fmtN(row.notaMedia) : "—"}</td>
                          <td className="px-4 py-3 text-blue-700 font-medium">{fmt(row.premioYTD)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Por Cargo/Nível */}
            {cargoRows.length > 0 && (
              <div className="bg-white icp-card overflow-hidden">
                <div className="px-5 py-3 icp-card-header">
                  <h3 className="font-semibold text-gray-700">Consolidado por Cargo / Nível</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Cargo","Nível","Colaboradores","Nota Média","Prêmio YTD","Target Total","% Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {cargoRows.map((row) => {
                        const perc = row.targetTotal > 0 ? (row.premioYTD / row.targetTotal) * 100 : 0;
                        return (
                          <tr key={`${row.cargo}|${row.nivel}`} className="">
                            <td className="px-4 py-3">{row.cargo}</td>
                            <td className="px-4 py-3"><span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{row.nivel}</span></td>
                            <td className="px-4 py-3">{row.count}</td>
                            <td className={`px-4 py-3 ${notaColor(row.notaMedia)}`}>{fmtN(row.notaMedia)}</td>
                            <td className="px-4 py-3 text-blue-700 font-medium">{fmt(row.premioYTD)}</td>
                            <td className="px-4 py-3">{fmt(row.targetTotal)}</td>
                            <td className={`px-4 py-3 font-medium ${perc >= 100 ? "text-green-600" : perc >= 70 ? "text-yellow-600" : "text-red-500"}`}>{perc.toFixed(0)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Evolução mês a mês */}
            {evolucaoMensal.length > 0 && (
              <div className="bg-white icp-card overflow-hidden">
                <div className="px-5 py-3 icp-card-header">
                  <h3 className="font-semibold text-gray-700">Evolução Mês a Mês</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Mês","Realizações","Nota Média","Prêmio Projetado"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {evolucaoMensal.map((m) => (
                        <tr key={m.mesNum} className="">
                          <td className="px-4 py-3">{m.mes}</td>
                          <td className="px-4 py-3">{m.count}</td>
                          <td className={`px-4 py-3 ${notaColor(m.notaMedia)}`}>{m.notaMedia !== null ? fmtN(m.notaMedia) : "—"}</td>
                          <td className="px-4 py-3 text-blue-700 font-medium">{fmt(m.premioTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {evolucaoMensal.length === 0 && ccRows.length === 0 && (
              <div className="text-center text-gray-400 py-12">Nenhuma realização lançada ainda — os painéis consolidados aparecerão aqui.</div>
            )}

            {/* Colaboradores sem metas (req 742) */}
            {(() => {
              const comMeta = new Set(metas.flatMap((m) => m.colaboradorIds));
              const semMeta = colaboradores.filter((c) => c.ativo && !comMeta.has(c.id));
              if (semMeta.length === 0) return null;
              return (
                <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-red-100 flex items-center justify-between">
                    <h3 className="font-semibold text-red-800">⚠ Colaboradores Ativos Sem Metas ({semMeta.length})</h3>
                    <span className="text-xs text-red-500">Estes colaboradores não estão atribuídos a nenhuma meta do ciclo ativo</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-red-100"><tr>
                      {["Matrícula","Nome","Cargo","CC"].map((h) => <th key={h} className="text-left px-4 py-2 text-red-700 font-medium text-xs uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-red-100">
                      {semMeta.map((c) => (
                        <tr key={c.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{c.matricula}</td>
                          <td className="px-4 py-2 text-gray-800">{c.nomeCompleto}</td>
                          <td className="px-4 py-2 text-gray-600">{c.cargo.nome}</td>
                          <td className="px-4 py-2 text-gray-600">{c.centroCusto.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── MOVIMENTAÇÕES RH ──────────────────────────────────────────── */}
        {activeTab === "movimentacoes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="icp-page-title">Movimentações RH</h2>
                <p className="text-sm text-gray-500 mt-0.5">Admissões, transferências, promoções e desligamentos — com cálculo pro-rata automático</p>
              </div>
              <button onClick={() => setShowMovForm(!showMovForm)}
                className="btn-primary">
                + Registrar Movimentação
              </button>
            </div>

            {showMovForm && (
              <form onSubmit={handleCriarMovimentacao} className="bg-white icp-card p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <h3 className="text-sm font-semibold text-blue-900">Nova Movimentação</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Colaborador *</label>
                  <select required value={movForm.colaboradorId} onChange={(e) => setMovForm({ ...movForm, colaboradorId: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="">Selecionar...</option>
                    {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.matricula}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                  <select required value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                    <option value="ADMISSAO">Admissão</option>
                    <option value="TRANSFERENCIA">Transferência de CC</option>
                    <option value="PROMOCAO">Promoção</option>
                    <option value="DESLIGAMENTO">Desligamento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data Efetiva *</label>
                  <input required type="date" value={movForm.dataEfetiva} onChange={(e) => setMovForm({ ...movForm, dataEfetiva: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
                </div>
                {(movForm.tipo === "PROMOCAO") && (<>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cargo Anterior</label>
                    <select value={movForm.cargoAnteriorId} onChange={(e) => setMovForm({ ...movForm, cargoAnteriorId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                      <option value="">Selecionar...</option>
                      {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.nivelHierarquico}) — {c.targetBonusPerc}%</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Cargo Novo *</label>
                    <select required value={movForm.cargoNovoId} onChange={(e) => setMovForm({ ...movForm, cargoNovoId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                      <option value="">Selecionar...</option>
                      {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.nivelHierarquico}) — {c.targetBonusPerc}%</option>)}
                    </select>
                  </div>
                </>)}
                {(movForm.tipo === "TRANSFERENCIA") && (<>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CC Anterior</label>
                    <select value={movForm.ccAnteriorId} onChange={(e) => setMovForm({ ...movForm, ccAnteriorId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                      <option value="">Selecionar...</option>
                      {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">CC Novo *</label>
                    <select required value={movForm.ccNovoId} onChange={(e) => setMovForm({ ...movForm, ccNovoId: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                      <option value="">Selecionar...</option>
                      {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                </>)}
                <div className="col-span-2 md:col-span-3 flex gap-2">
                  <button type="submit" className="btn-primary">Registrar</button>
                  <button type="button" onClick={() => setShowMovForm(false)} className="text-sm text-gray-500 px-4 py-1.5">Cancelar</button>
                </div>
              </form>
            )}

            {/* Pro-rata summary por colaborador */}
            {movimentacoes.length > 0 && (
              <div className="bg-white icp-card overflow-hidden">
                <div className="px-5 py-3 icp-card-header">
                  <h3 className="font-semibold text-gray-700">Impacto Pro-Rata por Colaborador</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Colaborador","Tipo","Data Efetiva","Fator Pro-Rata","Situação","Prêmio Bruto","Prêmio Ajustado"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {movimentacoes.map((mv) => {
                        const { fator, descricao } = calcFatorProRata(mv.colaboradorId);
                        const colRealizacoes = realizacoes.filter((r) => r.colaborador?.id === mv.colaboradorId);
                        const premioBruto = colRealizacoes.reduce((s, r) => s + (r.premioProjetado ?? 0), 0);
                        const premioAjustado = premioBruto * fator;
                        return (
                          <tr key={mv.id} className="">
                            <td className="px-4 py-3">{mv.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${mv.tipo === "ADMISSAO" ? "bg-green-100 text-green-700" : mv.tipo === "DESLIGAMENTO" ? "bg-red-100 text-red-700" : mv.tipo === "PROMOCAO" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                {mv.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3">{new Date(mv.dataEfetiva).toLocaleDateString("pt-BR")}</td>
                            <td className="px-4 py-3 font-semibold text-blue-700">{(fator * 100).toFixed(0)}%</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{descricao}</td>
                            <td className="px-4 py-3">{fmt(premioBruto)}</td>
                            <td className="px-4 py-3 font-semibold text-green-700">{fmt(premioAjustado)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-white icp-card overflow-hidden">
              <div className="px-5 py-3 icp-card-header flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Histórico de Movimentações</h3>
                <span className="text-xs text-gray-400">{movimentacoes.length} registros</span>
              </div>
              {movimentacoes.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">Nenhuma movimentação registrada no ciclo</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {["Colaborador","Tipo","Data","Cargo Ant.","Cargo Novo","CC Ant.","CC Novo","Status"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="">
                      {movimentacoes.map((mv) => (
                        <tr key={mv.id} className="">
                          <td className="px-4 py-3">{mv.colaborador.nomeCompleto}</td>
                          <td className="px-4 py-3"><StatusBadge status={mv.tipo} /></td>
                          <td className="px-4 py-3">{new Date(mv.dataEfetiva).toLocaleDateString("pt-BR")}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{mv.cargoAnterior?.nome ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{mv.cargoNovo?.nome ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{mv.ccAnterior?.nome ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{mv.ccNovo?.nome ?? "—"}</td>
                          <td className="px-4 py-3"><StatusBadge status={mv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Metas a Contratar — admitidos/transferidos sem metas (req 736) */}
            {(() => {
              const comMeta = new Set(metas.flatMap((m) => m.colaboradorIds));
              const movRecentes = movimentacoes.filter((mv) => ["ADMISSAO","TRANSFERENCIA"].includes(mv.tipo));
              const semMeta = movRecentes.filter((mv) => mv.colaborador && !comMeta.has(mv.colaborador.id));
              if (semMeta.length === 0) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-amber-100">
                    <h3 className="font-semibold text-amber-800">⚠ Metas a Contratar ({semMeta.length} colaboradores)</h3>
                    <p className="text-xs text-amber-600 mt-0.5">Admitidos ou transferidos que ainda não possuem metas atribuídas no ciclo ativo</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-amber-100"><tr>
                      {["Colaborador","Tipo Mov.","Data","Cargo","CC"].map((h) => <th key={h} className="text-left px-4 py-2 text-amber-700 font-medium text-xs uppercase">{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-amber-100">
                      {semMeta.map((mv) => (
                        <tr key={mv.id} className="hover:bg-amber-50/50">
                          <td className="px-4 py-2 font-medium text-gray-800">{mv.colaborador?.nomeCompleto ?? "—"}</td>
                          <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded font-medium ${mv.tipo === "ADMISSAO" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{mv.tipo}</span></td>
                          <td className="px-4 py-2 text-gray-500 text-xs">{new Date(mv.dataEfetiva).toLocaleDateString("pt-BR")}</td>
                          <td className="px-4 py-2 text-gray-600">{mv.colaborador?.cargo?.nome ?? "—"}</td>
                          <td className="px-4 py-2 text-gray-600">{mv.colaborador?.centroCusto?.nome ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── CADASTROS ─────────────────────────────────────────────────── */}
        {activeTab === "cadastros" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="icp-page-title">Cadastros</h2>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {(["empresa","cargo","cc"] as const).map((sub) => (
                <button key={sub} onClick={() => setCadastroSub(sub)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${cadastroSub === sub ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {sub === "empresa" ? "Empresas" : sub === "cargo" ? "Cargos" : "Centros de Custo"}
                </button>
              ))}
            </div>

            {/* EMPRESA */}
            {cadastroSub === "empresa" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowEmpresaForm((v) => !v)}
                    className="btn-primary">
                    + Nova Empresa
                  </button>
                </div>
                {showEmpresaForm && (
                  <form onSubmit={handleCriarEmpresa} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                      <input required value={empresaForm.codigo} onChange={(e) => setEmpresaForm((f) => ({ ...f, codigo: e.target.value }))}
                        placeholder="EMP001" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                      <input required value={empresaForm.nome} onChange={(e) => setEmpresaForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Razão Social" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 flex gap-3">
                      <button type="submit" className="btn-primary">Salvar</button>
                      <button type="button" onClick={() => setShowEmpresaForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="bg-white icp-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr>
                      {["Código","Nome","Colaboradores","CCs"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="">
                      {empresas.map((e) => (
                        <tr key={e.id} className="">
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{e.codigo}</td>
                          <td className="px-4 py-3">{e.nome}</td>
                          <td className="px-4 py-3">{e._count?.colaboradores ?? 0}</td>
                          <td className="px-4 py-3">{e._count?.centrosCusto ?? 0}</td>
                        </tr>
                      ))}
                      {empresas.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhuma empresa cadastrada</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CARGO */}
            {cadastroSub === "cargo" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowCargoForm((v) => !v)}
                    className="btn-primary">
                    + Novo Cargo
                  </button>
                </div>
                {showCargoForm && (
                  <form onSubmit={handleCriarCargo} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                      <input required value={cargoForm.codigo} onChange={(e) => setCargoForm((f) => ({ ...f, codigo: e.target.value }))}
                        placeholder="GER-COM" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                      <input required value={cargoForm.nome} onChange={(e) => setCargoForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Gerente Comercial" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Grade (Nível Hierárquico)</label>
                      <select value={cargoForm.nivelHierarquico} onChange={(e) => setCargoForm((f) => ({ ...f, nivelHierarquico: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {["N1","N2","N3","N4","N5","N6"].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Target Bonus (%)</label>
                      <input type="number" step="0.1" min="0" max="100" value={cargoForm.targetBonusPerc}
                        onChange={(e) => setCargoForm((f) => ({ ...f, targetBonusPerc: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Salário Teto (opcional)</label>
                      <input type="number" step="0.01" value={cargoForm.salarioTeto}
                        onChange={(e) => setCargoForm((f) => ({ ...f, salarioTeto: e.target.value }))}
                        placeholder="0.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 flex gap-3">
                      <button type="submit" className="btn-primary">Salvar</button>
                      <button type="button" onClick={() => setShowCargoForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="bg-white icp-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr>
                      {["Código","Nome","Grade","Target Bonus","Salário Teto","Colaboradores"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="">
                      {cargos.map((c) => (
                        <tr key={c.id} className="">
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.codigo}</td>
                          <td className="px-4 py-3">{c.nome}</td>
                          <td className="px-4 py-3"><span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{c.nivelHierarquico}</span></td>
                          <td className="px-4 py-3 text-green-700 font-semibold">{c.targetBonusPerc}%</td>
                          <td className="px-4 py-3">{c.salarioTeto ? fmt(c.salarioTeto) : "—"}</td>
                          <td className="px-4 py-3">{c._count?.colaboradores ?? 0}</td>
                        </tr>
                      ))}
                      {cargos.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum cargo cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CENTRO DE CUSTO */}
            {cadastroSub === "cc" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowCcForm((v) => !v)}
                    className="btn-primary">
                    + Novo Centro de Custo
                  </button>
                </div>
                {showCcForm && (
                  <form onSubmit={handleCriarCC} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Código *</label>
                      <input required value={ccForm.codigo} onChange={(e) => setCcForm((f) => ({ ...f, codigo: e.target.value }))}
                        placeholder="CC-VENDAS" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                      <input required value={ccForm.nome} onChange={(e) => setCcForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Vendas" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Empresa *</label>
                      <select required value={ccForm.empresaId} onChange={(e) => setCcForm((f) => ({ ...f, empresaId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="">Selecione...</option>
                        {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome} ({e.codigo})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nível</label>
                      <select value={ccForm.nivel} onChange={(e) => setCcForm((f) => ({ ...f, nivel: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {["1","2","3","4"].map((n) => <option key={n} value={n}>Nível {n}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex gap-3">
                      <button type="submit" className="btn-primary">Salvar</button>
                      <button type="button" onClick={() => setShowCcForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="bg-white icp-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr>
                      {["Código","Nome","Empresa","Nível","Colaboradores","Metas"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="">
                      {centrosCusto.map((cc) => (
                        <tr key={cc.id} className="">
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{cc.codigo}</td>
                          <td className="px-4 py-3">{cc.nome}</td>
                          <td className="px-4 py-3">{cc.empresa?.nome ?? "—"}</td>
                          <td className="px-4 py-3">{cc.nivel ?? 1}</td>
                          <td className="px-4 py-3">{cc._count?.colaboradores ?? 0}</td>
                          <td className="px-4 py-3">{cc._count?.metas ?? 0}</td>
                        </tr>
                      ))}
                      {centrosCusto.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum centro de custo cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AJUDA ─────────────────────────────────────────────────────── */}
        {activeTab === "ajuda" && (
          <div className="space-y-8 max-w-3xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="icp-page-title">Manual do Sistema ICP</h2>
                <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>Incentivo de Curto Prazo — guia completo de uso.</p>
              </div>
              <div className="bg-white icp-card p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Dados de demonstração</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-muted)" }}>Popula o banco com colaboradores, metas e realizações de exemplo.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleSeed} disabled={seedLoading} className="btn-primary text-xs">
                    {seedLoading ? "Carregando..." : "Carregar Demo"}
                  </button>
                  <button onClick={handleReset} disabled={resetLoading} className="btn-danger text-xs">
                    {resetLoading ? "Limpando..." : "Limpar Tudo"}
                  </button>
                </div>
              </div>
            </div>

            {/* Como usar — fluxo principal */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <h3 className="font-bold text-blue-900">Como usar — Fluxo Principal do Ciclo</h3>
              {[
                { step: "1", title: "Configurar o Ciclo", desc: "O sistema já cria o ciclo ativo automaticamente. Se precisar criar um novo, acesse a API /api/ciclos (POST) com anoFiscal, mesInicio, mesFim e status ATIVO." },
                { step: "2", title: "Carregar Colaboradores", desc: "Use o botão 'Carregar Dados Demo' para popular o banco com dados de exemplo, ou importe via API /api/colaboradores." },
                { step: "3", title: "Cadastrar Indicadores", desc: "Vá em Indicadores → + Novo Indicador. O código é gerado automaticamente. Defina: nome, tipo (Volume/Custo/Projeto), polaridade (↑ Maior ou ↓ Menor é melhor), unidade, analista responsável e origem dos dados." },
                { step: "4", title: "Criar Metas", desc: "Vá em Metas → + Nova Meta. Vincule um indicador, defina o Centro de Custo (ou deixe Corporativo), e os valores: mínimo, alvo e máximo. O peso na cesta define a participação dessa meta no prêmio total." },
                { step: "5", title: "Cascatear Metas (opcional)", desc: "Clique em 'Cascatear' em uma meta corporativa para criar uma meta filha de área ou individual. A meta filha herda o indicador e os valores, mas pode ter CC e alvo diferentes." },
                { step: "6", title: "Atribuir Colaboradores às Metas", desc: "Na tabela de Metas, clique em 'Atribuir' na linha da meta e selecione o colaborador. Repita para todos os elegíveis de cada meta." },
                { step: "7", title: "Criar Janelas de Apuração", desc: "Vá em Janelas → + Nova Janela. Defina o mês/ano de referência e as datas de abertura e fechamento. Enquanto a janela estiver aberta, realizações podem ser lançadas." },
                { step: "8", title: "Lançar Realizações", desc: "Vá em Realizações → + Lançar Realização (ou use Importação BP para lote). Informe a meta, o colaborador, o mês/ano e o valor realizado. O sistema calcula a nota automaticamente." },
                { step: "9", title: "Aprovar no Workflow", desc: "Vá em Workflow. O Guardião aprova ou rejeita metas e realizações pendentes. Metas precisam ser aprovadas antes de gerar prêmio." },
                { step: "10", title: "Acompanhar Resultados", desc: "Use: Dashboard (visão geral), Atingimento (por meta), Elegíveis (ranking), Conferência (validação e consolidados) e Relatório (fechamento para impressão/PDF)." },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{s.step}</div>
                  <div>
                    <p className="icp-section-title text-sm">{s.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Movimentações RH */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-purple-900">Movimentações RH — Pro-Rata</h3>
              <p className="text-sm text-gray-600">Quando um colaborador entra, sai ou muda de cargo/CC durante o ciclo, o prêmio é ajustado proporcionalmente.</p>
              {[
                { tipo: "Admissão", desc: "Informe a data de admissão. O sistema calcula quantos meses o colaborador ficou no ciclo e aplica o fator (ex: admitido em Jul de um ciclo Jan-Dez = 6/12 = 50%)." },
                { tipo: "Desligamento", desc: "Informe a data de saída. O fator é calculado como meses trabalhados / total de meses do ciclo." },
                { tipo: "Promoção", desc: "Informe data, cargo anterior e cargo novo. O sistema mostra o split: X meses com target antigo + Y meses com novo target." },
                { tipo: "Transferência", desc: "Informe data, CC anterior e CC novo. O prêmio dos meses no CC antigo usa as metas daquele CC; os demais meses, as metas do novo CC." },
              ].map((m) => (
                <div key={m.tipo} className="flex gap-2">
                  <span className="text-purple-600 font-semibold text-sm w-28 flex-shrink-0">{m.tipo}</span>
                  <span className="text-sm text-gray-600">{m.desc}</span>
                </div>
              ))}
            </div>

            {/* Motor matemático */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-green-900">Motor Matemático — Como a Nota é Calculada</h3>
              {[
                { label: "↑ Maior é Melhor (MAIOR_MELHOR)", formula: "Nota = (Realizado ÷ Alvo) × 100" },
                { label: "↓ Menor é Melhor (MENOR_MELHOR)", formula: "Nota = (Alvo ÷ Realizado) × 100  — quanto menor o realizado, maior a nota" },
                { label: "Projeto / Marco (PROJETO_MARCO)", formula: "Nota = 100 se realizado ≥ 1 (concluído), senão 0" },
                { label: "Abaixo do mínimo", formula: "Nota = 0 — se o realizado não atingir o mínimo definido" },
                { label: "Teto (cap)", formula: "Nota máxima = (Meta Máxima ÷ Alvo) × 100, ou 120% se máximo não definido" },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-sm font-semibold text-gray-700">{m.label}</p>
                  <p className="text-sm text-green-800 font-mono mt-0.5">{m.formula}</p>
                </div>
              ))}
              <div className="border-t border-green-200 pt-3">
                <p className="text-sm font-semibold text-gray-700">Prêmio Projetado por Realização</p>
                <p className="text-sm text-green-800 font-mono mt-0.5">Prêmio = Salário Base × 12 × (Target Bonus %) × (Nota ÷ 100) × (Peso na Cesta ÷ 100)</p>
              </div>
            </div>

            {/* Papéis */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="font-bold text-gray-800">Papéis e Permissões</h3>
              {[
                { papel: "GUARDIÃO", desc: "Acesso total. Aprova metas, realizações e waivers no Workflow. Único que pode aprovar." },
                { papel: "BP (Business Partner)", desc: "Lança realizações em lote via Importação BP. Pode abrir waivers (prorrogações) para colaboradores." },
                { papel: "GESTOR", desc: "Visualiza o Painel Gestor com a equipe. Acompanha notas e prêmios dos subordinados." },
                { papel: "COLABORADOR", desc: "Acessa o Cockpit individual. Visualiza suas metas, evolução e prêmio projetado." },
              ].map((p) => (
                <div key={p.papel} className="flex gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full h-fit mt-0.5 flex-shrink-0">{p.papel}</span>
                  <span className="text-sm text-gray-600">{p.desc}</span>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-gray-800 pt-2">Descrição de Cada Tela</h3>
            <p className="text-sm text-gray-500 -mt-4">Referência rápida de finalidade por tab.</p>
            {[
              {
                icon: "📊", tab: "Dashboard",
                desc: "Visão executiva do ciclo: total de colaboradores, metas ativas, workflow pendente, uso do bonus pool, top colaboradores e alertas de engajamento.",
              },
              {
                icon: "👤", tab: "Cockpit",
                desc: "Painel individual do colaborador — prêmio projetado ao vivo, evolução mensal e ofensores (quais metas estão puxando a nota para baixo).",
              },
              {
                icon: "👥", tab: "Painel Gestor",
                desc: "Visão do gestor sobre a equipe: heatmap de desempenho, nota e prêmio de cada subordinado por indicador.",
              },
              {
                icon: "📋", tab: "Scorecard",
                desc: "Ficha completa de um colaborador: todas as metas, realizações por mês, nota YTD e prêmio acumulado.",
              },
              {
                icon: "📈", tab: "Indicadores",
                desc: "Cadastro dos KPIs do ciclo: nome, tipo, polaridade, unidade, analista responsável, divisor. Define 'o que mede'. O código é gerado automaticamente.",
              },
              {
                icon: "🎯", tab: "Metas",
                desc: "Vincula um indicador a um centro de custo e define os valores (mínimo, alvo, máximo, peso). Também permite atribuir colaboradores à meta.",
              },
              {
                icon: "📉", tab: "Atingimento",
                desc: "Painel de atingimento por meta — mostra todas as metas com suas realizações, nota calculada e prêmio projetado mês a mês.",
              },
              {
                icon: "🏆", tab: "Elegíveis",
                desc: "Ranking de todos os colaboradores com realizações lançadas: nota média, prêmio YTD, target anual e % atingido. Serve para comparar entre pares.",
              },
              {
                icon: "📄", tab: "Relatório",
                desc: "Fechamento do ciclo — resumo executivo com cards, tabela completa por colaborador (com totais) e breakdown de metas. Botão de imprimir/exportar PDF.",
              },
              {
                icon: "⚡", tab: "Realizações",
                desc: "Lançamento dos valores realizados por meta/mês. É aqui que o BP ou colaborador registra o resultado do período. A nota é recalculada apenas se o valor mudar.",
              },
              {
                icon: "👔", tab: "Colaboradores",
                desc: "Base de elegíveis: matrícula, cargo, grade (nível hierárquico), target bonus com valor anual calculado, centro de custo e salário base.",
              },
              {
                icon: "✅", tab: "Workflow",
                desc: "Caixa de entrada do Guardião para aprovar ou rejeitar metas e realizações submetidas pelo BP ou colaborador.",
              },
              {
                icon: "🗓", tab: "Janelas",
                desc: "Controle dos períodos de apuração — abre e fecha a janela de cada mês. Gerencia prorrogações (waivers) para colaboradores com prazo estendido.",
              },
              {
                icon: "📥", tab: "Importação BP",
                desc: "Importação em lote de realizações via CSV. O BP cola as linhas no formato: matrícula; código da meta; valor realizado; observação — e submete tudo de uma vez.",
              },
            ].map((item) => (
              <div key={item.tab} className="bg-white icp-card p-5 flex gap-4">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="icp-section-title mb-1">{item.tab}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COCKPIT DO COLABORADOR ──────────────────────────────────────── */}
        {activeTab === "cockpit" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Cockpit do Colaborador</h1>
                <p className="text-xs text-gray-500 mt-0.5">Simulador R$ vivo — prêmio projetado, ofensores e evolução mensal</p>
              </div>
              <select
                value={cockpitColId ?? ""}
                onChange={(e) => setCockpitColId(e.target.value ? Number(e.target.value) : null)}
                className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione colaborador...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.matricula}</option>
                ))}
              </select>
            </div>
            <CockpitColaborador colaboradorId={cockpitColId} cicloId={cicloAtivo?.id ?? null} />
          </div>
        )}

        {/* ── PAINEL DO GESTOR ────────────────────────────────────────────── */}
        {activeTab === "gestor" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Painel do Gestor</h1>
                <p className="text-xs text-gray-500 mt-0.5">Heatmap da equipe e visão cruzada por indicador</p>
              </div>
              <select
                value={gestorColId ?? ""}
                onChange={(e) => setGestorColId(e.target.value ? Number(e.target.value) : null)}
                className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione gestor...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>
                ))}
              </select>
            </div>
            <PainelGestor
              gestorId={gestorColId}
              cicloId={cicloAtivo?.id ?? null}
              colaboradores={colaboradores.map((c) => ({ id: c.id, nomeCompleto: c.nomeCompleto, gestorId: null }))}
            />
          </div>
        )}

      </main>
      </div>
    </div>
  );
}

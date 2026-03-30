"use client";

import React, { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import CockpitColaborador from "@/components/CockpitColaborador";
import PainelGestor from "@/components/PainelGestor";
import MasterDashboard from "@/components/MasterDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "dashboard" | "metas" | "agrupamentos" | "colaboradores" | "cadastros";

type CheckResult = {
  id: string;
  tipo: "ERRO" | "AVISO" | "OK";
  categoria: string;
  titulo: string;
  descricao: string;
  count: number;
  detalhes: string[];
};

interface Cargo { id: number; nome: string; codigo: string; nivelHierarquico: string; targetMultiploSalarial: number; salarioTeto?: number | null; _count?: { colaboradores: number }; }
interface CentroCusto { id: number; nome: string; codigo: string; nivel?: number; empresaId?: number; empresa?: { id: number; nome: string; codigo: string }; _count?: { colaboradores: number; metas: number }; }
interface Empresa { id: number; nome: string; codigo: string; _count?: { colaboradores: number; centrosCusto: number }; }
interface Colaborador {
  id: number; matricula: string; nomeCompleto: string; email: string;
  salarioBase: number; ativo: boolean; gestorId: number | null;
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
interface AgrupamentoMetaItem {
  id: number; metaId: number;
  meta: Meta & { indicador: Indicador };
}
interface AgrupamentoAtribuicaoItem {
  id: number; gestorId: number | null; cascatear: boolean; aplicadoEm: string | null;
  gestor: { id: number; nomeCompleto: string; matricula: string } | null;
}
interface Agrupamento {
  id: number; nome: string; descricao: string | null; tipo: string; cicloId: number;
  criadoEm: string;
  metas: AgrupamentoMetaItem[];
  atribuicoes: AgrupamentoAtribuicaoItem[];
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
    name: "Principal",
    tabs: [
      { id: "dashboard",     label: "Dashboard" },
      { id: "colaboradores", label: "Colaboradores" },
      { id: "metas",         label: "Metas" },
      { id: "agrupamentos",  label: "Agrupamentos" },
    ],
  },
  {
    name: "Configuração",
    tabs: [
      { id: "cadastros", label: "Cadastros" },
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
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

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
      await Promise.all([loadColaboradores(), loadMetas(ativo?.id), loadIndicadores(ativo?.id), loadCentrosCusto()]);
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

  // Import metas XLSX
  const [showMetasImport, setShowMetasImport] = useState(false);
  const [metasCsvText, setMetasCsvText] = useState("");
  const [metasXlsxFile, setMetasXlsxFile] = useState<File | null>(null);
  const [metasImportResult, setMetasImportResult] = useState<{ processed: number; erros: { linha: number; motivo: string }[] } | null>(null);

  const [cargos, setCargos] = useState<Cargo[]>([]);

  // Agrupamentos state
  const [agrupamentos, setAgrupamentos] = useState<Agrupamento[]>([]);
  const [selectedAgrupamentoId, setSelectedAgrupamentoId] = useState<number | null>(null);
  const [showAgrupamentoForm, setShowAgrupamentoForm] = useState(false);
  const [agrupamentoForm, setAgrupamentoForm] = useState({ nome: "", descricao: "", tipo: "CORPORATIVO" });
  const [agrupamentoMetaSearch, setAgrupamentoMetaSearch] = useState("");
  const [agrupamentoGestorId, setAgrupamentoGestorId] = useState("");
  const [agrupamentoCascatear, setAgrupamentoCascatear] = useState(false);

  // Cadastros state (Empresa / Cargo / CC / Ciclos)
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cadastroSub, setCadastroSub] = useState<"empresa" | "cargo" | "cc" | "ciclos" | "indicadores">("empresa");

  // Ciclo form
  const [showCicloForm, setShowCicloForm] = useState(false);
  const [cicloForm, setCicloForm] = useState({ anoFiscal: "", mesInicio: "1", mesFim: "12", bonusPool: "", status: "SETUP" });
  const [cicloEditId, setCicloEditId] = useState<number | null>(null);

  async function handleSalvarCiclo(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      anoFiscal: Number(cicloForm.anoFiscal),
      mesInicio: Number(cicloForm.mesInicio),
      mesFim: Number(cicloForm.mesFim),
      bonusPool: cicloForm.bonusPool ? Number(cicloForm.bonusPool) : undefined,
      status: cicloForm.status,
    };
    try {
      const res = await fetch("/api/ciclos", {
        method: cicloEditId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cicloEditId ? { id: cicloEditId, ...payload } : payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao salvar ciclo: ${err.error ?? res.status}`, "err");
        return;
      }
      setShowCicloForm(false);
      setCicloEditId(null);
      setCicloForm({ anoFiscal: "", mesInicio: "1", mesFim: "12", bonusPool: "", status: "SETUP" });
      await loadCiclos();
      addToast(cicloEditId ? "Ciclo atualizado" : "Ciclo criado", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleExcluirCiclo(id: number) {
    if (!confirm("Excluir este ciclo? Todos os indicadores e metas vinculados também serão removidos.")) return;
    await fetch(`/api/ciclos?id=${id}`, { method: "DELETE" });
    await loadCiclos();
  }
  const [empresaForm, setEmpresaForm] = useState({ codigo: "", nome: "" });
  const [showEmpresaForm, setShowEmpresaForm] = useState(false);
  const [cargoForm, setCargoForm] = useState({ codigo: "", nome: "", nivelHierarquico: "N4", targetMultiploSalarial: "0", salarioTeto: "" });
  const [showCargoForm, setShowCargoForm] = useState(false);
  const [ccForm, setCcForm] = useState({ codigo: "", nome: "", nivel: "1", empresaId: "" });
  const [showCcForm, setShowCcForm] = useState(false);


  // Dashboard API state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Colaboradores import state
  const [showColabImport, setShowColabImport] = useState(false);
  const [colabCsvText, setColabCsvText] = useState("");
  const [colabCsvFile, setColabCsvFile] = useState<File | null>(null);
  const [colabImportResult, setColabImportResult] = useState<{ processed: number; updated: number; erros: { linha: number; motivo: string }[] } | null>(null);
  const [colabImportLoading, setColabImportLoading] = useState(false);

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
    const data = res.data ?? [];
    setColaboradores(data);
    setSeeded(data.length > 0);
    return data;
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

  const loadAgrupamentos = useCallback(async (cicloId?: number) => {
    const url = cicloId ? `/api/agrupamentos?cicloId=${cicloId}` : "/api/agrupamentos";
    const res = await fetch(url).then((r) => r.json()).catch(() => ({ data: [] }));
    setAgrupamentos(res.data ?? []);
  }, []);


  const loadCargos = useCallback(async () => {
    const res = await fetch("/api/cargos").then((r) => r.json()).catch(() => ({ data: [] }));
    setCargos(res.data ?? []);
  }, []);

  const loadEmpresas = useCallback(async () => {
    const res = await fetch("/api/empresas").then((r) => r.json()).catch(() => ({ data: [] }));
    setEmpresas(res.data ?? []);
  }, []);


  const loadDashboard = useCallback(async (cicloId?: number) => {
    if (!cicloId) return;
    const res = await fetch(`/api/dashboard?cicloId=${cicloId}`).then((r) => r.json()).catch(() => ({ data: null }));
    if (res.data) setDashboardData(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ativo = await loadCiclos();
      await Promise.all([
        loadColaboradores(), loadMetas(ativo?.id),
        loadIndicadores(ativo?.id), loadCentrosCusto(),
        loadDashboard(ativo?.id),
        loadCargos(), loadEmpresas(),
        loadAgrupamentos(ativo?.id),
      ]);
      setLoading(false);
    })();
  }, [loadCiclos, loadColaboradores, loadMetas, loadDashboard, loadIndicadores, loadCentrosCusto, loadCargos, loadEmpresas, loadAgrupamentos]);

  async function handleSeed() {
    setSeedLoading(true);
    await fetch("/api/seed", { method: "POST" });
    const ativo = await loadCiclos();
    await Promise.all([
      loadColaboradores(), loadMetas(ativo?.id), loadDashboard(ativo?.id),
      loadIndicadores(ativo?.id), loadAgrupamentos(ativo?.id),
    ]);
    setSeeded(true);
    setSeedLoading(false);
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
    try {
      const res = await fetch("/api/metas", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assigningMetaId, atribuirColaboradorId: Number(assignColabId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao atribuir meta: ${err.error ?? res.status}`, "err");
        return;
      }
      setAssignColabId("");
      setAssigningMetaId(null);
      loadMetas(cicloAtivo?.id);
      addToast("Meta atribuída ao colaborador", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCriarMeta(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) { addToast("Nenhum ciclo ativo.", "err"); return; }
    const smartObj = (metaForm.smart_e || metaForm.smart_m || metaForm.smart_a || metaForm.smart_r || metaForm.smart_t)
      ? JSON.stringify({ e: metaForm.smart_e, m: metaForm.smart_m, a: metaForm.smart_a, r: metaForm.smart_r, t: metaForm.smart_t })
      : null;
    try {
      const res = await fetch("/api/metas", {
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar meta: ${err.error ?? res.status}`, "err");
        return;
      }
      setMetaForm({ indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "", metaMinima: "", metaMaxima: "", parentMetaId: "", smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "" });
      setShowMetaForm(false);
      setCascateandoMetaId(null);
      setCloningMetaId(null);
      loadMetas(cicloAtivo.id);
      addToast(cloningMetaId ? "Meta clonada" : cascateandoMetaId ? "Meta cascateada" : "Meta criada", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCriarIndicador(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) { addToast("Nenhum ciclo ativo. Vá em Cadastros → Ciclos para criar um ciclo.", "err"); setActiveTab("cadastros"); setCadastroSub("ciclos"); return; }
    const autoCode = `IND-${Date.now()}`;
    try {
      const res = await fetch("/api/indicadores", {
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar indicador: ${err.error ?? res.status}`, "err");
        return;
      }
      setIndicadorForm({ codigo: "", nome: "", tipo: "VOLUME_FINANCEIRO", polaridade: "MAIOR_MELHOR", abrangencia: "CORPORATIVO", unidade: "%", descricao: "", diretivo: "", analistaResp: "", origemDado: "", isDivisivel: false, divisorId: "" });
      setShowIndicadorForm(false);
      loadIndicadores(cicloAtivo.id);
      addToast("Indicador criado com sucesso", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCancelarMeta(metaId: number) {
    await fetch("/api/metas", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: metaId, status: "CANCELADO", usuario: "sistema" }),
    });
    loadMetas(cicloAtivo?.id);
    addToast(`Meta #${metaId} cancelada`, "info");
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
    try {
      const res = await fetch("/api/empresas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empresaForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar empresa: ${err.error ?? res.status}`, "err");
        return;
      }
      setEmpresaForm({ codigo: "", nome: "" });
      setShowEmpresaForm(false);
      loadEmpresas();
      addToast("Empresa criada", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCriarCargo(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/cargos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cargoForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar cargo: ${err.error ?? res.status}`, "err");
        return;
      }
      setCargoForm({ codigo: "", nome: "", nivelHierarquico: "N4", targetMultiploSalarial: "0", salarioTeto: "" });
      setShowCargoForm(false);
      loadCargos();
      addToast("Cargo criado", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCriarCC(e: React.FormEvent) {
    e.preventDefault();
    if (!ccForm.empresaId) { addToast("Selecione uma empresa antes de criar o centro de custo.", "err"); return; }
    try {
      const res = await fetch("/api/centros-custo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ccForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar centro de custo: ${err.error ?? res.status}`, "err");
        return;
      }
      setCcForm({ codigo: "", nome: "", nivel: "1", empresaId: "" });
      setShowCcForm(false);
      loadCentrosCusto();
      addToast("Centro de custo criado", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleCriarAgrupamento(e: React.FormEvent) {
    e.preventDefault();
    if (!cicloAtivo) { addToast("Nenhum ciclo ativo.", "err"); return; }
    try {
      const res = await fetch("/api/agrupamentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agrupamentoForm, cicloId: cicloAtivo.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao criar agrupamento: ${err.error ?? res.status}`, "err");
        return;
      }
      const data = await res.json();
      setAgrupamentoForm({ nome: "", descricao: "", tipo: "CORPORATIVO" });
      setShowAgrupamentoForm(false);
      await loadAgrupamentos(cicloAtivo.id);
      setSelectedAgrupamentoId(data.data?.id ?? null);
      addToast("Agrupamento criado", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleAddMetaToAgrupamento(agrupamentoId: number, metaId: number) {
    try {
      const res = await fetch("/api/agrupamentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addMeta", agrupamentoId, metaId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao adicionar meta: ${err.error ?? res.status}`, "err");
        return;
      }
      await loadAgrupamentos(cicloAtivo?.id);
      addToast("Meta adicionada ao agrupamento", "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleRemoveMetaFromAgrupamento(agrupamentoId: number, metaId: number) {
    try {
      await fetch(`/api/agrupamentos?agrupamentoId=${agrupamentoId}&metaId=${metaId}`, { method: "DELETE" });
      await loadAgrupamentos(cicloAtivo?.id);
      addToast("Meta removida do agrupamento", "info");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleAplicarAgrupamento(agrupamentoId: number) {
    const agrupamento = agrupamentos.find((a) => a.id === agrupamentoId);
    if (!agrupamento) return;
    if (agrupamento.metas.length === 0) { addToast("Adicione metas ao agrupamento antes de aplicar.", "err"); return; }
    if (agrupamento.tipo === "AREA" && !agrupamentoGestorId) {
      addToast("Selecione um gestor para aplicar o agrupamento de área.", "err"); return;
    }
    try {
      const res = await fetch("/api/agrupamentos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "aplicar",
          agrupamentoId,
          gestorId: agrupamento.tipo === "AREA" ? Number(agrupamentoGestorId) : undefined,
          cascatear: agrupamento.tipo === "AREA" ? agrupamentoCascatear : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(`Erro ao aplicar agrupamento: ${err.error ?? res.status}`, "err");
        return;
      }
      const data = await res.json();
      await loadAgrupamentos(cicloAtivo?.id);
      await loadMetas(cicloAtivo?.id);
      addToast(`Aplicado: ${data.data?.criados ?? 0} atribuições criadas para ${data.data?.colaboradores ?? 0} colaborador(es)`, "ok");
    } catch (err) {
      addToast(`Erro inesperado: ${String(err)}`, "err");
    }
  }

  async function handleExcluirAgrupamento(id: number) {
    if (!confirm("Excluir este agrupamento? As atribuições já feitas não serão desfeitas.")) return;
    await fetch(`/api/agrupamentos?id=${id}`, { method: "DELETE" });
    if (selectedAgrupamentoId === id) setSelectedAgrupamentoId(null);
    await loadAgrupamentos(cicloAtivo?.id);
    addToast("Agrupamento excluído", "info");
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

  async function handleDownloadTemplateMetaas() {
    const XLSX = await import("xlsx");
    const headers = ["indicadorCodigo","pesoNaCesta","metaMinima","metaAlvo","metaMaxima","parentMetaIndicadorCodigo","smart_e","smart_m","smart_a","smart_r","smart_t"];
    const example = { indicadorCodigo:"REC-LIQ-2026", pesoNaCesta:50, metaMinima:80, metaAlvo:100, metaMaxima:120, parentMetaIndicadorCodigo:"", smart_e:"", smart_m:"", smart_a:"", smart_r:"", smart_t:"" };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas");
    XLSX.writeFile(wb, "template_metas.xlsx");
  }

  async function handleDownloadTemplateColaboradores() {
    const XLSX = await import("xlsx");
    const headers = ["matricula","nomeCompleto","cpf","email","salarioBase","dataAdmissao","empresaCodigo","cargoCodigo","centroCustoCodigo","gestorMatricula","cargoNome","nivelHierarquico","targetMultiploSalarial"];
    const example = { matricula:"001234", nomeCompleto:"João Silva", cpf:"123.456.789-00", email:"joao@empresa.com", salarioBase:8000, dataAdmissao:"2024-01-15", empresaCodigo:"EMP001", cargoCodigo:"GER-COM", centroCustoCodigo:"CC-VENDAS", gestorMatricula:"", cargoNome:"Gerente Comercial", nivelHierarquico:"N2", targetMultiploSalarial:3.0 };
    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
    XLSX.writeFile(wb, "template_colaboradores.xlsx");
  }

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
                if (c) { setCicloAtivo(c); loadMetas(c.id); loadDashboard(c.id); }
              }}
              className="text-xs rounded-md px-2 py-1 focus:outline-none"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.82)" }}
            >
              {ciclos.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "#0e1b2e" }}>{c.anoFiscal} — {c.status}</option>
              ))}
            </select>
          </div>


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
                { label: "Pendências Workflow", value: dashboardData?.workflowPendente ?? 0, accent: "#d97706" },
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

        {/* ── METAS ─────────────────────────────────────────────────────── */}
        {activeTab === "metas" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="icp-page-title">Metas</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>{metas.length} metas</p>
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
                              {m.status !== "CANCELADO" && (
                                <button onClick={() => setAssigningMetaId(assigningMetaId === m.id ? null : m.id)} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded">Atribuir</button>
                              )}
                              <button onClick={() => {
                                  setCascateandoMetaId(m.id);
                                  setMetaForm({ indicadorId: String(m.indicador.id ?? ""), centroCustoId: "", pesoNaCesta: "100", metaAlvo: String(m.metaAlvo), metaMinima: m.metaMinima ? String(m.metaMinima) : "", metaMaxima: m.metaMaxima ? String(m.metaMaxima) : "", parentMetaId: String(m.id), smart_e: "", smart_m: "", smart_a: "", smart_r: "", smart_t: "" });
                                  setShowMetaForm(true);
                                }} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-0.5 rounded">Cascatear</button>
                              <button onClick={() => handleClonarMeta(m)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Clonar</button>
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

        {/* ── AGRUPAMENTOS ─────────────────────────────────────────────── */}
        {activeTab === "agrupamentos" && (() => {
          const selectedAgrupamento = agrupamentos.find((a) => a.id === selectedAgrupamentoId) ?? null;
          const metasNoAgrupamento = new Set((selectedAgrupamento?.metas ?? []).map((m) => m.metaId));
          const metasDisponiveis = metas.filter((m) =>
            !metasNoAgrupamento.has(m.id) &&
            (agrupamentoMetaSearch === "" ||
              m.indicador.nome.toLowerCase().includes(agrupamentoMetaSearch.toLowerCase()))
          );
          const gestores = colaboradores.filter((c) =>
            colaboradores.some((sub) => sub.gestorId === c.id) || c.gestorId === null
          );

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="icp-page-title">Agrupamentos de Metas</h2>
                <button onClick={() => setShowAgrupamentoForm(true)} className="btn-primary text-xs">
                  + Novo Agrupamento
                </button>
              </div>

              {/* Create form */}
              {showAgrupamentoForm && (
                <div className="bg-white rounded-lg p-5" style={{ border: "1px solid var(--border)" }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)" }}>Novo Agrupamento</h3>
                  <form onSubmit={handleCriarAgrupamento} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: "var(--ink-secondary)" }}>Nome *</label>
                        <input required className="icp-input w-full" value={agrupamentoForm.nome}
                          onChange={(e) => setAgrupamentoForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Metas Corporativas 2026" />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: "var(--ink-secondary)" }}>Tipo *</label>
                        <select className="icp-input w-full" value={agrupamentoForm.tipo}
                          onChange={(e) => setAgrupamentoForm((f) => ({ ...f, tipo: e.target.value }))}>
                          <option value="CORPORATIVO">CORPORATIVO — todos os colaboradores</option>
                          <option value="AREA">ÁREA — gestor específico</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: "var(--ink-secondary)" }}>Descrição</label>
                        <input className="icp-input w-full" value={agrupamentoForm.descricao}
                          onChange={(e) => setAgrupamentoForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" className="btn-primary text-xs">Criar</button>
                      <button type="button" className="btn-ghost text-xs" onClick={() => setShowAgrupamentoForm(false)}>Cancelar</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Two-column layout: list + detail */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: agrupamento list */}
                <div className="space-y-2">
                  {agrupamentos.length === 0 && (
                    <div className="bg-white rounded-lg p-8 text-center" style={{ border: "1px solid var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Nenhum agrupamento criado.</p>
                      <button onClick={() => setShowAgrupamentoForm(true)} className="btn-primary text-xs mt-3">Criar primeiro</button>
                    </div>
                  )}
                  {agrupamentos.map((ag) => {
                    const isSelected = ag.id === selectedAgrupamentoId;
                    return (
                      <button
                        key={ag.id}
                        onClick={() => { setSelectedAgrupamentoId(ag.id); setAgrupamentoGestorId(""); setAgrupamentoCascatear(false); }}
                        className="w-full text-left rounded-lg p-4 transition-all"
                        style={{
                          border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                          background: isSelected ? "rgba(var(--accent-rgb, 26,115,232),0.06)" : "white",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{ag.nome}</p>
                            {ag.descricao && <p className="text-xs truncate mt-0.5" style={{ color: "var(--ink-muted)" }}>{ag.descricao}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            ag.tipo === "CORPORATIVO"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}>
                            {ag.tipo === "CORPORATIVO" ? "CORP" : "ÁREA"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                            {ag.metas.length} meta{ag.metas.length !== 1 ? "s" : ""}
                          </span>
                          {ag.atribuicoes.length > 0 && (
                            <span className="text-[11px] text-green-600">
                              ✓ Aplicado {ag.atribuicoes.length}×
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Right: detail panel */}
                <div className="lg:col-span-2">
                  {!selectedAgrupamento ? (
                    <div className="bg-white rounded-lg p-12 text-center" style={{ border: "1px solid var(--border)" }}>
                      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>Selecione um agrupamento para gerenciar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Detail header */}
                      <div className="bg-white rounded-lg p-5" style={{ border: "1px solid var(--border)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>{selectedAgrupamento.nome}</h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                selectedAgrupamento.tipo === "CORPORATIVO"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}>
                                {selectedAgrupamento.tipo}
                              </span>
                            </div>
                            {selectedAgrupamento.descricao && (
                              <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>{selectedAgrupamento.descricao}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleExcluirAgrupamento(selectedAgrupamento.id)}
                            className="text-xs px-2 py-1 rounded"
                            style={{ color: "var(--err-text)", border: "1px solid var(--err-border)" }}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>

                      {/* Metas no agrupamento */}
                      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                          <h4 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                            Metas ({selectedAgrupamento.metas.length})
                          </h4>
                        </div>
                        {selectedAgrupamento.metas.length === 0 ? (
                          <div className="px-5 py-6 text-center">
                            <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Nenhuma meta adicionada. Use o campo abaixo para adicionar.</p>
                          </div>
                        ) : (
                          <table className="w-full text-sm">
                            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                              {selectedAgrupamento.metas.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-5 py-3">
                                    <div className="font-medium text-sm" style={{ color: "var(--ink)" }}>{item.meta.indicador.nome}</div>
                                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
                                      Alvo: {item.meta.metaAlvo} {item.meta.indicador.unidade} · Peso: {item.meta.pesoNaCesta}%
                                    </div>
                                  </td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      onClick={() => handleRemoveMetaFromAgrupamento(selectedAgrupamento.id, item.metaId)}
                                      className="text-xs px-2 py-0.5 rounded"
                                      style={{ color: "var(--err-text)", border: "1px solid var(--err-border)" }}
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}

                        {/* Add meta */}
                        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                          <div className="flex gap-2">
                            <input
                              className="icp-input flex-1 text-xs"
                              placeholder="Buscar meta por indicador..."
                              value={agrupamentoMetaSearch}
                              onChange={(e) => setAgrupamentoMetaSearch(e.target.value)}
                            />
                          </div>
                          {agrupamentoMetaSearch && (
                            <div className="mt-2 rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                              {metasDisponiveis.slice(0, 8).map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => { handleAddMetaToAgrupamento(selectedAgrupamento.id, m.id); setAgrupamentoMetaSearch(""); }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between gap-2"
                                  style={{ borderBottom: "1px solid var(--border)" }}
                                >
                                  <span style={{ color: "var(--ink)" }}>{m.indicador.nome}</span>
                                  <span style={{ color: "var(--ink-muted)" }}>Alvo: {m.metaAlvo} {m.indicador.unidade}</span>
                                </button>
                              ))}
                              {metasDisponiveis.length === 0 && (
                                <p className="px-3 py-2 text-xs" style={{ color: "var(--ink-muted)" }}>Nenhuma meta encontrada ou todas já adicionadas</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Apply section */}
                      <div className="bg-white rounded-lg p-5" style={{ border: "1px solid var(--border)" }}>
                        <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>Aplicar Agrupamento</h4>

                        {selectedAgrupamento.tipo === "CORPORATIVO" ? (
                          <div className="space-y-3">
                            <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                              Atribui todas as metas deste agrupamento a <strong>todos os colaboradores ativos</strong>.
                            </p>
                            <button
                              onClick={() => handleAplicarAgrupamento(selectedAgrupamento.id)}
                              className="btn-primary text-xs"
                            >
                              Aplicar para todos ({colaboradores.filter((c) => c.ativo).length} colaboradores)
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                              Atribui as metas ao gestor selecionado e, opcionalmente, aos seus subordinados diretos.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: "var(--ink-secondary)" }}>Gestor *</label>
                                <select
                                  className="icp-input w-full"
                                  value={agrupamentoGestorId}
                                  onChange={(e) => setAgrupamentoGestorId(e.target.value)}
                                >
                                  <option value="">Selecionar gestor...</option>
                                  {colaboradores.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={agrupamentoCascatear}
                                    onChange={(e) => setAgrupamentoCascatear(e.target.checked)}
                                    className="rounded"
                                  />
                                  <span className="text-xs" style={{ color: "var(--ink-secondary)" }}>
                                    Cascatear para subordinados diretos
                                    {agrupamentoGestorId && (
                                      <span className="ml-1" style={{ color: "var(--ink-muted)" }}>
                                        ({colaboradores.filter((c) => c.gestorId === Number(agrupamentoGestorId)).length} subordinados)
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAplicarAgrupamento(selectedAgrupamento.id)}
                              disabled={!agrupamentoGestorId}
                              className="btn-primary text-xs disabled:opacity-40"
                            >
                              Aplicar
                            </button>
                          </div>
                        )}

                        {/* Atribuições history */}
                        {selectedAgrupamento.atribuicoes.length > 0 && (
                          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink-secondary)" }}>Aplicações anteriores</p>
                            <div className="space-y-1.5">
                              {selectedAgrupamento.atribuicoes.map((atr) => (
                                <div key={atr.id} className="text-xs flex items-center gap-2">
                                  <span className="text-green-600">✓</span>
                                  <span style={{ color: "var(--ink)" }}>
                                    {atr.gestor ? atr.gestor.nomeCompleto : "Todos os colaboradores"}
                                  </span>
                                  {atr.cascatear && (
                                    <span className="text-purple-600">+ subordinados</span>
                                  )}
                                  {atr.aplicadoEm && (
                                    <span style={{ color: "var(--ink-muted)" }}>
                                      em {new Date(atr.aplicadoEm).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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
                          <span className={`text-xs font-semibold ${c.cargo.targetMultiploSalarial >= 2 ? "text-green-700" : c.cargo.targetMultiploSalarial >= 1 ? "text-blue-700" : "text-gray-600"}`}>
                            {c.cargo.targetMultiploSalarial}x
                          </span>
                          <span className="text-xs text-gray-400 ml-1">= {fmt(c.salarioBase * c.cargo.targetMultiploSalarial)}/mês</span>
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
                          description="Importe colaboradores via XLSX ou cadastre manualmente para começar."
                          action={{ label: "Importar XLSX", onClick: () => setActiveTab("colaboradores") }} />
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              {(["ciclos","empresa","cargo","cc","indicadores"] as const).map((sub) => (
                <button key={sub} onClick={() => setCadastroSub(sub)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${cadastroSub === sub ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {sub === "ciclos" ? "Ciclos ICP" : sub === "empresa" ? "Empresas" : sub === "cargo" ? "Cargos" : sub === "cc" ? "Centros de Custo" : "Indicadores"}
                </button>
              ))}
            </div>

            {/* CICLOS ICP */}
            {cadastroSub === "ciclos" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => { setShowCicloForm((v) => !v); setCicloEditId(null); setCicloForm({ anoFiscal: "", mesInicio: "1", mesFim: "12", bonusPool: "", status: "SETUP" }); }}
                    className="btn-primary">+ Novo Ciclo</button>
                </div>
                {showCicloForm && (
                  <form onSubmit={handleSalvarCiclo} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 gap-4">
                    <h3 className="col-span-2 font-semibold text-blue-800">{cicloEditId ? "Editar Ciclo" : "Novo Ciclo ICP"}</h3>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ano Fiscal *</label>
                      <input required type="number" min="2020" max="2099" value={cicloForm.anoFiscal}
                        onChange={(e) => setCicloForm((f) => ({ ...f, anoFiscal: e.target.value }))}
                        placeholder="2026" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select value={cicloForm.status} onChange={(e) => setCicloForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="SETUP">SETUP</option>
                        <option value="ATIVO">ATIVO</option>
                        <option value="ENCERRADO">ENCERRADO</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mês Início</label>
                      <select value={cicloForm.mesInicio} onChange={(e) => setCicloForm((f) => ({ ...f, mesInicio: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mês Fim</label>
                      <select value={cicloForm.mesFim} onChange={(e) => setCicloForm((f) => ({ ...f, mesFim: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pool de Bônus (R$)</label>
                      <input type="number" step="0.01" min="0" value={cicloForm.bonusPool}
                        onChange={(e) => setCicloForm((f) => ({ ...f, bonusPool: e.target.value }))}
                        placeholder="500000.00" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 flex gap-3">
                      <button type="submit" className="btn-primary">Salvar</button>
                      <button type="button" onClick={() => setShowCicloForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="bg-white icp-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr>
                      {["Ano Fiscal","Status","Período","Pool de Bônus","Indicadores","Metas","Ações"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {ciclos.map((c) => (
                        <tr key={c.id} className={c.id === cicloAtivo?.id ? "bg-blue-50" : ""}>
                          <td className="px-4 py-3 font-semibold">
                            {c.anoFiscal}
                            {c.id === cicloAtivo?.id && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">ativo</span>}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                          <td className="px-4 py-3 text-gray-500">{MESES[(c.mesInicio ?? 1) - 1]} – {MESES[(c.mesFim ?? 12) - 1]}</td>
                          <td className="px-4 py-3">{c.bonusPool ? fmt(c.bonusPool) : "—"}</td>
                          <td className="px-4 py-3">{(c as CicloICP & { indicadores?: { id: number }[] }).indicadores?.length ?? 0}</td>
                          <td className="px-4 py-3">{(c as CicloICP & { metas?: { id: number }[] }).metas?.length ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button className="btn-ghost text-xs" onClick={() => {
                                setCicloEditId(c.id);
                                setCicloForm({
                                  anoFiscal: String(c.anoFiscal),
                                  mesInicio: String(c.mesInicio ?? 1),
                                  mesFim: String(c.mesFim ?? 12),
                                  bonusPool: c.bonusPool != null ? String(c.bonusPool) : "",
                                  status: c.status,
                                });
                                setShowCicloForm(true);
                              }}>Editar</button>
                              <button className="text-xs text-red-600 hover:text-red-800 px-2 py-1" onClick={() => handleExcluirCiclo(c.id)}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {ciclos.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum ciclo cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Múltiplo Salarial (ex: 1.5 = 1.5× salário mensal)</label>
                      <input type="number" step="0.01" min="0" value={cargoForm.targetMultiploSalarial}
                        onChange={(e) => setCargoForm((f) => ({ ...f, targetMultiploSalarial: e.target.value }))}
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
                      {["Código","Nome","Grade","Múltiplo Salarial","Salário Teto","Colaboradores"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="">
                      {cargos.map((c) => (
                        <tr key={c.id} className="">
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.codigo}</td>
                          <td className="px-4 py-3">{c.nome}</td>
                          <td className="px-4 py-3"><span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{c.nivelHierarquico}</span></td>
                          <td className="px-4 py-3 text-green-700 font-semibold">{c.targetMultiploSalarial}x</td>
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
            {cadastroSub === "indicadores" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => setShowIndicadorForm((v) => !v)}
                    className="btn-primary">
                    + Novo Indicador
                  </button>
                </div>
                {showIndicadorForm && (
                  <form onSubmit={handleCriarIndicador} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Código</label>
                      <input value={indicadorForm.codigo} onChange={(e) => setIndicadorForm((f) => ({ ...f, codigo: e.target.value }))}
                        placeholder="Auto-gerado" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                      <input required value={indicadorForm.nome} onChange={(e) => setIndicadorForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Nome do indicador" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                      <select value={indicadorForm.tipo} onChange={(e) => setIndicadorForm((f) => ({ ...f, tipo: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="VOLUME_FINANCEIRO">Volume/Financeiro</option>
                        <option value="CUSTO_PRAZO">Custo/Prazo</option>
                        <option value="PROJETO_MARCO">Projeto/Marco</option>
                        <option value="QUALITATIVO">Qualitativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Polaridade</label>
                      <select value={indicadorForm.polaridade} onChange={(e) => setIndicadorForm((f) => ({ ...f, polaridade: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="MAIOR_MELHOR">Maior é Melhor</option>
                        <option value="MENOR_MELHOR">Menor é Melhor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Abrangência</label>
                      <select value={indicadorForm.abrangencia} onChange={(e) => setIndicadorForm((f) => ({ ...f, abrangencia: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="CORPORATIVO">Corporativo</option>
                        <option value="AREA">Área</option>
                        <option value="INDIVIDUAL">Individual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                      <input value={indicadorForm.unidade} onChange={(e) => setIndicadorForm((f) => ({ ...f, unidade: e.target.value }))}
                        placeholder="%" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Diretivo</label>
                      <input value={indicadorForm.diretivo} onChange={(e) => setIndicadorForm((f) => ({ ...f, diretivo: e.target.value }))}
                        placeholder="Diretivo responsável" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Analista Resp.</label>
                      <input value={indicadorForm.analistaResp} onChange={(e) => setIndicadorForm((f) => ({ ...f, analistaResp: e.target.value }))}
                        placeholder="Analista responsável" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Origem do Dado</label>
                      <input value={indicadorForm.origemDado} onChange={(e) => setIndicadorForm((f) => ({ ...f, origemDado: e.target.value }))}
                        placeholder="Sistema de origem" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
                      <input value={indicadorForm.descricao} onChange={(e) => setIndicadorForm((f) => ({ ...f, descricao: e.target.value }))}
                        placeholder="Descrição do indicador" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-3 flex gap-3">
                      <button type="submit" className="btn-primary">Salvar</button>
                      <button type="button" onClick={() => setShowIndicadorForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancelar</button>
                    </div>
                  </form>
                )}
                <div className="bg-white icp-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr>
                      {["Código","Nome","Tipo","Polaridade","Abrangência","Unidade"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {indicadores.map((ind) => (
                        <tr key={ind.id}>
                          <td className="px-4 py-3 font-mono text-gray-500 text-xs">{ind.codigo}</td>
                          <td className="px-4 py-3 font-medium">{ind.nome}</td>
                          <td className="px-4 py-3 text-gray-500">{ind.tipo}</td>
                          <td className="px-4 py-3 text-gray-500">{ind.polaridade}</td>
                          <td className="px-4 py-3 text-gray-500">{ind.abrangencia}</td>
                          <td className="px-4 py-3 text-gray-500">{ind.unidade}</td>
                        </tr>
                      ))}
                      {indicadores.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhum indicador cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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

      </main>
      </div>
    </div>
  );
}

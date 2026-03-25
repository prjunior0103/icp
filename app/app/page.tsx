"use client";

import React, { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import CockpitColaborador from "@/components/CockpitColaborador";
import PainelGestor from "@/components/PainelGestor";
import MasterDashboard from "@/components/MasterDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "dashboard" | "cockpit" | "gestor" | "scorecard" | "indicadores" | "metas" | "atingimento" | "elegiveis" | "relatorio" | "conferencia" | "movimentacoes" | "realizacoes" | "colaboradores" | "workflow" | "janelas" | "importacao" | "ajuda";

interface Cargo { id: number; nome: string; nivelHierarquico: string; targetBonusPerc: number; }
interface CentroCusto { id: number; nome: string; codigo: string; }
interface Empresa { id: number; nome: string; }
interface Colaborador {
  id: number; matricula: string; nomeCompleto: string; email: string;
  salarioBase: number; ativo: boolean;
  cargo: Cargo; centroCusto: CentroCusto; empresa: Empresa;
}
interface CicloICP { id: number; anoFiscal: number; status: string; bonusPool: number | null; mesInicio: number; mesFim: number; }
interface Indicador { id: number; codigo: string; nome: string; tipo: string; polaridade: string; abrangencia: string; unidade: string; status: string; diretivo?: string; analistaResp?: string; origemDado?: string; divisorId?: number | null; divisor?: { id: number; nome: string } | null; }
interface Meta {
  id: number; pesoNaCesta: number; metaAlvo: number; metaMinima: number | null;
  metaMaxima: number | null; status: string;
  indicador: Indicador; centroCusto: CentroCusto | null;
  _count: { colaboradores: number; realizacoes: number; filhas: number };
  colaboradorIds: number[];
  parentMetaId: number | null;
  parentMeta: { id: number; indicador: { nome: string }; centroCusto: { nome: string } | null } | null;
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
  });
  const [cascateandoMetaId, setCascateandoMetaId] = useState<number | null>(null);

  // Movimentações state
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoRH[]>([]);
  const [showMovForm, setShowMovForm] = useState(false);
  const [movForm, setMovForm] = useState({
    colaboradorId: "", tipo: "ADMISSAO", dataEfetiva: "", cargoAnteriorId: "", cargoNovoId: "", ccAnteriorId: "", ccNovoId: "",
  });
  const [cargos, setCargos] = useState<Cargo[]>([]);

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

  const loadIndicadores = useCallback(async (cicloId?: number) => {
    const url = cicloId ? `/api/indicadores?cicloId=${cicloId}` : "/api/indicadores";
    const res = await fetch(url).then((r) => r.json()).catch(() => ({ data: [] }));
    setIndicadores(res.data ?? []);
  }, []);

  const loadCentrosCusto = useCallback(async () => {
    const res = await fetch("/api/colaboradores").then((r) => r.json()).catch(() => ({ data: [] }));
    const cols: Colaborador[] = res.data ?? [];
    const map = new Map<number, CentroCusto>();
    cols.forEach((c) => { if (c.centroCusto) map.set(c.centroCusto.id, c.centroCusto); });
    setCentrosCusto(Array.from(map.values()));
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
    const res = await fetch("/api/colaboradores").then((r) => r.json()).catch(() => ({ data: [] }));
    const cols: Colaborador[] = res.data ?? [];
    const map = new Map<number, Cargo>();
    cols.forEach((c) => { if (c.cargo) map.set(c.cargo.id, c.cargo); });
    setCargos(Array.from(map.values()));
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
        loadMovimentacoes(ativo?.id), loadCargos(),
      ]);
      setLoading(false);
    })();
  }, [loadCiclos, loadColaboradores, loadMetas, loadRealizacoes, loadWorkflow, checkSeeded, loadJanelas, loadWaivers, loadDashboard, loadIndicadores, loadCentrosCusto, loadMovimentacoes, loadCargos]);

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
      }),
    });
    setMetaForm({ indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "", metaMinima: "", metaMaxima: "", parentMetaId: "" });
    setShowMetaForm(false);
    setCascateandoMetaId(null);
    loadMetas(cicloAtivo.id);
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
            {(["dashboard","cockpit","gestor","scorecard","indicadores","metas","atingimento","elegiveis","relatorio","conferencia","realizacoes","colaboradores","workflow","janelas","importacao","ajuda"] as TabId[]).map((tab) => (
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
                 tab === "cockpit" ? "Cockpit" :
                 tab === "gestor" ? "Painel Gestor" :
                 tab === "elegiveis" ? "Elegíveis" :
                 tab === "relatorio" ? "Relatório" :
                 tab === "conferencia" ? "Conferência" :
                 tab === "movimentacoes" ? "Movimentações RH" :
                 tab === "ajuda" ? "? Ajuda" :
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

        {/* ── DASHBOARD (Master) ──────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Master Dashboard</h2>
            <MasterDashboard cicloId={cicloAtivo?.id ?? null} />

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

        {/* ── INDICADORES ───────────────────────────────────────────────── */}
        {activeTab === "indicadores" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Indicadores</h2>
              <button
                onClick={() => setShowIndicadorForm(!showIndicadorForm)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                + Novo Indicador
              </button>
            </div>

            {showIndicadorForm && (() => {
              const autoCode = `IND-${String(indicadores.length + 1).padStart(3, "0")}`;
              const codigoDisplay = indicadorForm.codigo || autoCode;
              return (
              <form onSubmit={(e) => { if (!indicadorForm.codigo) setIndicadorForm((f) => ({ ...f, codigo: autoCode })); handleCriarIndicador(e); }}
                className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg">
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

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["#","Código","Nome","Tipo","Polaridade","Unidade","Analista","Divisor","Status","Metas"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {indicadores.map((i) => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i.id}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{i.codigo}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{i.nome}</td>
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
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Nenhum indicador cadastrado</td></tr>
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
              <h2 className="text-xl font-bold text-gray-800">Metas</h2>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">{metas.length} metas encontradas</p>
                <button
                  onClick={() => setShowMetaForm(!showMetaForm)}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  + Nova Meta
                </button>
              </div>
            </div>

            {showMetaForm && (
              <form onSubmit={handleCriarMeta} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <h3 className="text-sm font-semibold text-blue-900">
                    {cascateandoMetaId ? `Cascatear Meta #${cascateandoMetaId}` : "Nova Meta"}
                  </h3>
                  {cascateandoMetaId && (
                    <p className="text-xs text-purple-600 mt-0.5">
                      Esta meta será filha de #{cascateandoMetaId} — {metas.find((m) => m.id === cascateandoMetaId)?.indicador.nome}
                    </p>
                  )}
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
                <div className="col-span-2 md:col-span-3 flex gap-2">
                  <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg">
                    {cascateandoMetaId ? "Criar Meta Cascateada" : "Criar Meta"}
                  </button>
                  <button type="button" onClick={() => { setShowMetaForm(false); setCascateandoMetaId(null); setMetaForm({ indicadorId: "", centroCustoId: "", pesoNaCesta: "100", metaAlvo: "", metaMinima: "", metaMaxima: "", parentMetaId: "" }); }}
                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5">
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
                      {["#","Indicador","CC","Peso","Alvo","Colaboradores","Status",""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metas.map((m) => (
                      <React.Fragment key={m.id}>
                        <tr className={`hover:bg-gray-50 ${m.parentMetaId ? "bg-gray-50/50" : ""}`}>
                          <td className="px-4 py-3 text-gray-400">
                            {m.parentMetaId && <span className="mr-1 text-purple-400">↳</span>}
                            {m.id}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{m.indicador.nome}</p>
                            {m.parentMeta && (
                              <p className="text-xs text-purple-600 mt-0.5">Cascata de: {m.parentMeta.indicador.nome}{m.parentMeta.centroCusto ? ` (${m.parentMeta.centroCusto.nome})` : ""}</p>
                            )}
                            {m._count.filhas > 0 && (
                              <p className="text-xs text-indigo-500 mt-0.5">{m._count.filhas} meta(s) cascateada(s)</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.centroCusto?.nome ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{m.pesoNaCesta}%</td>
                          <td className="px-4 py-3 text-gray-600">{m.metaAlvo.toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-3 text-gray-600">{m._count.colaboradores}</td>
                          <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                          <td className="px-4 py-3 flex gap-1 flex-wrap">
                            {role === "GUARDIAO" && m.status === "DRAFT" && (
                              <button onClick={() => handleApproveMeta(m.id)}
                                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded transition-colors">
                                Aprovar
                              </button>
                            )}
                            <button onClick={() => setAssigningMetaId(assigningMetaId === m.id ? null : m.id)}
                              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5 py-1 rounded transition-colors">
                              Atribuir
                            </button>
                            <button onClick={() => {
                                setCascateandoMetaId(m.id);
                                setMetaForm({ indicadorId: String(m.indicador.id ?? ""), centroCustoId: "", pesoNaCesta: "100", metaAlvo: String(m.metaAlvo), metaMinima: m.metaMinima ? String(m.metaMinima) : "", metaMaxima: m.metaMaxima ? String(m.metaMaxima) : "", parentMetaId: String(m.id) });
                                setShowMetaForm(true);
                              }}
                              className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2.5 py-1 rounded transition-colors">
                              Cascatear
                            </button>
                          </td>
                        </tr>
                        {assigningMetaId === m.id && (
                          <tr className="bg-blue-50">
                            <td colSpan={8} className="px-4 py-2">
                              <form onSubmit={handleAtribuirMeta} className="flex items-center gap-2">
                                <select required value={assignColabId} onChange={(e) => setAssignColabId(e.target.value)}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm flex-1">
                                  <option value="">Selecionar colaborador...</option>
                                  {colaboradores.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nomeCompleto} — {c.cargo.nome}</option>
                                  ))}
                                </select>
                                <button type="submit" className="text-xs bg-blue-700 text-white px-3 py-1 rounded">Atribuir</button>
                                <button type="button" onClick={() => setAssigningMetaId(null)} className="text-xs text-gray-500 px-2 py-1">Cancelar</button>
                              </form>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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

        {/* ── PAINEL ATINGIMENTO NOMINAL ────────────────────────────────── */}
        {activeTab === "atingimento" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Painel Atingimento Nominal — por Meta</h2>
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
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-800">{m.indicador.nome}</h3>
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
                            <thead className="bg-gray-50">
                              <tr>
                                {["Colaborador","Mês","Realizado","Nota","Prêmio Proj."].map((h) => (
                                  <th key={h} className="px-3 py-1.5 text-left text-gray-500 uppercase font-medium">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {metaRealizacoes.slice().sort((a, b) => (b.notaCalculada ?? 0) - (a.notaCalculada ?? 0)).map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
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
                      {["Matrícula","Nome","Cargo","Grade","Target Bonus","Centro de Custo","Salário Base","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colaboradores.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.matricula}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.nomeCompleto}</td>
                        <td className="px-4 py-3 text-gray-600">{c.cargo.nome}</td>
                        <td className="px-4 py-3">
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{c.cargo.nivelHierarquico}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold ${c.cargo.targetBonusPerc >= 20 ? "text-green-700" : c.cargo.targetBonusPerc >= 10 ? "text-blue-700" : "text-gray-600"}`}>
                            {c.cargo.targetBonusPerc}%
                          </span>
                          <span className="text-xs text-gray-400 ml-1">= {fmt(c.salarioBase * 12 * c.cargo.targetBonusPerc / 100)}/ano</span>
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
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Nenhum colaborador cadastrado</td></tr>
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

        {/* ── ELEGÍVEIS ─────────────────────────────────────────────────── */}
        {activeTab === "elegiveis" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Comparação entre Elegíveis</h2>
            <p className="text-sm text-gray-500">Ranking de todos os colaboradores com realizações lançadas no ciclo, ordenado por nota média.</p>
            {rankingElegiveis.length === 0 ? (
              <div className="text-center text-gray-400 py-16">Nenhuma realização lançada ainda</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["#","Colaborador","Cargo","Nível","Metas","Realizações","Nota Média","Prêmio YTD","Target Anual","% do Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
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
                            <td className="px-4 py-3 font-medium text-gray-800">{row.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3 text-gray-600">{row.colaborador.cargo.nome}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.cargo.nivelHierarquico}</td>
                            <td className="px-4 py-3 text-gray-500">{row.metasAtribuidas}</td>
                            <td className="px-4 py-3 text-gray-500">{row.totalRealizacoes > 0 ? row.totalRealizacoes : <span className="text-gray-300">—</span>}</td>
                            <td className={`px-4 py-3 ${row.totalRealizacoes > 0 ? notaColor(row.notaMedia) : "text-gray-300"}`}>{row.totalRealizacoes > 0 ? fmtN(row.notaMedia) : "—"}</td>
                            <td className="px-4 py-3">
                              <p className="text-blue-700 font-medium">{fmt(premioAjustado)}</p>
                              {movTipo && fator < 1 && <p className="text-xs text-amber-600">{fmt(row.premioYTD)} × {(fator * 100).toFixed(0)}%</p>}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{fmt(row.targetAnual)}</td>
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Relatório de Fechamento — Ciclo {cicloAtivo?.anoFiscal}</h2>
              <button
                onClick={() => window.print()}
                className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                Imprimir / Exportar PDF
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Colaboradores Elegíveis", value: String(rankingElegiveis.length) },
                { label: "Metas Ativas", value: String(metas.filter((m) => m.status === "APROVADO" || m.status === "ATIVO").length) },
                { label: "Realizações Lançadas", value: String(realizacoes.length) },
                { label: "Total Prêmio Projetado", value: fmt(totalPremioProjetado) },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Ciclo info */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Atingimento por Colaborador</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Colaborador","Matrícula","Cargo","Nível","Nota Média","Prêmio YTD","Target Anual","% Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rankingElegiveis.map((row) => {
                        const percTarget = row.targetAnual > 0 ? (row.premioYTD / row.targetAnual) * 100 : 0;
                        return (
                          <tr key={row.colaborador.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.matricula}</td>
                            <td className="px-4 py-3 text-gray-600">{row.colaborador.cargo.nome}</td>
                            <td className="px-4 py-3 text-gray-500">{row.colaborador.cargo.nivelHierarquico}</td>
                            <td className={`px-4 py-3 ${notaColor(row.notaMedia)}`}>{fmtN(row.notaMedia)}</td>
                            <td className="px-4 py-3 text-blue-700 font-medium">{fmt(row.premioYTD)}</td>
                            <td className="px-4 py-3 text-gray-600">{fmt(row.targetAnual)}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700">Metas do Ciclo</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Indicador","CC","Polaridade","Peso","Alvo","Colaboradores","Realizações","Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metas.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{m.indicador.nome}</td>
                        <td className="px-4 py-3 text-gray-500">{m.centroCusto?.nome ?? "Corporativo"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.indicador.polaridade === "MENOR_MELHOR" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {m.indicador.polaridade === "MENOR_MELHOR" ? "↓ Menor" : "↑ Maior"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{m.pesoNaCesta}%</td>
                        <td className="px-4 py-3 text-gray-600">{m.metaAlvo.toLocaleString("pt-BR")}</td>
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
            <h2 className="text-xl font-bold text-gray-800">Conferência e Validação</h2>

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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Checklist por Meta</h3>
                <span className="text-xs text-gray-400">{validacaoMetas.filter((v) => v.ok).length}/{metas.length} ok</span>
              </div>
              <div className="divide-y divide-gray-100">
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Consolidado por Centro de Custo</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Centro de Custo","Metas","Colaboradores","Realizações","Nota Média","Prêmio YTD"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ccRows.map((row) => (
                        <tr key={row.nome} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{row.nome}</td>
                          <td className="px-4 py-3 text-gray-600">{row.metas}</td>
                          <td className="px-4 py-3 text-gray-600">{row.colaboradores}</td>
                          <td className="px-4 py-3 text-gray-600">{row.realizacoesCount}</td>
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Consolidado por Cargo / Nível</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Cargo","Nível","Colaboradores","Nota Média","Prêmio YTD","Target Total","% Target"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cargoRows.map((row) => {
                        const perc = row.targetTotal > 0 ? (row.premioYTD / row.targetTotal) * 100 : 0;
                        return (
                          <tr key={`${row.cargo}|${row.nivel}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.cargo}</td>
                            <td className="px-4 py-3"><span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded">{row.nivel}</span></td>
                            <td className="px-4 py-3 text-gray-600">{row.count}</td>
                            <td className={`px-4 py-3 ${notaColor(row.notaMedia)}`}>{fmtN(row.notaMedia)}</td>
                            <td className="px-4 py-3 text-blue-700 font-medium">{fmt(row.premioYTD)}</td>
                            <td className="px-4 py-3 text-gray-600">{fmt(row.targetTotal)}</td>
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
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Evolução Mês a Mês</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Mês","Realizações","Nota Média","Prêmio Projetado"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {evolucaoMensal.map((m) => (
                        <tr key={m.mesNum} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{m.mes}</td>
                          <td className="px-4 py-3 text-gray-600">{m.count}</td>
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
          </div>
        )}

        {/* ── MOVIMENTAÇÕES RH ──────────────────────────────────────────── */}
        {activeTab === "movimentacoes" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Movimentações RH</h2>
                <p className="text-sm text-gray-500 mt-0.5">Admissões, transferências, promoções e desligamentos — com cálculo pro-rata automático</p>
              </div>
              <button onClick={() => setShowMovForm(!showMovForm)}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
                + Registrar Movimentação
              </button>
            </div>

            {showMovForm && (
              <form onSubmit={handleCriarMovimentacao} className="bg-blue-50 border border-blue-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  <button type="submit" className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-1.5 rounded-lg">Registrar</button>
                  <button type="button" onClick={() => setShowMovForm(false)} className="text-sm text-gray-500 px-4 py-1.5">Cancelar</button>
                </div>
              </form>
            )}

            {/* Pro-rata summary por colaborador */}
            {movimentacoes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700">Impacto Pro-Rata por Colaborador</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Colaborador","Tipo","Data Efetiva","Fator Pro-Rata","Situação","Prêmio Bruto","Prêmio Ajustado"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movimentacoes.map((mv) => {
                        const { fator, descricao } = calcFatorProRata(mv.colaboradorId);
                        const colRealizacoes = realizacoes.filter((r) => r.colaborador?.id === mv.colaboradorId);
                        const premioBruto = colRealizacoes.reduce((s, r) => s + (r.premioProjetado ?? 0), 0);
                        const premioAjustado = premioBruto * fator;
                        return (
                          <tr key={mv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{mv.colaborador.nomeCompleto}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${mv.tipo === "ADMISSAO" ? "bg-green-100 text-green-700" : mv.tipo === "DESLIGAMENTO" ? "bg-red-100 text-red-700" : mv.tipo === "PROMOCAO" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                {mv.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{new Date(mv.dataEfetiva).toLocaleDateString("pt-BR")}</td>
                            <td className="px-4 py-3 font-semibold text-blue-700">{(fator * 100).toFixed(0)}%</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{descricao}</td>
                            <td className="px-4 py-3 text-gray-600">{fmt(premioBruto)}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Histórico de Movimentações</h3>
                <span className="text-xs text-gray-400">{movimentacoes.length} registros</span>
              </div>
              {movimentacoes.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">Nenhuma movimentação registrada no ciclo</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Colaborador","Tipo","Data","Cargo Ant.","Cargo Novo","CC Ant.","CC Novo","Status"].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {movimentacoes.map((mv) => (
                        <tr key={mv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{mv.colaborador.nomeCompleto}</td>
                          <td className="px-4 py-3"><StatusBadge status={mv.tipo} /></td>
                          <td className="px-4 py-3 text-gray-600">{new Date(mv.dataEfetiva).toLocaleDateString("pt-BR")}</td>
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
          </div>
        )}

        {/* ── AJUDA ─────────────────────────────────────────────────────── */}
        {activeTab === "ajuda" && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-xl font-bold text-gray-800">Manual do Sistema ICP</h2>
            <p className="text-sm text-gray-500">Guia rápido de cada tela e sua finalidade.</p>
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
              <div key={item.tab} className="bg-white rounded-xl border border-gray-200 p-5 flex gap-4">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{item.tab}</h3>
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

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 px-4 text-center text-xs text-gray-400">
        Sistema ICP — Incentivo de Curto Prazo {cicloAtivo ? `| Ciclo ${cicloAtivo.anoFiscal}` : ""}
      </footer>
    </div>
  );
}

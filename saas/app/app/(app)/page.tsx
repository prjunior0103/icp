"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Building2, Calendar, LayoutDashboard, Pencil, Trash2, Users, Target, BarChart3, UserX, AlertCircle, TrendingUp, FileText, Shield, ArrowRight } from "lucide-react";
import { ModalWrapper } from "@/app/components/ModalWrapper";
import { useCiclo } from "@/app/lib/ciclo-context";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import { STATUS_COLOR, STATUS_LABEL } from "@/app/lib/status";
import { useConfirm } from "@/app/components/ConfirmModal";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];


interface DashStats {
  totalColabs: number;
  atribuidos: number;
  semPainel: number;
  totalIndicadores: number;
  pendenciasPreenchimento: number;
  midMedio: number | null;
  distribuicao: { faixa: string; qtd: number; cor: string }[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { ciclos, cicloAtivo, setCicloAtivo, recarregar } = useCiclo();
  const router = useRouter();
  const role = session?.user?.role;

  const confirm = useConfirm();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const carregarStats = useCallback(async () => {
    if (!cicloAtivo) { setStats(null); return; }
    setLoadingStats(true);
    const cid = cicloAtivo.id;

    const [rColabs, rAtrib, rInds, rReal, rMeta] = await Promise.all([
      fetch(`/api/colaboradores?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/atribuicoes?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/indicadores?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/realizacoes?cicloId=${cid}`).then(r => r.json()),
      fetch(`/api/meta-periodos?cicloId=${cid}`).then(r => r.json()),
    ]);

    const colabs: { id: number }[] = rColabs.colaboradores ?? [];
    const atribs: { colaboradorId: number; agrupamentoId: number; pesoNaCesta: number; agrupamento: { indicadores: { indicadorId: number; peso: number }[] } }[] = rAtrib.atribuicoes ?? [];
    const indicadores: { id: number; tipo: string; unidade: string; metaAlvo: number | null; metaMinima: number | null; metaMaxima: number | null; periodicidade: string; criterioApuracao: string; numeradorId: number | null; divisorId: number | null; faixas?: { de: number; ate: number; nota: number }[] }[] = rInds.indicadores ?? [];
    const realizacoes: { indicadorId: number; periodo: string; valorRealizado: number }[] = rReal.realizacoes ?? [];
    const metasPeriodo: { indicadorId: number; periodo: string; valorOrcado: number }[] = rMeta.metasPeriodo ?? [];

    const atribuidosSet = new Set(atribs.map(a => a.colaboradorId));
    const totalColabs = colabs.length;
    const atribuidos = colabs.filter(c => atribuidosSet.has(c.id)).length;
    const semPainel = totalColabs - atribuidos;

    // Pendências de preenchimento no período corrente
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const todosMeses = gerarPeriodos(cicloAtivo.anoFiscal, cicloAtivo.mesInicio, cicloAtivo.mesFim, "MENSAL");
    const periodosCiclo = new Set(todosMeses);
    const periodoRef = periodosCiclo.has(mesAtual) ? mesAtual : [...todosMeses].sort().pop() ?? mesAtual;
    const indsBase = indicadores.filter(i => !i.numeradorId && !i.divisorId);
    let pendenciasPreenchimento = 0;
    for (const ind of indsBase) {
      const periodos = gerarPeriodos(cicloAtivo.anoFiscal, cicloAtivo.mesInicio, cicloAtivo.mesFim, ind.periodicidade);
      const periodoAtual = periodos.filter(p => p <= periodoRef).pop();
      if (!periodoAtual) continue;
      if (!realizacoes.some(r => r.indicadorId === ind.id && r.periodo === periodoAtual)) pendenciasPreenchimento++;
    }

    // Calcular notas e MIDs
    const notasMap = new Map<number, number>();
    for (const ind of indicadores) {
      const periodos = gerarPeriodos(cicloAtivo.anoFiscal, cicloAtivo.mesInicio, cicloAtivo.mesFim, ind.periodicidade);
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
      if (valorFinal != null) {
        const vO = periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.id && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
        const orc = agregarRealizacoes(vO, ind.criterioApuracao);
        const indC = orc != null ? { ...ind, metaAlvo: orc, faixas: ind.faixas ?? [] } : { ...ind, faixas: ind.faixas ?? [] };
        notasMap.set(ind.id, calcNota(indC, valorFinal));
      }
    }

    // MID médio por colaborador
    const mids: number[] = [];
    const colabsUnicos = new Map<number, typeof atribs>();
    for (const at of atribs) {
      if (!colabsUnicos.has(at.colaboradorId)) colabsUnicos.set(at.colaboradorId, []);
      colabsUnicos.get(at.colaboradorId)!.push(at);
    }
    for (const [, atribsColab] of colabsUnicos) {
      let midTotal = 0;
      for (const at of atribsColab) {
        for (const ig of at.agrupamento.indicadores)
          midTotal += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
      }
      mids.push(midTotal);
    }
    const midMedio = mids.length > 0 ? mids.reduce((a, b) => a + b, 0) / mids.length : null;

    // Distribuição
    const dist = [
      { faixa: "≥ 100%", qtd: 0, cor: "bg-green-500" },
      { faixa: "80–99%", qtd: 0, cor: "bg-blue-500" },
      { faixa: "50–79%", qtd: 0, cor: "bg-yellow-500" },
      { faixa: "1–49%",  qtd: 0, cor: "bg-orange-500" },
      { faixa: "0%",     qtd: 0, cor: "bg-red-400" },
    ];
    for (const m of mids) {
      if (m >= 100) dist[0].qtd++;
      else if (m >= 80) dist[1].qtd++;
      else if (m >= 50) dist[2].qtd++;
      else if (m > 0) dist[3].qtd++;
      else dist[4].qtd++;
    }

    setStats({ totalColabs, atribuidos, semPainel, totalIndicadores: indicadores.length, pendenciasPreenchimento, midMedio, distribuicao: dist });
    setLoadingStats(false);
  }, [cicloAtivo?.id]);

  useEffect(() => { carregarStats(); }, [carregarStats]);

  // Modal ciclo
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<typeof ciclos[0] | null>(null);
  const [anoFiscal, setAnoFiscal] = useState(String(new Date().getFullYear()));
  const [mesInicio, setMesInicio] = useState("1");
  const [mesFim, setMesFim] = useState("12");
  const [statusForm, setStatusForm] = useState("SETUP");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  function abrirEditar(c: typeof ciclos[0]) {
    setEditando(c); setAnoFiscal(String(c.anoFiscal)); setMesInicio(String(c.mesInicio));
    setMesFim(String(c.mesFim)); setStatusForm(c.status); setErro(""); setModalOpen(true);
  }
  function abrirCriar() {
    setEditando(null); setAnoFiscal(String(new Date().getFullYear())); setMesInicio("1");
    setMesFim("12"); setStatusForm("SETUP"); setErro(""); setModalOpen(true);
  }
  async function salvarCiclo(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setSalvando(true);
    try {
      const res = editando
        ? await fetch("/api/ciclos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editando.id, anoFiscal: Number(anoFiscal), mesInicio: Number(mesInicio), mesFim: Number(mesFim), status: statusForm }) })
        : await fetch("/api/ciclos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anoFiscal: Number(anoFiscal), mesInicio: Number(mesInicio), mesFim: Number(mesFim) }) });
      if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao salvar"); return; }
      const { ciclo } = await res.json();
      recarregar();
      if (!editando) setCicloAtivo(ciclo);
      setModalOpen(false);
    } catch { setErro("Erro de conexão"); } finally { setSalvando(false); }
  }
  function excluirCiclo(id: number) {
    confirm.request("Confirma exclusão do ciclo?", async () => {
      setExcluindo(id);
      await fetch(`/api/ciclos?id=${id}`, { method: "DELETE" });
      recarregar(); setExcluindo(null);
    }, { confirmLabel: "Excluir", variant: "danger" });
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {cicloAtivo ? `Ciclo ${cicloAtivo.anoFiscal} — ${STATUS_LABEL[cicloAtivo.status] ?? cicloAtivo.status}` : "Selecione um ciclo"}
          </p>
        </div>
        {role === "GUARDIAO" && (
          <button onClick={abrirCriar}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16}/> Novo Ciclo
          </button>
        )}
      </div>

      {!cicloAtivo ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <Building2 size={36} className="text-blue-300 mx-auto mb-2"/>
          <p className="text-blue-700 font-medium">Nenhum ciclo selecionado</p>
          {role === "GUARDIAO" && <p className="text-blue-500 text-xs mt-1">Crie um ciclo clicando em <strong>Novo Ciclo</strong> acima</p>}
        </div>
      ) : (
        <>
          {/* Info ciclo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-blue-600"/>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Ciclo ICP {cicloAtivo.anoFiscal}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[cicloAtivo.status] ?? ""}`}>
                  {STATUS_LABEL[cicloAtivo.status] ?? cicloAtivo.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Calendar size={11}/>
                {MESES[cicloAtivo.mesInicio - 1]}/{cicloAtivo.anoFiscal} — {MESES[cicloAtivo.mesFim - 1]}/{cicloAtivo.anoFiscal}
              </p>
            </div>
          </div>

          {/* KPIs principais */}
          {loadingStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({length: 4}).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-3"/>
                  <div className="h-8 bg-gray-200 rounded w-12"/>
                </div>
              ))}
            </div>
          ) : stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => router.push("/colaboradores")}
                  className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <Users size={16} className="text-blue-500"/>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors"/>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalColabs}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Colaboradores</p>
                </button>

                <button onClick={() => router.push("/relatorios")}
                  className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <Target size={16} className="text-green-500"/>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors"/>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.atribuidos}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Atribuídos</p>
                  {stats.totalColabs > 0 && (
                    <p className="text-2xs text-gray-500 mt-0.5">{Math.round(stats.atribuidos/stats.totalColabs*100)}% do total</p>
                  )}
                </button>

                <button onClick={() => router.push("/relatorios?aba=sem-painel")}
                  className={`bg-white rounded-xl border p-5 text-left hover:border-red-300 transition-colors group ${stats.semPainel > 0 ? "border-red-200" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <UserX size={16} className={stats.semPainel > 0 ? "text-red-500" : "text-gray-400"}/>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-red-400 transition-colors"/>
                  </div>
                  <p className={`text-2xl font-bold ${stats.semPainel > 0 ? "text-red-600" : "text-gray-900"}`}>{stats.semPainel}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Sem Painel</p>
                </button>

                <button onClick={() => router.push("/relatorios?aba=nao-apurados")}
                  className={`bg-white rounded-xl border p-5 text-left hover:border-amber-300 transition-colors group ${stats.pendenciasPreenchimento > 0 ? "border-amber-200" : "border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <AlertCircle size={16} className={stats.pendenciasPreenchimento > 0 ? "text-amber-500" : "text-gray-400"}/>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-400 transition-colors"/>
                  </div>
                  <p className={`text-2xl font-bold ${stats.pendenciasPreenchimento > 0 ? "text-amber-600" : "text-gray-900"}`}>{stats.pendenciasPreenchimento}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Não Apurados</p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MID médio */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-blue-500"/>
                    <h3 className="text-sm font-semibold text-gray-700">MID Médio Geral</h3>
                  </div>
                  {stats.midMedio != null ? (
                    <>
                      <p className="text-4xl font-bold text-blue-700">{stats.midMedio.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p>
                      <p className="text-xs text-gray-500 mt-1">Média de todos os colaboradores atribuídos</p>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Sem dados de apuração ainda</p>
                  )}
                </div>

                {/* Distribuição */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={16} className="text-blue-500"/>
                    <h3 className="text-sm font-semibold text-gray-700">Distribuição de Atingimento</h3>
                  </div>
                  <div className="space-y-2">
                    {stats.distribuicao.map(d => {
                      const total = stats.distribuicao.reduce((acc, x) => acc + x.qtd, 0);
                      const pct = total > 0 ? (d.qtd / total * 100) : 0;
                      return (
                        <div key={d.faixa} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-14 text-right">{d.faixa}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={`${d.cor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}/>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6">{d.qtd}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Links rápidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Colaboradores", icon: Users, href: "/colaboradores", color: "text-blue-600 bg-blue-50" },
              { label: "Apuração", icon: BarChart3, href: "/apuracao", color: "text-green-600 bg-green-50" },
              { label: "Relatórios", icon: FileText, href: "/relatorios", color: "text-purple-600 bg-purple-50" },
              ...(role === "GUARDIAO" ? [{ label: "Auditoria", icon: Shield, href: "/auditoria", color: "text-red-600 bg-red-50" }] : [{ label: "Metas", icon: Target, href: "/metas", color: "text-amber-600 bg-amber-50" }]),
            ].map(({ label, icon: Icon, href, color }) => (
              <button key={href} onClick={() => router.push(href)}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-gray-300 hover:shadow-sm transition-all text-left">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon size={16}/>
                </div>
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Lista de ciclos */}
      {ciclos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Ciclos</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {ciclos.map(c => (
              <div key={c.id} className={`flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 transition-colors ${cicloAtivo?.id === c.id ? "bg-blue-50" : ""}`}>
                <button onClick={() => setCicloAtivo(c)} className="flex items-center gap-3 flex-1 text-left">
                  <span className={`font-medium ${cicloAtivo?.id === c.id ? "text-blue-700" : "text-gray-700"}`}>Ciclo {c.anoFiscal}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[c.status] ?? ""}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                </button>
                {role === "GUARDIAO" && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(c)} className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil size={14}/>
                    </button>
                    <button onClick={() => excluirCiclo(c.id)} disabled={excluindo === c.id}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal criar/editar ciclo */}
      {modalOpen && (
        <ModalWrapper title={editando ? `Editar Ciclo ${editando.anoFiscal}` : "Novo Ciclo ICP"} onClose={() => setModalOpen(false)} size="sm">
            <form onSubmit={salvarCiclo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Fiscal</label>
                <input type="number" required min={2020} max={2100} value={anoFiscal} onChange={e => setAnoFiscal(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês início</label>
                  <select value={mesInicio} onChange={e => setMesInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês fim</label>
                  <select value={mesFim} onChange={e => setMesFim(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
              </div>
              {editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={statusForm} onChange={e => setStatusForm(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="SETUP">Configuração</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="ENCERRADO">Encerrado</option>
                  </select>
                </div>
              )}
              {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg">
                  {salvando ? "Salvando..." : editando ? "Salvar" : "Criar Ciclo"}
                </button>
              </div>
            </form>
        </ModalWrapper>
      )}
      {confirm.modal}
    </div>
  );
}

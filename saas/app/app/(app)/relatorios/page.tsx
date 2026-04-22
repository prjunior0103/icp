"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCiclo } from "@/app/lib/ciclo-context";
import {
  FileText, Download, Users, BarChart3, GitBranch, UserCheck,
  UserCog, LayoutGrid, ArrowLeftRight, UserX, AlertCircle, Presentation, Mail,
} from "lucide-react";
import { useCalcEngine } from "@/app/hooks/useCalcEngine";
import type { AbaId, Indicador, Realizacao, MetaPeriodo, Atribuicao, ColaboradorBasico, AgrupamentoBasico } from "./_components/types";
import { RelatColaborador } from "./_components/RelatColaborador";
import { RelatIndicador } from "./_components/RelatIndicador";
import { RelatContratacao } from "./_components/RelatContratacao";
import { RelatResponsavel } from "./_components/RelatResponsavel";
import { RelatGestor } from "./_components/RelatGestor";
import { RelatCalibracao } from "./_components/RelatCalibracao";
import { RelatPendencias } from "./_components/RelatPendencias";
import { RelatMovimentacoes } from "./_components/RelatMovimentacoes";
import { RelatSemPainel } from "./_components/RelatSemPainel";
import { RelatNaoApurados } from "./_components/RelatNaoApurados";
import { RelatCartaPDF } from "./_components/RelatCartaPDF";
import { RelatPPT } from "./_components/RelatPPT";

const ABAS: { id: AbaId; label: string; icon: React.ReactNode }[] = [
  { id: "colaborador",    label: "Por Colaborador", icon: <Users size={14} /> },
  { id: "indicador",      label: "Por Indicador",   icon: <BarChart3 size={14} /> },
  { id: "contratacao",    label: "Contratação",      icon: <GitBranch size={14} /> },
  { id: "responsavel",    label: "Por Responsável",  icon: <UserCheck size={14} /> },
  { id: "gestor",         label: "Painel do Gestor", icon: <UserCog size={14} /> },
  { id: "calibracao",     label: "Calibração",       icon: <LayoutGrid size={14} /> },
  { id: "pendencias",     label: "Pendências",        icon: <FileText size={14} /> },
  { id: "movimentacoes",  label: "Movimentações",    icon: <ArrowLeftRight size={14} /> },
  { id: "sem-painel",     label: "Sem Painel",       icon: <UserX size={14} /> },
  { id: "nao-apurados",   label: "Não Apurados",     icon: <AlertCircle size={14} /> },
  { id: "ppt",            label: "Gerar PPT",        icon: <Presentation size={14} /> },
  { id: "carta",          label: "Carta PDF",        icon: <Mail size={14} /> },
];

export default function RelatoriosPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "COLABORADOR";
  const isCliente = role === "CLIENTE";
  const { cicloAtivo } = useCiclo();
  const searchParams = useSearchParams();
  const [aba, setAba] = useState<AbaId>((searchParams.get("aba") as AbaId) ?? "colaborador");
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [realizacoes, setRealizacoes] = useState<Realizacao[]>([]);
  const [metasPeriodo, setMetasPeriodo] = useState<MetaPeriodo[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [areas, setAreas] = useState<{ nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null; centroCusto: string }[]>([]);
  const [exportando, setExportando] = useState(false);
  const [movimentadosSet, setMovimentadosSet] = useState<Set<string>>(new Set());
  const [colaboradoresAll, setColaboradoresAll] = useState<ColaboradorBasico[]>([]);
  const [agrupamentosAll, setAgrupamentosAll] = useState<AgrupamentoBasico[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    if (!cicloAtivo) return;
    // Cancela request anterior ao trocar ciclo
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    try {
      const cid = cicloAtivo.id;
      const [dInds, dReal, dMeta, dAtrib, dAreas, dColabs, dAgrup, dMovs] = await Promise.all([
        fetch(`/api/indicadores?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/realizacoes?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/meta-periodos?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/atribuicoes?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/areas?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/colaboradores?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/agrupamentos?cicloId=${cid}`, { signal }).then(r => r.json()),
        fetch(`/api/movimentacoes?cicloId=${cid}`, { signal }).then(r => r.json()),
      ]);
      const inds: Indicador[] = dInds.indicadores ?? [];
      const comFaixas = await Promise.all(
        inds.map(async i => {
          const fd = await fetch(`/api/faixas?indicadorId=${i.id}`, { signal }).then(r => r.json());
          return { ...i, faixas: fd.faixas ?? [] };
        })
      );
      setIndicadores(comFaixas);
      setRealizacoes(dReal.realizacoes ?? []);
      setMetasPeriodo(dMeta.metasPeriodo ?? []);
      setAtribuicoes(dAtrib.atribuicoes ?? []);
      setAreas(dAreas.areas ?? []);
      setColaboradoresAll(dColabs.colaboradores ?? []);
      setAgrupamentosAll(dAgrup.agrupamentos ?? []);
      const movs: { matricula: string; requerNovoPainel: boolean; statusTratamento: string }[] = dMovs.movimentacoes ?? [];
      setMovimentadosSet(new Set(movs.filter(m => m.requerNovoPainel && m.statusTratamento === "TRATADO").map(m => m.matricula)));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    }
  }, [cicloAtivo?.id]);

  useEffect(() => {
    carregar();
    return () => { abortRef.current?.abort(); };
  }, [carregar]);

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
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <FileText size={40} className="mb-3 text-gray-300" />
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
        <button
          onClick={exportarExcel}
          disabled={exportando}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Download size={15} />
          {exportando ? "Exportando..." : "Exportar Excel"}
        </button>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {ABAS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1 whitespace-nowrap ${
                aba === id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {aba === "colaborador"   && <RelatColaborador atribuicoes={atribuicoes} notasMap={notasMap} areas={areas} movimentadosSet={movimentadosSet} />}
      {aba === "indicador"     && <RelatIndicador indicadores={indicadores} notasMap={notasMap} realMap={realMap} orcMap={orcMap} atribuicoes={atribuicoes} />}
      {aba === "contratacao"   && <RelatContratacao atribuicoes={atribuicoes} indicadores={indicadores} notasMap={notasMap} />}
      {aba === "responsavel"   && <RelatResponsavel indicadores={indicadores} notasMap={notasMap} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim} />}
      {aba === "gestor"        && <RelatGestor atribuicoes={atribuicoes} notasMap={notasMap} movimentadosSet={movimentadosSet} />}
      {aba === "calibracao"    && <RelatCalibracao atribuicoes={atribuicoes} notasMap={notasMap} movimentadosSet={movimentadosSet} />}
      {aba === "pendencias"    && <RelatPendencias indicadores={indicadores} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim} />}
      {aba === "movimentacoes" && <RelatMovimentacoes cicloId={cicloAtivo.id} />}
      {aba === "sem-painel"    && <RelatSemPainel colaboradoresAll={colaboradoresAll} atribuicoes={atribuicoes} agrupamentos={agrupamentosAll} cicloId={cicloAtivo.id} onAtribuir={carregar} readOnly={isCliente} />}
      {aba === "nao-apurados"  && <RelatNaoApurados indicadores={indicadores} realizacoes={realizacoes} anoFiscal={cicloAtivo.anoFiscal} mesInicio={cicloAtivo.mesInicio} mesFim={cicloAtivo.mesFim} />}
      {aba === "ppt"           && <RelatPPT atribuicoes={atribuicoes} cicloId={cicloAtivo.id} />}
      {aba === "carta"         && <RelatCartaPDF atribuicoes={atribuicoes} cicloId={cicloAtivo.id} />}
    </div>
  );
}

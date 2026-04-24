import { calcNota, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import type { Indicador, Realizacao, MetaPeriodo } from "@/app/(app)/relatorios/_components/types";

export function useCalcEngine(
  indicadores: Indicador[],
  realizacoes: Realizacao[],
  metasPeriodo: MetaPeriodo[],
  anoFiscal: number,
  mesInicio: number,
  mesFim: number
) {
  const notasMap = new Map<number, number>();
  const realMap = new Map<number, number | null>();
  const orcMap = new Map<number, number | null>();

  for (const ind of indicadores) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    let valorFinal: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const vN = periodos
        .map(p => realizacoes.find(r => r.indicadorId === ind.numeradorId && r.periodo === p)?.valorRealizado)
        .filter((v): v is number => v != null);
      const vD = periodos
        .map(p => realizacoes.find(r => r.indicadorId === ind.divisorId && r.periodo === p)?.valorRealizado)
        .filter((v): v is number => v != null);
      const n = agregarRealizacoes(vN, ind.criterioApuracao);
      const d = agregarRealizacoes(vD, ind.criterioApuracao);
      if (n != null && d != null && d !== 0) valorFinal = n / d;
    } else {
      const vals = periodos
        .map(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p)?.valorRealizado)
        .filter((v): v is number => v != null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    realMap.set(ind.id, valorFinal);
    let orc: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const orcN = agregarRealizacoes(periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.numeradorId && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null), ind.criterioApuracao);
      const orcD = agregarRealizacoes(periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.divisorId && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null), ind.criterioApuracao);
      if (orcN != null && orcD != null && orcD !== 0) orc = orcN / orcD;
    } else {
      const vO = periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.id && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
      orc = agregarRealizacoes(vO, ind.criterioApuracao);
    }
    orcMap.set(ind.id, orc);
    if (valorFinal != null) {
      const indC = orc != null
        ? { ...ind, metaAlvo: orc, faixas: ind.faixas ?? [] }
        : { ...ind, faixas: ind.faixas ?? [] };
      notasMap.set(ind.id, calcNota(indC, valorFinal));
    }
  }
  return { notasMap, realMap, orcMap };
}

import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = Number(searchParams.get("cicloId"));
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const ciclo = await prisma.cicloICP.findUnique({ where: { id: cicloId } });
  if (!ciclo) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const [atribuicoes, realizacoes, metasPeriodo, indicadores] = await Promise.all([
    prisma.atribuicaoAgrupamento.findMany({
      where: { cicloId },
      include: {
        colaborador: { include: { area: true } },
        agrupamento: { include: { indicadores: { include: { indicador: { include: { faixas: true, responsavelEnvio: true } } } } } },
      },
    }),
    prisma.realizacao.findMany({ where: { cicloId } }),
    prisma.metaPeriodo.findMany({ where: { cicloId } }),
    prisma.indicador.findMany({ where: { cicloId }, include: { faixas: true, responsavelEnvio: true } }),
  ]);

  const { anoFiscal, mesInicio, mesFim } = ciclo;

  // Calcular notas por indicador
  function notaInd(ind: typeof indicadores[0]): number | null {
    let valorFinal: number | null = null;
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    if (ind.numeradorId && ind.divisorId) {
      const valsNum = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.numeradorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const valsDen = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.divisorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const num = agregarRealizacoes(valsNum, ind.criterioApuracao);
      const den = agregarRealizacoes(valsDen, ind.criterioApuracao);
      if (num != null && den != null && den !== 0) valorFinal = num / den;
    } else {
      const vals = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    if (valorFinal == null) return null;
    const valsOrc = periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.id && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
    const orcAgg = agregarRealizacoes(valsOrc, ind.criterioApuracao);
    const indCalc = orcAgg != null ? { ...ind, metaAlvo: orcAgg } : ind;
    return calcNota({ ...indCalc, faixas: ind.faixas }, valorFinal);
  }

  const notasMap = new Map<number, number>();
  for (const ind of indicadores) {
    const n = notaInd(ind);
    if (n != null) notasMap.set(ind.id, n);
  }

  // ─── Aba 1: Por Colaborador ───────────────────────────────
  const rowsColab: Record<string, unknown>[] = [];
  const colaboradoresMap = new Map<number, typeof atribuicoes[0]["colaborador"]>();
  for (const a of atribuicoes) colaboradoresMap.set(a.colaboradorId, a.colaborador);

  for (const [, colab] of colaboradoresMap) {
    const atribs = atribuicoes.filter(a => a.colaboradorId === colab.id);
    let resultado = 0;
    for (const at of atribs) {
      for (const ig of at.agrupamento.indicadores) {
        const nota = notasMap.get(ig.indicadorId) ?? 0;
        const mid = calcMID(nota, ig.peso);
        resultado += mid;
      }
    }
    const premio = colab.salarioBase * (colab.target / 100) * (resultado / 100);

    for (const at of atribs) {
      for (const ig of at.agrupamento.indicadores) {
        const nota = notasMap.get(ig.indicadorId) ?? 0;
        const mid = calcMID(nota, ig.peso);
        rowsColab.push({
          "Colaborador": colab.nome,
          "Matrícula": colab.matricula,
          "Cargo": colab.cargo,
          "Área N1": colab.area?.nivel1 ?? "",
          "Área N2": colab.area?.nivel2 ?? "",
          "Agrupamento": at.agrupamento.nome,
          "Peso na Cesta (%)": at.pesoNaCesta,
          "Indicador": ig.indicador.codigo,
          "Nome Indicador": ig.indicador.nome,
          "Peso Indicador (%)": ig.peso,
          "Nota (%)": Number(nota.toFixed(2)),
          "MID": Number(mid.toFixed(4)),
          "Resultado (%)": Number(resultado.toFixed(2)),
          "Prêmio Projetado (R$)": Number(premio.toFixed(2)),
        });
      }
    }
  }

  // ─── Aba 2: Por Indicador ─────────────────────────────────
  const rowsInd: Record<string, unknown>[] = [];
  for (const ind of indicadores) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    const valsReal = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
    const valsOrc = periodos.map(p => metasPeriodo.find(m => m.indicadorId === ind.id && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
    const real = agregarRealizacoes(valsReal, ind.criterioApuracao);
    const orc = agregarRealizacoes(valsOrc, ind.criterioApuracao);
    const nota = notasMap.get(ind.id);
    const contratantes = new Set(atribuicoes.filter(a => a.agrupamento.indicadores.some(ig => ig.indicadorId === ind.id)).map(a => a.colaboradorId)).size;
    rowsInd.push({
      "Código": ind.codigo,
      "Indicador": ind.nome,
      "Tipo": ind.tipo,
      "Unidade": ind.unidade,
      "Métrica": ind.metrica ?? "",
      "Periodicidade": ind.periodicidade,
      "Critério": ind.criterioApuracao,
      "Orçado (Agregado)": orc ?? "",
      "Realizado (Agregado)": real ?? "",
      "Nota/Atingimento (%)": nota != null ? Number(nota.toFixed(2)) : "",
      "Responsável Envio": ind.responsavelEnvio?.nome ?? ind.analistaResp ?? "",
      "Colaboradores Impactados": contratantes,
    });
  }

  // ─── Aba 3: Contratação ───────────────────────────────────
  const rowsContrat: Record<string, unknown>[] = [];
  for (const at of atribuicoes) {
    for (const ig of at.agrupamento.indicadores) {
      rowsContrat.push({
        "Indicador": ig.indicador.codigo,
        "Nome Indicador": ig.indicador.nome,
        "Colaborador": at.colaborador.nome,
        "Matrícula": at.colaborador.matricula,
        "Agrupamento": at.agrupamento.nome,
        "Peso Indicador (%)": ig.peso,
        "Peso na Cesta (%)": at.pesoNaCesta,
      });
    }
  }

  // ─── Aba 4: Por Responsável ───────────────────────────────
  const rowsResp: Record<string, unknown>[] = [];
  for (const ind of indicadores) {
    const periodos = gerarPeriodos(anoFiscal, mesInicio, mesFim, ind.periodicidade);
    const realizado = periodos.some(p => realizacoes.find(r => r.indicadorId === ind.id && r.periodo === p));
    rowsResp.push({
      "Responsável": ind.responsavelEnvio?.nome ?? ind.analistaResp ?? "—",
      "Área Responsável": ind.responsavelEnvio ? "" : "",
      "Código": ind.codigo,
      "Indicador": ind.nome,
      "Tipo": ind.tipo,
      "Periodicidade": ind.periodicidade,
      "Status Preenchimento": realizado ? "Preenchido" : "Pendente",
      "Nota (%)": notasMap.has(ind.id) ? Number((notasMap.get(ind.id)!).toFixed(2)) : "",
    });
  }

  // Montar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsColab), "Por Colaborador");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsInd), "Por Indicador");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsContrat), "Contratação");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsResp), "Por Responsável");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ICP-Ciclo${ciclo.anoFiscal}.xlsx"`,
    },
  });
}

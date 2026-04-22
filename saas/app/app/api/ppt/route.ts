import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import PptxGenJS from "pptxgenjs";

export const dynamic = "force-dynamic";

// Cores corporativas
const COR_AZUL = "1E3A5F";
const COR_AZUL_CLARO = "2D6A9F";
const COR_CINZA = "F0F2F5";
const COR_TEXTO = "1F2937";
const COR_TEXTO_CLARO = "6B7280";

function cor(nota: number | null) {
  if (nota == null) return "9CA3AF";
  if (nota >= 100) return "059669";
  if (nota > 0) return "D97706";
  return "DC2626";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = Number(searchParams.get("cicloId"));
  const tipo = searchParams.get("tipo") ?? "todos"; // colaborador | gestor | area | todos
  const filtroId = searchParams.get("filtroId");
  const filtroArea = searchParams.get("filtroArea");

  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const ciclo = await prisma.cicloICP.findUnique({ where: { id: cicloId } });
  if (!ciclo) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  // Buscar dados
  const [atribuicoes, realizacoes, metasPeriodo] = await Promise.all([
    prisma.atribuicaoAgrupamento.findMany({
      where: { cicloId },
      include: {
        colaborador: { include: { area: true } },
        agrupamento: { include: { indicadores: { include: { indicador: { include: { faixas: true } } } } } },
      },
      orderBy: { colaborador: { nome: "asc" } },
    }),
    prisma.realizacao.findMany({ where: { cicloId } }),
    prisma.metaPeriodo.findMany({ where: { cicloId } }),
  ]);

  // Filtrar por tipo
  let atribsFiltradas = atribuicoes;
  if (tipo === "colaborador" && filtroId) {
    atribsFiltradas = atribuicoes.filter(a => a.colaboradorId === Number(filtroId));
  } else if (tipo === "gestor" && filtroId) {
    atribsFiltradas = atribuicoes.filter(a => String(a.colaborador.gestorId) === filtroId);
  } else if (tipo === "area" && filtroArea) {
    atribsFiltradas = atribuicoes.filter(a => a.colaborador.area?.nivel1 === filtroArea);
  }

  // Agrupar por colaborador
  const colabMap = new Map<number, typeof atribuicoes>();
  for (const at of atribsFiltradas) {
    if (!colabMap.has(at.colaboradorId)) colabMap.set(at.colaboradorId, []);
    colabMap.get(at.colaboradorId)!.push(at);
  }

  // Calcular notas de todos os indicadores
  const todasIndicadores = new Map<number, (typeof atribuicoes[0]["agrupamento"]["indicadores"][0]["indicador"]) & { faixas: { de: number; ate: number; nota: number }[] }>();
  for (const at of atribuicoes) {
    for (const ig of at.agrupamento.indicadores) {
      if (!todasIndicadores.has(ig.indicadorId)) todasIndicadores.set(ig.indicadorId, ig.indicador as typeof ig.indicador & { faixas: { de: number; ate: number; nota: number }[] });
    }
  }

  const notasMap = new Map<number, number>();
  const realMap = new Map<number, number | null>();
  const orcMap = new Map<number, number | null>();

  for (const [indId, ind] of todasIndicadores) {
    const periodos = gerarPeriodos(ciclo.anoFiscal, ciclo.mesInicio, ciclo.mesFim, ind.periodicidade);
    let valorFinal: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const vN = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.numeradorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const vD = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.divisorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const n = agregarRealizacoes(vN, ind.criterioApuracao); const d = agregarRealizacoes(vD, ind.criterioApuracao);
      if (n != null && d != null && d !== 0) valorFinal = n / d;
    } else {
      const vals = periodos.map(p => realizacoes.find(r => r.indicadorId === indId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    realMap.set(indId, valorFinal);
    const vO = periodos.map(p => metasPeriodo.find(m => m.indicadorId === indId && m.periodo === p)?.valorOrcado).filter((v): v is number => v != null);
    const orc = agregarRealizacoes(vO, ind.criterioApuracao);
    orcMap.set(indId, orc);
    if (valorFinal != null) {
      const indC = orc != null ? { ...ind, metaAlvo: orc, faixas: ind.faixas ?? [] } : { ...ind, faixas: ind.faixas ?? [] };
      notasMap.set(indId, calcNota(indC, valorFinal));
    }
  }

  // Calcular YTD (até o mês atual)
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const notasYtdMap = new Map<number, number>();
  const realYtdMap = new Map<number, number | null>();

  for (const [indId, ind] of todasIndicadores) {
    const periodos = gerarPeriodos(ciclo.anoFiscal, ciclo.mesInicio, ciclo.mesFim, ind.periodicidade).filter(p => p <= mesAtual);
    if (periodos.length === 0) continue;
    let valorFinal: number | null = null;
    if (ind.numeradorId && ind.divisorId) {
      const vN = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.numeradorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const vD = periodos.map(p => realizacoes.find(r => r.indicadorId === ind.divisorId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      const n = agregarRealizacoes(vN, ind.criterioApuracao); const d = agregarRealizacoes(vD, ind.criterioApuracao);
      if (n != null && d != null && d !== 0) valorFinal = n / d;
    } else {
      const vals = periodos.map(p => realizacoes.find(r => r.indicadorId === indId && r.periodo === p)?.valorRealizado).filter((v): v is number => v != null);
      valorFinal = agregarRealizacoes(vals, ind.criterioApuracao);
    }
    realYtdMap.set(indId, valorFinal);
    const orc = orcMap.get(indId) ?? null;
    if (valorFinal != null) {
      const indC = orc != null ? { ...ind, metaAlvo: orc, faixas: ind.faixas ?? [] } : { ...ind, faixas: ind.faixas ?? [] };
      notasYtdMap.set(indId, calcNota(indC, valorFinal));
    }
  }

  // Gerar PPT
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `ICP ${ciclo.anoFiscal} — Relatório Executivo`;

  for (const [, atribs] of colabMap) {
    const colab = atribs[0].colaborador;

    // Calcular MID total e YTD
    let midTotal = 0; let midYtd = 0;
    for (const at of atribs) {
      for (const ig of at.agrupamento.indicadores) {
        midTotal += calcMID(notasMap.get(ig.indicadorId) ?? 0, ig.peso);
        midYtd += calcMID(notasYtdMap.get(ig.indicadorId) ?? 0, ig.peso);
      }
    }

    const slide = pptx.addSlide();

    // Fundo
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: 1.2, fill: { color: COR_AZUL } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.2, w: "100%", h: 0.05, fill: { color: COR_AZUL_CLARO } });

    // Header
    slide.addText(colab.nome, { x: 0.4, y: 0.12, w: 7, h: 0.5, fontSize: 20, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    slide.addText(`${colab.cargo} · ${colab.area?.nivel1 ?? colab.centroCusto ?? "—"}  |  Matrícula: ${colab.matricula}`, { x: 0.4, y: 0.65, w: 8, h: 0.35, fontSize: 11, color: "B3C6E0", fontFace: "Calibri" });

    // MID badges
    const midCorTotal = midTotal >= 100 ? "059669" : midTotal > 0 ? "D97706" : "DC2626";
    const midCorYtd = midYtd >= 100 ? "059669" : midYtd > 0 ? "D97706" : "DC2626";
    slide.addShape(pptx.ShapeType.roundRect, { x: 8.5, y: 0.15, w: 1.8, h: 0.9, fill: { color: "FFFFFF", transparency: 85 }, line: { color: "FFFFFF", width: 1 }, rectRadius: 0.1 });
    slide.addText(["MID Total\n", `${midTotal.toFixed(1)}%`].join(""), { x: 8.5, y: 0.15, w: 1.8, h: 0.9, align: "center", valign: "middle", fontSize: 14, bold: true, color: midCorTotal, fontFace: "Calibri" });
    slide.addShape(pptx.ShapeType.roundRect, { x: 10.5, y: 0.15, w: 1.8, h: 0.9, fill: { color: "FFFFFF", transparency: 85 }, line: { color: "FFFFFF", width: 1 }, rectRadius: 0.1 });
    slide.addText(["YTD\n", `${midYtd.toFixed(1)}%`].join(""), { x: 10.5, y: 0.15, w: 1.8, h: 0.9, align: "center", valign: "middle", fontSize: 14, bold: true, color: midCorYtd, fontFace: "Calibri" });

    // Tabela de indicadores por agrupamento
    let yPos = 1.4;
    for (const at of atribs) {
      // Cabeçalho agrupamento
      slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: yPos, w: 12, h: 0.35, fill: { color: COR_AZUL_CLARO } });
      slide.addText(`${at.agrupamento.nome}  (${at.pesoNaCesta}% na cesta)`, { x: 0.4, y: yPos + 0.02, w: 11, h: 0.3, fontSize: 10, bold: true, color: "FFFFFF", fontFace: "Calibri" });
      yPos += 0.35;

      // Header tabela
      slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: yPos, w: 12, h: 0.28, fill: { color: COR_CINZA } });
      const headers = [
        { text: "Indicador", x: 0.4, w: 4.2 },
        { text: "Métrica", x: 4.7, w: 1.3 },
        { text: "Meta", x: 6.1, w: 1.3 },
        { text: "Real", x: 7.5, w: 1.3 },
        { text: "Ating.", x: 8.9, w: 1 },
        { text: "Peso", x: 10, w: 0.8 },
        { text: "MID", x: 10.9, w: 1.2 },
      ];
      for (const h of headers) {
        slide.addText(h.text, { x: h.x, y: yPos + 0.03, w: h.w, h: 0.22, fontSize: 8, bold: true, color: COR_TEXTO_CLARO, fontFace: "Calibri" });
      }
      yPos += 0.28;

      // Linhas
      for (const ig of at.agrupamento.indicadores) {
        const ind = ig.indicador;
        const real = realMap.get(ig.indicadorId);
        const orc = orcMap.get(ig.indicadorId);
        const nota = notasMap.get(ig.indicadorId) ?? null;
        const mid = calcMID(nota ?? 0, ig.peso);
        const bgCor = at.agrupamento.indicadores.indexOf(ig) % 2 === 0 ? "FFFFFF" : "F8FAFC";

        slide.addShape(pptx.ShapeType.rect, { x: 0.3, y: yPos, w: 12, h: 0.3, fill: { color: bgCor } });
        slide.addText(`${ind.codigo} — ${ind.nome}`, { x: 0.4, y: yPos + 0.03, w: 4.2, h: 0.24, fontSize: 8, color: COR_TEXTO, fontFace: "Calibri" });
        slide.addText(ind.unidade, { x: 4.7, y: yPos + 0.03, w: 1.3, h: 0.24, fontSize: 8, color: COR_TEXTO_CLARO, fontFace: "Calibri" });
        slide.addText(orc != null ? orc.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—", { x: 6.1, y: yPos + 0.03, w: 1.3, h: 0.24, fontSize: 8, color: COR_TEXTO, fontFace: "Calibri" });
        slide.addText(real != null ? real.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—", { x: 7.5, y: yPos + 0.03, w: 1.3, h: 0.24, fontSize: 8, color: nota != null ? cor(nota) : COR_TEXTO_CLARO, bold: nota != null, fontFace: "Calibri" });
        slide.addText(nota != null ? `${nota.toFixed(1)}%` : "—", { x: 8.9, y: yPos + 0.03, w: 1, h: 0.24, fontSize: 8, bold: true, color: cor(nota), fontFace: "Calibri" });
        slide.addText(`${ig.peso}%`, { x: 10, y: yPos + 0.03, w: 0.8, h: 0.24, fontSize: 8, color: COR_TEXTO_CLARO, fontFace: "Calibri" });
        slide.addText(`${mid.toFixed(2)}%`, { x: 10.9, y: yPos + 0.03, w: 1.2, h: 0.24, fontSize: 8, bold: true, color: cor(nota), fontFace: "Calibri" });
        yPos += 0.3;
      }
      yPos += 0.15;
    }

    // Rodapé
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.1, w: "100%", h: 0.4, fill: { color: COR_AZUL } });
    slide.addText(`ICP ${ciclo.anoFiscal}  |  Gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: 0.4, y: 7.15, w: 10, h: 0.3, fontSize: 8, color: "B3C6E0", fontFace: "Calibri" });
  }

  if (colabMap.size === 0) {
    const slide = pptx.addSlide();
    slide.addText("Nenhum colaborador encontrado com os filtros selecionados.", { x: 1, y: 3, w: 10, h: 1, fontSize: 18, color: COR_TEXTO_CLARO, align: "center" });
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="ICP-${ciclo.anoFiscal}-executivo.pptx"`,
    },
  });
}

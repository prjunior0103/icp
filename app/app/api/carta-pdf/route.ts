import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { calcNota, calcMID, gerarPeriodos, agregarRealizacoes } from "@/app/lib/calc";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

// Cores
const AZUL = "#1E3A5F";
const AZUL_C = "#2D6A9F";
const CINZA = "#F0F2F5";
const TEXTO = "#1F2937";
const TEXTO_C = "#6B7280";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = Number(searchParams.get("cicloId"));
  const colaboradorId = searchParams.get("colaboradorId");

  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const [ciclo, configCarta] = await Promise.all([
    prisma.cicloICP.findUnique({ where: { id: cicloId } }),
    prisma.configCartaICP.findUnique({ where: { cicloId } }),
  ]);
  if (!ciclo) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  // Buscar atribuições
  const atribuicoes = await prisma.atribuicaoAgrupamento.findMany({
    where: { cicloId, ...(colaboradorId ? { colaboradorId: Number(colaboradorId) } : {}) },
    include: {
      colaborador: { include: { area: true } },
      agrupamento: { include: { indicadores: { include: { indicador: { include: { faixas: true } } } } } },
    },
    orderBy: { colaborador: { nome: "asc" } },
  });

  const [realizacoes, metasPeriodo] = await Promise.all([
    prisma.realizacao.findMany({ where: { cicloId } }),
    prisma.metaPeriodo.findMany({ where: { cicloId } }),
  ]);

  // Calcular notas
  const notasMap = new Map<number, number>();
  const realMap = new Map<number, number | null>();
  const orcMap = new Map<number, number | null>();
  const todasIndicadores = new Map<number, { id: number; tipo: string; unidade: string; metaAlvo: number | null; metaMinima: number | null; metaMaxima: number | null; periodicidade: string; criterioApuracao: string; numeradorId: number | null; divisorId: number | null; faixas: { de: number; ate: number; nota: number }[] }>();
  for (const at of atribuicoes) {
    for (const ig of at.agrupamento.indicadores) {
      if (!todasIndicadores.has(ig.indicadorId)) todasIndicadores.set(ig.indicadorId, ig.indicador as typeof ig.indicador & { faixas: { de: number; ate: number; nota: number }[] });
    }
  }
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
      const indC = orc != null ? { ...ind, metaAlvo: orc } : { ...ind };
      notasMap.set(indId, calcNota(indC, valorFinal));
    }
  }

  // Agrupar por colaborador
  const colabMap = new Map<number, typeof atribuicoes>();
  for (const at of atribuicoes) {
    if (!colabMap.has(at.colaboradorId)) colabMap.set(at.colaboradorId, []);
    colabMap.get(at.colaboradorId)!.push(at);
  }

  const regulador: { faixaDe: string; faixaAte: string; fator: string }[] = configCarta?.reguladorPool ? JSON.parse(configCarta.reguladorPool) : [];

  // Gerar PDF
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  let primeiraPage = true;
  for (const [, atribs] of colabMap) {
    if (!primeiraPage) doc.addPage();
    primeiraPage = false;

    const colab = atribs[0].colaborador;
    const W = doc.page.width;
    const M = 40;

    // Header azul
    doc.rect(0, 0, W, 80).fill(AZUL);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("INCENTIVO DE CURTO PRAZO", M, 18, { width: W - M * 2 });
    doc.fontSize(10).font("Helvetica").text(`Ciclo ${ciclo.anoFiscal}`, M, 40);

    // Dados colaborador
    let y = 95;
    doc.rect(M, y, W - M * 2, 50).fill(CINZA);
    doc.fillColor(TEXTO).fontSize(11).font("Helvetica-Bold").text("Colaborador", M + 10, y + 8);
    doc.font("Helvetica").fontSize(10).text(colab.nome, M + 10 + 80, y + 8);
    doc.fontSize(11).font("Helvetica-Bold").text("Cargo", M + 10, y + 25);
    doc.font("Helvetica").fontSize(10).text(colab.cargo, M + 10 + 80, y + 25);
    doc.fontSize(11).font("Helvetica-Bold").text("Área", M + 10, y + 40);
    doc.font("Helvetica").fontSize(10).text(colab.area?.nivel1 ?? colab.centroCusto ?? "—", M + 10 + 80, y + 40);
    y += 62;

    // Seção Regras Gerais
    doc.rect(M, y, W - M * 2, 18).fill(AZUL_C);
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold").text("REGRAS GERAIS", M + 5, y + 4);
    y += 22;

    // Gatilho + Regulador + Target em 3 colunas
    const colW = (W - M * 2) / 3;
    doc.rect(M, y, W - M * 2, 90).fill("#FAFBFC").stroke("#E5E7EB");
    // Coluna 1 — Gatilho
    doc.fillColor(TEXTO_C).fontSize(7).font("Helvetica-Bold").text("1. GATILHO", M + 5, y + 5);
    doc.fillColor(TEXTO).fontSize(7).font("Helvetica").text("Maior ou Igual", M + 5, y + 15);
    doc.fillColor(AZUL).fontSize(22).font("Helvetica-Bold").text(`${configCarta?.gatilhoPercentual ?? 80}%`, M + 5, y + 25);
    doc.fillColor(TEXTO_C).fontSize(7).font("Helvetica").text(configCarta?.gatilhoIndicador ?? "LAIR CONTÁBIL", M + 5, y + 52);
    doc.fontSize(6).text(configCarta?.gatilhoTotal ?? "", M + 5, y + 62);
    // Coluna 2 — Regulador
    doc.fillColor(TEXTO_C).fontSize(7).font("Helvetica-Bold").text("2. REGULADOR DO POOL", M + colW + 5, y + 5);
    let rY = y + 15;
    for (const linha of regulador.slice(0, 5)) {
      doc.fillColor(TEXTO).fontSize(6.5).font("Helvetica").text(`${linha.faixaDe} — ${linha.faixaAte}: ${linha.fator}`, M + colW + 5, rY);
      rY += 10;
    }
    // Coluna 3 — Target
    doc.fillColor(TEXTO_C).fontSize(7).font("Helvetica-Bold").text("3. TARGET DO ICP", M + colW * 2 + 5, y + 5);
    doc.fillColor(TEXTO).fontSize(7).font("Helvetica").text(`Salário Pool: ${configCarta?.targetSalarioPool ?? "—"}`, M + colW * 2 + 5, y + 18);
    doc.text(`Target de Bônus: ${configCarta?.targetBonus ?? "—"}`, M + colW * 2 + 5, y + 30);
    y += 96;

    // Indicadores por agrupamento
    for (const at of atribs) {
      doc.rect(M, y, W - M * 2, 16).fill(AZUL_C);
      doc.fillColor("white").fontSize(8).font("Helvetica-Bold").text(`4. ${at.agrupamento.nome.toUpperCase()}`, M + 5, y + 4);
      y += 18;
      // Header tabela
      doc.rect(M, y, W - M * 2, 14).fill(CINZA);
      const cols = [140, 40];
      doc.fillColor(TEXTO_C).fontSize(7).font("Helvetica-Bold");
      doc.text("#", M + 5, y + 3);
      doc.text("Indicadores", M + 18, y + 3);
      doc.text("Peso", M + 18 + cols[0], y + 3);
      doc.text("Nota", M + 18 + cols[0] + cols[1], y + 3);
      doc.text("MID", M + 18 + cols[0] + cols[1] + 40, y + 3);
      y += 16;
      let subtotal = 0;
      at.agrupamento.indicadores.forEach((ig, idx) => {
        const nota = notasMap.get(ig.indicadorId) ?? null;
        const mid = calcMID(nota ?? 0, ig.peso);
        subtotal += mid;
        const bg = idx % 2 === 0 ? "white" : "#F8FAFC";
        doc.rect(M, y, W - M * 2, 14).fill(bg);
        doc.fillColor(TEXTO).fontSize(7).font("Helvetica");
        doc.text(String(idx + 1), M + 5, y + 3);
        doc.text(ig.indicador.nome, M + 18, y + 3, { width: 135, ellipsis: true });
        doc.text(`${ig.peso}%`, M + 18 + cols[0], y + 3);
        doc.text(nota != null ? `${nota.toFixed(1)}%` : "—", M + 18 + cols[0] + cols[1], y + 3);
        doc.fillColor(AZUL_C).text(`${mid.toFixed(2)}%`, M + 18 + cols[0] + cols[1] + 40, y + 3);
        y += 14;
      });
      // Total
      doc.rect(M, y, W - M * 2, 14).fill(CINZA);
      doc.fillColor(TEXTO).fontSize(7).font("Helvetica-Bold").text("TOTAL", M + 5, y + 3);
      doc.fillColor(AZUL).text(`${subtotal.toFixed(2)}%`, M + 18 + cols[0] + cols[1] + 40, y + 3);
      y += 18;
    }

    // Critérios e Conceitos
    if (configCarta?.textoCriterios) {
      doc.rect(M, y, W - M * 2, 16).fill(AZUL);
      doc.fillColor("white").fontSize(8).font("Helvetica-Bold").text("CRITÉRIOS E CONCEITOS", M + 5, y + 4);
      y += 18;
      doc.rect(M, y, W - M * 2, 1).fill("#E5E7EB");
      y += 4;
      doc.fillColor(TEXTO).fontSize(7).font("Helvetica").text(configCarta.textoCriterios, M + 5, y, { width: W - M * 2 - 10, lineGap: 2 });
      y = doc.y + 8;
    }

    // Assinatura
    const assinY = Math.max(y + 10, doc.page.height - 80);
    doc.moveTo(M, assinY).lineTo(M + 180, assinY).stroke("#9CA3AF");
    doc.fillColor(TEXTO_C).fontSize(8).font("Helvetica").text("Assinado por:", M, assinY + 5);

    // Rodapé
    doc.rect(0, doc.page.height - 28, W, 28).fill(AZUL);
    doc.fillColor("white").fontSize(7).font("Helvetica").text(`ICP ${ciclo.anoFiscal}  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`, M, doc.page.height - 18);
  }

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.end();
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const nome = colaboradorId ? `carta-icp-colab${colaboradorId}` : `cartas-icp-${ciclo.anoFiscal}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}.pdf"`,
    },
  });
}

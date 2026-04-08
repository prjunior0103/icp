import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");
    if (!cicloId) {
      return NextResponse.json({ error: "cicloId obrigatorio" }, { status: 400 });
    }

    const cId = Number(cicloId);
    const now = new Date();
    const mesMes = now.getMonth() + 1;
    const anoAtual = now.getFullYear();

    // Run independent queries in parallel
    const [
      totalColaboradores,
      totalMetasAtivas,
      workflowPendente,
      ciclo,
      realizacoesCiclo,
      realizacoesMes,
      janelaAtual,
      centrosCusto,
    ] = await Promise.all([
      prisma.colaborador.count({ where: { ativo: true } }),
      prisma.meta.count({ where: { cicloId: cId, status: "APROVADO" } }),
      prisma.workflowItem.count({ where: { status: "PENDENTE" } }),
      prisma.cicloICP.findUnique({ where: { id: cId } }),
      prisma.realizacao.findMany({
        where: { meta: { cicloId: cId } },
        select: { premioProjetado: true, colaboradorId: true },
      }),
      prisma.realizacao.count({
        where: { mesReferencia: mesMes, anoReferencia: anoAtual, meta: { cicloId: cId } },
      }),
      prisma.janelaApuracao.findFirst({
        where: {
          cicloId: cId,
          mesReferencia: mesMes,
          anoReferencia: anoAtual,
          status: { in: ["ABERTA", "PRORROGADA"] },
        },
      }),
      prisma.centroCusto.findMany({ select: { id: true, nome: true } }),
    ]);

    const bonusPoolUsado = realizacoesCiclo.reduce(
      (sum, r) => sum + (r.premioProjetado ?? 0),
      0
    );

    // Alertas: centros de custo with no realizacoes in last 2 months
    const mesAnterior = mesMes === 1 ? 12 : mesMes - 1;
    const anoAnterior = mesMes === 1 ? anoAtual - 1 : anoAtual;

    const ccComRealizacoes = await prisma.realizacao.findMany({
      where: {
        meta: { cicloId: cId },
        OR: [
          { mesReferencia: mesMes, anoReferencia: anoAtual },
          { mesReferencia: mesAnterior, anoReferencia: anoAnterior },
        ],
      },
      select: { meta: { select: { centroCustoId: true } } },
    });

    const ccComAtividade = new Set(
      ccComRealizacoes.map((r) => r.meta.centroCustoId).filter(Boolean)
    );

    const alertasEngajamento = centrosCusto
      .filter((cc) => !ccComAtividade.has(cc.id))
      .map((cc) => cc.nome);

    // Top 5 colaboradores by premioProjetado
    const premiosPorColab: Record<
      number,
      { premioYTD: number; notaTotal: number; count: number }
    > = {};
    for (const r of realizacoesCiclo) {
      if (r.colaboradorId) {
        if (!premiosPorColab[r.colaboradorId]) {
          premiosPorColab[r.colaboradorId] = { premioYTD: 0, notaTotal: 0, count: 0 };
        }
        premiosPorColab[r.colaboradorId].premioYTD += r.premioProjetado ?? 0;
      }
    }

    const topIds = Object.entries(premiosPorColab)
      .sort((a, b) => b[1].premioYTD - a[1].premioYTD)
      .slice(0, 5)
      .map(([id]) => Number(id));

    const topColaboradoresData = await prisma.colaborador.findMany({
      where: { id: { in: topIds } },
      select: {
        id: true,
        nomeCompleto: true,
        cargo: { select: { nome: true } },
        realizacoes: {
          where: { meta: { cicloId: cId } },
          select: { notaCalculada: true, premioProjetado: true },
        },
      },
    });

    const topColaboradores = topColaboradoresData
      .map((c) => {
        const notas = c.realizacoes.map((r) => r.notaCalculada ?? 0);
        const notaMedia = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
        const premioYTD = c.realizacoes.reduce((s, r) => s + (r.premioProjetado ?? 0), 0);
        return { id: c.id, nome: c.nomeCompleto, cargo: c.cargo.nome, notaMedia, premioYTD };
      })
      .sort((a, b) => b.premioYTD - a.premioYTD);

    const janelaAtualWithOpen = janelaAtual
      ? {
          ...janelaAtual,
          isOpen:
            (janelaAtual.status === "ABERTA" || janelaAtual.status === "PRORROGADA") &&
            now >= janelaAtual.dataAbertura &&
            now <= janelaAtual.dataFechamento,
        }
      : null;

    return NextResponse.json({
      data: {
        totalColaboradores,
        totalMetasAtivas,
        workflowPendente,
        bonusPoolUsado,
        bonusPoolTotal: ciclo?.bonusPool ?? null,
        alertasEngajamento,
        topColaboradores,
        realizacoesMes,
        janelaAtual: janelaAtualWithOpen,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

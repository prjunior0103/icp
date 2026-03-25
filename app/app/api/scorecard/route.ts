import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const colaboradorId = searchParams.get("colaboradorId");
    const cicloId = searchParams.get("cicloId");

    if (!colaboradorId || !cicloId) {
      return NextResponse.json(
        { error: "colaboradorId e cicloId sao obrigatorios" },
        { status: 400 }
      );
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { id: Number(colaboradorId) },
      include: { cargo: true, centroCusto: true, empresa: true },
    });
    if (!colaborador) {
      return NextResponse.json({ error: "Colaborador nao encontrado" }, { status: 404 });
    }

    // Fetch MetaColaborador records for this colaborador in this ciclo
    const metaColabs = await prisma.metaColaborador.findMany({
      where: {
        colaboradorId: Number(colaboradorId),
        ativo: true,
        meta: { cicloId: Number(cicloId) },
      },
      include: {
        meta: {
          include: {
            indicador: true,
            centroCusto: true,
          },
        },
      },
    });

    const metaIds = metaColabs.map((mc) => mc.metaId);

    // Fetch all realizacoes for this colaborador for these metas
    const realizacoes = await prisma.realizacao.findMany({
      where: {
        metaId: { in: metaIds },
        OR: [
          { colaboradorId: Number(colaboradorId) },
          { colaboradorId: null },
        ],
      },
      orderBy: [{ anoReferencia: "asc" }, { mesReferencia: "asc" }],
    });

    // Build scorecard per meta
    let totalPeso = 0;
    let notaPonderada = 0;
    let premioYTD = 0;

    const metasScorecard = metaColabs.map((mc) => {
      const meta = mc.meta;
      const pesoEfetivo = mc.pesoPersonalizado ?? meta.pesoNaCesta;
      const metaRealizacoes = realizacoes.filter((r) => r.metaId === meta.id);

      const notas = metaRealizacoes
        .filter((r) => r.notaCalculada !== null)
        .map((r) => r.notaCalculada as number);

      const notaMedia = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;

      const premioMetaYTD = metaRealizacoes.reduce(
        (sum, r) => sum + (r.premioProjetado ?? 0),
        0
      );

      totalPeso += pesoEfetivo;
      notaPonderada += notaMedia * pesoEfetivo;
      premioYTD += premioMetaYTD;

      return {
        meta: {
          id: meta.id,
          pesoNaCesta: pesoEfetivo,
          metaAlvo: meta.metaAlvo,
          metaMinima: meta.metaMinima,
          metaMaxima: meta.metaMaxima,
          status: meta.status,
          centroCusto: meta.centroCusto,
        },
        indicador: meta.indicador,
        realizacoes: metaRealizacoes,
        notaMedia,
        premioProjetado: premioMetaYTD,
      };
    });

    const notaYTD = totalPeso > 0 ? notaPonderada / totalPeso : 0;

    // Target anual
    const targetAnual =
      colaborador.salarioBase * 12 * (colaborador.cargo.targetBonusPerc / 100);

    return NextResponse.json({
      data: {
        colaborador,
        cargo: colaborador.cargo,
        metas: metasScorecard,
        notaYTD,
        premioYTD,
        targetAnual,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

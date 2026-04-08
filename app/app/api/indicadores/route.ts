import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");

    const indicadores = await prisma.indicador.findMany({
      where: cicloId ? { cicloId: Number(cicloId) } : undefined,
      include: {
        ciclo: true,
        metas: { select: { id: true } },
        divisor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    const result = indicadores.map((i) => ({
      ...i,
      _count: { metas: i.metas.length },
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const indicador = await prisma.indicador.create({
      data: {
        codigo: body.codigo,
        nome: body.nome,
        descricao: body.descricao,
        tipo: body.tipo,
        polaridade: body.polaridade ?? "MAIOR_MELHOR",
        abrangencia: body.abrangencia,
        unidade: body.unidade ?? "%",
        diretivo: body.diretivo ?? null,
        analistaResp: body.analistaResp ?? null,
        origemDado: body.origemDado ?? null,
        divisorId: body.divisorId ? Number(body.divisorId) : null,
        baseline: body.baseline ? Number(body.baseline) : undefined,
        metrica: body.metrica ?? null,
        periodicidade: body.periodicidade ?? null,
        perspectiva: body.perspectiva ?? null,
        tipoIndicador: body.tipoIndicador ?? null,
        auditorDados: body.auditorDados ?? null,
        metaMinima: body.metaMinima ? Number(body.metaMinima) : undefined,
        metaAlvo: body.metaAlvo ? Number(body.metaAlvo) : undefined,
        metaMaxima: body.metaMaxima ? Number(body.metaMaxima) : undefined,
        cicloId: Number(body.cicloId),
        status: body.status ?? "DRAFT",
      },
    });
    return NextResponse.json({ data: indicador }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const indicador = await prisma.indicador.update({
      where: { id: Number(id) },
      data: {
        ...data,
        metaMinima: data.metaMinima !== undefined ? Number(data.metaMinima) : undefined,
        metaAlvo: data.metaAlvo !== undefined ? Number(data.metaAlvo) : undefined,
        metaMaxima: data.metaMaxima !== undefined ? Number(data.metaMaxima) : undefined,
        cicloId: data.cicloId ? Number(data.cicloId) : undefined,
      },
    });
    return NextResponse.json({ data: indicador });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const indId = Number(id);

    // Excluir dependências das metas vinculadas ao indicador
    const metas = await prisma.meta.findMany({ where: { indicadorId: indId }, select: { id: true } });
    for (const meta of metas) {
      await prisma.meta.updateMany({ where: { parentMetaId: meta.id }, data: { parentMetaId: null } });
      await prisma.metaHistorico.deleteMany({ where: { metaId: meta.id } });
      await prisma.metaColaborador.deleteMany({ where: { metaId: meta.id } });
      await prisma.realizacao.deleteMany({ where: { metaId: meta.id } });
      await prisma.workflowItem.deleteMany({ where: { metaId: meta.id } });
      await prisma.planoAcao.deleteMany({ where: { metaId: meta.id } });
      await prisma.agrupamentoMeta.deleteMany({ where: { metaId: meta.id } });
    }
    await prisma.meta.deleteMany({ where: { indicadorId: indId } });

    // Desvincula indicadores que usam este como divisor
    await prisma.indicador.updateMany({ where: { divisorId: indId }, data: { divisorId: null } });

    await prisma.indicador.delete({ where: { id: indId } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

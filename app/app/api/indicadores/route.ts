import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");

    const indicadores = await prisma.indicador.findMany({
      where: cicloId ? { cicloId: Number(cicloId) } : undefined,
      include: {
        ciclo: true,
        metas: { select: { id: true } },
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
        abrangencia: body.abrangencia,
        unidade: body.unidade ?? "%",
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

    await prisma.indicador.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

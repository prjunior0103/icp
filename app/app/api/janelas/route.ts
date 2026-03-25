import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
export { isJanelaAberta } from "@/app/lib/janelas";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");
    if (!cicloId) {
      return NextResponse.json({ error: "cicloId obrigatorio" }, { status: 400 });
    }

    const janelas = await prisma.janelaApuracao.findMany({
      where: { cicloId: Number(cicloId) },
      include: { prorrogacoes: { select: { id: true, status: true } } },
      orderBy: [{ anoReferencia: "asc" }, { mesReferencia: "asc" }],
    });

    const now = new Date();
    const result = janelas.map((j) => ({
      ...j,
      isOpen:
        (j.status === "ABERTA" || j.status === "PRORROGADA") &&
        now >= j.dataAbertura &&
        now <= j.dataFechamento,
      waiversPendentes: j.prorrogacoes.filter((p) => p.status === "PENDENTE").length,
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cicloId, mesReferencia, anoReferencia, dataAbertura, dataFechamento } = body;
    if (!cicloId || !mesReferencia || !anoReferencia || !dataAbertura || !dataFechamento) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    const janela = await prisma.janelaApuracao.create({
      data: {
        cicloId: Number(cicloId),
        mesReferencia: Number(mesReferencia),
        anoReferencia: Number(anoReferencia),
        dataAbertura: new Date(dataAbertura),
        dataFechamento: new Date(dataFechamento),
        status: "ABERTA",
      },
    });

    return NextResponse.json({ data: janela }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    if (!status || !["ABERTA", "FECHADA", "PRORROGADA"].includes(status)) {
      return NextResponse.json(
        { error: "status deve ser ABERTA, FECHADA ou PRORROGADA" },
        { status: 400 }
      );
    }

    const janela = await prisma.janelaApuracao.update({
      where: { id: Number(id) },
      data: { status },
    });

    return NextResponse.json({ data: janela });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

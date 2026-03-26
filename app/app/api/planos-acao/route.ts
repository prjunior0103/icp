import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metaId = searchParams.get("metaId");
    const planos = await prisma.planoAcao.findMany({
      where: metaId ? { metaId: Number(metaId) } : undefined,
      orderBy: { criadoEm: "desc" },
    });
    return NextResponse.json({ data: planos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plano = await prisma.planoAcao.create({
      data: {
        metaId: Number(body.metaId),
        descricao: body.descricao,
        responsavel: body.responsavel ?? null,
        prazo: body.prazo ? new Date(body.prazo) : null,
        status: body.status ?? "ABERTO",
      },
    });
    return NextResponse.json({ data: plano }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const plano = await prisma.planoAcao.update({
      where: { id: Number(id) },
      data: {
        ...data,
        prazo: data.prazo ? new Date(data.prazo) : undefined,
      },
    });
    return NextResponse.json({ data: plano });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    await prisma.planoAcao.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const centros = await prisma.centroCusto.findMany({
      include: {
        empresa: { select: { id: true, nome: true, codigo: true } },
        _count: { select: { colaboradores: true, metas: true } },
      },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json({ data: centros });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cc = await prisma.centroCusto.create({
      data: {
        codigo: body.codigo,
        nome: body.nome,
        nivel: Number(body.nivel ?? 1),
        empresaId: Number(body.empresaId),
      },
      include: { empresa: { select: { id: true, nome: true, codigo: true } } },
    });
    return NextResponse.json({ data: cc }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const cc = await prisma.centroCusto.update({
      where: { id: Number(id) },
      data: {
        ...data,
        nivel: data.nivel !== undefined ? Number(data.nivel) : undefined,
        empresaId: data.empresaId !== undefined ? Number(data.empresaId) : undefined,
      },
      include: { empresa: { select: { id: true, nome: true, codigo: true } } },
    });
    return NextResponse.json({ data: cc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    await prisma.centroCusto.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

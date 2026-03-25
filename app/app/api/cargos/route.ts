import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const cargos = await prisma.cargo.findMany({
      include: { _count: { select: { colaboradores: true } } },
      orderBy: { nome: "asc" },
    });
    return NextResponse.json({ data: cargos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cargo = await prisma.cargo.create({
      data: {
        codigo: body.codigo,
        nome: body.nome,
        nivelHierarquico: body.nivelHierarquico ?? "N4",
        targetBonusPerc: Number(body.targetBonusPerc ?? 0),
        salarioTeto: body.salarioTeto ? Number(body.salarioTeto) : undefined,
      },
    });
    return NextResponse.json({ data: cargo }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const cargo = await prisma.cargo.update({
      where: { id: Number(id) },
      data: {
        ...data,
        targetBonusPerc: data.targetBonusPerc !== undefined ? Number(data.targetBonusPerc) : undefined,
        salarioTeto: data.salarioTeto !== undefined ? (data.salarioTeto ? Number(data.salarioTeto) : null) : undefined,
      },
    });
    return NextResponse.json({ data: cargo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    await prisma.cargo.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const colaboradores = await prisma.colaborador.findMany({
      include: {
        cargo: true,
        centroCusto: true,
        empresa: true,
      },
      orderBy: { nomeCompleto: "asc" },
    });
    return NextResponse.json({ data: colaboradores });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const colaborador = await prisma.colaborador.create({
      data: {
        matricula: body.matricula,
        nomeCompleto: body.nomeCompleto,
        cpf: body.cpf,
        email: body.email,
        salarioBase: Number(body.salarioBase),
        dataAdmissao: new Date(body.dataAdmissao),
        empresaId: Number(body.empresaId),
        cargoId: Number(body.cargoId),
        centroCustoId: Number(body.centroCustoId),
        gestorId: body.gestorId ? Number(body.gestorId) : undefined,
      },
      include: { cargo: true, centroCusto: true, empresa: true },
    });
    return NextResponse.json({ data: colaborador }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const colaborador = await prisma.colaborador.update({
      where: { id: Number(id) },
      data: {
        ...data,
        salarioBase: data.salarioBase ? Number(data.salarioBase) : undefined,
        cargoId: data.cargoId ? Number(data.cargoId) : undefined,
        centroCustoId: data.centroCustoId ? Number(data.centroCustoId) : undefined,
        empresaId: data.empresaId ? Number(data.empresaId) : undefined,
        dataAdmissao: data.dataAdmissao ? new Date(data.dataAdmissao) : undefined,
        dataDesligamento: data.dataDesligamento ? new Date(data.dataDesligamento) : undefined,
      },
      include: { cargo: true, centroCusto: true, empresa: true },
    });
    return NextResponse.json({ data: colaborador });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await prisma.colaborador.update({
      where: { id: Number(id) },
      data: { ativo: false, dataDesligamento: new Date() },
    });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });
  const agrupamentos = await prisma.agrupamento.findMany({
    where: { cicloId: Number(cicloId) },
    include: { indicadores: { include: { indicador: true } } },
    orderBy: { nome: "asc" },
  });
  return NextResponse.json({ agrupamentos });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { cicloId, nome, tipo, peso, descricao } = await req.json();
  if (!cicloId || !nome) return NextResponse.json({ error: "cicloId e nome obrigatórios" }, { status: 400 });
  const agrupamento = await prisma.agrupamento.create({
    data: { cicloId: Number(cicloId), nome, tipo: tipo ?? "CORPORATIVO", peso: peso != null ? Number(peso) : 0, descricao: descricao || null },
    include: { indicadores: { include: { indicador: true } } },
  });
  return NextResponse.json({ agrupamento }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, nome, tipo, peso, descricao, indicadores } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await prisma.agrupamento.update({
    where: { id: Number(id) },
    data: { ...(nome && { nome }), ...(tipo && { tipo }), ...(peso != null && { peso: Number(peso) }), descricao: descricao ?? null },
  });
  // Sync indicadores se fornecido
  if (indicadores !== undefined) {
    await prisma.indicadorNoAgrupamento.deleteMany({ where: { agrupamentoId: Number(id) } });
    if (indicadores.length > 0) {
      await prisma.indicadorNoAgrupamento.createMany({
        data: indicadores.map((i: { indicadorId: number; peso: number }) => ({
          agrupamentoId: Number(id), indicadorId: Number(i.indicadorId), peso: Number(i.peso),
        })),
      });
    }
  }
  const agrupamento = await prisma.agrupamento.findUnique({
    where: { id: Number(id) },
    include: { indicadores: { include: { indicador: true } } },
  });
  return NextResponse.json({ agrupamento });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await prisma.agrupamento.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

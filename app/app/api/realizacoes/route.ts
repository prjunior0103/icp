import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  const indicadorId = searchParams.get("indicadorId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });
  const where: Record<string, unknown> = { cicloId: Number(cicloId) };
  if (indicadorId) where.indicadorId = Number(indicadorId);
  const realizacoes = await prisma.realizacao.findMany({
    where,
    include: { indicador: true },
    orderBy: [{ indicadorId: "asc" }, { periodo: "asc" }],
  });
  return NextResponse.json({ realizacoes });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { cicloId, indicadorId, periodo, valorRealizado, lancadoPor } = await req.json();
  if (!cicloId || !indicadorId || !periodo || valorRealizado == null)
    return NextResponse.json({ error: "cicloId, indicadorId, periodo e valorRealizado são obrigatórios" }, { status: 400 });
  const realizacao = await prisma.realizacao.upsert({
    where: { indicadorId_periodo: { indicadorId: Number(indicadorId), periodo } },
    update: { valorRealizado: Number(valorRealizado), lancadoPor: lancadoPor || null },
    create: { cicloId: Number(cicloId), indicadorId: Number(indicadorId), periodo, valorRealizado: Number(valorRealizado), lancadoPor: lancadoPor || null },
  });
  return NextResponse.json({ realizacao }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await prisma.realizacao.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

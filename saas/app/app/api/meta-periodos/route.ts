import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

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
  const metasPeriodo = await prisma.metaPeriodo.findMany({
    where,
    orderBy: [{ indicadorId: "asc" }, { periodo: "asc" }],
  });
  return NextResponse.json({ metasPeriodo });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { cicloId, indicadorId, periodo, valorOrcado } = await req.json();
  if (!cicloId || !indicadorId || !periodo || valorOrcado == null)
    return NextResponse.json({ error: "cicloId, indicadorId, periodo e valorOrcado são obrigatórios" }, { status: 400 });
  const metaPeriodo = await prisma.metaPeriodo.upsert({
    where: { indicadorId_periodo: { indicadorId: Number(indicadorId), periodo } },
    update: { valorOrcado: Number(valorOrcado) },
    create: { cicloId: Number(cicloId), indicadorId: Number(indicadorId), periodo, valorOrcado: Number(valorOrcado) },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "MetaPeriodo", entidadeId: metaPeriodo.id, descricao: `Meta período indicadorId ${indicadorId} — ${periodo}: ${valorOrcado}` });

  return NextResponse.json({ metaPeriodo }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const meta = await prisma.metaPeriodo.findUnique({ where: { id: Number(id) } });
  await prisma.metaPeriodo.delete({ where: { id: Number(id) } });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "MetaPeriodo", entidadeId: id, descricao: `Meta período #${id} excluída`, dadosAntigos: meta });

  return NextResponse.json({ ok: true });
}

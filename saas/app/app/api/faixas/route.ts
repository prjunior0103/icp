import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const indicadorId = searchParams.get("indicadorId");
  if (!indicadorId) return NextResponse.json({ error: "indicadorId obrigatório" }, { status: 400 });
  const faixas = await prisma.faixaIndicador.findMany({
    where: { indicadorId: Number(indicadorId) },
    orderBy: { de: "asc" },
  });
  return NextResponse.json({ faixas });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  // Aceita array (sync completo) ou objeto único
  if (Array.isArray(body)) {
    const { indicadorId } = body[0] ?? {};
    if (!indicadorId) return NextResponse.json({ error: "indicadorId obrigatório" }, { status: 400 });
    await prisma.faixaIndicador.deleteMany({ where: { indicadorId: Number(indicadorId) } });
    if (body.length > 0) {
      await prisma.faixaIndicador.createMany({
        data: body.map((f: { indicadorId: number; de: number; ate: number; nota: number }) => ({
          indicadorId: Number(f.indicadorId), de: Number(f.de), ate: Number(f.ate), nota: Number(f.nota),
        })),
      });
    }
    const faixas = await prisma.faixaIndicador.findMany({ where: { indicadorId: Number(indicadorId) }, orderBy: { de: "asc" } });

    const { userId, userName } = getAuditUser(session);
    await logAudit({ userId, userName, acao: "EDITAR", entidade: "FaixaIndicador", entidadeId: String(indicadorId), descricao: `Faixas do indicadorId ${indicadorId} sincronizadas (${body.length} faixas)` });

    return NextResponse.json({ faixas }, { status: 201 });
  }
  const { indicadorId, de, ate, nota } = body;
  if (!indicadorId || de == null || ate == null || nota == null)
    return NextResponse.json({ error: "indicadorId, de, ate e nota são obrigatórios" }, { status: 400 });
  const faixa = await prisma.faixaIndicador.create({ data: { indicadorId: Number(indicadorId), de: Number(de), ate: Number(ate), nota: Number(nota) } });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "FaixaIndicador", entidadeId: faixa.id, descricao: `Faixa criada para indicadorId ${indicadorId}: de ${de} até ${ate}` });

  return NextResponse.json({ faixa }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const indicadorId = searchParams.get("indicadorId");
  if (id) {
    await prisma.faixaIndicador.delete({ where: { id: Number(id) } });
    const { userId, userName } = getAuditUser(session);
    await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "FaixaIndicador", entidadeId: id, descricao: `Faixa #${id} excluída` });
  } else if (indicadorId) {
    await prisma.faixaIndicador.deleteMany({ where: { indicadorId: Number(indicadorId) } });
    const { userId, userName } = getAuditUser(session);
    await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "FaixaIndicador", entidadeId: indicadorId, descricao: `Todas as faixas do indicadorId ${indicadorId} excluídas` });
  } else {
    return NextResponse.json({ error: "id ou indicadorId obrigatório" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

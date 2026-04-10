import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [ciclos, params] = await Promise.all([
    prisma.cicloICP.findMany({ orderBy: { anoFiscal: "desc" } }),
    prisma.parametroSistema.findUnique({ where: { id: 1 } }),
  ]);

  const ativo = params?.cicloAtivoId
    ? (ciclos.find((c) => c.id === params.cicloAtivoId) ?? null)
    : (ciclos.find((c) => c.status === "ATIVO") ?? null);

  return NextResponse.json({ ciclos, ativo });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { anoFiscal, mesInicio = 1, mesFim = 12, bonusPool } = body;

  if (!anoFiscal || typeof anoFiscal !== "number") {
    return NextResponse.json({ error: "anoFiscal obrigatório" }, { status: 400 });
  }

  const ciclo = await prisma.cicloICP.create({
    data: { anoFiscal, mesInicio, mesFim, bonusPool: bonusPool ?? null },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "Ciclo", entidadeId: ciclo.id, descricao: `Ciclo ${anoFiscal} criado`, dadosNovos: ciclo });

  return NextResponse.json({ ciclo }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const ciclo = await prisma.cicloICP.findUnique({ where: { id: Number(id) } });
  await prisma.cicloICP.delete({ where: { id: Number(id) } });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "Ciclo", entidadeId: id, descricao: `Ciclo ${ciclo?.anoFiscal ?? id} excluído`, dadosAntigos: ciclo });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { id, anoFiscal, status, mesInicio, mesFim, bonusPool } = body;

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const anterior = await prisma.cicloICP.findUnique({ where: { id: Number(id) } });
  const ciclo = await prisma.cicloICP.update({
    where: { id: Number(id) },
    data: {
      ...(anoFiscal !== undefined && { anoFiscal: Number(anoFiscal) }),
      ...(status && { status }),
      ...(mesInicio !== undefined && { mesInicio: Number(mesInicio) }),
      ...(mesFim !== undefined && { mesFim: Number(mesFim) }),
      ...(bonusPool !== undefined && { bonusPool: bonusPool ? Number(bonusPool) : null }),
    },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EDITAR", entidade: "Ciclo", entidadeId: id, descricao: `Ciclo ${ciclo.anoFiscal} editado`, dadosAntigos: anterior, dadosNovos: ciclo });

  return NextResponse.json({ ciclo });
}

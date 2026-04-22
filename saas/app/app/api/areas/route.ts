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
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const areas = await prisma.area.findMany({
    where: { cicloId: Number(cicloId) },
    orderBy: { nivel1: "asc" },
  });

  return NextResponse.json({ areas });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { cicloId, centroCusto, codEmpresa, nivel1, nivel2, nivel3, nivel4, nivel5 } = body;

  if (!cicloId || !centroCusto || !codEmpresa || !nivel1) {
    return NextResponse.json({ error: "cicloId, centroCusto, codEmpresa e nivel1 são obrigatórios" }, { status: 400 });
  }

  const area = await prisma.area.create({
    data: { cicloId: Number(cicloId), centroCusto, codEmpresa, nivel1, nivel2, nivel3, nivel4, nivel5 },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "Area", entidadeId: area.id, descricao: `Área ${nivel1} (CC: ${centroCusto}) criada`, dadosNovos: area });

  return NextResponse.json({ area }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, centroCusto, codEmpresa, nivel1, nivel2, nivel3, nivel4, nivel5 } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const anterior = await prisma.area.findUnique({ where: { id: Number(id) } });
  const area = await prisma.area.update({
    where: { id: Number(id) },
    data: {
      ...(centroCusto !== undefined && { centroCusto }),
      ...(codEmpresa !== undefined && { codEmpresa }),
      ...(nivel1 !== undefined && { nivel1 }),
      nivel2: nivel2 ?? null,
      nivel3: nivel3 ?? null,
      nivel4: nivel4 ?? null,
      nivel5: nivel5 ?? null,
    },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EDITAR", entidade: "Area", entidadeId: id, descricao: `Área ${area.nivel1} editada`, dadosAntigos: anterior, dadosNovos: area });

  return NextResponse.json({ area });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const area = await prisma.area.findUnique({ where: { id: Number(id) } });
  await prisma.area.delete({ where: { id: Number(id) } });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "Area", entidadeId: id, descricao: `Área ${area?.nivel1 ?? id} excluída`, dadosAntigos: area });

  return NextResponse.json({ ok: true });
}

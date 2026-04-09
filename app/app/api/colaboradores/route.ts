import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  const busca = searchParams.get("busca") ?? "";

  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const colaboradores = await prisma.colaborador.findMany({
    where: {
      cicloId: Number(cicloId),
      ...(busca && {
        OR: [
          { nome: { contains: busca } },
          { matricula: { contains: busca } },
        ],
      }),
    },
    include: { area: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json({ colaboradores });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    cicloId, areaId, nome, email, matricula, cargo, grade,
    salarioBase, target, centroCusto, codEmpresa, admissao,
    gestorId, matriculaGestor, nomeGestor, status,
  } = body;

  if (!cicloId || !nome || !matricula || !cargo || salarioBase == null || target == null) {
    return NextResponse.json({ error: "cicloId, nome, matricula, cargo, salarioBase e target são obrigatórios" }, { status: 400 });
  }

  const colaborador = await prisma.colaborador.create({
    data: {
      cicloId: Number(cicloId),
      areaId: areaId ? Number(areaId) : null,
      nome, email: email || null, matricula, cargo,
      grade: grade || null,
      salarioBase: Number(salarioBase),
      target: Number(target),
      centroCusto: centroCusto || null,
      codEmpresa: codEmpresa || null,
      admissao: admissao ? new Date(admissao) : null,
      gestorId: gestorId ? Number(gestorId) : null,
      matriculaGestor: matriculaGestor || null,
      nomeGestor: nomeGestor || null,
      status: status ?? "ATIVO",
    },
    include: { area: true },
  });

  return NextResponse.json({ colaborador }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    id, areaId, nome, email, matricula, cargo, grade,
    salarioBase, target, centroCusto, codEmpresa, admissao,
    gestorId, matriculaGestor, nomeGestor, status,
  } = body;

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const colaborador = await prisma.colaborador.update({
    where: { id: Number(id) },
    data: {
      areaId: areaId !== undefined ? (areaId ? Number(areaId) : null) : undefined,
      ...(nome !== undefined && { nome }),
      email: email !== undefined ? (email || null) : undefined,
      ...(matricula !== undefined && { matricula }),
      ...(cargo !== undefined && { cargo }),
      grade: grade !== undefined ? (grade || null) : undefined,
      ...(salarioBase !== undefined && { salarioBase: Number(salarioBase) }),
      ...(target !== undefined && { target: Number(target) }),
      centroCusto: centroCusto !== undefined ? (centroCusto || null) : undefined,
      codEmpresa: codEmpresa !== undefined ? (codEmpresa || null) : undefined,
      admissao: admissao !== undefined ? (admissao ? new Date(admissao) : null) : undefined,
      gestorId: gestorId !== undefined ? (gestorId ? Number(gestorId) : null) : undefined,
      matriculaGestor: matriculaGestor !== undefined ? (matriculaGestor || null) : undefined,
      nomeGestor: nomeGestor !== undefined ? (nomeGestor || null) : undefined,
      ...(status !== undefined && { status }),
    },
    include: { area: true },
  });

  return NextResponse.json({ colaborador });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  await prisma.colaborador.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

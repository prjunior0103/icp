import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

const CAMPOS_DISPONIVEIS = [
  { key: "centroCusto", label: "Centro de Custo" },
  { key: "matriculaGestor", label: "Gestor (Matrícula)" },
  { key: "cargo", label: "Cargo" },
  { key: "grade", label: "Grade" },
  { key: "codEmpresa", label: "Cód. Empresa" },
  { key: "status", label: "Status" },
];

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const config = await prisma.configMovimentacao.findFirst({
    where: { cicloId: Number(cicloId) },
  });

  const camposSelecionados = config?.campos?.split(",").filter(Boolean) ?? ["centroCusto", "matriculaGestor"];

  return NextResponse.json({ camposDisponiveis: CAMPOS_DISPONIVEIS, camposSelecionados });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { cicloId, campos } = body as { cicloId: number; campos: string[] };

  if (!cicloId || !campos || campos.length === 0) {
    return NextResponse.json({ error: "cicloId e campos obrigatórios" }, { status: 400 });
  }

  const validKeys = CAMPOS_DISPONIVEIS.map((c) => c.key);
  const filtered = campos.filter((c) => validKeys.includes(c));
  if (filtered.length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido" }, { status: 400 });
  }

  const existing = await prisma.configMovimentacao.findFirst({
    where: { cicloId },
  });

  if (existing) {
    await prisma.configMovimentacao.update({
      where: { id: existing.id },
      data: { campos: filtered.join(",") },
    });
  } else {
    await prisma.configMovimentacao.create({
      data: { cicloId, campos: filtered.join(",") },
    });
  }

  return NextResponse.json({ ok: true, campos: filtered });
}

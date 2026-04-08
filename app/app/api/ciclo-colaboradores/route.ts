import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/ciclo-colaboradores?cicloId=X
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");
    if (!cicloId) return NextResponse.json({ error: "cicloId obrigatorio" }, { status: 400 });

    const snapshots = await prisma.cicloColaborador.findMany({
      where: { cicloId: Number(cicloId) },
      include: {
        colaborador: { select: { id: true, matricula: true, nomeCompleto: true, email: true } },
        cargo: true,
        centroCusto: true,
        empresa: { select: { id: true, codigo: true, nome: true } },
      },
      orderBy: { colaborador: { nomeCompleto: "asc" } },
    });

    return NextResponse.json({ data: snapshots });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/ciclo-colaboradores
// Body: { cicloId } → sync all active colaboradores as snapshot (upsert)
// Body: { cicloId, colaboradorId, salarioBase, cargoId, targetMultiploSalarial, centroCustoId, empresaId } → upsert single
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cicloId = Number(body.cicloId);
    if (!cicloId) return NextResponse.json({ error: "cicloId obrigatorio" }, { status: 400 });

    // Single entry upsert
    if (body.colaboradorId) {
      const snap = await prisma.cicloColaborador.upsert({
        where: { cicloId_colaboradorId: { cicloId, colaboradorId: Number(body.colaboradorId) } },
        update: {
          salarioBase: Number(body.salarioBase),
          cargoId: Number(body.cargoId),
          targetMultiploSalarial: Number(body.targetMultiploSalarial),
          centroCustoId: Number(body.centroCustoId),
          empresaId: Number(body.empresaId),
          ativo: body.ativo ?? true,
        },
        create: {
          cicloId,
          colaboradorId: Number(body.colaboradorId),
          salarioBase: Number(body.salarioBase),
          cargoId: Number(body.cargoId),
          targetMultiploSalarial: Number(body.targetMultiploSalarial),
          centroCustoId: Number(body.centroCustoId),
          empresaId: Number(body.empresaId),
          ativo: body.ativo ?? true,
        },
        include: { colaborador: true, cargo: true },
      });
      return NextResponse.json({ data: snap }, { status: 201 });
    }

    // Bulk sync — snapshot all active colaboradores
    const colaboradores = await prisma.colaborador.findMany({
      where: { ativo: true },
      include: { cargo: true },
    });

    let synced = 0;
    for (const col of colaboradores) {
      await prisma.cicloColaborador.upsert({
        where: { cicloId_colaboradorId: { cicloId, colaboradorId: col.id } },
        update: {
          salarioBase: col.salarioBase,
          cargoId: col.cargoId,
          targetMultiploSalarial: col.cargo.targetMultiploSalarial,
          centroCustoId: col.centroCustoId,
          empresaId: col.empresaId,
          ativo: true,
        },
        create: {
          cicloId,
          colaboradorId: col.id,
          salarioBase: col.salarioBase,
          cargoId: col.cargoId,
          targetMultiploSalarial: col.cargo.targetMultiploSalarial,
          centroCustoId: col.centroCustoId,
          empresaId: col.empresaId,
          ativo: true,
        },
      });
      synced++;
    }

    return NextResponse.json({ data: { synced } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/ciclo-colaboradores — update single snapshot entry
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const snap = await prisma.cicloColaborador.update({
      where: { id: Number(id) },
      data: {
        salarioBase: data.salarioBase !== undefined ? Number(data.salarioBase) : undefined,
        cargoId: data.cargoId ? Number(data.cargoId) : undefined,
        targetMultiploSalarial: data.targetMultiploSalarial !== undefined ? Number(data.targetMultiploSalarial) : undefined,
        centroCustoId: data.centroCustoId ? Number(data.centroCustoId) : undefined,
        empresaId: data.empresaId ? Number(data.empresaId) : undefined,
        ativo: data.ativo,
      },
      include: { colaborador: true, cargo: true },
    });
    return NextResponse.json({ data: snap });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

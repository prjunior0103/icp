import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");

    const metas = await prisma.meta.findMany({
      where: cicloId ? { cicloId: Number(cicloId) } : undefined,
      include: {
        indicador: true,
        centroCusto: true,
        ciclo: true,
        colaboradores: { select: { id: true } },
        realizacoes: { select: { id: true } },
      },
      orderBy: { id: "asc" },
    });

    const result = metas.map((m) => ({
      ...m,
      _count: {
        colaboradores: m.colaboradores.length,
        realizacoes: m.realizacoes.length,
      },
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const meta = await prisma.meta.create({
      data: {
        indicadorId: Number(body.indicadorId),
        cicloId: Number(body.cicloId),
        centroCustoId: body.centroCustoId ? Number(body.centroCustoId) : undefined,
        pesoNaCesta: Number(body.pesoNaCesta ?? 100),
        metaMinima: body.metaMinima ? Number(body.metaMinima) : undefined,
        metaAlvo: Number(body.metaAlvo ?? 100),
        metaMaxima: body.metaMaxima ? Number(body.metaMaxima) : undefined,
        status: body.status ?? "DRAFT",
      },
      include: { indicador: true, centroCusto: true },
    });
    return NextResponse.json({ data: meta }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, comentario, atribuirColaboradorId, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    // Assign collaborator to meta
    if (atribuirColaboradorId) {
      await prisma.metaColaborador.upsert({
        where: { metaId_colaboradorId: { metaId: Number(id), colaboradorId: Number(atribuirColaboradorId) } },
        update: { ativo: true },
        create: { metaId: Number(id), colaboradorId: Number(atribuirColaboradorId) },
      });
      return NextResponse.json({ data: { success: true } });
    }

    const updateData: Record<string, unknown> = {};

    // Workflow approval/rejection
    if (status) updateData.status = status;
    if (data.pesoNaCesta !== undefined) updateData.pesoNaCesta = Number(data.pesoNaCesta);
    if (data.metaMinima !== undefined) updateData.metaMinima = Number(data.metaMinima);
    if (data.metaAlvo !== undefined) updateData.metaAlvo = Number(data.metaAlvo);
    if (data.metaMaxima !== undefined) updateData.metaMaxima = Number(data.metaMaxima);
    if (data.indicadorId !== undefined) updateData.indicadorId = Number(data.indicadorId);
    if (data.centroCustoId !== undefined)
      updateData.centroCustoId = data.centroCustoId ? Number(data.centroCustoId) : null;

    const meta = await prisma.meta.update({
      where: { id: Number(id) },
      data: updateData,
      include: { indicador: true, centroCusto: true },
    });

    // Create workflow item if approving/rejecting
    if (status && (status === "APROVADO" || status === "REJEITADO")) {
      try {
        const systemUser = await prisma.user.findFirst();
        if (systemUser) {
          await prisma.workflowItem.create({
            data: {
              tipo: "ALTERACAO_META",
              status,
              descricao: `Meta #${id} ${status === "APROVADO" ? "aprovada" : "rejeitada"}`,
              metaId: Number(id),
              solicitanteId: systemUser.id,
              comentario: comentario ?? null,
              resolvidoEm: new Date(),
            },
          });
        }
      } catch {
        // ignore workflow creation errors
      }
    }

    return NextResponse.json({ data: meta });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await prisma.meta.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

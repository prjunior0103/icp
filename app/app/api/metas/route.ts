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
        colaboradores: { select: { id: true, colaboradorId: true } },
        realizacoes: { select: { id: true } },
        parentMeta: { select: { id: true, indicador: { select: { nome: true } }, centroCusto: { select: { nome: true } } } },
        filhas: { select: { id: true } },
      },
      orderBy: { id: "asc" },
    });

    const result = metas.map((m) => ({
      ...m,
      _count: {
        colaboradores: m.colaboradores.length,
        realizacoes: m.realizacoes.length,
        filhas: m.filhas.length,
      },
      colaboradorIds: m.colaboradores.map((c) => c.colaboradorId),
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Phase validation
    if (body.cicloId) {
      const ciclo = await prisma.cicloICP.findUnique({ where: { id: Number(body.cicloId) } });
      if (ciclo?.status === "ENCERRADO")
        return NextResponse.json({ error: "Ciclo encerrado — não é possível criar novas metas." }, { status: 403 });
    }
    const meta = await prisma.meta.create({
      data: {
        indicadorId: Number(body.indicadorId),
        cicloId: Number(body.cicloId),
        centroCustoId: body.centroCustoId ? Number(body.centroCustoId) : undefined,
        metaMinima: body.metaMinima ? Number(body.metaMinima) : undefined,
        metaAlvo: Number(body.metaAlvo ?? 100),
        metaMaxima: body.metaMaxima ? Number(body.metaMaxima) : undefined,
        status: body.status ?? "DRAFT",
        smart: body.smart ?? null,
        parentMetaId: body.parentMetaId ? Number(body.parentMetaId) : undefined,
        nome: body.nome || null,
        polaridade: body.polaridade || null,
        tipo: body.tipo || null,
        unidade: body.unidade || null,
        valorOrcado: body.valorOrcado ? Number(body.valorOrcado) : undefined,
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
    const { id, status, comentario, atribuirColaboradorId, usuario, ...data } = body;
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

    // Fetch current meta for audit trail
    const metaAtual = await prisma.meta.findUnique({ where: { id: Number(id) } });

    // Build update fields
    if (status) updateData.status = status;
    if (data.metaMinima !== undefined) updateData.metaMinima = data.metaMinima !== null ? Number(data.metaMinima) : null;
    if (data.metaAlvo !== undefined) updateData.metaAlvo = Number(data.metaAlvo);
    if (data.metaMaxima !== undefined) updateData.metaMaxima = data.metaMaxima !== null ? Number(data.metaMaxima) : null;
    if (data.indicadorId !== undefined) updateData.indicadorId = Number(data.indicadorId);
    if (data.centroCustoId !== undefined) updateData.centroCustoId = data.centroCustoId ? Number(data.centroCustoId) : null;
    if (data.parentMetaId !== undefined) updateData.parentMetaId = data.parentMetaId ? Number(data.parentMetaId) : null;
    if (data.smart !== undefined) updateData.smart = data.smart;
    if (data.nome !== undefined) updateData.nome = data.nome || null;
    if (data.polaridade !== undefined) updateData.polaridade = data.polaridade || null;
    if (data.tipo !== undefined) updateData.tipo = data.tipo || null;
    if (data.unidade !== undefined) updateData.unidade = data.unidade || null;
    if (data.valorOrcado !== undefined) updateData.valorOrcado = data.valorOrcado !== null ? Number(data.valorOrcado) : null;

    const meta = await prisma.meta.update({
      where: { id: Number(id) },
      data: updateData,
      include: { indicador: true, centroCusto: true },
    });

    // Audit trail — log every changed field
    if (metaAtual) {
      const auditFields: Array<[string, unknown, unknown]> = [
        ["status", metaAtual.status, updateData.status],
        ["metaMinima", metaAtual.metaMinima, updateData.metaMinima],
        ["metaAlvo", metaAtual.metaAlvo, updateData.metaAlvo],
        ["metaMaxima", metaAtual.metaMaxima, updateData.metaMaxima],
        ["smart", metaAtual.smart, updateData.smart],
      ];
      for (const [campo, antes, depois] of auditFields) {
        if (depois !== undefined && String(antes) !== String(depois)) {
          try {
            await prisma.metaHistorico.create({
              data: {
                metaId: Number(id),
                campo,
                valorAntes: antes !== null && antes !== undefined ? String(antes) : null,
                valorDepois: depois !== null && depois !== undefined ? String(depois) : null,
                usuario: usuario ?? null,
              },
            });
          } catch { /* ignore */ }
        }
      }
    }

    // Create workflow item if approving/rejecting/cancelling
    if (status && ["APROVADO", "REJEITADO", "CANCELADO"].includes(status)) {
      try {
        const systemUser = await prisma.user.findFirst();
        if (systemUser) {
          await prisma.workflowItem.create({
            data: {
              tipo: "ALTERACAO_META",
              status: status === "CANCELADO" ? "REJEITADO" : status,
              descricao: `Meta #${id} ${status === "APROVADO" ? "aprovada" : status === "CANCELADO" ? "cancelada" : "rejeitada"}`,
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

async function deleteMeta(id: number) {
  // Desvincula metas filhas antes de excluir a pai
  await prisma.meta.updateMany({ where: { parentMetaId: id }, data: { parentMetaId: null } });
  // Exclui dependências em cascata
  await prisma.metaHistorico.deleteMany({ where: { metaId: id } });
  await prisma.metaColaborador.deleteMany({ where: { metaId: id } });
  await prisma.realizacao.deleteMany({ where: { metaId: id } });
  await prisma.workflowItem.deleteMany({ where: { metaId: id } });
  await prisma.planoAcao.deleteMany({ where: { metaId: id } });
  await prisma.agrupamentoMeta.deleteMany({ where: { metaId: id } });
  await prisma.meta.delete({ where: { id } });
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await deleteMeta(Number(id));
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

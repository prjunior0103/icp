import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloId = searchParams.get("cicloId");

    const agrupamentos = await prisma.agrupamento.findMany({
      where: cicloId ? { cicloId: Number(cicloId) } : undefined,
      include: {
        metas: {
          include: {
            meta: {
              include: { indicador: { select: { nome: true, unidade: true, tipo: true } } },
            },
          },
        },
        atribuicoes: {
          include: { gestor: { select: { id: true, nomeCompleto: true, matricula: true } } },
        },
      },
      orderBy: [{ tipo: "asc" }, { criadoEm: "desc" }],
    });

    return NextResponse.json({ data: agrupamentos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Apply action: assign agrupamento to collaborators
    if (body.action === "aplicar") {
      return await handleAplicar(body);
    }

    // Add meta to agrupamento
    if (body.action === "addMeta") {
      const item = await prisma.agrupamentoMeta.create({
        data: { agrupamentoId: Number(body.agrupamentoId), metaId: Number(body.metaId) },
      });
      return NextResponse.json({ data: item }, { status: 201 });
    }

    // Update peso of a meta in agrupamento
    if (body.action === "updateMetaPeso") {
      const item = await prisma.agrupamentoMeta.update({
        where: { id: Number(body.agrupamentoMetaId) },
        data: { pesoNaCesta: Number(body.pesoNaCesta) },
      });
      return NextResponse.json({ data: item });
    }

    // Create agrupamento
    const agrupamento = await prisma.agrupamento.create({
      data: {
        nome: body.nome,
        descricao: body.descricao || null,
        tipo: body.tipo,
        cicloId: Number(body.cicloId),
      },
      include: { metas: true, atribuicoes: true },
    });
    return NextResponse.json({ data: agrupamento }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** Returns all subordinate IDs at every level below gestorId (direct + indirect). */
async function getSubordinadosRecursivo(gestorId: number): Promise<number[]> {
  const todos: number[] = [];
  const visited = new Set<number>();
  const fila = [gestorId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    if (visited.has(atual)) continue;
    visited.add(atual);
    const diretos = await prisma.colaborador.findMany({
      where: { gestorId: atual, ativo: true },
      select: { id: true },
    });
    for (const d of diretos) {
      if (!visited.has(d.id)) {
        todos.push(d.id);
        fila.push(d.id);
      }
    }
  }
  return todos;
}

async function handleAplicar(body: {
  agrupamentoId: number;
  gestorId?: number;
  cascatear?: boolean;
}) {
  const agrupamento = await prisma.agrupamento.findUnique({
    where: { id: Number(body.agrupamentoId) },
    include: {
      metas: true,
      ciclo: true,
    },
  });

  if (!agrupamento) {
    return NextResponse.json({ error: "Agrupamento não encontrado" }, { status: 404 });
  }

  const metaIds = agrupamento.metas.map((m) => m.metaId);
  if (metaIds.length === 0) {
    return NextResponse.json({ error: "Agrupamento sem metas" }, { status: 400 });
  }

  // Determine which collaborators receive the metas
  let colaboradorIds: number[] = [];
  const gestorIdValue = body.gestorId != null ? Number(body.gestorId) : null;

  if (agrupamento.tipo === "CORPORATIVO" && !body.gestorId) {
    // All active collaborators
    const todos = await prisma.colaborador.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    colaboradorIds = todos.map((c) => c.id);
  } else {
    // AREA or CORPORATIVO with hierarchical mode: manager + optionally subordinates
    if (!body.gestorId) {
      return NextResponse.json({ error: "gestorId obrigatório para agrupamento AREA" }, { status: 400 });
    }
    colaboradorIds = [Number(body.gestorId)];

    if (body.cascatear) {
      const subordinados = await getSubordinadosRecursivo(Number(body.gestorId));
      colaboradorIds.push(...subordinados);
    }
  }

  // Create MetaColaborador records (upsert to avoid duplicates) — wrapped in transaction
  let criados = 0;

  await prisma.$transaction(async (tx) => {
    for (const metaId of metaIds) {
      for (const colaboradorId of colaboradorIds) {
        await tx.metaColaborador.upsert({
          where: { metaId_colaboradorId: { metaId, colaboradorId } },
          update: { ativo: true },
          create: { metaId, colaboradorId },
        });
        criados++;
      }
    }
    // Record attribution — handle nullable gestorId separately to avoid Prisma null-upsert issues
    if (gestorIdValue != null) {
      await tx.agrupamentoAtribuicao.upsert({
        where: { agrupamentoId_gestorId: { agrupamentoId: Number(body.agrupamentoId), gestorId: gestorIdValue } },
        update: { aplicadoEm: new Date(), cascatear: body.cascatear ?? false },
        create: { agrupamentoId: Number(body.agrupamentoId), gestorId: gestorIdValue, cascatear: body.cascatear ?? false, aplicadoEm: new Date() },
      });
    } else {
      // Null gestorId = "all collaborators" application; use findFirst + create/update pattern
      const existing = await tx.agrupamentoAtribuicao.findFirst({
        where: { agrupamentoId: Number(body.agrupamentoId), gestorId: null },
      });
      if (existing) {
        await tx.agrupamentoAtribuicao.update({
          where: { id: existing.id },
          data: { aplicadoEm: new Date(), cascatear: false },
        });
      } else {
        await tx.agrupamentoAtribuicao.create({
          data: { agrupamentoId: Number(body.agrupamentoId), gestorId: null, cascatear: false, aplicadoEm: new Date() },
        });
      }
    }
  });

  return NextResponse.json({ data: { criados, colaboradores: colaboradorIds.length } });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, nome, descricao, tipo } = body;
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const agrupamento = await prisma.agrupamento.update({
      where: { id: Number(id) },
      data: {
        nome: nome ?? undefined,
        descricao: descricao !== undefined ? (descricao || null) : undefined,
        tipo: tipo ?? undefined,
      },
      include: { metas: { include: { meta: { include: { indicador: { select: { nome: true, unidade: true, tipo: true } } } } } }, atribuicoes: true },
    });
    return NextResponse.json({ data: agrupamento });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const metaId = searchParams.get("metaId");
    const agrupamentoId = searchParams.get("agrupamentoId");

    // Remove meta from agrupamento
    if (metaId && agrupamentoId) {
      await prisma.agrupamentoMeta.deleteMany({
        where: { agrupamentoId: Number(agrupamentoId), metaId: Number(metaId) },
      });
      return NextResponse.json({ data: { success: true } });
    }

    // Delete agrupamento
    if (id) {
      await prisma.agrupamento.delete({ where: { id: Number(id) } });
      return NextResponse.json({ data: { success: true } });
    }

    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

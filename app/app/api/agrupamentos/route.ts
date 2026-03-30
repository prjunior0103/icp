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
  const fila = [gestorId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    const diretos = await prisma.colaborador.findMany({
      where: { gestorId: atual, ativo: true },
      select: { id: true },
    });
    for (const d of diretos) {
      todos.push(d.id);
      fila.push(d.id);
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

  if (agrupamento.tipo === "CORPORATIVO") {
    // All active collaborators
    const todos = await prisma.colaborador.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    colaboradorIds = todos.map((c) => c.id);
  } else {
    // AREA: manager + optionally subordinates
    if (!body.gestorId) {
      return NextResponse.json({ error: "gestorId obrigatório para agrupamento AREA" }, { status: 400 });
    }
    colaboradorIds = [Number(body.gestorId)];

    if (body.cascatear) {
      const subordinados = await getSubordinadosRecursivo(Number(body.gestorId));
      colaboradorIds.push(...subordinados);
    }
  }

  // Create MetaColaborador records (upsert to avoid duplicates)
  let criados = 0;
  for (const metaId of metaIds) {
    for (const colaboradorId of colaboradorIds) {
      await prisma.metaColaborador.upsert({
        where: { metaId_colaboradorId: { metaId, colaboradorId } },
        update: { ativo: true },
        create: { metaId, colaboradorId },
      });
      criados++;
    }
  }

  // Record the attribution
  const gestorIdValue = body.gestorId != null ? Number(body.gestorId) : null;
  await prisma.agrupamentoAtribuicao.upsert({
    where: {
      agrupamentoId_gestorId: {
        agrupamentoId: Number(body.agrupamentoId),
        gestorId: gestorIdValue as number,
      },
    },
    update: { aplicadoEm: new Date(), cascatear: body.cascatear ?? false },
    create: {
      agrupamentoId: Number(body.agrupamentoId),
      gestorId: gestorIdValue,
      cascatear: body.cascatear ?? false,
      aplicadoEm: new Date(),
    },
  });

  return NextResponse.json({ data: { criados, colaboradores: colaboradorIds.length } });
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

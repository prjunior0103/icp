import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDENTE";

    const items = await prisma.workflowItem.findMany({
      where: { status },
      include: {
        meta: { include: { indicador: true } },
        realizacao: { include: { meta: { include: { indicador: true } } } },
        solicitante: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { criadoEm: "desc" },
    });
    return NextResponse.json({ data: items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Resolve solicitante — use system user if not provided
    let solicitanteId = body.solicitanteId;
    if (!solicitanteId) {
      const systemUser = await prisma.user.findFirst();
      if (!systemUser) {
        return NextResponse.json(
          { error: "Nenhum usuario encontrado para ser solicitante" },
          { status: 400 }
        );
      }
      solicitanteId = systemUser.id;
    }

    const item = await prisma.workflowItem.create({
      data: {
        tipo: body.tipo,
        status: "PENDENTE",
        descricao: body.descricao,
        metaId: body.metaId ? Number(body.metaId) : undefined,
        realizacaoId: body.realizacaoId ? Number(body.realizacaoId) : undefined,
        solicitanteId,
        comentario: body.comentario ?? null,
      },
      include: {
        meta: true,
        realizacao: true,
        solicitante: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, comentario } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    if (!status || !["APROVADO", "REJEITADO"].includes(status)) {
      return NextResponse.json(
        { error: "status deve ser APROVADO ou REJEITADO" },
        { status: 400 }
      );
    }

    const item = await prisma.workflowItem.update({
      where: { id: Number(id) },
      data: {
        status,
        comentario: comentario ?? null,
        resolvidoEm: new Date(),
      },
      include: {
        meta: true,
        realizacao: true,
      },
    });

    // Cascade update linked meta
    if (item.metaId && status === "APROVADO") {
      await prisma.meta.update({
        where: { id: item.metaId },
        data: { status: "APROVADO" },
      });
    }

    // Cascade update linked realizacao
    if (item.realizacaoId) {
      await prisma.realizacao.update({
        where: { id: item.realizacaoId },
        data: {
          status,
          aprovacao: status === "APROVADO" ? new Date() : undefined,
        },
      });
    }

    return NextResponse.json({ data: item });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

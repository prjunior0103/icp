import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const janelaId = searchParams.get("janelaId");
    const status = searchParams.get("status");

    const waivers = await prisma.prorrogacaoWaiver.findMany({
      where: {
        ...(janelaId ? { janelaId: Number(janelaId) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        janela: { select: { id: true, mesReferencia: true, anoReferencia: true, cicloId: true } },
      },
      orderBy: { criadoEm: "desc" },
    });

    // Fetch all colaboradores in one query instead of N queries
    const colaboradorIds = [...new Set(waivers.map((w) => w.colaboradorId))];
    const colaboradores = await prisma.colaborador.findMany({
      where: { id: { in: colaboradorIds } },
      select: { id: true, nomeCompleto: true, matricula: true },
    });
    const colaboradorMap = Object.fromEntries(colaboradores.map((c) => [c.id, c]));

    const enriched = waivers.map((w) => ({ ...w, colaborador: colaboradorMap[w.colaboradorId] ?? null }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { janelaId, colaboradorId, justificativa, novaDataLimite } = body;
    if (!janelaId || !colaboradorId || !justificativa || !novaDataLimite) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    const waiver = await prisma.prorrogacaoWaiver.create({
      data: {
        janelaId: Number(janelaId),
        colaboradorId: Number(colaboradorId),
        justificativa,
        novaDataLimite: new Date(novaDataLimite),
        status: "PENDENTE",
      },
    });

    return NextResponse.json({ data: waiver }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    if (!status || !["APROVADO", "REJEITADO"].includes(status)) {
      return NextResponse.json(
        { error: "status deve ser APROVADO ou REJEITADO" },
        { status: 400 }
      );
    }

    const waiver = await prisma.prorrogacaoWaiver.update({
      where: { id: Number(id) },
      data: { status, resolvidoEm: new Date() },
    });

    // When approved: update janela status and extend dataFechamento
    if (status === "APROVADO") {
      await prisma.janelaApuracao.update({
        where: { id: waiver.janelaId },
        data: {
          status: "PRORROGADA",
          dataFechamento: waiver.novaDataLimite,
        },
      });
    }

    return NextResponse.json({ data: waiver });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

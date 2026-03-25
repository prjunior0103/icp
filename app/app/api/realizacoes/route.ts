import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isJanelaAberta } from "@/app/lib/janelas";

function calcularNota(
  tipo: string,
  valorRealizado: number,
  metaAlvo: number,
  metaMinima: number | null,
  metaMaxima: number | null
): number {
  let nota = 0;

  if (tipo === "VOLUME_FINANCEIRO") {
    nota = (valorRealizado / metaAlvo) * 100;
  } else if (tipo === "CUSTO_PRAZO") {
    nota = (metaAlvo / valorRealizado) * 100;
  } else if (tipo === "PROJETO_MARCO") {
    nota = valorRealizado >= 1 ? 100 : 0;
  }

  // Cap at maxima ratio
  if (metaMaxima && metaAlvo > 0) {
    const maxNota = (metaMaxima / metaAlvo) * 100;
    nota = Math.min(nota, maxNota);
  } else {
    nota = Math.min(nota, 120);
  }

  // Floor at minima
  if (metaMinima && metaAlvo > 0) {
    if (tipo === "VOLUME_FINANCEIRO" && valorRealizado < metaMinima) nota = 0;
    if (tipo === "CUSTO_PRAZO" && valorRealizado > (metaMaxima ?? Infinity)) nota = 0;
  }

  return Math.max(0, nota);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metaId = searchParams.get("metaId");
    const colaboradorId = searchParams.get("colaboradorId");

    const realizacoes = await prisma.realizacao.findMany({
      where: {
        ...(metaId ? { metaId: Number(metaId) } : {}),
        ...(colaboradorId ? { colaboradorId: Number(colaboradorId) } : {}),
      },
      include: {
        meta: { include: { indicador: true } },
        colaborador: { include: { cargo: true } },
      },
      orderBy: [{ anoReferencia: "desc" }, { mesReferencia: "desc" }],
    });

    return NextResponse.json({ data: realizacoes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      metaId,
      colaboradorId,
      mesReferencia,
      anoReferencia,
      valorRealizado,
      evidenciaUrl,
      observacao,
    } = body;

    if (!metaId || !mesReferencia || !anoReferencia || valorRealizado === undefined) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    // Fetch meta + indicador + colaborador
    const meta = await prisma.meta.findUnique({
      where: { id: Number(metaId) },
      include: { indicador: true },
    });
    if (!meta) return NextResponse.json({ error: "Meta nao encontrada" }, { status: 404 });

    // Check if janela is open
    const { aberta, janela } = await isJanelaAberta(
      meta.cicloId,
      Number(mesReferencia),
      Number(anoReferencia)
    );
    if (janela && !aberta) {
      // Check if colaborador has an active approved waiver
      const hasWaiver =
        colaboradorId &&
        (await prisma.prorrogacaoWaiver.findFirst({
          where: {
            janelaId: janela.id,
            colaboradorId: Number(colaboradorId),
            status: "APROVADO",
          },
        }));
      if (!hasWaiver) {
        return NextResponse.json(
          { error: "Janela de apuração fechada. Solicite prorrogação." },
          { status: 403 }
        );
      }
    }

    const nota = calcularNota(
      meta.indicador.tipo,
      Number(valorRealizado),
      meta.metaAlvo,
      meta.metaMinima,
      meta.metaMaxima
    );

    let premioProjetado: number | undefined;
    if (colaboradorId) {
      const colaborador = await prisma.colaborador.findUnique({
        where: { id: Number(colaboradorId) },
        include: { cargo: true },
      });
      if (colaborador) {
        premioProjetado =
          (colaborador.salarioBase * 12 * (colaborador.cargo.targetBonusPerc / 100)) *
          (nota / 100) *
          (meta.pesoNaCesta / 100);
      }
    }

    // Upsert realizacao
    const realizacao = await prisma.realizacao.upsert({
      where: {
        metaId_colaboradorId_mesReferencia_anoReferencia: {
          metaId: Number(metaId),
          colaboradorId: colaboradorId ? Number(colaboradorId) : null as unknown as number,
          mesReferencia: Number(mesReferencia),
          anoReferencia: Number(anoReferencia),
        },
      },
      update: {
        valorRealizado: Number(valorRealizado),
        notaCalculada: nota,
        premioProjetado,
        evidenciaUrl: evidenciaUrl ?? null,
        observacao: observacao ?? null,
        submissao: new Date(),
        status: "SUBMETIDO",
      },
      create: {
        metaId: Number(metaId),
        colaboradorId: colaboradorId ? Number(colaboradorId) : undefined,
        mesReferencia: Number(mesReferencia),
        anoReferencia: Number(anoReferencia),
        valorRealizado: Number(valorRealizado),
        notaCalculada: nota,
        premioProjetado,
        evidenciaUrl: evidenciaUrl ?? null,
        observacao: observacao ?? null,
        submissao: new Date(),
        status: "SUBMETIDO",
      },
      include: {
        meta: { include: { indicador: true } },
        colaborador: true,
      },
    });

    return NextResponse.json({ data: realizacao }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await prisma.realizacao.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

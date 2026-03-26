import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isJanelaAberta } from "@/app/lib/janelas";

function calcularNota(
  tipo: string,
  polaridade: string,
  valorRealizado: number,
  metaAlvo: number,
  metaMinima: number | null,
  metaMaxima: number | null
): number {
  if (metaAlvo === 0) return 0;
  let nota = 0;

  if (tipo === "PROJETO_MARCO") {
    // Pass/fail: 100 if realizado >= 1 (true), else 0
    nota = valorRealizado >= 1 ? 100 : 0;
  } else if (polaridade === "MENOR_MELHOR") {
    // Ex: custo, prazo, defeitos — menor realizado = melhor nota
    nota = valorRealizado === 0 ? 120 : (metaAlvo / valorRealizado) * 100;
    // Below minimum (pior que o piso): zero score
    if (metaMaxima && valorRealizado > metaMaxima) nota = 0;
  } else {
    // MAIOR_MELHOR (default): maior realizado = melhor nota
    nota = (valorRealizado / metaAlvo) * 100;
    // Below minimum: zero score
    if (metaMinima && valorRealizado < metaMinima) nota = 0;
  }

  // Cap upside: use metaMaxima ratio or default 120
  if (tipo !== "PROJETO_MARCO") {
    if (metaMaxima && metaAlvo > 0 && polaridade !== "MENOR_MELHOR") {
      nota = Math.min(nota, (metaMaxima / metaAlvo) * 100);
    } else if (polaridade !== "MENOR_MELHOR") {
      nota = Math.min(nota, 120);
    } else {
      nota = Math.min(nota, 120);
    }
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

    // Validate cycle phase — SETUP/ENCERRADO block new realizações
    const ciclo = await prisma.cicloICP.findUnique({ where: { id: meta.cicloId } });
    if (ciclo?.status === "SETUP")
      return NextResponse.json({ error: "Ciclo em SETUP — metas ainda não ativas para apuração." }, { status: 403 });
    if (ciclo?.status === "ENCERRADO")
      return NextResponse.json({ error: "Ciclo encerrado — não é possível registrar novas realizações." }, { status: 403 });

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

    // Check if record exists — only recalculate nota if valorRealizado changed
    const existing = await prisma.realizacao.findFirst({
      where: {
        metaId: Number(metaId),
        colaboradorId: colaboradorId ? Number(colaboradorId) : null,
        mesReferencia: Number(mesReferencia),
        anoReferencia: Number(anoReferencia),
      },
    });

    const valorChanged = !existing || existing.valorRealizado !== Number(valorRealizado);

    const nota = valorChanged
      ? calcularNota(
          meta.indicador.tipo,
          meta.indicador.polaridade ?? "MAIOR_MELHOR",
          Number(valorRealizado),
          meta.metaAlvo,
          meta.metaMinima,
          meta.metaMaxima
        )
      : (existing.notaCalculada ?? calcularNota(
          meta.indicador.tipo,
          meta.indicador.polaridade ?? "MAIOR_MELHOR",
          Number(valorRealizado),
          meta.metaAlvo,
          meta.metaMinima,
          meta.metaMaxima
        ));

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

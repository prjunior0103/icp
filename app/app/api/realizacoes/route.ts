import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isJanelaAberta } from "@/app/lib/janelas";
import { calcularNota, calcularPremio } from "@/app/lib/calc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metaId = searchParams.get("metaId");
    const colaboradorId = searchParams.get("colaboradorId");
    const cicloId = searchParams.get("cicloId");

    const realizacoes = await prisma.realizacao.findMany({
      where: {
        ...(metaId ? { metaId: Number(metaId) } : {}),
        ...(colaboradorId ? { colaboradorId: Number(colaboradorId) } : {}),
        ...(cicloId ? { meta: { cicloId: Number(cicloId) } } : {}),
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
      valorRealizado: valorRealizadoRaw,
      valorDividendo: valorDividendoRaw,
      valorDivisor: valorDivisorRaw,
      evidenciaUrl,
      observacao,
    } = body;

    if (!metaId || !mesReferencia || !anoReferencia) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    // Fetch meta + indicador (with divisor and faixas)
    const meta = await prisma.meta.findUnique({
      where: { id: Number(metaId) },
      include: { indicador: { include: { faixas: true } } },
    });
    if (!meta) return NextResponse.json({ error: "Meta nao encontrada" }, { status: 404 });

    // TASK-028: resolve valorRealizado for divisor indicators
    let valorRealizado: number;
    let valorDividendo: number | undefined;
    let valorDivisorComp: number | undefined;

    if (meta.indicador.divisorId && valorDividendoRaw !== undefined && valorDivisorRaw !== undefined) {
      valorDividendo = Number(valorDividendoRaw);
      valorDivisorComp = Number(valorDivisorRaw);
      if (valorDivisorComp === 0) {
        return NextResponse.json({ error: "Valor do divisor não pode ser zero." }, { status: 400 });
      }
      valorRealizado = valorDividendo / valorDivisorComp;
    } else if (valorRealizadoRaw !== undefined) {
      valorRealizado = Number(valorRealizadoRaw);
    } else {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

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

    const valorChanged = !existing || existing.valorRealizado !== valorRealizado;

    const tipoEfetivo = meta.tipo ?? meta.indicador.tipo;
    const polaridadeEfetiva = meta.polaridade ?? meta.indicador.polaridade ?? "MAIOR_MELHOR";
    // TASK-027: pass faixas to calcularNota
    const faixas = meta.indicador.faixas ?? [];
    const nota = valorChanged
      ? calcularNota(
          tipoEfetivo,
          polaridadeEfetiva,
          valorRealizado,
          meta.metaAlvo,
          meta.metaMinima,
          meta.metaMaxima,
          faixas
        )
      : (existing.notaCalculada ?? calcularNota(
          tipoEfetivo,
          polaridadeEfetiva,
          valorRealizado,
          meta.metaAlvo,
          meta.metaMinima,
          meta.metaMaxima,
          faixas
        ));

    let premioProjetado: number | undefined;
    if (colaboradorId) {
      const [colaborador, metaColab] = await Promise.all([
        prisma.colaborador.findUnique({ where: { id: Number(colaboradorId) }, include: { cargo: true } }),
        prisma.metaColaborador.findFirst({ where: { metaId: Number(metaId), colaboradorId: Number(colaboradorId), ativo: true } }),
      ]);
      if (colaborador) {
        const pesoEfetivo = metaColab?.pesoPersonalizado ?? 0;
        premioProjetado = calcularPremio(
          colaborador.salarioBase,
          colaborador.cargo.targetMultiploSalarial,
          nota,
          pesoEfetivo
        );
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
        valorRealizado,
        valorDividendo: valorDividendo ?? null,
        valorDivisor: valorDivisorComp ?? null,
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
        valorRealizado,
        valorDividendo: valorDividendo ?? null,
        valorDivisor: valorDivisorComp ?? null,
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

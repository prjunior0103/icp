import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { calcularNota, calcularPremio } from "@/app/lib/calc";

interface ImportRow {
  matricula: string;
  metaCodigo: string; // indicador.codigo
  valorRealizado: number;
  observacao?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cicloId, mesReferencia, anoReferencia, rows } = body as {
      cicloId: number;
      mesReferencia: number;
      anoReferencia: number;
      rows: ImportRow[];
    };

    if (!cicloId || !mesReferencia || !anoReferencia || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    let processed = 0;
    const erros: { matricula: string; motivo: string }[] = [];

    for (const row of rows) {
      try {
        // Find colaborador by matricula
        const colaborador = await prisma.colaborador.findUnique({
          where: { matricula: row.matricula },
          include: { cargo: true },
        });
        if (!colaborador) {
          erros.push({ matricula: row.matricula, motivo: "Colaborador não encontrado" });
          continue;
        }

        // Find indicador by codigo + cicloId
        const indicador = await prisma.indicador.findFirst({
          where: { codigo: row.metaCodigo, cicloId: Number(cicloId) },
        });
        if (!indicador) {
          erros.push({ matricula: row.matricula, motivo: `Indicador '${row.metaCodigo}' não encontrado no ciclo` });
          continue;
        }

        // Find meta by indicadorId + cicloId
        const meta = await prisma.meta.findFirst({
          where: { indicadorId: indicador.id, cicloId: Number(cicloId) },
          include: { indicador: true },
        });
        if (!meta) {
          erros.push({ matricula: row.matricula, motivo: `Meta para indicador '${row.metaCodigo}' não encontrada` });
          continue;
        }

        // Find or create MetaColaborador
        await prisma.metaColaborador.upsert({
          where: { metaId_colaboradorId: { metaId: meta.id, colaboradorId: colaborador.id } },
          update: {},
          create: { metaId: meta.id, colaboradorId: colaborador.id },
        });

        // Calculate nota and premio
        const valorRealizado = Number(row.valorRealizado);
        const nota = calcularNota(
          meta.indicador.tipo,
          meta.indicador.polaridade,
          valorRealizado,
          meta.metaAlvo,
          meta.metaMinima,
          meta.metaMaxima
        );
        const premioProjetado = calcularPremio(
          colaborador.salarioBase,
          colaborador.cargo.targetBonusPerc,
          nota,
          meta.pesoNaCesta
        );

        // Upsert realizacao
        await prisma.realizacao.upsert({
          where: {
            metaId_colaboradorId_mesReferencia_anoReferencia: {
              metaId: meta.id,
              colaboradorId: colaborador.id,
              mesReferencia: Number(mesReferencia),
              anoReferencia: Number(anoReferencia),
            },
          },
          update: {
            valorRealizado,
            notaCalculada: nota,
            premioProjetado,
            observacao: row.observacao ?? null,
            submissao: new Date(),
            status: "SUBMETIDO",
          },
          create: {
            metaId: meta.id,
            colaboradorId: colaborador.id,
            mesReferencia: Number(mesReferencia),
            anoReferencia: Number(anoReferencia),
            valorRealizado,
            notaCalculada: nota,
            premioProjetado,
            observacao: row.observacao ?? null,
            submissao: new Date(),
            status: "SUBMETIDO",
          },
        });

        processed++;
      } catch (rowErr) {
        erros.push({ matricula: row.matricula, motivo: String(rowErr) });
      }
    }

    return NextResponse.json({ data: { processed, erros } }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

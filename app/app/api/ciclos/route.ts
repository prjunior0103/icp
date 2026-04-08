import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

async function syncSnapshotColaboradores(cicloId: number) {
  const colaboradores = await prisma.colaborador.findMany({
    where: { ativo: true },
    include: { cargo: true },
  });
  for (const col of colaboradores) {
    await prisma.cicloColaborador.upsert({
      where: { cicloId_colaboradorId: { cicloId, colaboradorId: col.id } },
      update: {
        salarioBase: col.salarioBase,
        cargoId: col.cargoId,
        targetMultiploSalarial: col.cargo.targetMultiploSalarial,
        centroCustoId: col.centroCustoId,
        empresaId: col.empresaId,
        ativo: true,
      },
      create: {
        cicloId,
        colaboradorId: col.id,
        salarioBase: col.salarioBase,
        cargoId: col.cargoId,
        targetMultiploSalarial: col.cargo.targetMultiploSalarial,
        centroCustoId: col.centroCustoId,
        empresaId: col.empresaId,
        ativo: true,
      },
    });
  }
}

export async function GET() {
  try {
    const ciclos = await prisma.cicloICP.findMany({
      include: {
        indicadores: { select: { id: true } },
        metas: { select: { id: true } },
      },
      orderBy: { anoFiscal: "desc" },
    });
    return NextResponse.json({ data: ciclos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bonusPool = body.bonusPool ? Number(body.bonusPool) : undefined;
    if (bonusPool !== undefined && bonusPool < 0)
      return NextResponse.json({ error: "bonusPool não pode ser negativo" }, { status: 400 });

    const newAno = Number(body.anoFiscal);
    const ciclo = await prisma.cicloICP.create({
      data: {
        anoFiscal: newAno,
        status: body.status ?? "SETUP",
        mesInicio: body.mesInicio ? Number(body.mesInicio) : 1,
        mesFim: body.mesFim ? Number(body.mesFim) : 12,
        gatilhoEbitda: body.gatilhoEbitda ? Number(body.gatilhoEbitda) : undefined,
        bonusPool,
      },
    });

    // Importar indicadores de outro ciclo (opcional)
    if (body.importFromCicloId) {
      const sourceCicloId = Number(body.importFromCicloId);
      const sourceIndicadores = await prisma.indicador.findMany({
        where: { cicloId: sourceCicloId },
        include: { faixas: true },
      });

      for (const ind of sourceIndicadores) {
        const newCodigo = `${ind.codigo}_${newAno}`;
        const existing = await prisma.indicador.findFirst({ where: { codigo: newCodigo } });
        const finalCodigo = existing ? `${ind.codigo}_${newAno}_${Date.now()}` : newCodigo;

        await prisma.indicador.create({
          data: {
            codigo: finalCodigo,
            nome: ind.nome,
            descricao: ind.descricao,
            tipo: ind.tipo,
            polaridade: ind.polaridade,
            abrangencia: ind.abrangencia,
            unidade: ind.unidade,
            metaMinima: ind.metaMinima,
            metaAlvo: ind.metaAlvo,
            metaMaxima: ind.metaMaxima,
            diretivo: ind.diretivo,
            analistaResp: ind.analistaResp,
            origemDado: ind.origemDado,
            cicloId: ciclo.id,
            status: "DRAFT",
            baseline: ind.baseline,
            metrica: ind.metrica,
            periodicidade: ind.periodicidade,
            perspectiva: ind.perspectiva,
            tipoIndicador: ind.tipoIndicador,
            auditorDados: ind.auditorDados,
            criterioApuracao: ind.criterioApuracao,
            faixas: {
              create: ind.faixas.map((f) => ({ de: f.de, ate: f.ate, nota: f.nota })),
            },
          },
        });
      }
    }

    // Snapshot colaboradores on ciclo creation
    await syncSnapshotColaboradores(ciclo.id);

    return NextResponse.json({ data: ciclo }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const bonusPool = data.bonusPool !== undefined ? Number(data.bonusPool) : undefined;
    if (bonusPool !== undefined && bonusPool < 0)
      return NextResponse.json({ error: "bonusPool não pode ser negativo" }, { status: 400 });

    const ciclo = await prisma.cicloICP.update({
      where: { id: Number(id) },
      data: {
        status: data.status,
        mesInicio: data.mesInicio ? Number(data.mesInicio) : undefined,
        mesFim: data.mesFim ? Number(data.mesFim) : undefined,
        gatilhoEbitda: data.gatilhoEbitda !== undefined ? Number(data.gatilhoEbitda) : undefined,
        bonusPool,
      },
    });

    // Re-sync snapshot when activating (picks up any changes since creation)
    if (data.status === "ATIVO") {
      await syncSnapshotColaboradores(Number(id));
    }

    return NextResponse.json({ data: ciclo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await prisma.cicloICP.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

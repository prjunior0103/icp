import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const colaboradorId = searchParams.get("colaboradorId");
    const cicloId = searchParams.get("cicloId");

    const movimentacoes = await prisma.movimentacaoRH.findMany({
      where: {
        ...(colaboradorId ? { colaboradorId: Number(colaboradorId) } : {}),
      },
      include: {
        colaborador: {
          include: { cargo: true, centroCusto: true },
        },
      },
      orderBy: { dataEfetiva: "desc" },
    });

    // Enrich with cargo/cc names from related records
    const cargos = await prisma.cargo.findMany({ select: { id: true, nome: true, nivelHierarquico: true, targetBonusPerc: true } });
    const ccs = await prisma.centroCusto.findMany({ select: { id: true, nome: true } });
    const cargoMap = new Map(cargos.map((c) => [c.id, c]));
    const ccMap = new Map(ccs.map((c) => [c.id, c]));

    const result = movimentacoes.map((m) => ({
      ...m,
      cargoAnterior: m.cargoAnteriorId ? cargoMap.get(m.cargoAnteriorId) ?? null : null,
      cargoNovo: m.cargoNovoId ? cargoMap.get(m.cargoNovoId) ?? null : null,
      ccAnterior: m.ccAnteriorId ? ccMap.get(m.ccAnteriorId) ?? null : null,
      ccNovo: m.ccNovoId ? ccMap.get(m.ccNovoId) ?? null : null,
    }));

    // If cicloId provided, filter to movimentações within ciclo period
    if (cicloId) {
      const ciclo = await prisma.cicloICP.findUnique({ where: { id: Number(cicloId) } });
      if (ciclo) {
        const start = new Date(`${ciclo.anoFiscal}-${String(ciclo.mesInicio).padStart(2, "0")}-01`);
        const end = new Date(`${ciclo.anoFiscal}-${String(ciclo.mesFim).padStart(2, "0")}-31`);
        return NextResponse.json({ data: result.filter((m) => new Date(m.dataEfetiva) >= start && new Date(m.dataEfetiva) <= end) });
      }
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const movimentacao = await prisma.movimentacaoRH.create({
      data: {
        colaboradorId: Number(body.colaboradorId),
        tipo: body.tipo,
        dataEfetiva: new Date(body.dataEfetiva),
        cargoAnteriorId: body.cargoAnteriorId ? Number(body.cargoAnteriorId) : null,
        cargoNovoId: body.cargoNovoId ? Number(body.cargoNovoId) : null,
        ccAnteriorId: body.ccAnteriorId ? Number(body.ccAnteriorId) : null,
        ccNovoId: body.ccNovoId ? Number(body.ccNovoId) : null,
        status: "PENDENTE",
      },
      include: { colaborador: { include: { cargo: true, centroCusto: true } } },
    });
    return NextResponse.json({ data: movimentacao }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const movimentacao = await prisma.movimentacaoRH.update({
      where: { id: Number(id) },
      data: { status },
    });
    return NextResponse.json({ data: movimentacao });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    await prisma.movimentacaoRH.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

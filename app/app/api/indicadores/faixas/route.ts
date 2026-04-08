import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET /api/indicadores/faixas?indicadorId=X
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const indicadorId = searchParams.get("indicadorId");
    if (!indicadorId) return NextResponse.json({ error: "indicadorId obrigatorio" }, { status: 400 });

    const faixas = await prisma.faixaAtingimento.findMany({
      where: { indicadorId: Number(indicadorId) },
      orderBy: { de: "asc" },
    });
    return NextResponse.json({ data: faixas });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT /api/indicadores/faixas — full replace for an indicador
// body: { indicadorId: number; faixas: { de: number; ate: number; nota: number }[] }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { indicadorId, faixas } = body;
    if (!indicadorId) return NextResponse.json({ error: "indicadorId obrigatorio" }, { status: 400 });

    // Delete existing and re-insert
    await prisma.faixaAtingimento.deleteMany({ where: { indicadorId: Number(indicadorId) } });

    if (Array.isArray(faixas) && faixas.length > 0) {
      await prisma.faixaAtingimento.createMany({
        data: faixas.map((f: { de: number; ate: number; nota: number }) => ({
          indicadorId: Number(indicadorId),
          de: Number(f.de),
          ate: Number(f.ate),
          nota: Number(f.nota),
        })),
      });
    }

    const updated = await prisma.faixaAtingimento.findMany({
      where: { indicadorId: Number(indicadorId) },
      orderBy: { de: "asc" },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

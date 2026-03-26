import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET — CSV template
export async function GET() {
  const headers = ["indicadorCodigo", "centroCustoCodigo", "pesoNaCesta", "metaMinima", "metaAlvo", "metaMaxima"];
  const example = ["REC-LIQ-2026", "CC-COM", "50", "80", "100", "120"];
  const csv = [headers.join(";"), example.join(";")].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=template_metas.csv",
    },
  });
}

// POST — bulk import
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cicloId, rows } = body as { cicloId: number; rows: Record<string, string>[] };
    if (!cicloId || !Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "cicloId e rows obrigatorios" }, { status: 400 });

    const indicadores = await prisma.indicador.findMany({ where: { cicloId: Number(cicloId) }, select: { id: true, codigo: true } });
    const ccs = await prisma.centroCusto.findMany({ select: { id: true, codigo: true } });
    const indMap = new Map(indicadores.map((i) => [i.codigo, i.id]));
    const ccMap = new Map(ccs.map((c) => [c.codigo, c.id]));

    let processed = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;
      const indicadorId = indMap.get(row.indicadorCodigo);
      if (!indicadorId) { erros.push({ linha, motivo: `Indicador '${row.indicadorCodigo}' não encontrado no ciclo` }); continue; }
      const centroCustoId = row.centroCustoCodigo ? ccMap.get(row.centroCustoCodigo) : undefined;
      if (row.centroCustoCodigo && !centroCustoId) { erros.push({ linha, motivo: `CC '${row.centroCustoCodigo}' não encontrado` }); continue; }

      try {
        await prisma.meta.create({
          data: {
            indicadorId,
            cicloId: Number(cicloId),
            centroCustoId: centroCustoId ?? null,
            pesoNaCesta: Number(row.pesoNaCesta ?? 100),
            metaMinima: row.metaMinima ? Number(row.metaMinima) : null,
            metaAlvo: Number(row.metaAlvo ?? 100),
            metaMaxima: row.metaMaxima ? Number(row.metaMaxima) : null,
            status: "DRAFT",
          },
        });
        processed++;
      } catch (rowErr) {
        erros.push({ linha, motivo: String(rowErr) });
      }
    }
    return NextResponse.json({ data: { processed, erros } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

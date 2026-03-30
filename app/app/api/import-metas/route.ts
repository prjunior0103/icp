import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET — CSV template
export async function GET() {
  const headers = [
    "indicadorCodigo",
    "pesoNaCesta",
    "metaMinima",
    "metaAlvo",
    "metaMaxima",
    "parentMetaIndicadorCodigo",
    "smart_e",
    "smart_m",
    "smart_a",
    "smart_r",
    "smart_t",
  ];
  const example = ["REC-LIQ-2026", "50", "80", "100", "120", "", "", "", "", "", ""];
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

    // Build a map from indicadorCodigo → metaId (for parentMeta lookup) after first pass
    // We'll do a lazy fetch of metas in this cycle
    let metasByIndicador: Map<string, number> | null = null;
    async function getMetasByIndicador() {
      if (!metasByIndicador) {
        const metas = await prisma.meta.findMany({
          where: { cicloId: Number(cicloId) },
          select: { id: true, indicador: { select: { codigo: true } } },
        });
        metasByIndicador = new Map(metas.map((m) => [m.indicador.codigo, m.id]));
      }
      return metasByIndicador;
    }

    let processed = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;

      const indicadorId = indMap.get(row.indicadorCodigo);
      if (!indicadorId) { erros.push({ linha, motivo: `Indicador '${row.indicadorCodigo}' não encontrado no ciclo` }); continue; }

      const centroCustoId = row.centroCustoCodigo ? ccMap.get(row.centroCustoCodigo) : undefined;
      if (row.centroCustoCodigo && !centroCustoId) { erros.push({ linha, motivo: `CC '${row.centroCustoCodigo}' não encontrado` }); continue; }

      // Resolve parentMetaId via indicator code
      let parentMetaId: number | null = null;
      if (row.parentMetaIndicadorCodigo?.trim()) {
        const metasMap = await getMetasByIndicador();
        const found = metasMap.get(row.parentMetaIndicadorCodigo.trim());
        if (!found) { erros.push({ linha, motivo: `Meta pai com indicador '${row.parentMetaIndicadorCodigo}' não encontrada no ciclo` }); continue; }
        parentMetaId = found;
      }

      // Build SMART JSON if any field provided
      const smartFields = { e: row.smart_e, m: row.smart_m, a: row.smart_a, r: row.smart_r, t: row.smart_t };
      const hasSmartData = Object.values(smartFields).some((v) => v?.trim());
      const smart = hasSmartData ? JSON.stringify(smartFields) : null;

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
            parentMetaId,
            smart,
          },
        });
        // Invalidate cache so newly created metas can be referenced as parents in subsequent rows
        metasByIndicador = null;
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

import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";
import { gerarPeriodos } from "@/app/lib/calc";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");

  if (!cicloId) {
    return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });
  }

  const ciclo = await prisma.cicloICP.findUnique({ where: { id: Number(cicloId) } });
  if (!ciclo) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  const periodos = gerarPeriodos(ciclo.anoFiscal, ciclo.mesInicio, ciclo.mesFim, "MENSAL");

  const indicadores = await prisma.indicador.findMany({
    where: { cicloId: Number(cicloId), numeradorId: null, divisorId: null },
    orderBy: { codigo: "asc" },
  });

  const headers = [
    "indicador",
    ...periodos.map(p => `realizado_${p}`),
    ...periodos.map(p => `orcado_${p}`),
  ];

  const rows = indicadores.map(ind => [
    ind.codigo,
    ...periodos.map(() => ""),
    ...periodos.map(() => ""),
  ]);

  if (rows.length === 0) {
    rows.push(["IND-001", ...periodos.map(() => ""), ...periodos.map(() => "")]);
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = [{ wch: 12 }, ...periodos.flatMap(() => [{ wch: 12 }]), ...periodos.flatMap(() => [{ wch: 12 }])];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resultados");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_resultados.xlsx"',
    },
  });
}

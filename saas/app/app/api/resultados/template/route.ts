import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const headers = ["indicador", "periodo", "orcado", "realizado"];
  const exemplos = [
    ["IND-001", "2025-01", "1000000", "980000"],
    ["IND-001", "2025-02", "1000000", ""],
    ["IND-002", "2025-T1", "500", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplos]);
  ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];

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

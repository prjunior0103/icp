import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const headers = ["centroCusto", "codEmpresa", "nivel1", "nivel2", "nivel3", "nivel4", "nivel5"];
  const example = ["CC001", "EMP01", "Diretoria", "Comercial", "", "", ""];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Areas");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_areas.xlsx"',
    },
  });
}

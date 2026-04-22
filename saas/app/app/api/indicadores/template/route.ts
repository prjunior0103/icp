import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const headers = ["codigo","nome","tipo","abrangencia","unidade","metaMinima","metaAlvo","metaMaxima",
    "baseline","metrica","periodicidade","criterioApuracao","origemDado","analistaResp","descricao"];
  const example = ["IND001","Faturamento","MAIOR_MELHOR","CORPORATIVO","R$","800000","1000000","1200000",
    "900000","Receita Bruta","MENSAL","SOMA","ERP","Ana Lima","Faturamento total do período"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Indicadores");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_indicadores.xlsx"',
    },
  });
}

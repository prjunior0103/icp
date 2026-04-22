import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const headers = [
    "nome", "matricula", "cargo", "grade", "email",
    "salarioBase", "target", "centroCusto", "codEmpresa",
    "admissao", "matriculaGestor", "nomeGestor", "status",
  ];
  const example = [
    "João Silva", "12345", "Analista", "G3", "joao@empresa.com",
    "5000", "1.5", "CC001", "EMP01",
    "2023-01-15", "99999", "Maria Souza", "ATIVO",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_colaboradores.xlsx"',
    },
  });
}

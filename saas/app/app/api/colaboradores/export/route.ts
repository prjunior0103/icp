import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: Number(cicloId) },
    orderBy: { nome: "asc" },
  });

  const data = colaboradores.map(c => ({
    Matrícula: c.matricula,
    Nome: c.nome,
    Email: c.email ?? "",
    Cargo: c.cargo,
    Grade: c.grade ?? "",
    "Salário Base": c.salarioBase,
    Target: c.target,
    "Centro Custo": c.centroCusto ?? "",
    "Cód Empresa": c.codEmpresa ?? "",
    Admissão: c.admissao ? new Date(c.admissao).toISOString().slice(0, 10) : "",
    "Matrícula Gestor": c.matriculaGestor ?? "",
    "Nome Gestor": c.nomeGestor ?? "",
    Status: c.status,
    "Data Desligamento": c.dataDesligamento ? new Date(c.dataDesligamento).toISOString().slice(0, 10) : "",
    "Tipo Desligamento": c.tipoDesligamento ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Colaboradores");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores_ciclo_${cicloId}.xlsx"`,
    },
  });
}

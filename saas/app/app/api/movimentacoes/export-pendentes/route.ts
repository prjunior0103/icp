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

  const pendentes = await prisma.movimentacaoColaborador.findMany({
    where: { cicloId: Number(cicloId), tipo: "POSSIVEL_DESLIGAMENTO", statusTratamento: "PENDENTE" },
  });

  const matriculas = pendentes.map(p => p.matricula);
  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: Number(cicloId), matricula: { in: matriculas } },
  });
  const colabMap = new Map(colaboradores.map(c => [c.matricula, c]));

  const data = pendentes.map(p => {
    const c = colabMap.get(p.matricula);
    return {
      matricula: p.matricula,
      nome: c?.nome ?? "",
      cargo: c?.cargo ?? "",
      centroCusto: c?.centroCusto ?? "",
      nomeGestor: c?.nomeGestor ?? "",
      dataDesligamento: "",
      tipoDesligamento: "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Pendentes Desligamento");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pendentes_desligamento_ciclo_${cicloId}.xlsx"`,
    },
  });
}

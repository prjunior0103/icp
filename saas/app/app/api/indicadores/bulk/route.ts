import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

const JANELAS_VALIDAS = ["ABERTA", "FECHADA", "PRORROGADA"];
const STATUS_VALIDOS = ["ATIVO", "INATIVO", "DRAFT"];

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { ids, statusJanela, status } = body as {
    ids: number[];
    statusJanela?: string;
    status?: string;
  };

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "ids obrigatório" }, { status: 400 });
  }
  if (!statusJanela && !status) {
    return NextResponse.json({ error: "statusJanela ou status obrigatório" }, { status: 400 });
  }
  if (statusJanela && !JANELAS_VALIDAS.includes(statusJanela)) {
    return NextResponse.json({ error: "statusJanela inválido" }, { status: 400 });
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (statusJanela) {
    data.statusJanela = statusJanela;
    if (statusJanela === "ABERTA") data.janelaAbertaEm = new Date();
    if (statusJanela === "FECHADA") data.janelaFechadaEm = new Date();
  }
  if (status) data.status = status;

  const result = await prisma.indicador.updateMany({
    where: { id: { in: ids } },
    data,
  });

  const { userId, userName } = getAuditUser(session);
  const campos = [statusJanela && `janela → ${statusJanela}`, status && `status → ${status}`].filter(Boolean).join(", ");
  await logAudit({
    userId, userName, acao: "EDITAR", entidade: "Indicador", entidadeId: 0,
    descricao: `Edição em massa de ${result.count} indicador(es): ${campos}`,
  });

  return NextResponse.json({ updated: result.count });
}

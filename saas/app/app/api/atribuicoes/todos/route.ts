import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { cicloId, agrupamentoId, pesoNaCesta } = await req.json();
  if (!cicloId || !agrupamentoId || pesoNaCesta == null)
    return NextResponse.json({ error: "cicloId, agrupamentoId e pesoNaCesta obrigatórios" }, { status: 400 });

  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: Number(cicloId) },
    select: { id: true },
  });

  let criados = 0;
  let erros = 0;
  for (const c of colaboradores) {
    try {
      await prisma.atribuicaoAgrupamento.upsert({
        where: { colaboradorId_agrupamentoId: { colaboradorId: c.id, agrupamentoId: Number(agrupamentoId) } },
        create: { cicloId: Number(cicloId), colaboradorId: c.id, agrupamentoId: Number(agrupamentoId), pesoNaCesta: Number(pesoNaCesta), cascata: "NENHUM" },
        update: { pesoNaCesta: Number(pesoNaCesta) },
      });
      criados++;
    } catch { erros++; }
  }

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "Atribuicao", entidadeId: String(agrupamentoId), descricao: `Atribuir a todos: agrupamentoId ${agrupamentoId} — ${criados} atribuições criadas/atualizadas` });

  return NextResponse.json({ criados, erros, total: colaboradores.length });
}

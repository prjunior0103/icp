import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    // Delete in dependency order (children first)
    await prisma.metaHistorico.deleteMany();
    await prisma.planoAcao.deleteMany();
    await prisma.prorrogacaoWaiver.deleteMany();
    await prisma.workflowItem.deleteMany();
    await prisma.realizacao.deleteMany();
    await prisma.metaColaborador.deleteMany();
    await prisma.agrupamentoMeta.deleteMany();
    await prisma.agrupamentoAtribuicao.deleteMany();
    await prisma.agrupamento.deleteMany();
    await prisma.meta.deleteMany();
    await prisma.janelaApuracao.deleteMany();
    await prisma.movimentacaoRH.deleteMany();
    await prisma.colaborador.deleteMany();
    await prisma.faixaAtingimento.deleteMany();
    await prisma.indicador.deleteMany();
    await prisma.cicloICP.deleteMany();
    await prisma.centroCusto.deleteMany();
    await prisma.cargo.deleteMany();
    await prisma.empresa.deleteMany();
    await prisma.bibliotecaMeta.deleteMany();
    await prisma.parametroSistema.deleteMany();

    return NextResponse.json({ data: { message: "Banco limpo com sucesso." } });
  } catch (err) {
    console.error("Reset error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

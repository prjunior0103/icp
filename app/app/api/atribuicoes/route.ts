import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

// Recursivo: busca todos subordinados diretos e indiretos
async function buscarSubordinados(gestorId: number, cicloId: number, indiretos: boolean): Promise<number[]> {
  const diretos = await prisma.colaborador.findMany({
    where: { gestorId, cicloId }, select: { id: true },
  });
  const ids = diretos.map(d => d.id);
  if (indiretos) {
    for (const d of diretos) {
      const sub = await buscarSubordinados(d.id, cicloId, true);
      ids.push(...sub);
    }
  }
  return ids;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });
  const atribuicoes = await prisma.atribuicaoAgrupamento.findMany({
    where: { cicloId: Number(cicloId) },
    include: {
      colaborador: { include: { area: true } },
      agrupamento: { include: { indicadores: { include: { indicador: true } } } },
    },
    orderBy: { colaborador: { nome: "asc" } },
  });
  return NextResponse.json({ atribuicoes });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { cicloId, colaboradorId, agrupamentoId, pesoNaCesta, cascata } = await req.json();
  if (!cicloId || !colaboradorId || !agrupamentoId || pesoNaCesta == null)
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });

  const criados: number[] = [];

  async function atribuir(colabId: number) {
    try {
      const a = await prisma.atribuicaoAgrupamento.upsert({
        where: { colaboradorId_agrupamentoId: { colaboradorId: colabId, agrupamentoId: Number(agrupamentoId) } },
        create: { cicloId: Number(cicloId), colaboradorId: colabId, agrupamentoId: Number(agrupamentoId), pesoNaCesta: Number(pesoNaCesta), cascata: cascata ?? "NENHUM" },
        update: { pesoNaCesta: Number(pesoNaCesta), cascata: cascata ?? "NENHUM" },
      });
      criados.push(a.id);
    } catch { /* ignora */ }
  }

  await atribuir(Number(colaboradorId));

  if (cascata === "DIRETOS" || cascata === "DIRETOS_E_INDIRETOS") {
    const subIds = await buscarSubordinados(Number(colaboradorId), Number(cicloId), cascata === "DIRETOS_E_INDIRETOS");
    for (const sid of subIds) await atribuir(sid);
  }

  return NextResponse.json({ criados: criados.length }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await prisma.atribuicaoAgrupamento.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  const tipo = searchParams.get("tipo") ?? "";
  const busca = searchParams.get("busca") ?? "";
  const status = searchParams.get("status") ?? "";

  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const movimentacoes = await prisma.movimentacaoColaborador.findMany({
    where: {
      cicloId: Number(cicloId),
      ...(tipo && { tipo }),
      ...(status && { statusTratamento: status }),
      ...(busca && { matricula: { contains: busca } }),
    },
    orderBy: { criadoEm: "desc" },
    take: 500,
  });

  // Enriquecer com nome do colaborador e nomes dos painéis
  const matriculas = [...new Set(movimentacoes.map(m => m.matricula))];
  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: Number(cicloId), matricula: { in: matriculas } },
    select: { matricula: true, nome: true, centroCusto: true, nomeGestor: true, status: true, dataDesligamento: true, tipoDesligamento: true },
  });
  const colabMap = new Map(colaboradores.map(c => [c.matricula, c]));

  const painelIds = movimentacoes.flatMap(m => [m.painelAnteriorId, m.painelNovoId]).filter((id): id is number => id != null);
  const paineis = painelIds.length > 0
    ? await prisma.agrupamento.findMany({ where: { id: { in: painelIds } }, select: { id: true, nome: true } })
    : [];
  const painelMap = new Map(paineis.map(p => [p.id, p.nome]));

  const enriched = movimentacoes.map(m => ({
    ...m,
    nomeColaborador: colabMap.get(m.matricula)?.nome ?? null,
    statusColaborador: colabMap.get(m.matricula)?.status ?? null,
    painelAnteriorNome: m.painelAnteriorId ? painelMap.get(m.painelAnteriorId) ?? null : null,
    painelNovoNome: m.painelNovoId ? painelMap.get(m.painelNovoId) ?? null : null,
  }));

  return NextResponse.json({ movimentacoes: enriched });
}

// PUT — tratar movimentação (atribuir painel, ignorar, confirmar desligamento individual)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, acao, painelNovoId, dataDesligamento, tipoDesligamento } = body as {
    id: number;
    acao: "TRATAR" | "IGNORAR" | "CONFIRMAR_DESLIGAMENTO";
    painelNovoId?: number;
    dataDesligamento?: string;
    tipoDesligamento?: string;
  };

  const mov = await prisma.movimentacaoColaborador.findUnique({ where: { id } });
  if (!mov) return NextResponse.json({ error: "Movimentação não encontrada" }, { status: 404 });

  if (acao === "TRATAR" && mov.requerNovoPainel && painelNovoId) {
    await prisma.movimentacaoColaborador.update({
      where: { id },
      data: { painelNovoId, statusTratamento: "TRATADO" },
    });
    return NextResponse.json({ ok: true });
  }

  if (acao === "IGNORAR") {
    await prisma.movimentacaoColaborador.update({
      where: { id },
      data: { statusTratamento: "IGNORADO" },
    });
    return NextResponse.json({ ok: true });
  }

  if (acao === "CONFIRMAR_DESLIGAMENTO" && mov.tipo === "POSSIVEL_DESLIGAMENTO") {
    if (!dataDesligamento || !tipoDesligamento) {
      return NextResponse.json({ error: "dataDesligamento e tipoDesligamento obrigatórios" }, { status: 400 });
    }
    // Atualizar colaborador
    await prisma.colaborador.updateMany({
      where: { cicloId: mov.cicloId, matricula: mov.matricula },
      data: {
        status: "INATIVO",
        dataDesligamento: new Date(dataDesligamento),
        tipoDesligamento,
      },
    });
    // Atualizar movimentação
    await prisma.movimentacaoColaborador.update({
      where: { id },
      data: {
        tipo: "DESLIGAMENTO",
        statusTratamento: "TRATADO",
        dadosNovos: JSON.stringify({ dataDesligamento, tipoDesligamento }),
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida ou dados faltantes" }, { status: 400 });
}

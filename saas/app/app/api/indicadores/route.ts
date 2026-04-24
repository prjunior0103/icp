import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { logAudit, getAuditUser } from "@/app/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });
  const indicadores = await prisma.indicador.findMany({
    where: { cicloId: Number(cicloId) },
    orderBy: { codigo: "asc" },
  });
  return NextResponse.json({ indicadores });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  const { cicloId, nome, tipo, abrangencia, unidade, metaMinima, metaAlvo, metaMaxima,
    baseline, metrica, piso, teto, gatilho, bonusMetaZero, periodicidade, criterioApuracao,
    origemDado, analistaResp, aprovadorId, responsavelEnvioId, numeradorId, divisorId,
    statusJanela, janelaAbertaEm, janelaFechadaEm, status, descricao } = body;
  if (!cicloId || !nome || !tipo) {
    return NextResponse.json({ error: "cicloId, nome e tipo são obrigatórios" }, { status: 400 });
  }
  const existentes = await prisma.indicador.findMany({
    where: { cicloId: Number(cicloId) },
    select: { codigo: true },
  });
  let maxNum = 0;
  for (const e of existentes) {
    const m = e.codigo.match(/^IND-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
  }
  const codigo = `IND-${String(maxNum + 1).padStart(3, "0")}`;
  const indicador = await prisma.indicador.create({
    data: {
      cicloId: Number(cicloId), codigo, nome, tipo, descricao: descricao || null,
      abrangencia: abrangencia ?? "CORPORATIVO", unidade: unidade ?? "%",
      metaMinima: metaMinima != null ? Number(metaMinima) : null,
      metaAlvo: metaAlvo != null ? Number(metaAlvo) : null,
      metaMaxima: metaMaxima != null ? Number(metaMaxima) : null,
      baseline: baseline != null ? Number(baseline) : null,
      piso: piso != null && piso !== "" ? Number(piso) : null,
      teto: teto != null && teto !== "" ? Number(teto) : null,
      gatilho: gatilho != null && gatilho !== "" ? Number(gatilho) : null,
      bonusMetaZero: bonusMetaZero != null && bonusMetaZero !== "" ? Number(bonusMetaZero) : null,
      metrica: metrica || null, periodicidade: periodicidade ?? "MENSAL",
      criterioApuracao: criterioApuracao ?? "ULTIMA_POSICAO",
      origemDado: origemDado || null, analistaResp: analistaResp || null,
      aprovadorId: aprovadorId || null,
      responsavelEnvioId: responsavelEnvioId ? Number(responsavelEnvioId) : null,
      numeradorId: numeradorId ? Number(numeradorId) : null,
      divisorId: divisorId ? Number(divisorId) : null,
      statusJanela: statusJanela ?? "FECHADA",
      janelaAbertaEm: janelaAbertaEm ? new Date(janelaAbertaEm) : null,
      janelaFechadaEm: janelaFechadaEm ? new Date(janelaFechadaEm) : null,
      status: status ?? "DRAFT",
    },
  });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "CRIAR", entidade: "Indicador", entidadeId: indicador.id, descricao: `Indicador ${codigo} — ${nome} criado` });

  return NextResponse.json({ indicador }, { status: 201 });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const data: Record<string, unknown> = {};
  const fields = ["codigo","nome","tipo","abrangencia","unidade","metaMinima","metaAlvo","metaMaxima",
    "baseline","metrica","piso","teto","gatilho","bonusMetaZero","periodicidade","criterioApuracao",
    "origemDado","analistaResp","aprovadorId","responsavelEnvioId","numeradorId","divisorId",
    "statusJanela","janelaAbertaEm","janelaFechadaEm","status","descricao"];
  for (const f of fields) {
    if (rest[f] !== undefined) {
      if (["metaMinima","metaAlvo","metaMaxima","baseline","piso","teto","gatilho","bonusMetaZero"].includes(f))
        data[f] = rest[f] != null && rest[f] !== "" ? Number(rest[f]) : null;
      else if (["responsavelEnvioId","numeradorId","divisorId"].includes(f))
        data[f] = rest[f] ? Number(rest[f]) : null;
      else if (["janelaAbertaEm","janelaFechadaEm"].includes(f))
        data[f] = rest[f] ? new Date(rest[f]) : null;
      else data[f] = rest[f] || null;
    }
  }
  const indicador = await prisma.indicador.update({ where: { id: Number(id) }, data });

  const { userId, userName } = getAuditUser(session);
  await logAudit({ userId, userName, acao: "EDITAR", entidade: "Indicador", entidadeId: id, descricao: `Indicador ${indicador.codigo} — ${indicador.nome} editado`, dadosNovos: data });

  return NextResponse.json({ indicador });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const numId = Number(id);
  try {
    const indicador = await prisma.indicador.findUnique({ where: { id: numId } });
    // Remove vínculos com agrupamentos antes de deletar (sem cascade na FK)
    await prisma.indicadorNoAgrupamento.deleteMany({ where: { indicadorId: numId } });
    await prisma.indicador.delete({ where: { id: numId } });

    const { userId, userName } = getAuditUser(session);
    await logAudit({ userId, userName, acao: "EXCLUIR", entidade: "Indicador", entidadeId: id, descricao: `Indicador ${indicador?.codigo ?? id} — ${indicador?.nome ?? ""} excluído`, dadosAntigos: indicador });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

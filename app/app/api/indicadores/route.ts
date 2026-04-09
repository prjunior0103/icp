import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

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
  const { cicloId, codigo, nome, tipo, abrangencia, unidade, metaMinima, metaAlvo, metaMaxima,
    baseline, metrica, periodicidade, criterioApuracao, origemDado, analistaResp,
    aprovadorId, responsavelEnvioId, divisorId, statusJanela, janelaAbertaEm, janelaFechadaEm,
    status, descricao } = body;
  if (!cicloId || !codigo || !nome || !tipo) {
    return NextResponse.json({ error: "cicloId, codigo, nome e tipo são obrigatórios" }, { status: 400 });
  }
  const indicador = await prisma.indicador.create({
    data: {
      cicloId: Number(cicloId), codigo, nome, tipo, descricao: descricao || null,
      abrangencia: abrangencia ?? "CORPORATIVO", unidade: unidade ?? "%",
      metaMinima: metaMinima != null ? Number(metaMinima) : null,
      metaAlvo: metaAlvo != null ? Number(metaAlvo) : null,
      metaMaxima: metaMaxima != null ? Number(metaMaxima) : null,
      baseline: baseline != null ? Number(baseline) : null,
      metrica: metrica || null, periodicidade: periodicidade ?? "MENSAL",
      criterioApuracao: criterioApuracao ?? "ULTIMA_POSICAO",
      origemDado: origemDado || null, analistaResp: analistaResp || null,
      aprovadorId: aprovadorId || null,
      responsavelEnvioId: responsavelEnvioId ? Number(responsavelEnvioId) : null,
      divisorId: divisorId ? Number(divisorId) : null,
      statusJanela: statusJanela ?? "FECHADA",
      janelaAbertaEm: janelaAbertaEm ? new Date(janelaAbertaEm) : null,
      janelaFechadaEm: janelaFechadaEm ? new Date(janelaFechadaEm) : null,
      status: status ?? "DRAFT",
    },
  });
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
    "baseline","metrica","periodicidade","criterioApuracao","origemDado","analistaResp","aprovadorId",
    "responsavelEnvioId","divisorId","statusJanela","janelaAbertaEm","janelaFechadaEm","status","descricao"];
  for (const f of fields) {
    if (rest[f] !== undefined) {
      if (["metaMinima","metaAlvo","metaMaxima","baseline"].includes(f))
        data[f] = rest[f] != null ? Number(rest[f]) : null;
      else if (["responsavelEnvioId","divisorId"].includes(f))
        data[f] = rest[f] ? Number(rest[f]) : null;
      else if (["janelaAbertaEm","janelaFechadaEm"].includes(f))
        data[f] = rest[f] ? new Date(rest[f]) : null;
      else data[f] = rest[f] || null;
    }
  }
  const indicador = await prisma.indicador.update({ where: { id: Number(id) }, data });
  return NextResponse.json({ indicador });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await prisma.indicador.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

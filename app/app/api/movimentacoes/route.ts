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

  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const movimentacoes = await prisma.movimentacaoColaborador.findMany({
    where: {
      cicloId: Number(cicloId),
      ...(tipo && { tipo }),
      ...(busca && { matricula: { contains: busca } }),
    },
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  return NextResponse.json({ movimentacoes });
}

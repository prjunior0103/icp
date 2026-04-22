import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const acao = searchParams.get("acao") ?? "";
  const entidade = searchParams.get("entidade") ?? "";
  const busca = searchParams.get("busca") ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const offset = Number(searchParams.get("offset") ?? "0");

  const where = {
    ...(acao && { acao }),
    ...(entidade && { entidade }),
    ...(busca && {
      OR: [
        { userName: { contains: busca } },
        { descricao: { contains: busca } },
        { entidadeId: { contains: busca } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total });
}

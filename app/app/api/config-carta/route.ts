import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const cicloId = new URL(req.url).searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const config = await prisma.configCartaICP.findUnique({ where: { cicloId: Number(cicloId) } });
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "GUARDIAO" && role !== "BP") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { cicloId, gatilhoPercentual, gatilhoIndicador, gatilhoTotal, reguladorPool, targetSalarioPool, targetBonus, textoCriterios } = body;
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const config = await prisma.configCartaICP.upsert({
    where: { cicloId: Number(cicloId) },
    create: { cicloId: Number(cicloId), gatilhoPercentual: Number(gatilhoPercentual ?? 80), gatilhoIndicador: gatilhoIndicador ?? "", gatilhoTotal: gatilhoTotal ?? "", reguladorPool: JSON.stringify(reguladorPool ?? []), targetSalarioPool: targetSalarioPool ?? "", targetBonus: targetBonus ?? "", textoCriterios: textoCriterios ?? "" },
    update: { gatilhoPercentual: Number(gatilhoPercentual ?? 80), gatilhoIndicador: gatilhoIndicador ?? "", gatilhoTotal: gatilhoTotal ?? "", reguladorPool: JSON.stringify(reguladorPool ?? []), targetSalarioPool: targetSalarioPool ?? "", targetBonus: targetBonus ?? "", textoCriterios: textoCriterios ?? "" },
  });

  return NextResponse.json({ config });
}

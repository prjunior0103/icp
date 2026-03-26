import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const metaId = searchParams.get("metaId");
    if (!metaId) return NextResponse.json({ error: "metaId obrigatorio" }, { status: 400 });
    const historico = await prisma.metaHistorico.findMany({
      where: { metaId: Number(metaId) },
      orderBy: { criadoEm: "desc" },
    });
    return NextResponse.json({ data: historico });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

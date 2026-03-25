import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const ciclos = await prisma.cicloICP.findMany({
      include: {
        indicadores: { select: { id: true } },
        metas: { select: { id: true } },
      },
      orderBy: { anoFiscal: "desc" },
    });
    return NextResponse.json({ data: ciclos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ciclo = await prisma.cicloICP.create({
      data: {
        anoFiscal: Number(body.anoFiscal),
        status: body.status ?? "SETUP",
        mesInicio: body.mesInicio ? Number(body.mesInicio) : 1,
        mesFim: body.mesFim ? Number(body.mesFim) : 12,
        gatilhoEbitda: body.gatilhoEbitda ? Number(body.gatilhoEbitda) : undefined,
        bonusPool: body.bonusPool ? Number(body.bonusPool) : undefined,
      },
    });
    return NextResponse.json({ data: ciclo }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    const ciclo = await prisma.cicloICP.update({
      where: { id: Number(id) },
      data: {
        status: data.status,
        mesInicio: data.mesInicio ? Number(data.mesInicio) : undefined,
        mesFim: data.mesFim ? Number(data.mesFim) : undefined,
        gatilhoEbitda: data.gatilhoEbitda !== undefined ? Number(data.gatilhoEbitda) : undefined,
        bonusPool: data.bonusPool !== undefined ? Number(data.bonusPool) : undefined,
      },
    });
    return NextResponse.json({ data: ciclo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    await prisma.cicloICP.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.bibliotecaMeta.findMany({ orderBy: { nome: "asc" } });
    return NextResponse.json({ data: templates });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template = await prisma.bibliotecaMeta.create({
      data: {
        nome: body.nome,
        descricao: body.descricao ?? null,
        indicadorNome: body.indicadorNome,
        unidade: body.unidade ?? "%",
        tipo: body.tipo,
        polaridade: body.polaridade ?? "MAIOR_MELHOR",
        abrangencia: body.abrangencia,
        metaMinima: body.metaMinima ? Number(body.metaMinima) : null,
        metaAlvo: body.metaAlvo ? Number(body.metaAlvo) : null,
        metaMaxima: body.metaMaxima ? Number(body.metaMaxima) : null,
        pesoSugerido: Number(body.pesoSugerido ?? 100),
      },
    });
    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    await prisma.bibliotecaMeta.delete({ where: { id: Number(id) } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

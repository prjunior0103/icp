import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const cicloId = formData.get("cicloId");
  if (!file || !cicloId) return NextResponse.json({ error: "file e cicloId obrigatórios" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const erros: string[] = [];
  let criados = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; const linha = i + 2;
    if (!r.codigo || !r.nome || !r.tipo) { erros.push(`Linha ${linha}: codigo, nome e tipo obrigatórios`); continue; }
    try {
      await prisma.indicador.create({
        data: {
          cicloId: Number(cicloId), codigo: String(r.codigo), nome: String(r.nome), tipo: String(r.tipo),
          abrangencia: r.abrangencia || "CORPORATIVO", unidade: r.unidade || "%",
          metaMinima: r.metaMinima ? Number(r.metaMinima) : null,
          metaAlvo: r.metaAlvo ? Number(r.metaAlvo) : null,
          metaMaxima: r.metaMaxima ? Number(r.metaMaxima) : null,
          baseline: r.baseline ? Number(r.baseline) : null,
          metrica: r.metrica || null, periodicidade: r.periodicidade || "MENSAL",
          criterioApuracao: r.criterioApuracao || "ULTIMA_POSICAO",
          origemDado: r.origemDado || null, analistaResp: r.analistaResp || null,
          descricao: r.descricao || null,
        },
      });
      criados++;
    } catch { erros.push(`Linha ${linha}: erro (código duplicado?)`); }
  }
  return NextResponse.json({ criados, erros });
}

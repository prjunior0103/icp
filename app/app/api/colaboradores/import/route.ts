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

  if (!file || !cicloId) {
    return NextResponse.json({ error: "file e cicloId obrigatórios" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

  const erros: string[] = [];
  let criados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    if (!row.nome || !row.matricula || !row.cargo || !row.salarioBase || !row.target) {
      erros.push(`Linha ${linha}: nome, matricula, cargo, salarioBase e target são obrigatórios`);
      continue;
    }

    const salarioBase = Number(row.salarioBase);
    const target = Number(row.target);

    if (isNaN(salarioBase) || isNaN(target)) {
      erros.push(`Linha ${linha}: salarioBase e target devem ser números`);
      continue;
    }

    const statusValidos = ["ATIVO", "INATIVO", "AFASTADO"];
    const status = statusValidos.includes(row.status?.toUpperCase())
      ? row.status.toUpperCase()
      : "ATIVO";

    try {
      await prisma.colaborador.create({
        data: {
          cicloId: Number(cicloId),
          nome: String(row.nome),
          matricula: String(row.matricula),
          cargo: String(row.cargo),
          grade: row.grade || null,
          email: row.email || null,
          salarioBase,
          target,
          centroCusto: row.centroCusto || null,
          codEmpresa: row.codEmpresa || null,
          admissao: row.admissao ? new Date(String(row.admissao)) : null,
          matriculaGestor: row.matriculaGestor || null,
          nomeGestor: row.nomeGestor || null,
          status,
        },
      });
      criados++;
    } catch {
      erros.push(`Linha ${linha}: erro ao salvar (matrícula duplicada?)`);
    }
  }

  return NextResponse.json({ criados, erros });
}

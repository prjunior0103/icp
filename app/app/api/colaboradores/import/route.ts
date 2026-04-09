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

    const matricula = String(row.matricula).trim();
    const admissao = row.admissao ? new Date(String(row.admissao)) : null;
    if (admissao && isNaN(admissao.getTime())) {
      erros.push(`Linha ${linha}: data de admissão inválida "${row.admissao}"`);
      continue;
    }

    try {
      const existing = await prisma.colaborador.findFirst({
        where: { cicloId: Number(cicloId), matricula },
      });
      if (existing) {
        await prisma.colaborador.update({
          where: { id: existing.id },
          data: {
            nome: String(row.nome).trim(),
            cargo: String(row.cargo).trim(),
            grade: row.grade || null,
            email: row.email || null,
            salarioBase,
            target,
            centroCusto: row.centroCusto || null,
            codEmpresa: row.codEmpresa || null,
            admissao,
            matriculaGestor: row.matriculaGestor || null,
            nomeGestor: row.nomeGestor || null,
            status,
          },
        });
      } else {
        await prisma.colaborador.create({
          data: {
            cicloId: Number(cicloId),
            nome: String(row.nome).trim(),
            matricula,
            cargo: String(row.cargo).trim(),
            grade: row.grade || null,
            email: row.email || null,
            salarioBase,
            target,
            centroCusto: row.centroCusto || null,
            codEmpresa: row.codEmpresa || null,
            admissao,
            matriculaGestor: row.matriculaGestor || null,
            nomeGestor: row.nomeGestor || null,
            status,
          },
        });
      }
      criados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`Linha ${linha} (matrícula ${row.matricula}): ${msg}`);
    }
  }

  return NextResponse.json({ criados, erros });
}

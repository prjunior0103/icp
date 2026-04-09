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
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  // Converte qualquer valor para string ou null (XLSX pode retornar number/boolean para células numéricas/booleanas)
  const toStr = (v: unknown): string | null => {
    if (v == null || v === "" || v === false) return null;
    return String(v).trim() || null;
  };

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
    const statusRaw = toStr(row.status)?.toUpperCase() ?? "";
    const status = statusValidos.includes(statusRaw) ? statusRaw : "ATIVO";

    const matricula = String(row.matricula).trim();
    let admissao: Date | null = null;
    if (row.admissao && row.admissao !== "") {
      // XLSX com cellDates:true retorna Date; sem ela, retorna número serial ou string
      admissao = row.admissao instanceof Date ? row.admissao : new Date(String(row.admissao));
      if (isNaN(admissao.getTime())) {
        erros.push(`Linha ${linha}: data de admissão inválida "${row.admissao}"`);
        continue;
      }
    }

    try {
      const existing = await prisma.colaborador.findFirst({
        where: { cicloId: Number(cicloId), matricula },
      });
      const sharedData = {
        nome: String(row.nome).trim(),
        cargo: String(row.cargo).trim(),
        grade: toStr(row.grade),
        email: toStr(row.email),
        salarioBase,
        target,
        centroCusto: toStr(row.centroCusto),
        codEmpresa: toStr(row.codEmpresa),
        admissao,
        matriculaGestor: toStr(row.matriculaGestor),
        nomeGestor: toStr(row.nomeGestor),
        status,
      };

      if (existing) {
        await prisma.colaborador.update({
          where: { id: existing.id },
          data: sharedData,
        });
      } else {
        await prisma.colaborador.create({
          data: { cicloId: Number(cicloId), matricula, ...sharedData },
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

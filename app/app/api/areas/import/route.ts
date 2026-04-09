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
  const criadas: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    if (!row.centroCusto || !row.codEmpresa || !row.nivel1) {
      erros.push(`Linha ${linha}: centroCusto, codEmpresa e nivel1 são obrigatórios`);
      continue;
    }

    try {
      const area = await prisma.area.create({
        data: {
          cicloId: Number(cicloId),
          centroCusto: String(row.centroCusto),
          codEmpresa: String(row.codEmpresa),
          nivel1: String(row.nivel1),
          nivel2: row.nivel2 || null,
          nivel3: row.nivel3 || null,
          nivel4: row.nivel4 || null,
          nivel5: row.nivel5 || null,
        },
      });
      criadas.push(area.id);
    } catch {
      erros.push(`Linha ${linha}: erro ao salvar`);
    }
  }

  return NextResponse.json({ criadas: criadas.length, erros });
}

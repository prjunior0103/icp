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

  const cid = Number(cicloId);
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const erros: string[] = [];
  let processados = 0;

  const TIPOS_VALIDOS = ["VOLUNTARIO", "INVOLUNTARIO", "TERMINO_CONTRATO", "APOSENTADORIA", "FALECIMENTO", "OUTROS"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    const matricula = String(row.matricula ?? row.Matricula ?? row.MATRICULA ?? "").trim();
    if (!matricula) {
      erros.push(`Linha ${linha}: matrícula não encontrada`);
      continue;
    }

    const dataRaw = row.dataDesligamento ?? row.DataDesligamento ?? row["Data Desligamento"] ?? row["data_desligamento"] ?? "";
    const tipoRaw = String(row.tipoDesligamento ?? row.TipoDesligamento ?? row["Tipo Desligamento"] ?? row["tipo_desligamento"] ?? "").trim().toUpperCase();

    if (!dataRaw) {
      erros.push(`Linha ${linha} (${matricula}): dataDesligamento ausente — ignorada`);
      continue;
    }
    if (!tipoRaw || !TIPOS_VALIDOS.includes(tipoRaw)) {
      erros.push(`Linha ${linha} (${matricula}): tipoDesligamento inválido "${tipoRaw}". Válidos: ${TIPOS_VALIDOS.join(", ")}`);
      continue;
    }

    const data = dataRaw instanceof Date ? dataRaw : new Date(String(dataRaw));
    if (isNaN(data.getTime())) {
      erros.push(`Linha ${linha} (${matricula}): data inválida "${dataRaw}"`);
      continue;
    }

    // Atualizar colaborador
    const updated = await prisma.colaborador.updateMany({
      where: { cicloId: cid, matricula },
      data: { status: "INATIVO", dataDesligamento: data, tipoDesligamento: tipoRaw },
    });

    if (updated.count === 0) {
      erros.push(`Linha ${linha}: matrícula "${matricula}" não encontrada no ciclo`);
      continue;
    }

    // Atualizar movimentação pendente se existir
    const movPendente = await prisma.movimentacaoColaborador.findFirst({
      where: { cicloId: cid, matricula, tipo: "POSSIVEL_DESLIGAMENTO", statusTratamento: "PENDENTE" },
    });
    if (movPendente) {
      await prisma.movimentacaoColaborador.update({
        where: { id: movPendente.id },
        data: {
          tipo: "DESLIGAMENTO",
          statusTratamento: "TRATADO",
          dadosNovos: JSON.stringify({ dataDesligamento: data.toISOString().slice(0, 10), tipoDesligamento: tipoRaw }),
        },
      });
    } else {
      // Criar movimentação de desligamento
      await prisma.movimentacaoColaborador.create({
        data: {
          cicloId: cid,
          matricula,
          tipo: "DESLIGAMENTO",
          dadosNovos: JSON.stringify({ dataDesligamento: data.toISOString().slice(0, 10), tipoDesligamento: tipoRaw }),
          statusTratamento: "TRATADO",
        },
      });
    }

    processados++;
  }

  return NextResponse.json({ processados, erros });
}

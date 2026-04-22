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

  // Carregar indicadores do ciclo para resolver código → id
  const indicadoresDoCiclo = await prisma.indicador.findMany({
    where: { cicloId: cid },
    select: { id: true, codigo: true },
  });
  const indicadorPorCodigo = new Map(indicadoresDoCiclo.map(i => [i.codigo.trim().toLowerCase(), i.id]));

  // Parse XLSX
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const normKey = (k: string) =>
    k.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s_-]+/g, "");

  const KEY_MAP: Record<string, string> = {
    indicador: "indicador", codigo: "indicador", codigoindicador: "indicador",
    periodo: "periodo", mes: "periodo", period: "periodo",
    orcado: "orcado", orcamento: "orcado", budget: "orcado",
    realizado: "realizado", real: "realizado", actual: "realizado",
  };

  const rows = rawRows.map(rawRow => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const canonical = KEY_MAP[normKey(k)];
      if (canonical) row[canonical] = v;
    }
    return row;
  });

  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    const codigoBruto = String(row.indicador ?? "").trim();
    const periodo = String(row.periodo ?? "").trim();
    const orcadoRaw = String(row.orcado ?? "").trim();
    const realizadoRaw = String(row.realizado ?? "").trim();

    if (!codigoBruto) { erros.push(`Linha ${linha}: coluna "indicador" ausente ou vazia`); continue; }
    if (!periodo) { erros.push(`Linha ${linha}: coluna "periodo" ausente ou vazia`); continue; }
    if (!orcadoRaw && !realizadoRaw) { erros.push(`Linha ${linha}: pelo menos "orcado" ou "realizado" deve ser preenchido`); continue; }

    const indicadorId = indicadorPorCodigo.get(codigoBruto.toLowerCase());
    if (!indicadorId) { erros.push(`Linha ${linha}: indicador "${codigoBruto}" não encontrado no ciclo`); continue; }

    const orcado = orcadoRaw !== "" ? Number(orcadoRaw) : null;
    const realizado = realizadoRaw !== "" ? Number(realizadoRaw) : null;

    if (orcadoRaw !== "" && isNaN(orcado!)) { erros.push(`Linha ${linha}: valor de "orcado" inválido: "${orcadoRaw}"`); continue; }
    if (realizadoRaw !== "" && isNaN(realizado!)) { erros.push(`Linha ${linha}: valor de "realizado" inválido: "${realizadoRaw}"`); continue; }

    try {
      if (orcado !== null) {
        const existia = await prisma.metaPeriodo.findUnique({
          where: { indicadorId_periodo: { indicadorId, periodo } },
        });
        await prisma.metaPeriodo.upsert({
          where: { indicadorId_periodo: { indicadorId, periodo } },
          update: { valorOrcado: orcado },
          create: { cicloId: cid, indicadorId, periodo, valorOrcado: orcado },
        });
        existia ? atualizados++ : criados++;
      }

      if (realizado !== null) {
        const existia = await prisma.realizacao.findUnique({
          where: { indicadorId_periodo: { indicadorId, periodo } },
        });
        await prisma.realizacao.upsert({
          where: { indicadorId_periodo: { indicadorId, periodo } },
          update: { valorRealizado: realizado },
          create: { cicloId: cid, indicadorId, periodo, valorRealizado: realizado },
        });
        existia ? atualizados++ : criados++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`Linha ${linha} (${codigoBruto} / ${periodo}): ${msg}`);
    }
  }

  return NextResponse.json({ criados, atualizados, erros });
}

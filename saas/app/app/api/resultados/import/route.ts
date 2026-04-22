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

  const indicadoresDoCiclo = await prisma.indicador.findMany({
    where: { cicloId: cid },
    select: { id: true, codigo: true },
  });
  const indicadorPorCodigo = new Map(indicadoresDoCiclo.map(i => [i.codigo.trim().toLowerCase(), i.id]));

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  if (rawRows.length === 0) {
    return NextResponse.json({ criados: 0, atualizados: 0, erros: ["Arquivo vazio"] });
  }

  const firstRowKeys = Object.keys(rawRows[0]);
  const isWide = firstRowKeys.some(k => /^realizado_/i.test(k.trim()));

  if (isWide) {
    return importarWide(rawRows, firstRowKeys, cid, indicadorPorCodigo);
  } else {
    return importarLong(rawRows, cid, indicadorPorCodigo);
  }
}

async function importarWide(
  rawRows: Record<string, unknown>[],
  keys: string[],
  cid: number,
  indicadorPorCodigo: Map<string, number>
) {
  const realizadoCols = keys.filter(k => /^realizado_/i.test(k.trim()));
  const orcadoCols = keys.filter(k => /^orcado_/i.test(k.trim()));

  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const linha = i + 2;

    const codigoBruto = String(row["indicador"] ?? "").trim();
    if (!codigoBruto) { erros.push(`Linha ${linha}: coluna "indicador" ausente ou vazia`); continue; }

    const indicadorId = indicadorPorCodigo.get(codigoBruto.toLowerCase());
    if (!indicadorId) { erros.push(`Linha ${linha}: indicador "${codigoBruto}" não encontrado no ciclo`); continue; }

    for (const col of realizadoCols) {
      const periodo = col.replace(/^realizado_/i, "").trim();
      const rawVal = String(row[col] ?? "").trim();
      if (!rawVal) continue;
      const val = Number(rawVal);
      if (isNaN(val)) { erros.push(`Linha ${linha} (${codigoBruto}/${periodo}): valor realizado inválido: "${rawVal}"`); continue; }
      try {
        const existia = await prisma.realizacao.findUnique({ where: { indicadorId_periodo: { indicadorId, periodo } } });
        await prisma.realizacao.upsert({
          where: { indicadorId_periodo: { indicadorId, periodo } },
          update: { valorRealizado: val },
          create: { cicloId: cid, indicadorId, periodo, valorRealizado: val },
        });
        existia ? atualizados++ : criados++;
      } catch (e) {
        erros.push(`Linha ${linha} (${codigoBruto}/${periodo}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const col of orcadoCols) {
      const periodo = col.replace(/^orcado_/i, "").trim();
      const rawVal = String(row[col] ?? "").trim();
      if (!rawVal) continue;
      const val = Number(rawVal);
      if (isNaN(val)) { erros.push(`Linha ${linha} (${codigoBruto}/${periodo}): valor orçado inválido: "${rawVal}"`); continue; }
      try {
        const existia = await prisma.metaPeriodo.findUnique({ where: { indicadorId_periodo: { indicadorId, periodo } } });
        await prisma.metaPeriodo.upsert({
          where: { indicadorId_periodo: { indicadorId, periodo } },
          update: { valorOrcado: val },
          create: { cicloId: cid, indicadorId, periodo, valorOrcado: val },
        });
        existia ? atualizados++ : criados++;
      } catch (e) {
        erros.push(`Linha ${linha} (${codigoBruto}/${periodo}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return NextResponse.json({ criados, atualizados, erros });
}

async function importarLong(
  rawRows: Record<string, unknown>[],
  cid: number,
  indicadorPorCodigo: Map<string, number>
) {
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
        const existia = await prisma.metaPeriodo.findUnique({ where: { indicadorId_periodo: { indicadorId, periodo } } });
        await prisma.metaPeriodo.upsert({
          where: { indicadorId_periodo: { indicadorId, periodo } },
          update: { valorOrcado: orcado },
          create: { cicloId: cid, indicadorId, periodo, valorOrcado: orcado },
        });
        existia ? atualizados++ : criados++;
      }

      if (realizado !== null) {
        const existia = await prisma.realizacao.findUnique({ where: { indicadorId_periodo: { indicadorId, periodo } } });
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

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
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  // Converte qualquer valor para string ou null (XLSX pode retornar number/boolean para células numéricas/booleanas)
  const toStr = (v: unknown): string | null => {
    if (v == null || v === "" || v === false) return null;
    return String(v).trim() || null;
  };

  // Normaliza chave: remove acentos, espaços, lowercase — permite colunas com variações de nome
  const normKey = (k: string) => k.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

  // Mapa de chave normalizada → campo canônico do banco
  const KEY_MAP: Record<string, string> = {
    nome: "nome",
    matricula: "matricula",
    cargo: "cargo",
    grade: "grade",
    email: "email",
    salariobase: "salarioBase",
    salario: "salarioBase",
    target: "target",
    multiplo: "target",
    centrocusto: "centroCusto",
    codempresa: "codEmpresa",
    codigoempresa: "codEmpresa",
    admissao: "admissao",
    dataadmissao: "admissao",
    matriculagestor: "matriculaGestor",
    nomegestor: "nomeGestor",
    gestor: "nomeGestor",
    status: "status",
  };

  // Normaliza os nomes das colunas de cada linha
  const rawKeys = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const rows = rawRows.map(rawRow => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const canonical = KEY_MAP[normKey(k)];
      if (canonical) row[canonical] = v;
      else row[k] = v; // mantém campos desconhecidos
    }
    return row;
  });

  const erros: string[] = [];
  let criados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    const faltando = ["nome","matricula","cargo","salarioBase","target"].filter(f => !row[f] && row[f] !== 0);
    if (faltando.length > 0) {
      erros.push(`Linha ${linha}: campos obrigatórios ausentes ou vazios: ${faltando.join(", ")} | Colunas detectadas: ${rawKeys.join(", ")}`);
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
        // Normaliza para comparação — evita falsos positivos por case/espaço/null vs ""
        const norm = (v: string | null | undefined) => (v?.trim() ?? null) || null;
        const changed = (a: string | null | undefined, b: string | null | undefined) => norm(a) !== norm(b);

        // Detectar movimentações por diff
        const movs: { tipo: string; dadosAntigos: object; dadosNovos: object }[] = [];

        if (changed(existing.cargo, sharedData.cargo))
          movs.push({ tipo: "MUDANCA_FUNCAO", dadosAntigos: { cargo: existing.cargo }, dadosNovos: { cargo: sharedData.cargo } });

        if (changed(existing.centroCusto, sharedData.centroCusto))
          movs.push({ tipo: "MUDANCA_AREA", dadosAntigos: { centroCusto: existing.centroCusto }, dadosNovos: { centroCusto: sharedData.centroCusto } });

        if (changed(existing.matriculaGestor, sharedData.matriculaGestor))
          movs.push({ tipo: "MUDANCA_GESTOR", dadosAntigos: { matriculaGestor: existing.matriculaGestor, nomeGestor: existing.nomeGestor }, dadosNovos: { matriculaGestor: sharedData.matriculaGestor, nomeGestor: sharedData.nomeGestor } });

        if (existing.status !== "AFASTADO" && status === "AFASTADO")
          movs.push({ tipo: "AFASTAMENTO", dadosAntigos: { status: existing.status }, dadosNovos: { status } });
        else if (existing.status === "AFASTADO" && status === "ATIVO")
          movs.push({ tipo: "RETORNO", dadosAntigos: { status: existing.status }, dadosNovos: { status } });
        else if (existing.status === "ATIVO" && status === "INATIVO")
          movs.push({ tipo: "DESLIGAMENTO", dadosAntigos: { status: existing.status }, dadosNovos: { status } });

        await prisma.colaborador.update({ where: { id: existing.id }, data: sharedData });

        for (const mov of movs) {
          await prisma.movimentacaoColaborador.create({
            data: { cicloId: Number(cicloId), matricula, tipo: mov.tipo, dadosAntigos: JSON.stringify(mov.dadosAntigos), dadosNovos: JSON.stringify(mov.dadosNovos) },
          });
        }
      } else {
        await prisma.colaborador.create({
          data: { cicloId: Number(cicloId), matricula, ...sharedData },
        });
        await prisma.movimentacaoColaborador.create({
          data: { cicloId: Number(cicloId), matricula, tipo: "ADMISSAO", dadosNovos: JSON.stringify({ nome: sharedData.nome, cargo: sharedData.cargo, centroCusto: sharedData.centroCusto }) },
        });
      }
      criados++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`Linha ${linha} (matrícula ${row.matricula}): ${msg}`);
    }
  }

  // Resolve gestorId a partir de matriculaGestor — necessário para cascata funcionar
  const comGestor = await prisma.colaborador.findMany({
    where: { cicloId: Number(cicloId), matriculaGestor: { not: null } },
    select: { id: true, matriculaGestor: true },
  });
  for (const c of comGestor) {
    if (!c.matriculaGestor) continue;
    const gestor = await prisma.colaborador.findFirst({
      where: { cicloId: Number(cicloId), matricula: c.matriculaGestor },
      select: { id: true },
    });
    if (gestor) {
      await prisma.colaborador.update({ where: { id: c.id }, data: { gestorId: gestor.id } });
    }
  }

  return NextResponse.json({ criados, erros });
}

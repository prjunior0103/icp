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

  // ── Ler config de campos que constituem movimentação ──
  const configMov = await prisma.configMovimentacao.findFirst({ where: { cicloId: cid } });
  const camposMovimentacao = (configMov?.campos ?? "centroCusto,matriculaGestor").split(",").filter(Boolean);

  // ── Parse XLSX ──
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const toStr = (v: unknown): string | null => {
    if (v == null || v === "" || v === false) return null;
    return String(v).trim() || null;
  };

  const normKey = (k: string) => k.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

  const KEY_MAP: Record<string, string> = {
    nome: "nome", matricula: "matricula", cargo: "cargo", grade: "grade",
    email: "email", salariobase: "salarioBase", salario: "salarioBase",
    target: "target", multiplo: "target", centrocusto: "centroCusto",
    codempresa: "codEmpresa", codigoempresa: "codEmpresa",
    admissao: "admissao", dataadmissao: "admissao",
    matriculagestor: "matriculaGestor", nomegestor: "nomeGestor",
    gestor: "nomeGestor", status: "status",
  };

  const rawKeys = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const rows = rawRows.map(rawRow => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const canonical = KEY_MAP[normKey(k)];
      if (canonical) row[canonical] = v;
      else row[k] = v;
    }
    return row;
  });

  // ── Buscar colaboradores existentes no ciclo ──
  const existentes = await prisma.colaborador.findMany({
    where: { cicloId: cid },
    include: { atribuicoes: { include: { agrupamento: true } } },
  });
  const mapExistentes = new Map(existentes.map(c => [c.matricula, c]));
  const matriculasNaPlanilha = new Set<string>();

  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;
  const movimentacoesCriadas: { matricula: string; tipo: string; requerNovoPainel: boolean }[] = [];

  // ── Processar cada linha ──
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const linha = i + 2;

    const faltando = ["nome", "matricula", "cargo", "salarioBase", "target"].filter(f => !row[f] && row[f] !== 0);
    if (faltando.length > 0) {
      erros.push(`Linha ${linha}: campos obrigatórios ausentes: ${faltando.join(", ")} | Colunas: ${rawKeys.join(", ")}`);
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
    matriculasNaPlanilha.add(matricula);

    let admissao: Date | null = null;
    if (row.admissao && row.admissao !== "") {
      admissao = row.admissao instanceof Date ? row.admissao : new Date(String(row.admissao));
      if (isNaN(admissao.getTime())) {
        erros.push(`Linha ${linha}: data de admissão inválida "${row.admissao}"`);
        continue;
      }
    }

    try {
      const existing = mapExistentes.get(matricula);
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
        // ── Detectar movimentação usando APENAS os campos configurados ──
        const norm = (v: string | null | undefined) => (v?.trim() ?? null) || null;
        const changed = (a: string | null | undefined, b: string | null | undefined) => norm(a) !== norm(b);

        const fieldMap: Record<string, { old: string | null | undefined; new: string | null | undefined }> = {
          centroCusto: { old: existing.centroCusto, new: sharedData.centroCusto },
          matriculaGestor: { old: existing.matriculaGestor, new: sharedData.matriculaGestor },
          cargo: { old: existing.cargo, new: sharedData.cargo },
          grade: { old: existing.grade, new: sharedData.grade },
          codEmpresa: { old: existing.codEmpresa, new: sharedData.codEmpresa },
          status: { old: existing.status, new: sharedData.status },
        };

        // Verifica se ALGUM dos campos configurados mudou
        const camposMudados = camposMovimentacao.filter(campo => {
          const f = fieldMap[campo];
          return f && changed(f.old, f.new);
        });

        if (camposMudados.length > 0) {
          // Montar dados antigos e novos só dos campos que mudaram
          const dadosAntigos: Record<string, string | null> = {};
          const dadosNovos: Record<string, string | null> = {};
          for (const campo of camposMudados) {
            const f = fieldMap[campo];
            dadosAntigos[campo] = norm(f.old);
            dadosNovos[campo] = norm(f.new);
          }
          // Se gestor mudou, incluir nomeGestor no diff
          if (camposMudados.includes("matriculaGestor")) {
            dadosAntigos.nomeGestor = norm(existing.nomeGestor);
            dadosNovos.nomeGestor = norm(sharedData.nomeGestor);
          }

          // ── Verificar se novo gestor tem painel diferente ──
          let requerNovoPainel = false;
          let painelAnteriorId: number | null = null;
          let painelNovoId: number | null = null;

          if (camposMudados.includes("matriculaGestor") || camposMudados.includes("centroCusto")) {
            // Painel atual do colaborador
            const atribuicaoAtual = existing.atribuicoes[0]; // pega a primeira (principal)
            painelAnteriorId = atribuicaoAtual?.agrupamentoId ?? null;

            // Buscar o novo gestor e seu painel
            if (sharedData.matriculaGestor) {
              const novoGestor = await prisma.colaborador.findFirst({
                where: { cicloId: cid, matricula: sharedData.matriculaGestor },
                include: { atribuicoes: { include: { agrupamento: true } } },
              });
              if (novoGestor && novoGestor.atribuicoes.length > 0) {
                painelNovoId = novoGestor.atribuicoes[0].agrupamentoId;
                if (painelAnteriorId && painelNovoId && painelAnteriorId !== painelNovoId) {
                  requerNovoPainel = true;
                }
              }
            }
          }

          // Determinar tipo mais relevante
          let tipo = "MOVIMENTACAO";
          if (camposMudados.includes("matriculaGestor") && camposMudados.includes("centroCusto")) {
            tipo = "MUDANCA_AREA_GESTOR";
          } else if (camposMudados.includes("centroCusto")) {
            tipo = "MUDANCA_AREA";
          } else if (camposMudados.includes("matriculaGestor")) {
            tipo = "MUDANCA_GESTOR";
          } else if (camposMudados.includes("cargo")) {
            tipo = "MUDANCA_FUNCAO";
          }

          await prisma.movimentacaoColaborador.create({
            data: {
              cicloId: cid,
              matricula,
              tipo,
              dadosAntigos: JSON.stringify(dadosAntigos),
              dadosNovos: JSON.stringify(dadosNovos),
              requerNovoPainel,
              painelAnteriorId,
              painelNovoId,
              statusTratamento: requerNovoPainel ? "PENDENTE" : "TRATADO",
            },
          });
          movimentacoesCriadas.push({ matricula, tipo, requerNovoPainel });
        }

        // Detectar mudanças de status separadamente (afastamento/retorno/desligamento)
        if (existing.status !== "AFASTADO" && status === "AFASTADO") {
          await prisma.movimentacaoColaborador.create({
            data: { cicloId: cid, matricula, tipo: "AFASTAMENTO", dadosAntigos: JSON.stringify({ status: existing.status }), dadosNovos: JSON.stringify({ status }), statusTratamento: "TRATADO" },
          });
        } else if (existing.status === "AFASTADO" && status === "ATIVO") {
          await prisma.movimentacaoColaborador.create({
            data: { cicloId: cid, matricula, tipo: "RETORNO", dadosAntigos: JSON.stringify({ status: existing.status }), dadosNovos: JSON.stringify({ status }), statusTratamento: "TRATADO" },
          });
        } else if (existing.status === "ATIVO" && status === "INATIVO") {
          await prisma.movimentacaoColaborador.create({
            data: { cicloId: cid, matricula, tipo: "DESLIGAMENTO", dadosAntigos: JSON.stringify({ status: existing.status }), dadosNovos: JSON.stringify({ status }), statusTratamento: "TRATADO" },
          });
        }

        await prisma.colaborador.update({ where: { id: existing.id }, data: sharedData });
        atualizados++;
      } else {
        // Novo colaborador — ADMISSÃO
        await prisma.colaborador.create({
          data: { cicloId: cid, matricula, ...sharedData },
        });
        await prisma.movimentacaoColaborador.create({
          data: {
            cicloId: cid, matricula, tipo: "ADMISSAO",
            dadosNovos: JSON.stringify({ nome: sharedData.nome, cargo: sharedData.cargo, centroCusto: sharedData.centroCusto }),
            statusTratamento: "TRATADO",
          },
        });
        criados++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erros.push(`Linha ${linha} (matrícula ${row.matricula}): ${msg}`);
    }
  }

  // ── Detectar desaparecidos (existiam mas não estão na nova planilha) ──
  const desaparecidos: string[] = [];
  // Só detecta se já havia colaboradores antes (não é o primeiro import)
  if (existentes.length > 0) {
    for (const existing of existentes) {
      if (!matriculasNaPlanilha.has(existing.matricula) && existing.status === "ATIVO") {
        // Verificar se já existe uma movimentação POSSIVEL_DESLIGAMENTO pendente
        const jaExiste = await prisma.movimentacaoColaborador.findFirst({
          where: { cicloId: cid, matricula: existing.matricula, tipo: "POSSIVEL_DESLIGAMENTO", statusTratamento: "PENDENTE" },
        });
        if (!jaExiste) {
          await prisma.movimentacaoColaborador.create({
            data: {
              cicloId: cid,
              matricula: existing.matricula,
              tipo: "POSSIVEL_DESLIGAMENTO",
              dadosAntigos: JSON.stringify({ nome: existing.nome, cargo: existing.cargo, centroCusto: existing.centroCusto }),
              statusTratamento: "PENDENTE",
            },
          });
          desaparecidos.push(existing.matricula);
        }
      }
    }
  }

  // ── Resolver gestorId ──
  const comGestor = await prisma.colaborador.findMany({
    where: { cicloId: cid, matriculaGestor: { not: null } },
    select: { id: true, matriculaGestor: true },
  });
  for (const c of comGestor) {
    if (!c.matriculaGestor) continue;
    const gestor = await prisma.colaborador.findFirst({
      where: { cicloId: cid, matricula: c.matriculaGestor },
      select: { id: true },
    });
    if (gestor) {
      await prisma.colaborador.update({ where: { id: c.id }, data: { gestorId: gestor.id } });
    }
  }

  return NextResponse.json({
    criados,
    atualizados,
    desaparecidos: desaparecidos.length,
    movimentacoes: movimentacoesCriadas.length,
    movimentacoesRequerPainel: movimentacoesCriadas.filter(m => m.requerNovoPainel).length,
    erros,
  });
}

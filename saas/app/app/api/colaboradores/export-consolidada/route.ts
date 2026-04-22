import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const cid = Number(cicloId);

  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: cid },
    include: { atribuicoes: { include: { agrupamento: true } } },
    orderBy: { nome: "asc" },
  });

  // Buscar movimentações com troca de painel (tratadas)
  const movComPainel = await prisma.movimentacaoColaborador.findMany({
    where: { cicloId: cid, requerNovoPainel: true },
  });
  const movPorMatricula = new Map<string, typeof movComPainel>();
  for (const m of movComPainel) {
    const arr = movPorMatricula.get(m.matricula) ?? [];
    arr.push(m);
    movPorMatricula.set(m.matricula, arr);
  }

  // Buscar nomes dos painéis
  const painelIds = new Set<number>();
  for (const m of movComPainel) {
    if (m.painelAnteriorId) painelIds.add(m.painelAnteriorId);
    if (m.painelNovoId) painelIds.add(m.painelNovoId);
  }
  for (const c of colaboradores) {
    for (const a of c.atribuicoes) painelIds.add(a.agrupamentoId);
  }
  const paineis = painelIds.size > 0
    ? await prisma.agrupamento.findMany({ where: { id: { in: [...painelIds] } }, select: { id: true, nome: true } })
    : [];
  const painelMap = new Map(paineis.map(p => [p.id, p.nome]));

  type Row = Record<string, string | number>;
  const rows: Row[] = [];

  for (const c of colaboradores) {
    const movs = movPorMatricula.get(c.matricula);
    const painelAtual = c.atribuicoes.map(a => a.agrupamento.nome).join(", ") || "—";

    const baseRow = {
      Matrícula: c.matricula,
      Nome: c.nome,
      Cargo: c.cargo,
      Grade: c.grade ?? "",
      "Salário Base": c.salarioBase,
      Target: c.target,
      "Centro Custo": c.centroCusto ?? "",
      "Cód Empresa": c.codEmpresa ?? "",
      "Matrícula Gestor": c.matriculaGestor ?? "",
      "Nome Gestor": c.nomeGestor ?? "",
      Status: c.status,
      "Data Desligamento": c.dataDesligamento ? new Date(c.dataDesligamento).toISOString().slice(0, 10) : "",
      "Tipo Desligamento": c.tipoDesligamento ?? "",
    };

    if (movs && movs.length > 0) {
      // Linha com painel anterior
      for (const m of movs) {
        const antigos = m.dadosAntigos ? JSON.parse(m.dadosAntigos) : {};
        rows.push({
          ...baseRow,
          "Centro Custo": antigos.centroCusto ?? baseRow["Centro Custo"],
          "Matrícula Gestor": antigos.matriculaGestor ?? baseRow["Matrícula Gestor"],
          "Nome Gestor": antigos.nomeGestor ?? baseRow["Nome Gestor"],
          Painel: m.painelAnteriorId ? painelMap.get(m.painelAnteriorId) ?? "—" : painelAtual,
          Situação: "MOVIMENTADO (anterior)",
          "Data Movimentação": new Date(m.dataEfetiva).toISOString().slice(0, 10),
        });
      }
      // Linha com dados atuais (novo painel)
      const ultimaMov = movs[movs.length - 1];
      rows.push({
        ...baseRow,
        Painel: ultimaMov.painelNovoId ? painelMap.get(ultimaMov.painelNovoId) ?? painelAtual : painelAtual,
        Situação: "MOVIMENTADO (atual)",
        "Data Movimentação": new Date(ultimaMov.dataEfetiva).toISOString().slice(0, 10),
      });
    } else {
      rows.push({
        ...baseRow,
        Painel: painelAtual,
        Situação: c.status === "INATIVO" ? "DESLIGADO" : "ATIVO",
        "Data Movimentação": "",
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Base Consolidada");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="base_consolidada_ciclo_${cicloId}.xlsx"`,
    },
  });
}

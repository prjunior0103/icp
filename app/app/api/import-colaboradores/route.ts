import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET — returns CSV template with headers + example row
export async function GET() {
  const headers = [
    "matricula",
    "nomeCompleto",
    "cpf",
    "email",
    "salarioBase",
    "dataAdmissao",
    "empresaCodigo",
    "cargoCodigo",
    "centroCustoCodigo",
    "gestorMatricula",
  ];

  const example = [
    "001234",
    "João Silva Santos",
    "123.456.789-00",
    "joao.silva@empresa.com",
    "8000.00",
    "2024-01-15",
    "EMP001",
    "GER-COMERCIAL",
    "CC-VENDAS",
    "",
  ];

  const csv = [headers.join(";"), example.join(";")].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=template_colaboradores.csv",
    },
  });
}

// POST — bulk upsert collaborators from CSV rows
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows } = body as {
      rows: Record<string, string>[];
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha enviada" }, { status: 400 });
    }

    // Pre-load lookup maps
    const empresas = await prisma.empresa.findMany({ select: { id: true, codigo: true, nome: true } });
    const cargos = await prisma.cargo.findMany({ select: { id: true, codigo: true, nome: true } });
    const ccs = await prisma.centroCusto.findMany({ select: { id: true, codigo: true, nome: true } });
    const colabs = await prisma.colaborador.findMany({ select: { id: true, matricula: true } });

    const empresaMap = new Map(empresas.map((e) => [e.codigo, e.id]));
    const cargoMap = new Map(cargos.map((c) => [c.codigo, c.id]));
    const ccMap = new Map(ccs.map((c) => [c.codigo, c.id]));
    const colabMap = new Map(colabs.map((c) => [c.matricula, c.id]));

    // Helper: auto-create entities if not found
    async function getOrCreateEmpresa(codigo: string): Promise<number> {
      if (!codigo) codigo = "EMP-DEFAULT";
      const existing = empresaMap.get(codigo);
      if (existing) return existing;
      const created = await prisma.empresa.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nome: codigo },
        select: { id: true },
      });
      empresaMap.set(codigo, created.id);
      return created.id;
    }

    async function getOrCreateCargo(codigo: string, nome?: string, nivel?: string, bonus?: number): Promise<number> {
      if (!codigo) codigo = "CARGO-DEFAULT";
      const existing = cargoMap.get(codigo);
      if (existing) return existing;
      const created = await prisma.cargo.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nome: nome || codigo, nivelHierarquico: nivel || "N4", targetMultiploSalarial: bonus || 0 },
        select: { id: true },
      });
      cargoMap.set(codigo, created.id);
      return created.id;
    }

    async function getOrCreateCC(codigo: string, empresaId: number): Promise<number> {
      if (!codigo) codigo = "CC-DEFAULT";
      const existing = ccMap.get(codigo);
      if (existing) return existing;
      const created = await prisma.centroCusto.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nome: codigo, empresaId },
        select: { id: true },
      });
      ccMap.set(codigo, created.id);
      return created.id;
    }

    let processed = 0;
    let updated = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2; // header is row 1

      // Normalize keys — strip BOM and whitespace
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k.replace(/^\uFEFF/, "").trim()] = String(v ?? "").trim();
      }

      const {
        matricula,
        nomeCompleto,
        cpf,
        email,
        salarioBase,
        dataAdmissao,
        empresaCodigo,
        cargoCodigo,
        centroCustoCodigo,
        gestorMatricula,
        cargoNome,
        nivelHierarquico,
        targetMultiploSalarial,
      } = normalized;

      if (!matricula || !nomeCompleto) {
        erros.push({ linha, motivo: "Campos obrigatórios faltando (matricula, nomeCompleto)" });
        continue;
      }

      const empresaId = await getOrCreateEmpresa(empresaCodigo || "EMP-DEFAULT");
      const cargoId = await getOrCreateCargo(
        cargoCodigo || "CARGO-DEFAULT",
        cargoNome,
        nivelHierarquico,
        targetMultiploSalarial ? Number(targetMultiploSalarial) : undefined
      );
      const centroCustoId = await getOrCreateCC(centroCustoCodigo || "CC-DEFAULT", empresaId);

      const gestorId = gestorMatricula ? colabMap.get(gestorMatricula) ?? undefined : undefined;

      try {
        const existingId = colabMap.get(matricula);

        const admissaoDate = dataAdmissao ? new Date(dataAdmissao) : new Date("2020-01-01");
        const salario = salarioBase ? Number(String(salarioBase).replace(",", ".")) : 0;
        const emailVal = email || `${matricula}@empresa.com`;
        const cpfVal = cpf || matricula;

        if (existingId) {
          // Update
          await prisma.colaborador.update({
            where: { id: existingId },
            data: {
              nomeCompleto,
              cpf: cpfVal,
              email: emailVal,
              salarioBase: salario,
              dataAdmissao: admissaoDate,
              empresaId,
              cargoId,
              centroCustoId,
              gestorId: gestorId ?? null,
            },
          });
          updated++;
        } else {
          // Create
          const novo = await prisma.colaborador.create({
            data: {
              matricula,
              nomeCompleto,
              cpf: cpfVal,
              email: emailVal,
              salarioBase: salario,
              dataAdmissao: admissaoDate,
              empresaId,
              cargoId,
              centroCustoId,
              gestorId: gestorId ?? undefined,
            },
          });
          colabMap.set(matricula, novo.id);
        }

        processed++;
      } catch (rowErr) {
        erros.push({ linha, motivo: String(rowErr) });
      }
    }

    return NextResponse.json({ data: { processed, updated, erros } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

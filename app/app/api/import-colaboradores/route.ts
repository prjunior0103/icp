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
    const empresas = await prisma.empresa.findMany({ select: { id: true, codigo: true } });
    const cargos = await prisma.cargo.findMany({ select: { id: true, codigo: true } });
    const ccs = await prisma.centroCusto.findMany({ select: { id: true, codigo: true } });
    const colabs = await prisma.colaborador.findMany({ select: { id: true, matricula: true } });

    const empresaMap = new Map(empresas.map((e) => [e.codigo, e.id]));
    const cargoMap = new Map(cargos.map((c) => [c.codigo, c.id]));
    const ccMap = new Map(ccs.map((c) => [c.codigo, c.id]));
    const colabMap = new Map(colabs.map((c) => [c.matricula, c.id]));

    let processed = 0;
    let updated = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2; // header is row 1

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
      } = row;

      if (!matricula || !nomeCompleto || !cpf || !email) {
        erros.push({ linha, motivo: "Campos obrigatórios faltando (matricula, nomeCompleto, cpf, email)" });
        continue;
      }

      const empresaId = empresaMap.get(empresaCodigo);
      if (!empresaId) {
        erros.push({ linha, motivo: `Empresa '${empresaCodigo}' não encontrada` });
        continue;
      }

      const cargoId = cargoMap.get(cargoCodigo);
      if (!cargoId) {
        erros.push({ linha, motivo: `Cargo '${cargoCodigo}' não encontrado` });
        continue;
      }

      const centroCustoId = ccMap.get(centroCustoCodigo);
      if (!centroCustoId) {
        erros.push({ linha, motivo: `Centro de Custo '${centroCustoCodigo}' não encontrado` });
        continue;
      }

      const gestorId = gestorMatricula ? colabMap.get(gestorMatricula) ?? undefined : undefined;

      try {
        const existingId = colabMap.get(matricula);

        if (existingId) {
          // Update
          await prisma.colaborador.update({
            where: { id: existingId },
            data: {
              nomeCompleto,
              cpf,
              email,
              salarioBase: Number(salarioBase),
              dataAdmissao: new Date(dataAdmissao),
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
              cpf,
              email,
              salarioBase: Number(salarioBase),
              dataAdmissao: new Date(dataAdmissao),
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

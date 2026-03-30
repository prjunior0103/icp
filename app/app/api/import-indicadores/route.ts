import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET — CSV/template download
export async function GET() {
  const headers = [
    "codigo",
    "nome",
    "tipo",
    "polaridade",
    "abrangencia",
    "unidade",
    "metaMinima",
    "metaAlvo",
    "metaMaxima",
    "diretivo",
    "analistaResp",
    "origemDado",
  ];
  // tipo: VOLUME_FINANCEIRO | CUSTO_PRAZO | PROJETO_MARCO
  // polaridade: MAIOR_MELHOR | MENOR_MELHOR  (default MAIOR_MELHOR)
  // abrangencia: CORPORATIVO | AREA | INDIVIDUAL
  const example = ["IND-001", "Receita Líquida", "VOLUME_FINANCEIRO", "MAIOR_MELHOR", "CORPORATIVO", "R$", "80", "100", "120", "", "", ""];
  const csv = [headers.join(";"), example.join(";")].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=template_indicadores.csv",
    },
  });
}

// POST — bulk upsert Indicadores
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cicloId, rows } = body as { cicloId: number; rows: Record<string, string>[] };

    if (!cicloId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "cicloId e rows obrigatorios" }, { status: 400 });
    }

    // Verify the cycle exists
    const ciclo = await prisma.cicloICP.findUnique({ where: { id: Number(cicloId) } });
    if (!ciclo) {
      return NextResponse.json({ error: `Ciclo ${cicloId} não encontrado` }, { status: 404 });
    }

    const VALID_TIPOS = new Set(["VOLUME_FINANCEIRO", "CUSTO_PRAZO", "PROJETO_MARCO", "QUALITATIVO"]);
    const VALID_POLARIDADES = new Set(["MAIOR_MELHOR", "MENOR_MELHOR"]);
    const VALID_ABRANGENCIAS = new Set(["CORPORATIVO", "AREA", "INDIVIDUAL"]);

    let processed = 0;
    let updated = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;

      const codigo = row.codigo?.trim();
      const nome = row.nome?.trim();
      const tipo = row.tipo?.trim().toUpperCase();
      const polaridade = (row.polaridade?.trim().toUpperCase()) || "MAIOR_MELHOR";
      const abrangencia = row.abrangencia?.trim().toUpperCase();
      const unidade = row.unidade?.trim() || "%";

      if (!codigo) { erros.push({ linha, motivo: "Campo 'codigo' obrigatório" }); continue; }
      if (!nome) { erros.push({ linha, motivo: "Campo 'nome' obrigatório" }); continue; }
      if (!tipo || !VALID_TIPOS.has(tipo)) {
        erros.push({ linha, motivo: `'tipo' inválido: '${row.tipo}'. Use: VOLUME_FINANCEIRO, CUSTO_PRAZO, PROJETO_MARCO` });
        continue;
      }
      if (!VALID_POLARIDADES.has(polaridade)) {
        erros.push({ linha, motivo: `'polaridade' inválida: '${row.polaridade}'. Use: MAIOR_MELHOR, MENOR_MELHOR` });
        continue;
      }
      if (!abrangencia || !VALID_ABRANGENCIAS.has(abrangencia)) {
        erros.push({ linha, motivo: `'abrangencia' inválida: '${row.abrangencia}'. Use: CORPORATIVO, AREA, INDIVIDUAL` });
        continue;
      }

      const metaMinima = row.metaMinima?.trim() ? Number(row.metaMinima) : null;
      const metaAlvo = row.metaAlvo?.trim() ? Number(row.metaAlvo) : null;
      const metaMaxima = row.metaMaxima?.trim() ? Number(row.metaMaxima) : null;
      const diretivo = row.diretivo?.trim() || null;
      const analistaResp = row.analistaResp?.trim() || null;
      const origemDado = row.origemDado?.trim() || null;

      try {
        const existing = await prisma.indicador.findUnique({ where: { codigo } });

        if (existing) {
          await prisma.indicador.update({
            where: { codigo },
            data: { nome, tipo, polaridade, abrangencia, unidade, metaMinima, metaAlvo, metaMaxima, diretivo, analistaResp, origemDado },
          });
          updated++;
        } else {
          await prisma.indicador.create({
            data: { codigo, nome, tipo, polaridade, abrangencia, unidade, metaMinima, metaAlvo, metaMaxima, diretivo, analistaResp, origemDado, cicloId: Number(cicloId), status: "ATIVO" },
          });
          processed++;
        }
      } catch (rowErr) {
        erros.push({ linha, motivo: String(rowErr) });
      }
    }

    return NextResponse.json({ data: { processed, updated, erros } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

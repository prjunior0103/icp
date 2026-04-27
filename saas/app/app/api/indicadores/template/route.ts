import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const headers = ["nome","tipo","abrangencia","unidade","metaMinima","metaAlvo","metaMaxima",
    "baseline","metrica","periodicidade","criterioApuracao","origemDado","analistaResp","descricao"];
  const example = ["Faturamento","MAIOR_MELHOR","CORPORATIVO","R$","800000","1000000","1200000",
    "900000","Receita Bruta","MENSAL","SOMA","ERP","Ana Lima","Faturamento total do período"];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  const instrucoes = [
    ["Campo", "Valores válidos / Observação"],
    ["nome", "Obrigatório. Texto livre."],
    ["tipo", "MAIOR_MELHOR | MENOR_MELHOR | PROJETO_MARCO"],
    ["abrangencia", "CORPORATIVO | AREA | INDIVIDUAL"],
    ["unidade", "% | R$ | Unidades | Dias | Horas | Pontos | Índice | NPS | Score | Toneladas | Km | Litros | Kg"],
    ["metaMinima", "Número (opcional)"],
    ["metaAlvo", "Número (opcional)"],
    ["metaMaxima", "Número (opcional)"],
    ["baseline", "Número (opcional)"],
    ["metrica", "Texto livre (opcional)"],
    ["periodicidade", "MENSAL | TRIMESTRAL | SEMESTRAL | ANUAL"],
    ["criterioApuracao", "SOMA | MEDIA | ULTIMA_POSICAO"],
    ["origemDado", "Texto livre (opcional)"],
    ["analistaResp", "Nome do responsável (opcional)"],
    ["descricao", "Texto livre (opcional)"],
    ["", ""],
    ["Obs:", "O código do indicador é gerado automaticamente na importação."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr["!cols"] = [{ wch: 20 }, { wch: 70 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Indicadores");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_indicadores.xlsx"',
    },
  });
}

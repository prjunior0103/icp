import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { calcAvosMeses } from "@/app/lib/calc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloId = searchParams.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId obrigatório" }, { status: 400 });

  const cid = Number(cicloId);

  const ciclo = await prisma.cicloICP.findFirst({ where: {} }); // ciclo ativo já filtrado no front; buscamos dados para calcular avos
  // Buscar o ciclo pelo id do parametro do sistema (não temos FK direta — usar atribuicoes ou colaboradores)
  const paramSistema = await prisma.parametroSistema.findFirst({ select: { cicloAtivoId: true } });
  const cicloReal = await prisma.cicloICP.findFirst({ where: { id: paramSistema?.cicloAtivoId ?? 0 } });

  const { anoFiscal, mesInicio, mesFim } = cicloReal ?? { anoFiscal: new Date().getFullYear(), mesInicio: 1, mesFim: 12 };

  // Colaboradores ativos no ciclo
  const colaboradores = await prisma.colaborador.findMany({
    where: { cicloId: cid },
    select: {
      id: true, matricula: true, nome: true, cargo: true,
      centroCusto: true, nomeGestor: true,
      salarioBase: true, target: true, status: true,
      admissao: true, dataDesligamento: true,
    },
    orderBy: { nome: "asc" },
  });

  // Movimentações do ciclo (excluindo ADMISSAO — queremos movimentos reais)
  const movs = await prisma.movimentacaoColaborador.findMany({
    where: { cicloId: cid, tipo: { not: "ADMISSAO" } },
    select: { matricula: true, tipo: true, dataMovimentacao: true },
  });

  const matriculasComMov = new Set(movs.map(m => m.matricula));

  // Buscar admissão ADMISSAO para calcular dataMovimentacao
  const admissoes = await prisma.movimentacaoColaborador.findMany({
    where: { cicloId: cid, tipo: "ADMISSAO" },
    select: { matricula: true, dataMovimentacao: true },
  });
  const admissaoMap = new Map(admissoes.map(a => [a.matricula, a.dataMovimentacao]));

  const totalMeses = mesFim - mesInicio + 1;

  const semMovimentacao = colaboradores
    .filter(c => !matriculasComMov.has(c.matricula))
    .map(c => {
      // Calcular ávos de admissão se houver data
      const dataAdm = admissaoMap.get(c.matricula) ?? (c.admissao ?? null);
      let avos = 1;
      if (dataAdm) {
        avos = calcAvosMeses({
          tipo: "ADMISSAO",
          dataMovimentacao: dataAdm,
          anoFiscal,
          mesInicio,
          mesFim,
        });
      }
      const premioBase = c.salarioBase * (c.target / 100);
      const dataAdmFormatada = dataAdm
        ? dataAdm.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : null;
      return {
        id: c.id,
        matricula: c.matricula,
        nome: c.nome,
        cargo: c.cargo,
        centroCusto: c.centroCusto,
        nomeGestor: c.nomeGestor,
        status: c.status,
        salarioBase: c.salarioBase,
        target: c.target,
        avos,
        mesesAtivos: Math.round(avos * totalMeses),
        totalMeses,
        premioBase,
        premioMaxProporcional: premioBase * avos,
        dataAdm: dataAdmFormatada,
      };
    });

  return NextResponse.json({ colaboradores: semMovimentacao, totalMeses });
}

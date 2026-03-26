import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export type CheckResult = {
  id: string;
  tipo: "ERRO" | "AVISO" | "OK";
  categoria: string;
  titulo: string;
  descricao: string;
  count: number;
  detalhes: string[];
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cicloIdParam = searchParams.get("cicloId");
    const cicloId = cicloIdParam ? Number(cicloIdParam) : null;

    const results: CheckResult[] = [];

    // ── 1. Ciclo ativo único ────────────────────────────────────────────────
    const ciclosAtivos = await prisma.cicloICP.findMany({ where: { status: "ATIVO" } });
    if (ciclosAtivos.length === 0) {
      results.push({
        id: "ciclo_sem_ativo",
        tipo: "AVISO",
        categoria: "Ciclo",
        titulo: "Nenhum ciclo ativo",
        descricao: "Não há ciclo com status ATIVO. O sistema não pode apurar realizações.",
        count: 0,
        detalhes: [],
      });
    } else if (ciclosAtivos.length > 1) {
      results.push({
        id: "ciclo_multiplos_ativos",
        tipo: "ERRO",
        categoria: "Ciclo",
        titulo: "Múltiplos ciclos ativos",
        descricao: `${ciclosAtivos.length} ciclos com status ATIVO simultaneamente. Apenas 1 é permitido.`,
        count: ciclosAtivos.length,
        detalhes: ciclosAtivos.map((c) => `Ciclo ${c.anoFiscal} (id ${c.id})`),
      });
    } else {
      results.push({
        id: "ciclo_ok",
        tipo: "OK",
        categoria: "Ciclo",
        titulo: "Ciclo ativo único",
        descricao: `Ciclo ${ciclosAtivos[0].anoFiscal} está ativo.`,
        count: 1,
        detalhes: [],
      });
    }

    // Trabalhar com o ciclo especificado ou o primeiro ativo
    const cicloAlvo = cicloId
      ? await prisma.cicloICP.findUnique({ where: { id: cicloId } })
      : ciclosAtivos[0] ?? null;

    if (!cicloAlvo) {
      return NextResponse.json({ data: results });
    }

    // ── 2. Pool de bônus ────────────────────────────────────────────────────
    if (cicloAlvo.bonusPool != null && cicloAlvo.bonusPool > 0) {
      const somaProjetado = await prisma.realizacao.aggregate({
        where: { meta: { cicloId: cicloAlvo.id } },
        _sum: { premioProjetado: true },
      });
      const usado = somaProjetado._sum.premioProjetado ?? 0;
      const percUsado = (usado / cicloAlvo.bonusPool) * 100;

      if (usado > cicloAlvo.bonusPool) {
        results.push({
          id: "pool_excedido",
          tipo: "ERRO",
          categoria: "Bônus",
          titulo: "Pool de bônus excedido",
          descricao: `Prêmios projetados (R$ ${usado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) ultrapassam o pool de R$ ${cicloAlvo.bonusPool.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — ${(percUsado - 100).toFixed(1)}% acima.`,
          count: 1,
          detalhes: [],
        });
      } else if (percUsado > 90) {
        results.push({
          id: "pool_quase_esgotado",
          tipo: "AVISO",
          categoria: "Bônus",
          titulo: "Pool de bônus quase esgotado",
          descricao: `${percUsado.toFixed(1)}% do pool já comprometido (R$ ${usado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ ${cicloAlvo.bonusPool.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
          count: 1,
          detalhes: [],
        });
      } else {
        results.push({
          id: "pool_ok",
          tipo: "OK",
          categoria: "Bônus",
          titulo: "Pool de bônus dentro do limite",
          descricao: `${percUsado.toFixed(1)}% do pool utilizado.`,
          count: 1,
          detalhes: [],
        });
      }
    }

    // ── 3. Metas aprovadas sem colaboradores ────────────────────────────────
    const metasAprovadas = await prisma.meta.findMany({
      where: { cicloId: cicloAlvo.id, status: "APROVADO" },
      include: { colaboradores: true, indicador: { select: { nome: true } } },
    });

    const metasSemColab = metasAprovadas.filter((m) => m.colaboradores.length === 0);
    if (metasSemColab.length > 0) {
      results.push({
        id: "metas_sem_colaboradores",
        tipo: "AVISO",
        categoria: "Metas",
        titulo: "Metas aprovadas sem colaboradores",
        descricao: `${metasSemColab.length} meta(s) aprovada(s) sem nenhum colaborador atribuído — não gerarão prêmio.`,
        count: metasSemColab.length,
        detalhes: metasSemColab.map((m) => `Meta #${m.id} — ${m.indicador.nome}`),
      });
    } else if (metasAprovadas.length > 0) {
      results.push({
        id: "metas_colab_ok",
        tipo: "OK",
        categoria: "Metas",
        titulo: "Todas as metas têm colaboradores",
        descricao: "Todas as metas aprovadas possuem colaboradores atribuídos.",
        count: 0,
        detalhes: [],
      });
    }

    // ── 4. Pesos da cesta por colaborador ───────────────────────────────────
    const metaColabs = await prisma.metaColaborador.findMany({
      where: { meta: { cicloId: cicloAlvo.id, status: "APROVADO" }, ativo: true },
      include: {
        meta: { select: { pesoNaCesta: true, indicador: { select: { nome: true } } } },
        colaborador: { select: { nomeCompleto: true, matricula: true } },
      },
    });

    // Agrupar por colaborador
    const pesosPorColab = new Map<number, { nome: string; matricula: string; totalPeso: number; metas: string[] }>();
    for (const mc of metaColabs) {
      const peso = mc.pesoPersonalizado ?? mc.meta.pesoNaCesta;
      const entry = pesosPorColab.get(mc.colaboradorId) ?? {
        nome: mc.colaborador.nomeCompleto,
        matricula: mc.colaborador.matricula,
        totalPeso: 0,
        metas: [],
      };
      entry.totalPeso += peso;
      entry.metas.push(mc.meta.indicador.nome);
      pesosPorColab.set(mc.colaboradorId, entry);
    }

    const cestasForaDoLimite = Array.from(pesosPorColab.values()).filter(
      (e) => Math.abs(e.totalPeso - 100) > 0.5
    );

    if (cestasForaDoLimite.length > 0) {
      results.push({
        id: "pesos_incorretos",
        tipo: "ERRO",
        categoria: "Metas",
        titulo: "Soma dos pesos fora de 100%",
        descricao: `${cestasForaDoLimite.length} colaborador(es) com soma de pesos diferente de 100%.`,
        count: cestasForaDoLimite.length,
        detalhes: cestasForaDoLimite.map(
          (e) => `${e.nomeCompleto ?? e.nome} (${e.matricula}) — total ${e.totalPeso.toFixed(1)}%`
        ),
      });
    } else if (pesosPorColab.size > 0) {
      results.push({
        id: "pesos_ok",
        tipo: "OK",
        categoria: "Metas",
        titulo: "Pesos das cestas corretos",
        descricao: `${pesosPorColab.size} colaborador(es) com soma de pesos = 100%.`,
        count: 0,
        detalhes: [],
      });
    }

    // ── 5. Colaboradores ativos sem metas ───────────────────────────────────
    const totalColabs = await prisma.colaborador.count({ where: { ativo: true } });
    const colabsComMeta = new Set(metaColabs.map((mc) => mc.colaboradorId));
    const semMeta = totalColabs - colabsComMeta.size;

    if (semMeta > 0) {
      const colabsSemMeta = await prisma.colaborador.findMany({
        where: {
          ativo: true,
          id: { notIn: Array.from(colabsComMeta) },
        },
        select: { nomeCompleto: true, matricula: true },
        take: 20,
      });
      results.push({
        id: "colabs_sem_meta",
        tipo: "AVISO",
        categoria: "Colaboradores",
        titulo: "Colaboradores sem metas atribuídas",
        descricao: `${semMeta} colaborador(es) ativo(s) sem nenhuma meta aprovada no ciclo ${cicloAlvo.anoFiscal}.`,
        count: semMeta,
        detalhes: colabsSemMeta.map((c) => `${c.nomeCompleto} (${c.matricula})`),
      });
    } else if (totalColabs > 0) {
      results.push({
        id: "colabs_meta_ok",
        tipo: "OK",
        categoria: "Colaboradores",
        titulo: "Todos os colaboradores têm metas",
        descricao: "Todos os colaboradores ativos possuem metas aprovadas no ciclo.",
        count: 0,
        detalhes: [],
      });
    }

    // ── 6. Metas com realizações no mês corrente (janela aberta) ────────────
    const agora = new Date();
    const mesAtual = agora.getMonth() + 1;
    const anoAtual = agora.getFullYear();

    const janelaAberta = await prisma.janelaApuracao.findFirst({
      where: {
        cicloId: cicloAlvo.id,
        mesReferencia: mesAtual,
        anoReferencia: anoAtual,
        status: { in: ["ABERTA", "PRORROGADA"] },
      },
    });

    if (janelaAberta) {
      const metasAtivaIds = metasAprovadas.map((m) => m.id);
      const realizacoesMes = await prisma.realizacao.findMany({
        where: { metaId: { in: metasAtivaIds }, mesReferencia: mesAtual, anoReferencia: anoAtual },
        select: { metaId: true },
      });
      const metasComReal = new Set(realizacoesMes.map((r) => r.metaId));
      const metasSemReal = metasAprovadas.filter((m) => !metasComReal.has(m.id));

      if (metasSemReal.length > 0) {
        results.push({
          id: "metas_sem_realizacao_mes",
          tipo: "AVISO",
          categoria: "Realizações",
          titulo: `Metas sem realização em ${mesAtual}/${anoAtual}`,
          descricao: `${metasSemReal.length} meta(s) com janela aberta ainda sem realização lançada neste mês.`,
          count: metasSemReal.length,
          detalhes: metasSemReal.map((m) => `Meta #${m.id} — ${m.indicador.nome}`),
        });
      } else if (metasAprovadas.length > 0) {
        results.push({
          id: "realizacoes_mes_ok",
          tipo: "OK",
          categoria: "Realizações",
          titulo: "Todas as metas têm realizações no mês",
          descricao: `Todas as metas aprovadas têm realizações lançadas para ${mesAtual}/${anoAtual}.`,
          count: 0,
          detalhes: [],
        });
      }
    }

    // ── 7. Realizações fora de janela de apuração ───────────────────────────
    const janelas = await prisma.janelaApuracao.findMany({
      where: { cicloId: cicloAlvo.id },
      select: { mesReferencia: true, anoReferencia: true },
    });
    const janelaKeys = new Set(janelas.map((j) => `${j.anoReferencia}-${j.mesReferencia}`));

    const todasRealizacoes = await prisma.realizacao.findMany({
      where: { meta: { cicloId: cicloAlvo.id } },
      select: { mesReferencia: true, anoReferencia: true, meta: { select: { indicador: { select: { nome: true } } } } },
    });

    const realizacoesSemJanela = todasRealizacoes.filter(
      (r) => !janelaKeys.has(`${r.anoReferencia}-${r.mesReferencia}`)
    );

    if (realizacoesSemJanela.length > 0) {
      results.push({
        id: "realizacoes_sem_janela",
        tipo: "AVISO",
        categoria: "Realizações",
        titulo: "Realizações fora de janela de apuração",
        descricao: `${realizacoesSemJanela.length} realização(ões) lançada(s) em períodos sem janela de apuração cadastrada.`,
        count: realizacoesSemJanela.length,
        detalhes: Array.from(
          new Set(realizacoesSemJanela.map((r) => `${r.mesReferencia}/${r.anoReferencia}`))
        ).map((p) => `Período ${p} sem janela`),
      });
    } else if (todasRealizacoes.length > 0) {
      results.push({
        id: "janelas_ok",
        tipo: "OK",
        categoria: "Realizações",
        titulo: "Realizações dentro de janelas",
        descricao: "Todas as realizações correspondem a períodos com janela cadastrada.",
        count: 0,
        detalhes: [],
      });
    }

    // ── 8. Workflow pendente antigo ─────────────────────────────────────────
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const workflowAntigo = await prisma.workflowItem.findMany({
      where: { status: "PENDENTE", criadoEm: { lt: seteDiasAtras } },
      include: { meta: { select: { id: true, indicador: { select: { nome: true } } } } },
    });

    if (workflowAntigo.length > 0) {
      results.push({
        id: "workflow_atrasado",
        tipo: "AVISO",
        categoria: "Workflow",
        titulo: "Aprovações pendentes há mais de 7 dias",
        descricao: `${workflowAntigo.length} item(ns) no workflow aguardando aprovação há mais de 7 dias.`,
        count: workflowAntigo.length,
        detalhes: workflowAntigo.slice(0, 10).map((w) =>
          `${w.tipo} — Meta #${w.metaId ?? "–"} ${w.meta?.indicador?.nome ? `(${w.meta.indicador.nome})` : ""}`
        ),
      });
    } else {
      results.push({
        id: "workflow_ok",
        tipo: "OK",
        categoria: "Workflow",
        titulo: "Workflow em dia",
        descricao: "Nenhum item pendente há mais de 7 dias.",
        count: 0,
        detalhes: [],
      });
    }

    // ── 9. Indicadores ativos sem metas no ciclo ───────────────────────────
    const indicadores = await prisma.indicador.findMany({
      where: { cicloId: cicloAlvo.id, status: "ATIVO" },
      include: { metas: { where: { cicloId: cicloAlvo.id } } },
    });
    const indSemMeta = indicadores.filter((i) => i.metas.length === 0);

    if (indSemMeta.length > 0) {
      results.push({
        id: "indicadores_sem_meta",
        tipo: "AVISO",
        categoria: "Indicadores",
        titulo: "Indicadores ativos sem metas",
        descricao: `${indSemMeta.length} indicador(es) ativo(s) no ciclo sem nenhuma meta cadastrada.`,
        count: indSemMeta.length,
        detalhes: indSemMeta.map((i) => `${i.nome} (${i.codigo})`),
      });
    } else if (indicadores.length > 0) {
      results.push({
        id: "indicadores_ok",
        tipo: "OK",
        categoria: "Indicadores",
        titulo: "Todos os indicadores têm metas",
        descricao: "Todos os indicadores ativos possuem metas associadas.",
        count: 0,
        detalhes: [],
      });
    }

    // ── 10. Metas DRAFT antigas (mais de 30 dias sem aprovação) ────────────
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const metasDraftAntigas = await prisma.meta.findMany({
      where: {
        cicloId: cicloAlvo.id,
        status: "DRAFT",
        // Prisma sqlite: without createdAt field on Meta, check by id approximation
      },
      include: { indicador: { select: { nome: true } } },
    });
    // Filter aproximado: só alertar se houver metas DRAFT quando ciclo já está ATIVO
    if (cicloAlvo.status === "ATIVO" && metasDraftAntigas.length > 0) {
      results.push({
        id: "metas_draft",
        tipo: "AVISO",
        categoria: "Metas",
        titulo: "Metas em rascunho com ciclo ativo",
        descricao: `${metasDraftAntigas.length} meta(s) ainda em status DRAFT enquanto o ciclo está ATIVO — não geram prêmio.`,
        count: metasDraftAntigas.length,
        detalhes: metasDraftAntigas.slice(0, 10).map((m) => `Meta #${m.id} — ${m.indicador.nome}`),
      });
    }

    // Ordenar: ERRO > AVISO > OK
    const ordem = { ERRO: 0, AVISO: 1, OK: 2 };
    results.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);

    return NextResponse.json({ data: results });
  } catch (err) {
    console.error("Consistencia error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

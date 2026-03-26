import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    // Empresa
    const empresa = await prisma.empresa.upsert({
      where: { codigo: "EMP001" },
      update: {},
      create: { codigo: "EMP001", nome: "Empresa Demonstração" },
    });

    // Centros de Custo
    const ccComercial = await prisma.centroCusto.upsert({
      where: { codigo: "CC-COM" },
      update: {},
      create: { codigo: "CC-COM", nome: "Comercial", nivel: 1, empresaId: empresa.id },
    });
    const ccTec = await prisma.centroCusto.upsert({
      where: { codigo: "CC-TEC" },
      update: {},
      create: { codigo: "CC-TEC", nome: "Tecnologia", nivel: 1, empresaId: empresa.id },
    });
    const ccFin = await prisma.centroCusto.upsert({
      where: { codigo: "CC-FIN" },
      update: {},
      create: { codigo: "CC-FIN", nome: "Financeiro", nivel: 1, empresaId: empresa.id },
    });

    // Cargos
    const cargoDiretor = await prisma.cargo.upsert({
      where: { codigo: "DIR" },
      update: {},
      create: { codigo: "DIR", nome: "Diretor", nivelHierarquico: "N1", targetBonusPerc: 40 },
    });
    const cargoGerente = await prisma.cargo.upsert({
      where: { codigo: "GER" },
      update: {},
      create: { codigo: "GER", nome: "Gerente", nivelHierarquico: "N2", targetBonusPerc: 25 },
    });
    const cargoAnalista = await prisma.cargo.upsert({
      where: { codigo: "ANL" },
      update: {},
      create: { codigo: "ANL", nome: "Analista", nivelHierarquico: "N4", targetBonusPerc: 15 },
    });

    // Colaboradores
    const colabs = [
      {
        matricula: "M001",
        nomeCompleto: "Carlos Eduardo Mendes",
        cpf: "111.222.333-01",
        email: "carlos.mendes@empresa.com.br",
        salarioBase: 25000,
        cargoId: cargoDiretor.id,
        centroCustoId: ccComercial.id,
      },
      {
        matricula: "M002",
        nomeCompleto: "Fernanda Lima Souza",
        cpf: "111.222.333-02",
        email: "fernanda.souza@empresa.com.br",
        salarioBase: 15000,
        cargoId: cargoGerente.id,
        centroCustoId: ccComercial.id,
      },
      {
        matricula: "M003",
        nomeCompleto: "Rafael Oliveira Nunes",
        cpf: "111.222.333-03",
        email: "rafael.nunes@empresa.com.br",
        salarioBase: 8500,
        cargoId: cargoAnalista.id,
        centroCustoId: ccTec.id,
      },
      {
        matricula: "M004",
        nomeCompleto: "Juliana Pereira Costa",
        cpf: "111.222.333-04",
        email: "juliana.costa@empresa.com.br",
        salarioBase: 9200,
        cargoId: cargoAnalista.id,
        centroCustoId: ccTec.id,
      },
      {
        matricula: "M005",
        nomeCompleto: "Anderson Rodrigues Silva",
        cpf: "111.222.333-05",
        email: "anderson.silva@empresa.com.br",
        salarioBase: 12000,
        cargoId: cargoGerente.id,
        centroCustoId: ccFin.id,
      },
    ];

    const colaboradoresCriados = [];
    for (const c of colabs) {
      const col = await prisma.colaborador.upsert({
        where: { matricula: c.matricula },
        update: {},
        create: {
          ...c,
          dataAdmissao: new Date("2022-01-01"),
          empresaId: empresa.id,
        },
      });
      colaboradoresCriados.push(col);
    }

    // Ciclo ICP
    const ciclo = await prisma.cicloICP.upsert({
      where: { anoFiscal: 2026 },
      update: {},
      create: {
        anoFiscal: 2026,
        status: "ATIVO",
        mesInicio: 1,
        mesFim: 12,
        bonusPool: 500000,
      },
    });

    // Indicadores
    const indReceita = await prisma.indicador.upsert({
      where: { codigo: "REC-LIQ-2026" },
      update: {},
      create: {
        codigo: "REC-LIQ-2026",
        nome: "Receita Líquida",
        descricao: "Receita líquida mensal da empresa",
        tipo: "VOLUME_FINANCEIRO",
        abrangencia: "CORPORATIVO",
        unidade: "R$",
        metaMinima: 80,
        metaAlvo: 100,
        metaMaxima: 120,
        cicloId: ciclo.id,
        status: "ATIVO",
      },
    });

    const indNps = await prisma.indicador.upsert({
      where: { codigo: "NPS-2026" },
      update: {},
      create: {
        codigo: "NPS-2026",
        nome: "NPS",
        descricao: "Net Promoter Score de satisfação do cliente",
        tipo: "VOLUME_FINANCEIRO",
        abrangencia: "AREA",
        unidade: "pts",
        metaMinima: 60,
        metaAlvo: 75,
        metaMaxima: 90,
        cicloId: ciclo.id,
        status: "ATIVO",
      },
    });

    const indPrazo = await prisma.indicador.upsert({
      where: { codigo: "PRAZO-ENT-2026" },
      update: {},
      create: {
        codigo: "PRAZO-ENT-2026",
        nome: "Prazo de Entrega",
        descricao: "Percentual de entregas dentro do prazo",
        tipo: "CUSTO_PRAZO",
        abrangencia: "INDIVIDUAL",
        unidade: "%",
        metaMinima: 80,
        metaAlvo: 95,
        metaMaxima: 100,
        cicloId: ciclo.id,
        status: "ATIVO",
      },
    });

    // Metas
    const metaReceita = await prisma.meta.upsert({
      where: { id: 1 },
      update: {},
      create: {
        indicadorId: indReceita.id,
        cicloId: ciclo.id,
        centroCustoId: ccComercial.id,
        pesoNaCesta: 50,
        metaMinima: 2000000,
        metaAlvo: 2500000,
        metaMaxima: 3000000,
        status: "APROVADO",
      },
    });

    const metaNps = await prisma.meta.upsert({
      where: { id: 2 },
      update: {},
      create: {
        indicadorId: indNps.id,
        cicloId: ciclo.id,
        centroCustoId: ccComercial.id,
        pesoNaCesta: 30,
        metaMinima: 60,
        metaAlvo: 75,
        metaMaxima: 90,
        status: "APROVADO",
      },
    });

    const metaPrazo = await prisma.meta.upsert({
      where: { id: 3 },
      update: {},
      create: {
        indicadorId: indPrazo.id,
        cicloId: ciclo.id,
        centroCustoId: ccTec.id,
        pesoNaCesta: 20,
        metaMinima: 80,
        metaAlvo: 95,
        metaMaxima: 100,
        status: "APROVADO",
      },
    });

    // MetaColaboradores — vincular colaboradores às metas
    for (const col of colaboradoresCriados) {
      await prisma.metaColaborador.upsert({
        where: { metaId_colaboradorId: { metaId: metaReceita.id, colaboradorId: col.id } },
        update: {},
        create: { metaId: metaReceita.id, colaboradorId: col.id },
      });
      await prisma.metaColaborador.upsert({
        where: { metaId_colaboradorId: { metaId: metaNps.id, colaboradorId: col.id } },
        update: {},
        create: { metaId: metaNps.id, colaboradorId: col.id },
      });
    }

    // Vincular colaboradores de TI à meta de prazo
    const colabsTec = colaboradoresCriados.filter(
      (c) => c.centroCustoId === ccTec.id
    );
    for (const col of colabsTec) {
      await prisma.metaColaborador.upsert({
        where: { metaId_colaboradorId: { metaId: metaPrazo.id, colaboradorId: col.id } },
        update: {},
        create: { metaId: metaPrazo.id, colaboradorId: col.id },
      });
    }

    // Realizações (Jan e Fev 2026)
    const realizacoesData = [
      // Meta Receita
      { metaId: metaReceita.id, mesReferencia: 1, anoReferencia: 2026, valorRealizado: 2600000 },
      { metaId: metaReceita.id, mesReferencia: 2, anoReferencia: 2026, valorRealizado: 2450000 },
      // Meta NPS
      { metaId: metaNps.id, mesReferencia: 1, anoReferencia: 2026, valorRealizado: 78 },
      { metaId: metaNps.id, mesReferencia: 2, anoReferencia: 2026, valorRealizado: 72 },
      // Meta Prazo
      { metaId: metaPrazo.id, mesReferencia: 1, anoReferencia: 2026, valorRealizado: 92 },
      { metaId: metaPrazo.id, mesReferencia: 2, anoReferencia: 2026, valorRealizado: 88 },
    ];

    for (const r of realizacoesData) {
      const meta = await prisma.meta.findUnique({
        where: { id: r.metaId },
        include: { indicador: true },
      });
      if (!meta) continue;

      let nota = 0;
      if (meta.indicador.tipo === "VOLUME_FINANCEIRO") {
        nota = (r.valorRealizado / meta.metaAlvo) * 100;
      } else if (meta.indicador.tipo === "CUSTO_PRAZO") {
        nota = (meta.metaAlvo / r.valorRealizado) * 100;
      }
      if (meta.metaMaxima) nota = Math.min(nota, (meta.metaMaxima / meta.metaAlvo) * 100);
      nota = Math.max(0, nota);

      try {
        await prisma.realizacao.upsert({
          where: {
            metaId_colaboradorId_mesReferencia_anoReferencia: {
              metaId: r.metaId,
              colaboradorId: null as unknown as number,
              mesReferencia: r.mesReferencia,
              anoReferencia: r.anoReferencia,
            },
          },
          update: {},
          create: {
            metaId: r.metaId,
            mesReferencia: r.mesReferencia,
            anoReferencia: r.anoReferencia,
            valorRealizado: r.valorRealizado,
            notaCalculada: nota,
            status: "APROVADO",
            aprovacao: new Date(),
          },
        });
      } catch {
        // ignore duplicate
      }
    }

    // Marcar como seeded
    await prisma.parametroSistema.upsert({
      where: { id: 1 },
      update: { seeded: true, cicloAtivoId: ciclo.id },
      create: { id: 1, seeded: true, cicloAtivoId: ciclo.id },
    });

    return NextResponse.json({
      data: {
        message: "Seed concluido",
        totais: {
          empresa: 1,
          centrosCusto: 3,
          cargos: 3,
          colaboradores: colaboradoresCriados.length,
          indicadores: 3,
          metas: 3,
          ciclos: 1,
        },
      },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Erro ao executar seed", detail: String(err) },
      { status: 500 }
    );
  }
}

-- CreateTable
CREATE TABLE "Indicador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL,
    "abrangencia" TEXT NOT NULL DEFAULT 'CORPORATIVO',
    "unidade" TEXT NOT NULL DEFAULT '%',
    "metaMinima" REAL,
    "metaAlvo" REAL,
    "metaMaxima" REAL,
    "baseline" REAL,
    "metrica" TEXT,
    "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL',
    "criterioApuracao" TEXT NOT NULL DEFAULT 'ULTIMA_POSICAO',
    "origemDado" TEXT,
    "analistaResp" TEXT,
    "aprovadorId" TEXT,
    "responsavelEnvioId" INTEGER,
    "divisorId" INTEGER,
    "statusJanela" TEXT NOT NULL DEFAULT 'FECHADA',
    "janelaAbertaEm" DATETIME,
    "janelaFechadaEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Indicador_responsavelEnvioId_fkey" FOREIGN KEY ("responsavelEnvioId") REFERENCES "Colaborador" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Indicador_divisorId_fkey" FOREIGN KEY ("divisorId") REFERENCES "Indicador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Agrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CORPORATIVO',
    "descricao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IndicadorNoAgrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agrupamentoId" INTEGER NOT NULL,
    "indicadorId" INTEGER NOT NULL,
    "peso" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "IndicadorNoAgrupamento_agrupamentoId_fkey" FOREIGN KEY ("agrupamentoId") REFERENCES "Agrupamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IndicadorNoAgrupamento_indicadorId_fkey" FOREIGN KEY ("indicadorId") REFERENCES "Indicador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AtribuicaoAgrupamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "colaboradorId" INTEGER NOT NULL,
    "agrupamentoId" INTEGER NOT NULL,
    "pesoNaCesta" REAL NOT NULL,
    "cascata" TEXT NOT NULL DEFAULT 'NENHUM',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtribuicaoAgrupamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AtribuicaoAgrupamento_agrupamentoId_fkey" FOREIGN KEY ("agrupamentoId") REFERENCES "Agrupamento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Indicador_cicloId_codigo_key" ON "Indicador"("cicloId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorNoAgrupamento_agrupamentoId_indicadorId_key" ON "IndicadorNoAgrupamento"("agrupamentoId", "indicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "AtribuicaoAgrupamento_colaboradorId_agrupamentoId_key" ON "AtribuicaoAgrupamento"("colaboradorId", "agrupamentoId");

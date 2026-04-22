CREATE TABLE "MovimentacaoColaborador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "matricula" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dataEfetiva" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dadosAntigos" TEXT,
    "dadosNovos" TEXT,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

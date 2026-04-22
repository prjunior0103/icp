CREATE TABLE "ConfigCartaICP" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "cicloId" INTEGER NOT NULL,
  "gatilhoPercentual" REAL NOT NULL DEFAULT 80,
  "gatilhoIndicador" TEXT NOT NULL DEFAULT 'LAIR CONTÁBIL',
  "gatilhoTotal" TEXT NOT NULL DEFAULT 'TOTAL 2025',
  "reguladorPool" TEXT NOT NULL DEFAULT '[]',
  "targetSalarioPool" TEXT NOT NULL DEFAULT '',
  "targetBonus" TEXT NOT NULL DEFAULT '',
  "textoCriterios" TEXT NOT NULL DEFAULT '',
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigCartaICP_cicloId_key" ON "ConfigCartaICP"("cicloId");

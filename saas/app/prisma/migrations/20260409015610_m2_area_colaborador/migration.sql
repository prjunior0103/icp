-- CreateTable
CREATE TABLE "Area" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "centroCusto" TEXT NOT NULL,
    "codEmpresa" TEXT NOT NULL,
    "nivel1" TEXT NOT NULL,
    "nivel2" TEXT,
    "nivel3" TEXT,
    "nivel4" TEXT,
    "nivel5" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cicloId" INTEGER NOT NULL,
    "areaId" INTEGER,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "matricula" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "grade" TEXT,
    "salarioBase" REAL NOT NULL,
    "target" REAL NOT NULL,
    "centroCusto" TEXT,
    "codEmpresa" TEXT,
    "admissao" DATETIME,
    "gestorId" INTEGER,
    "matriculaGestor" TEXT,
    "nomeGestor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Colaborador_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Colaborador_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Colaborador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLABORADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CicloICP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "anoFiscal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SETUP',
    "mesInicio" INTEGER NOT NULL DEFAULT 1,
    "mesFim" INTEGER NOT NULL DEFAULT 12,
    "bonusPool" REAL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParametroSistema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "cicloAtivoId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CicloICP_anoFiscal_key" ON "CicloICP"("anoFiscal");

-- Colaborador: campos de desligamento
ALTER TABLE "Colaborador" ADD COLUMN "dataDesligamento" DATETIME;
ALTER TABLE "Colaborador" ADD COLUMN "tipoDesligamento" TEXT;

-- MovimentacaoColaborador: novos campos
ALTER TABLE "MovimentacaoColaborador" ADD COLUMN "requerNovoPainel" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "MovimentacaoColaborador" ADD COLUMN "painelAnteriorId" INTEGER;
ALTER TABLE "MovimentacaoColaborador" ADD COLUMN "painelNovoId" INTEGER;
ALTER TABLE "MovimentacaoColaborador" ADD COLUMN "statusTratamento" TEXT NOT NULL DEFAULT 'PENDENTE';

-- ConfigMovimentacao
CREATE TABLE IF NOT EXISTS "ConfigMovimentacao" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "cicloId" INTEGER NOT NULL,
    "campos" TEXT NOT NULL DEFAULT 'centroCusto,matriculaGestor'
);

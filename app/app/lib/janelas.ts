import { prisma } from "@/app/lib/prisma";

/**
 * Check whether a JanelaApuracao is currently open for the given ciclo/mes/ano.
 * Returns { aberta: true, janela: null } when no janela exists (no restriction).
 */
export async function isJanelaAberta(
  cicloId: number,
  mesReferencia: number,
  anoReferencia: number
): Promise<{ aberta: boolean; janela: { id: number; status: string } | null }> {
  const janela = await prisma.janelaApuracao.findUnique({
    where: { cicloId_mesReferencia_anoReferencia: { cicloId, mesReferencia, anoReferencia } },
  });
  if (!janela) return { aberta: true, janela: null };

  const now = new Date();
  const withinWindow = now >= janela.dataAbertura && now <= janela.dataFechamento;
  const aberta =
    (janela.status === "ABERTA" || janela.status === "PRORROGADA") && withinWindow;

  return { aberta, janela: { id: janela.id, status: janela.status } };
}

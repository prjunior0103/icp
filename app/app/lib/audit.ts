import { prisma } from "@/app/lib/prisma";

interface AuditParams {
  userId: string;
  userName: string;
  acao: "CRIAR" | "EDITAR" | "EXCLUIR";
  entidade: string;
  entidadeId?: string | number | null;
  descricao: string;
  dadosAntigos?: unknown;
  dadosNovos?: unknown;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId != null ? String(params.entidadeId) : null,
        descricao: params.descricao,
        dadosAntigos: params.dadosAntigos != null ? JSON.stringify(params.dadosAntigos) : null,
        dadosNovos: params.dadosNovos != null ? JSON.stringify(params.dadosNovos) : null,
      },
    });
  } catch {
    // Audit nunca deve quebrar a operação principal
  }
}

export function getAuditUser(session: { user?: { id?: string; name?: string | null } | null }) {
  return {
    userId: (session.user as { id?: string })?.id ?? "unknown",
    userName: session.user?.name ?? "Desconhecido",
  };
}

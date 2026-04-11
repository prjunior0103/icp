"use client";

import { ModalWrapper } from "./ModalWrapper";

interface Props {
  message: string;
  /** Texto do botão de confirmação (padrão: "Confirmar") */
  confirmLabel?: string;
  /** Variante do botão de confirmação (padrão: "danger") */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  /** Mostra spinner no botão (operação em andamento) */
  loading?: boolean;
}

export function ConfirmModal({
  message,
  confirmLabel = "Confirmar",
  variant = "danger",
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  const confirmCls =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white"
      : "bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white";

  return (
    <ModalWrapper onClose={onCancel} size="sm" closeOnBackdrop={!loading}>
      <p className="text-sm text-gray-700 mb-5">{message}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 text-sm py-2 rounded-lg ${confirmCls}`}
        >
          {loading ? "Aguarde..." : confirmLabel}
        </button>
      </div>
    </ModalWrapper>
  );
}

/**
 * Hook para gerenciar estado de um ConfirmModal.
 *
 * Uso:
 * ```tsx
 * const confirm = useConfirm();
 *
 * function excluir(id: number) {
 *   confirm.request("Excluir este item?", () => deletar(id));
 * }
 *
 * return (
 *   <>
 *     ...
 *     {confirm.modal}
 *   </>
 * );
 * ```
 */
import { useState, useCallback } from "react";

interface ConfirmState {
  message: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  variant?: "danger" | "primary";
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [loading, setLoading] = useState(false);

  const request = useCallback(
    (
      message: string,
      onConfirm: () => void | Promise<void>,
      opts?: { confirmLabel?: string; variant?: "danger" | "primary" }
    ) => {
      setState({ message, onConfirm, ...opts });
    },
    []
  );

  async function handleConfirm() {
    if (!state) return;
    setLoading(true);
    try {
      await state.onConfirm();
    } finally {
      setLoading(false);
      setState(null);
    }
  }

  const modal = state ? (
    <ConfirmModal
      message={state.message}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      onCancel={() => setState(null)}
      loading={loading}
    />
  ) : null;

  return { request, modal };
}

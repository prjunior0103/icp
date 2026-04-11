"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

interface Props {
  /** Título exibido no cabeçalho. Se omitido, não renderiza cabeçalho. */
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof WIDTHS;
  /** Fechar ao clicar no backdrop (padrão: true) */
  closeOnBackdrop?: boolean;
}

export function ModalWrapper({
  title,
  onClose,
  children,
  size = "md",
  closeOnBackdrop = true,
}: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${WIDTHS[size]} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

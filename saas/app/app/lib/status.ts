export const STATUS_LABEL: Record<string, string> = {
  SETUP: "Configuração",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
};

// Com border — usar em fundos brancos/neutros
export const STATUS_COLOR: Record<string, string> = {
  SETUP: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ATIVO: "bg-green-100 text-green-700 border-green-200",
  ENCERRADO: "bg-gray-100 text-gray-500 border-gray-200",
};

// Sem border — usar em fundos coloridos (ex: header azul)
export const STATUS_BADGE: Record<string, string> = {
  SETUP: "bg-yellow-100 text-yellow-700",
  ATIVO: "bg-green-100 text-green-700",
  ENCERRADO: "bg-gray-100 text-gray-500",
};

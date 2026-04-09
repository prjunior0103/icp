"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Ciclo {
  id: number;
  anoFiscal: number;
  status: string;
  mesInicio: number;
  mesFim: number;
  bonusPool?: number | null;
}

interface CicloContextType {
  ciclos: Ciclo[];
  cicloAtivo: Ciclo | null;
  setCicloAtivo: (c: Ciclo) => void;
  recarregar: () => void;
}

const CicloContext = createContext<CicloContextType>({
  ciclos: [],
  cicloAtivo: null,
  setCicloAtivo: () => {},
  recarregar: () => {},
});

export function CicloProvider({ children }: { children: ReactNode }) {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cicloAtivo, setCicloAtivo] = useState<Ciclo | null>(null);

  function carregar(cicloAtivoAtual?: Ciclo | null) {
    fetch("/api/ciclos")
      .then((r) => r.json())
      .then((data) => {
        const lista: Ciclo[] = data.ciclos ?? [];
        setCiclos(lista);
        // Se o servidor retorna um ativo, usar. Senão, manter o atual se ainda existir.
        // Se o atual foi excluído, cair para o primeiro da lista.
        const servidorAtivo = data.ativo ?? null;
        if (servidorAtivo) {
          setCicloAtivo(servidorAtivo);
        } else if (cicloAtivoAtual && lista.find((c) => c.id === cicloAtivoAtual.id)) {
          setCicloAtivo(cicloAtivoAtual);
        } else {
          setCicloAtivo(lista[0] ?? null);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <CicloContext.Provider value={{ ciclos, cicloAtivo, setCicloAtivo, recarregar: () => carregar(cicloAtivo) }}>
      {children}
    </CicloContext.Provider>
  );
}

export function useCiclo() {
  return useContext(CicloContext);
}

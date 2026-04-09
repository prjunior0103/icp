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

  function carregar() {
    fetch("/api/ciclos")
      .then((r) => r.json())
      .then((data) => {
        setCiclos(data.ciclos ?? []);
        setCicloAtivo(data.ativo ?? null);
      })
      .catch(() => {});
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <CicloContext.Provider value={{ ciclos, cicloAtivo, setCicloAtivo, recarregar: carregar }}>
      {children}
    </CicloContext.Provider>
  );
}

export function useCiclo() {
  return useContext(CicloContext);
}

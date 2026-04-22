"use client";

import { useState } from "react";
import { Users, Building2, ArrowLeftRight } from "lucide-react";
import { useCiclo } from "@/app/lib/ciclo-context";
import { AbaColaboradores } from "./_components/AbaColaboradores";
import { AbaAreas } from "./_components/AbaAreas";
import { AbaMovimentacoes } from "./_components/AbaMovimentacoes";

export default function ColaboradoresPage() {
  const { cicloAtivo } = useCiclo();
  const [aba, setAba] = useState<"colaboradores" | "areas" | "movimentacoes">("colaboradores");

  if (!cicloAtivo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Users size={40} className="mb-3 text-gray-300" />
        <p className="font-medium">Selecione um ciclo no header para continuar</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
        <p className="text-gray-500 text-sm mt-1">Ciclo {cicloAtivo.anoFiscal} — {cicloAtivo.status}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["colaboradores", "Colaboradores", <Users size={14}/>],
          ["areas", "Áreas", <Building2 size={14}/>],
          ["movimentacoes", "Movimentações", <ArrowLeftRight size={14}/>],
        ] as const).map(([tab, label, icon]) => (
          <button key={tab} onClick={() => setAba(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              aba === tab ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {aba === "colaboradores" ? (
        <AbaColaboradores cicloId={cicloAtivo.id} />
      ) : aba === "areas" ? (
        <AbaAreas cicloId={cicloAtivo.id} />
      ) : (
        <AbaMovimentacoes cicloId={cicloAtivo.id} />
      )}
    </div>
  );
}

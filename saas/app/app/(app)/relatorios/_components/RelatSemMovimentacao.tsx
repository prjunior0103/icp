"use client";

import { useState, useEffect } from "react";
import { Download, UserCheck } from "lucide-react";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface ColabSemMov {
  id: number;
  matricula: string;
  nome: string;
  cargo: string;
  centroCusto: string | null;
  nomeGestor: string | null;
  status: string;
  salarioBase: number;
  target: number;
  avos: number;
  mesesAtivos: number;
  totalMeses: number;
  premioBase: number;
  premioMaxProporcional: number;
  dataAdm: string | null;
}

export function RelatSemMovimentacao({ cicloId }: { cicloId: number }) {
  const [colaboradores, setColaboradores] = useState<ColabSemMov[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/relatorios/sem-movimentacao?cicloId=${cicloId}`)
      .then(r => r.json())
      .then(d => { setColaboradores(d.colaboradores ?? []); setLoading(false); });
  }, [cicloId]);

  if (loading) return <LoadingSpinner text="Carregando..." />;

  const totalPremioMax = colaboradores.reduce((s, c) => s + c.premioMaxProporcional, 0);
  const cheios = colaboradores.filter(c => c.avos === 1).length;
  const proporcionais = colaboradores.filter(c => c.avos < 1).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900">{colaboradores.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 uppercase font-medium">Ciclo Cheio</p>
          <p className="text-2xl font-bold text-green-700">{cheios}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase font-medium">Proporcionais</p>
          <p className="text-2xl font-bold text-amber-700">{proporcionais}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-blue-600 uppercase font-medium">Prêmio Máx. Total</p>
          <p className="text-lg font-bold text-blue-700">{fmtR(totalPremioMax)}</p>
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <UserCheck size={32} className="mb-2 text-gray-300" />
          <p className="text-sm">Todos os colaboradores têm movimentações registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Colaborador", "Cargo", "Centro de Custo", "Gestor", "Salário Base", "Target", "Ávos", "Detalhe Ávos", "Prêmio Máx."].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{c.nome}</p>
                    <p className="text-xs font-mono text-gray-500">{c.matricula}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{c.cargo}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.centroCusto ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{c.nomeGestor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">{fmtR(c.salarioBase)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">{c.target}%</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      c.avos === 1 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {c.mesesAtivos}/{c.totalMeses}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {c.avos === 1
                      ? <span className="text-green-600">Ciclo cheio</span>
                      : c.dataAdm
                        ? <span>Admitido em {c.dataAdm} → {c.mesesAtivos}/{c.totalMeses} meses</span>
                        : <span>{c.mesesAtivos}/{c.totalMeses} meses</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{fmtR(c.premioMaxProporcional)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => window.location.href = `/api/relatorios/sem-movimentacao?cicloId=${cicloId}&export=xlsx`}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Download size={15} /> Exportar
        </button>
      </div>
    </div>
  );
}

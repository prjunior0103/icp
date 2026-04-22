"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import type { MovRel } from "./types";
import { MOV_TIPO_LABEL, MOV_TIPO_COR } from "./types";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";

export function RelatMovimentacoes({ cicloId }: { cicloId: number }) {
  const [movs, setMovs] = useState<MovRel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/movimentacoes?cicloId=${cicloId}`)
      .then(r => r.json())
      .then(d => {
        setMovs(d.movimentacoes ?? []);
        setLoading(false);
      });
  }, [cicloId]);

  if (loading) return <LoadingSpinner text="Carregando..." />;

  const porTipo = new Map<string, number>();
  for (const m of movs) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);

  const pendentes = movs.filter(m => m.statusTratamento === "PENDENTE").length;
  const tratados = movs.filter(m => m.statusTratamento === "TRATADO").length;
  const requerPainel = movs.filter(m => m.requerNovoPainel && m.statusTratamento === "PENDENTE").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
          <p className="text-2xl font-bold text-gray-900">{movs.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase font-medium">Pendentes</p>
          <p className="text-2xl font-bold text-amber-700">{pendentes}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <p className="text-xs text-green-600 uppercase font-medium">Tratados</p>
          <p className="text-2xl font-bold text-green-700">{tratados}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-blue-600 uppercase font-medium">Requerem Painel</p>
          <p className="text-2xl font-bold text-blue-700">{requerPainel}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Tipo</h3>
        <div className="flex flex-wrap gap-2">
          {[...porTipo.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, qtd]) => (
            <div key={tipo} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${MOV_TIPO_COR[tipo] ?? "bg-gray-100 text-gray-600"}`}>
              {MOV_TIPO_LABEL[tipo] ?? tipo}: {qtd}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Data", "Colaborador", "Matrícula", "Tipo", "Painel", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movs.filter(m => m.tipo !== "ADMISSAO").map(m => (
              <tr key={m.id} className={`hover:bg-gray-50 ${m.statusTratamento === "PENDENTE" ? "bg-amber-50/30" : ""}`}>
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(m.dataEfetiva).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{m.nomeColaborador ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{m.matricula}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${MOV_TIPO_COR[m.tipo] ?? "bg-gray-100"}`}>
                    {MOV_TIPO_LABEL[m.tipo] ?? m.tipo}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {m.requerNovoPainel ? (
                    <div>
                      {m.painelAnteriorNome && <span className="text-red-500 line-through mr-1">{m.painelAnteriorNome}</span>}
                      {m.painelNovoNome
                        ? <span className="text-green-700 font-medium">{m.painelNovoNome}</span>
                        : <span className="text-amber-600 font-medium">Pendente</span>}
                    </div>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${
                    m.statusTratamento === "PENDENTE" ? "bg-amber-100 text-amber-700" :
                    m.statusTratamento === "TRATADO"  ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {m.statusTratamento}
                  </span>
                </td>
              </tr>
            ))}
            {movs.filter(m => m.tipo !== "ADMISSAO").length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">
                  Nenhuma movimentação (exceto admissões do primeiro import)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => window.location.href = `/api/colaboradores/export-consolidada?cicloId=${cicloId}`}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Download size={15} /> Exportar Base Consolidada
        </button>
      </div>
    </div>
  );
}

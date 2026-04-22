"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import type { Atribuicao } from "./types";

export function RelatCartaPDF({ atribuicoes, cicloId }: { atribuicoes: Atribuicao[]; cicloId: number }) {
  const [tipo, setTipo] = useState<"todos" | "colaborador">("todos");
  const [colaboradorId, setColaboradorId] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const colabsMap = new Map<number, { id: number; nome: string }>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, { id: a.colaboradorId, nome: a.colaborador.nome });
  const colaboradores = Array.from(colabsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

  async function gerar() {
    setErro("");
    setGerando(true);
    try {
      const params = new URLSearchParams({ cicloId: String(cicloId) });
      if (tipo === "colaborador" && colaboradorId) params.set("colaboradorId", colaboradorId);
      const res = await fetch(`/api/carta-pdf?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErro(d.error ?? `Erro ${res.status} ao gerar PDF`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carta-icp.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de conexão ao gerar PDF");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-blue-500" />
          <h3 className="font-semibold text-gray-800">Gerar Carta PDF</h3>
        </div>
        <p className="text-sm text-gray-500">
          Gera a carta de incentivo individual com painel, indicadores e critérios.
          Configure os parâmetros em <strong>Configurações → Carta ICP</strong>.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Escopo</label>
          <select
            value={tipo}
            onChange={e => { setTipo(e.target.value as typeof tipo); setColaboradorId(""); setErro(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os colaboradores</option>
            <option value="colaborador">Colaborador específico</option>
          </select>
        </div>
        {tipo === "colaborador" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Colaborador</label>
            <select
              value={colaboradorId}
              onChange={e => setColaboradorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar...</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
        <button
          onClick={gerar}
          disabled={gerando || (tipo === "colaborador" && !colaboradorId)}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Mail size={15} /> {gerando ? "Gerando..." : "Baixar PDF"}
        </button>
      </div>
    </div>
  );
}

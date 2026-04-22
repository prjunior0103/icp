"use client";

import { useState } from "react";
import { Presentation } from "lucide-react";
import type { Atribuicao } from "./types";

export function RelatPPT({ atribuicoes, cicloId }: { atribuicoes: Atribuicao[]; cicloId: number }) {
  const [tipo, setTipo] = useState<"todos" | "colaborador" | "gestor" | "area">("todos");
  const [filtroId, setFiltroId] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [gerando, setGerando] = useState(false);

  const colabsMap = new Map<number, { id: number; nome: string; gestorId?: number | null }>();
  for (const a of atribuicoes) colabsMap.set(a.colaboradorId, { id: a.colaboradorId, nome: a.colaborador.nome, gestorId: a.colaborador.gestorId });
  const colaboradores = Array.from(colabsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  const gestoresIds = new Set(colaboradores.map(c => c.gestorId).filter(Boolean));
  const gestores = colaboradores.filter(c => gestoresIds.has(c.id));
  const areas = Array.from(new Set(atribuicoes.map(a => a.colaborador.area?.nivel1).filter(Boolean))) as string[];

  async function gerar() {
    setGerando(true);
    const params = new URLSearchParams({ cicloId: String(cicloId), tipo });
    if ((tipo === "colaborador" || tipo === "gestor") && filtroId) params.set("filtroId", filtroId);
    if (tipo === "area" && filtroArea) params.set("filtroArea", filtroArea);
    const res = await fetch(`/api/ppt?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ICP-PPT-${tipo}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setGerando(false);
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Presentation size={18} className="text-blue-500" />
          <h3 className="font-semibold text-gray-800">Gerar PPT Executivo</h3>
        </div>
        <p className="text-sm text-gray-500">
          Gera uma apresentação com um slide por colaborador contendo painel, indicadores, atingimento, MID total e YTD.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Escopo</label>
          <select
            value={tipo}
            onChange={e => { setTipo(e.target.value as typeof tipo); setFiltroId(""); setFiltroArea(""); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os colaboradores</option>
            <option value="colaborador">Colaborador específico</option>
            <option value="gestor">Equipe de um gestor</option>
            <option value="area">Área específica</option>
          </select>
        </div>
        {tipo === "colaborador" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Colaborador</label>
            <select
              value={filtroId}
              onChange={e => setFiltroId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar...</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        {tipo === "gestor" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Gestor</label>
            <select
              value={filtroId}
              onChange={e => setFiltroId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar...</option>
              {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </div>
        )}
        {tipo === "area" && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Área</label>
            <select
              value={filtroArea}
              onChange={e => setFiltroArea(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar...</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
        <button
          onClick={gerar}
          disabled={
            gerando ||
            (tipo === "colaborador" && !filtroId) ||
            (tipo === "gestor" && !filtroId) ||
            (tipo === "area" && !filtroArea)
          }
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Presentation size={15} />
          {gerando ? "Gerando..." : "Baixar PPT"}
        </button>
      </div>
    </div>
  );
}

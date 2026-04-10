"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Search, ChevronDown, ChevronRight, X } from "lucide-react";

interface AuditLog {
  id: number;
  userId: string;
  userName: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  descricao: string;
  dadosAntigos: string | null;
  dadosNovos: string | null;
  criadoEm: string;
}

const ACAO_CORES: Record<string, string> = {
  CRIAR:   "bg-green-100 text-green-700",
  EDITAR:  "bg-blue-100 text-blue-700",
  EXCLUIR: "bg-red-100 text-red-700",
};

function JsonExpander({ label, json }: { label: string; json: string | null }) {
  const [open, setOpen] = useState(false);
  if (!json) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { parsed = json; }
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        {open ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
        {label}
      </button>
      {open && (
        <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-600 overflow-x-auto max-w-lg">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        ...(busca && { busca }),
        ...(filtroAcao && { acao: filtroAcao }),
        ...(filtroEntidade && { entidade: filtroEntidade }),
      });
      const res = await fetch(`/api/auditoria?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [busca, filtroAcao, filtroEntidade, offset]);

  useEffect(() => { setOffset(0); }, [busca, filtroAcao, filtroEntidade]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const hasFilter = busca || filtroAcao || filtroEntidade;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-gray-600" />
          <h1 className="text-lg font-semibold text-gray-800">Auditoria</h1>
          {total > 0 && <span className="text-xs text-gray-400">{total} registro{total !== 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário, descrição..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas as ações</option>
          <option value="CRIAR">Criar</option>
          <option value="EDITAR">Editar</option>
          <option value="EXCLUIR">Excluir</option>
        </select>
        <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas as entidades</option>
          {["Ciclo","Area","Colaborador","Indicador","Agrupamento","Atribuicao","Realizacao","FaixaIndicador","MetaPeriodo"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        {hasFilter && (
          <button onClick={() => { setBusca(""); setFiltroAcao(""); setFiltroEntidade(""); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 rounded hover:bg-red-50 transition-colors">
            <X size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Shield size={32} className="mb-2 text-gray-300" />
            <p className="text-sm">Nenhum registro encontrado</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-36">Data/Hora</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-36">Usuário</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-20">Ação</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-28">Entidade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmt(log.criadoEm)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{log.userName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${ACAO_CORES[log.acao] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-600">{log.entidade}</span>
                      {log.entidadeId && <span className="text-xs text-gray-400 ml-1">#{log.entidadeId}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">
                      {log.descricao}
                      <JsonExpander label="dados anteriores" json={log.dadosAntigos} />
                      <JsonExpander label="dados novos" json={log.dadosNovos} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Paginação */}
            {total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {offset + 1}–{Math.min(offset + limit, total)} de {total}
                </span>
                <div className="flex gap-2">
                  <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}
                    className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                    Anterior
                  </button>
                  <button disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}
                    className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

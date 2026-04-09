"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, X, Building2, Calendar, LayoutDashboard } from "lucide-react";
import { useCiclo } from "@/app/lib/ciclo-context";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const statusLabel: Record<string, string> = {
  SETUP: "Configuração",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
};

const statusColor: Record<string, string> = {
  SETUP: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ATIVO: "bg-green-100 text-green-700 border-green-200",
  ENCERRADO: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const { ciclos, cicloAtivo, setCicloAtivo, recarregar } = useCiclo();
  const role = (session?.user as { role?: string })?.role;

  const [modalOpen, setModalOpen] = useState(false);
  const [anoFiscal, setAnoFiscal] = useState(String(new Date().getFullYear()));
  const [mesInicio, setMesInicio] = useState("1");
  const [mesFim, setMesFim] = useState("12");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function criarCiclo(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch("/api/ciclos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anoFiscal: Number(anoFiscal),
          mesInicio: Number(mesInicio),
          mesFim: Number(mesFim),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.error ?? "Erro ao criar ciclo");
        return;
      }
      const { ciclo } = await res.json();
      recarregar();
      setCicloAtivo(ciclo);
      setModalOpen(false);
    } catch {
      setErro("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral do ciclo ICP</p>
        </div>
        {role === "GUARDIAO" && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Novo Ciclo
          </button>
        )}
      </div>

      {/* Painel do ciclo ativo */}
      {cicloAtivo ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Ciclo ICP {cicloAtivo.anoFiscal}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor[cicloAtivo.status] ?? ""}`}>
                    {statusLabel[cicloAtivo.status] ?? cicloAtivo.status}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar size={11} />
                    {MESES[cicloAtivo.mesInicio - 1]}/{cicloAtivo.anoFiscal} — {MESES[cicloAtivo.mesFim - 1]}/{cicloAtivo.anoFiscal}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-400">ID #{cicloAtivo.id}</span>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <Building2 size={32} className="text-blue-300 mx-auto mb-2" />
          <p className="text-blue-700 font-medium text-sm">Nenhum ciclo selecionado</p>
          {role === "GUARDIAO" && (
            <p className="text-blue-500 text-xs mt-1">
              Crie um ciclo clicando em <strong>Novo Ciclo</strong> acima
            </p>
          )}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Colaboradores", value: cicloAtivo ? "0" : "—" },
          { label: "Metas", value: cicloAtivo ? "0" : "—" },
          { label: "Indicadores", value: cicloAtivo ? "0" : "—" },
          { label: "Prêmio projetado", value: cicloAtivo ? "R$ 0" : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {cicloAtivo && (
              <p className="text-xs text-gray-400 mt-1">Ciclo {cicloAtivo.anoFiscal}</p>
            )}
          </div>
        ))}
      </div>

      {/* Lista de ciclos */}
      {ciclos.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Todos os ciclos</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {ciclos.map((c) => (
              <button
                key={c.id}
                onClick={() => setCicloAtivo(c)}
                className={`w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-gray-50 transition-colors ${
                  cicloAtivo?.id === c.id ? "bg-blue-50" : ""
                }`}
              >
                <span className={`font-medium ${cicloAtivo?.id === c.id ? "text-blue-700" : "text-gray-700"}`}>
                  Ciclo {c.anoFiscal}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor[c.status] ?? ""}`}>
                  {statusLabel[c.status] ?? c.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Placeholder módulos */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center justify-center text-center min-h-40">
        <LayoutDashboard size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Módulos em construção</p>
        <p className="text-gray-400 text-sm mt-1">Colaboradores, Metas e Apuração serão adicionados nos próximos milestones</p>
      </div>

      {/* Modal criar ciclo */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Novo Ciclo ICP</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={criarCiclo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano Fiscal
                </label>
                <input
                  type="number"
                  required
                  min={2020}
                  max={2100}
                  value={anoFiscal}
                  onChange={(e) => setAnoFiscal(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mês início
                  </label>
                  <select
                    value={mesInicio}
                    onChange={(e) => setMesInicio(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MESES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mês fim
                  </label>
                  <select
                    value={mesFim}
                    onChange={(e) => setMesFim(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MESES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {erro && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {salvando ? "Criando..." : "Criar Ciclo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Users, Plus, Trash2, Pencil, X, Eye, EyeOff, Shield, UserCog, User, Building2, FileText, Save } from "lucide-react";

interface Usuario { id: string; name: string; email: string; role: string; }

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  GUARDIAO:   { label: "Guardião", color: "bg-red-100 text-red-700" },
  BP:         { label: "BP", color: "bg-purple-100 text-purple-700" },
  GESTOR:     { label: "Gestor", color: "bg-blue-100 text-blue-700" },
  COLABORADOR:{ label: "Colaborador", color: "bg-green-100 text-green-700" },
  CLIENTE:    { label: "Cliente", color: "bg-gray-100 text-gray-600" },
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  GUARDIAO: <Shield size={12}/>,
  BP: <Building2 size={12}/>,
  GESTOR: <UserCog size={12}/>,
  COLABORADOR: <User size={12}/>,
  CLIENTE: <Eye size={12}/>,
};

interface ReguladorFaixa { faixaDe: number; faixaAte: number; fator: number; }
interface ConfigCarta {
  gatilhoPercentual: number;
  gatilhoIndicador: string;
  gatilhoTotal: string;
  reguladorPool: ReguladorFaixa[];
  textoCriterios: string;
}

export default function ConfiguracoesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const [aba, setAba] = useState<"usuarios" | "carta">("usuarios");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modal, setModal] = useState<"criar" | "editar" | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [userRole, setUserRole] = useState("COLABORADOR");
  const [showSenha, setShowSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    fetch("/api/usuarios").then(r => r.json()).then(d => { setUsuarios(d.usuarios ?? []); setLoading(false); });
  }

  useEffect(() => { carregar(); }, []);

  function abrirCriar() {
    setEditando(null); setNome(""); setEmail(""); setSenha(""); setUserRole("COLABORADOR"); setErro(""); setModal("criar");
  }

  function abrirEditar(u: Usuario) {
    setEditando(u); setNome(u.name); setEmail(u.email); setSenha(""); setUserRole(u.role); setErro(""); setModal("editar");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(""); setSalvando(true);
    try {
      if (modal === "criar") {
        const res = await fetch("/api/usuarios", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nome, email, password: senha, userRole }),
        });
        if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao criar"); return; }
      } else {
        const body: Record<string, string> = { id: editando!.id, name: nome, userRole };
        if (senha) body.password = senha;
        const res = await fetch("/api/usuarios", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao salvar"); return; }
      }
      setModal(null); carregar();
    } catch { setErro("Erro de conexão"); } finally { setSalvando(false); }
  }

  async function excluir(id: string) {
    if (!confirm("Confirma exclusão do usuário?")) return;
    setExcluindo(id);
    await fetch(`/api/usuarios?id=${id}`, { method: "DELETE" });
    setExcluindo(null); carregar();
  }

  // ── Carta ICP ──────────────────────────────────────────
  const [cicloId, setCicloId] = useState<number | null>(null);
  const [carta, setCarta] = useState<ConfigCarta>({
    gatilhoPercentual: 80,
    gatilhoIndicador: "LAIR CONTÁBIL",
    gatilhoTotal: "TOTAL 2025",
    reguladorPool: [],
    textoCriterios: "",
  });
  const [salvandoCarta, setSalvandoCarta] = useState(false);
  const [cartaSalva, setCartaSalva] = useState(false);

  useEffect(() => {
    fetch("/api/ciclos")
      .then(r => r.json())
      .then(d => {
        const ativo = (d.ciclos ?? []).find((c: { id: number; status: string }) => c.status === "ATIVO");
        if (ativo) { setCicloId(ativo.id); carregarCarta(ativo.id); }
      });
  }, []);

  function carregarCarta(id: number) {
    fetch(`/api/config-carta?cicloId=${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          const c = d.config;
          setCarta({
            gatilhoPercentual: c.gatilhoPercentual ?? 80,
            gatilhoIndicador: c.gatilhoIndicador ?? "",
            gatilhoTotal: c.gatilhoTotal ?? "",
            reguladorPool: (() => { try { return JSON.parse(c.reguladorPool ?? "[]"); } catch { return []; } })(),
            textoCriterios: c.textoCriterios ?? "",
          });
        }
      });
  }

  async function salvarCarta() {
    if (!cicloId) return;
    setSalvandoCarta(true);
    await fetch("/api/config-carta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId, ...carta, reguladorPool: carta.reguladorPool }),
    });
    setSalvandoCarta(false);
    setCartaSalva(true);
    setTimeout(() => setCartaSalva(false), 2500);
  }

  function addFaixa() {
    setCarta(c => ({ ...c, reguladorPool: [...c.reguladorPool, { faixaDe: 0, faixaAte: 0, fator: 1 }] }));
  }
  function removeFaixa(i: number) {
    setCarta(c => ({ ...c, reguladorPool: c.reguladorPool.filter((_, idx) => idx !== i) }));
  }
  function updateFaixa(i: number, field: keyof ReguladorFaixa, val: number) {
    setCarta(c => {
      const reg = [...c.reguladorPool];
      reg[i] = { ...reg[i], [field]: val };
      return { ...c, reguladorPool: reg };
    });
  }

  if (role !== "GUARDIAO" && role !== "BP") return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <p>Sem permissão para acessar configurações.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm mt-1">Gerenciamento de usuários e parâmetros do ciclo</p>
        </div>
        {role === "GUARDIAO" && aba === "usuarios" && (
          <button onClick={abrirCriar}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16}/> Novo Usuário
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: "usuarios", label: "Usuários", icon: <Users size={14}/> },
          { id: "carta",    label: "Carta ICP", icon: <FileText size={14}/> },
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id as typeof aba)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              aba === t.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {aba === "usuarios" && (<>
      {/* Legenda de perfis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Perfis de Acesso</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(ROLE_LABELS).map(([key, { label, color }]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit ${color}`}>
                {ROLE_ICONS[key]} {label}
              </span>
              <p className="text-xs text-gray-400 pl-0.5">
                {key === "GUARDIAO" && "Acesso total ao sistema"}
                {key === "BP" && "Gestão por área"}
                {key === "GESTOR" && "Visão de equipe"}
                {key === "COLABORADOR" && "Visão pessoal"}
                {key === "CLIENTE" && "Relatórios e dashboard (somente leitura)"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-gray-500"/>
          <h3 className="text-sm font-semibold text-gray-700">Usuários</h3>
          <span className="text-xs text-gray-400 ml-auto">{usuarios.length} usuário(s)</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Nome","Email","Perfil","Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map(u => {
                const rl = ROLE_LABELS[u.role] ?? { label: u.role, color: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${rl.color}`}>
                        {ROLE_ICONS[u.role]} {rl.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {role === "GUARDIAO" && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirEditar(u)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Pencil size={14}/>
                          </button>
                          <button onClick={() => excluir(u.id)} disabled={excluindo === u.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      </>)}

      {/* ── Aba Carta ICP ── */}
      {aba === "carta" && (
        <div className="space-y-6 max-w-2xl">
          {!cicloId && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg">
              Nenhum ciclo ativo encontrado. Ative um ciclo para configurar a carta.
            </div>
          )}

          {/* Gatilho */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Gatilho de Pagamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Percentual mínimo (%)</label>
                <input type="number" step="0.1" value={carta.gatilhoPercentual}
                  onChange={e => setCarta(c => ({ ...c, gatilhoPercentual: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Indicador de gatilho</label>
                <input type="text" value={carta.gatilhoIndicador}
                  onChange={e => setCarta(c => ({ ...c, gatilhoIndicador: e.target.value }))}
                  placeholder="ex: LAIR CONTÁBIL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Resultado total (rótulo)</label>
              <input type="text" value={carta.gatilhoTotal}
                onChange={e => setCarta(c => ({ ...c, gatilhoTotal: e.target.value }))}
                placeholder="ex: TOTAL 2025"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          {/* Regulador do Pool */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Regulador do Pool</h3>
              <button onClick={addFaixa}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium border border-blue-200 hover:border-blue-400 px-2 py-1 rounded-lg transition-colors">
                <Plus size={12}/> Faixa
              </button>
            </div>
            {carta.reguladorPool.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhuma faixa configurada.</p>
            )}
            {carta.reguladorPool.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">De (%)</label>
                  <input type="number" step="0.1" value={f.faixaDe}
                    onChange={e => updateFaixa(i, "faixaDe", Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Até (%)</label>
                  <input type="number" step="0.1" value={f.faixaAte}
                    onChange={e => updateFaixa(i, "faixaAte", Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fator</label>
                  <input type="number" step="0.01" value={f.fator}
                    onChange={e => updateFaixa(i, "fator", Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <button onClick={() => removeFaixa(i)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mb-0.5">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>

          {/* Critérios e Conceitos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Critérios e Conceitos</h3>
            <textarea value={carta.textoCriterios} rows={6}
              onChange={e => setCarta(c => ({ ...c, textoCriterios: e.target.value }))}
              placeholder="Descreva os critérios de elegibilidade, conceitos e regras do ICP..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"/>
          </div>

          {/* Salvar */}
          <div className="flex items-center gap-3">
            <button onClick={salvarCarta} disabled={salvandoCarta || !cicloId}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              <Save size={15}/> {salvandoCarta ? "Salvando..." : "Salvar configuração"}
            </button>
            {cartaSalva && <span className="text-sm text-green-600 font-medium">✓ Salvo com sucesso</span>}
          </div>
        </div>
      )}

      {/* Modal criar/editar usuário */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{modal === "criar" ? "Novo Usuário" : "Editar Usuário"}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={modal === "editar"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha {modal === "editar" && <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>}
                </label>
                <div className="relative">
                  <input type={showSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)}
                    required={modal === "criar"}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  <button type="button" onClick={() => setShowSenha(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showSenha ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                <select value={userRole} onChange={e => setUserRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(ROLE_LABELS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-medium py-2 rounded-lg">
                  {salvando ? "Salvando..." : modal === "criar" ? "Criar" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

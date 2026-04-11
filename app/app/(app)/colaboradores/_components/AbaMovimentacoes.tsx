"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, CheckCircle2, AlertCircle, ArrowLeftRight, ArrowRight, UserX, Search, FileDown, FileUp, Settings, Plus } from "lucide-react";
import { fmtData } from "@/app/lib/format";

const TIPO_COR: Record<string, string> = {
  ADMISSAO:              "bg-green-100 text-green-700",
  DESLIGAMENTO:          "bg-red-100 text-red-700",
  POSSIVEL_DESLIGAMENTO: "bg-red-50 text-red-600 border border-red-200",
  AFASTAMENTO:           "bg-orange-100 text-orange-700",
  RETORNO:               "bg-blue-100 text-blue-700",
  MUDANCA_FUNCAO:        "bg-purple-100 text-purple-700",
  MUDANCA_AREA:          "bg-yellow-100 text-yellow-700",
  MUDANCA_GESTOR:        "bg-indigo-100 text-indigo-700",
  MUDANCA_AREA_GESTOR:   "bg-pink-100 text-pink-700",
  MOVIMENTACAO:          "bg-gray-100 text-gray-700",
};
const TIPO_LABEL: Record<string, string> = {
  ADMISSAO:"Admissão", DESLIGAMENTO:"Desligamento", POSSIVEL_DESLIGAMENTO:"Possível Desligamento",
  AFASTAMENTO:"Afastamento", RETORNO:"Retorno", MUDANCA_FUNCAO:"Mudança de Função",
  MUDANCA_AREA:"Mudança de Área", MUDANCA_GESTOR:"Mudança de Gestor",
  MUDANCA_AREA_GESTOR:"Mudança Área + Gestor", MOVIMENTACAO:"Movimentação",
};
const STATUS_TRAT_COR: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-700",
  TRATADO: "bg-green-100 text-green-700",
  IGNORADO: "bg-gray-100 text-gray-500",
};
const TIPOS_DESLIGAMENTO = [
  { value: "VOLUNTARIO", label: "Voluntário" },
  { value: "INVOLUNTARIO", label: "Involuntário" },
  { value: "TERMINO_CONTRATO", label: "Término de Contrato" },
  { value: "APOSENTADORIA", label: "Aposentadoria" },
  { value: "FALECIMENTO", label: "Falecimento" },
  { value: "OUTROS", label: "Outros" },
];

interface Movimentacao {
  id: number; matricula: string; tipo: string; dataEfetiva: string;
  dadosAntigos: string|null; dadosNovos: string|null; observacao: string|null;
  requerNovoPainel: boolean; painelAnteriorId: number|null; painelNovoId: number|null;
  painelAnteriorNome: string|null; painelNovoNome: string|null;
  statusTratamento: string; nomeColaborador: string|null; criadoEm: string;
}

interface Agrupamento { id: number; nome: string; }
interface ConfigCampo { key: string; label: string; }

// ─── Modal Config Campos ─────────────────────────────────
function ModalConfigCampos({ cicloId, onClose }: { cicloId: number; onClose: () => void }) {
  const [disponiveis, setDisponiveis] = useState<ConfigCampo[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(`/api/config-movimentacao?cicloId=${cicloId}`).then(r => r.json()).then(d => {
      setDisponiveis(d.camposDisponiveis ?? []);
      setSelecionados(d.camposSelecionados ?? []);
    });
  }, [cicloId]);

  function toggle(key: string) {
    setSelecionados(s => s.includes(key) ? s.filter(k => k !== key) : [...s, key]);
  }

  async function salvar() {
    setSalvando(true);
    await fetch("/api/config-movimentacao", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cicloId, campos: selecionados }),
    });
    setSalvando(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Campos de Movimentação</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Selecione quais campos, ao mudar entre imports, constituem uma movimentação:</p>
        <div className="space-y-2 mb-5">
          {disponiveis.map(c => (
            <label key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selecionados.includes(c.key)} onChange={() => toggle(c.key)} className="rounded text-blue-600" />
              <span className="text-sm text-gray-700">{c.label}</span>
            </label>
          ))}
        </div>
        {selecionados.length === 0 && <p className="text-xs text-red-500 mb-3">Selecione ao menos um campo</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={salvar} disabled={salvando || selecionados.length === 0} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Desligamento Individual ───────────────────────
function ModalDesligamento({ mov, onSave, onClose }: { mov: Movimentacao; onSave: () => void; onClose: () => void }) {
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !tipo) { setErro("Preencha todos os campos"); return; }
    setSalvando(true);
    const res = await fetch("/api/movimentacoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mov.id, acao: "CONFIRMAR_DESLIGAMENTO", dataDesligamento: data, tipoDesligamento: tipo }),
    });
    if (!res.ok) { setErro("Erro ao salvar"); setSalvando(false); return; }
    onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Confirmar Desligamento</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-1"><strong>{mov.nomeColaborador}</strong></p>
        <p className="text-xs text-gray-400 mb-4">Matrícula: {mov.matricula}</p>
        <form onSubmit={confirmar} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data de Desligamento *</label>
            <input type="date" required value={data} onChange={e => setData(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Desligamento *</label>
            <select required value={tipo} onChange={e => setTipo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione...</option>
              {TIPOS_DESLIGAMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm py-2 rounded-lg">
              {salvando ? "Salvando..." : "Confirmar Desligamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Import Desligamentos XLSX ─────────────────────
function ModalImportDesligamentos({ cicloId, onDone, onClose }: { cicloId: number; onDone: () => void; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ processados: number; erros: string[] } | null>(null);

  async function importar() {
    if (!file) return;
    setEnviando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("cicloId", String(cicloId));
    const res = await fetch("/api/movimentacoes/import-desligamentos", { method: "POST", body: fd });
    const data = await res.json();
    setResultado(data);
    setEnviando(false);
    if (data.processados > 0) onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Importar Desligamentos</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {!resultado ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Baixe a planilha de pendentes, preencha <strong>dataDesligamento</strong> e <strong>tipoDesligamento</strong>, depois carregue aqui.</p>
            <p className="text-xs text-gray-400">Tipos válidos: VOLUNTARIO, INVOLUNTARIO, TERMINO_CONTRATO, APOSENTADORIA, FALECIMENTO, OUTROS</p>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={32} className="text-gray-300 mx-auto mb-2" />
              <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-sm text-gray-600" />
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={importar} disabled={!file || enviando} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm py-2 rounded-lg">
                {enviando ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium">{resultado.processados} desligamento(s) processado(s)</span>
            </div>
            {resultado.erros.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-red-700 text-sm font-medium mb-1">
                  <AlertCircle size={15} /> {resultado.erros.length} erro(s):
                </div>
                {resultado.erros.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal Atribuir Painel ───────────────────────────────
function ModalAtribuirPainel({ mov, cicloId, agrupamentos, onSave, onClose }: {
  mov: Movimentacao; cicloId: number; agrupamentos: Agrupamento[]; onSave: () => void; onClose: () => void;
}) {
  // Map<agrupamentoId, pesoNaCesta> — suporta múltiplos painéis
  const [selecionados, setSelecionados] = useState<Map<number, number>>(new Map());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function toggleAg(agId: number) {
    setSelecionados(m => {
      const n = new Map(m);
      n.has(agId) ? n.delete(agId) : n.set(agId, 100);
      return n;
    });
  }

  function setPeso(agId: number, peso: number) {
    setSelecionados(m => { const n = new Map(m); n.set(agId, peso); return n; });
  }

  async function salvar() {
    if (selecionados.size === 0) { setErro("Selecione ao menos um agrupamento"); return; }
    setSalvando(true);
    setErro("");

    // Primeiro: buscar o colaboradorId pela matrícula
    const colabRes = await fetch(`/api/colaboradores?cicloId=${cicloId}&busca=${mov.matricula}`);
    const colabData = await colabRes.json();
    const colab = (colabData.colaboradores ?? []).find((c: { matricula: string }) => c.matricula === mov.matricula);
    if (!colab) { setErro("Colaborador não encontrado"); setSalvando(false); return; }

    // Criar AtribuicaoAgrupamento para cada painel selecionado
    const atribResults = await Promise.all(
      [...selecionados].map(([agrupamentoId, pesoNaCesta]) =>
        fetch("/api/atribuicoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cicloId, colaboradorId: colab.id, agrupamentoId, pesoNaCesta, cascata: "NENHUM" }),
        })
      )
    );

    if (atribResults.some(r => !r.ok)) { setErro("Erro ao criar atribuições"); setSalvando(false); return; }

    // Marcar movimentação como tratada com o primeiro painel selecionado como referência
    const primeiroId = [...selecionados.keys()][0];
    await fetch("/api/movimentacoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: mov.id, acao: "TRATAR", painelNovoId: primeiroId }),
    });

    setSalvando(false);
    onSave();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Atribuir Novo Painel</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-gray-600 mb-1"><strong>{mov.nomeColaborador}</strong></p>
        <p className="text-xs text-gray-400 mb-1">Matrícula: {mov.matricula}</p>
        {mov.painelAnteriorNome && (
          <p className="text-xs text-amber-600 mb-4">Painel anterior: <span className="font-medium">{mov.painelAnteriorNome}</span> — permanece ativo</p>
        )}

        <p className="text-xs font-medium text-gray-600 mb-2">Selecione os novos agrupamentos:</p>
        <div className="space-y-2 mb-4">
          {agrupamentos.map(ag => {
            const sel = selecionados.has(ag.id);
            return (
              <div key={ag.id} className={`border rounded-lg px-3 py-2 ${sel ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sel} onChange={() => toggleAg(ag.id)} className="rounded text-blue-600" />
                  <span className="text-sm text-gray-800 flex-1">{ag.nome}</span>
                </label>
                {sel && (
                  <div className="flex items-center gap-2 mt-2 ml-6">
                    <label className="text-xs text-gray-500">Peso na cesta (%):</label>
                    <input
                      type="number" min={0} max={100} step={1}
                      value={selecionados.get(ag.id) ?? 100}
                      onChange={e => setPeso(ag.id, Number(e.target.value))}
                      className="w-20 border border-gray-300 rounded px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selecionados.size > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            {selecionados.size} agrupamento(s) selecionado(s). Soma dos pesos: {[...selecionados.values()].reduce((a, b) => a + b, 0)}%
          </p>
        )}

        {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{erro}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={salvar} disabled={selecionados.size === 0 || salvando}
            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
            {salvando ? "Salvando..." : `Atribuir ${selecionados.size > 0 ? `(${selecionados.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AbaMovimentacoes({ cicloId }: { cicloId: number }) {
  const router = useRouter();
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [agrupamentos, setAgrupamentos] = useState<Agrupamento[]>([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [modalDesligamento, setModalDesligamento] = useState<Movimentacao | null>(null);
  const [modalPainel, setModalPainel] = useState<Movimentacao | null>(null);
  const [modalImportDeslig, setModalImportDeslig] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({
      cicloId: String(cicloId),
      ...(filtroTipo && { tipo: filtroTipo }),
      ...(filtroStatus && { status: filtroStatus }),
      ...(busca && { busca }),
    });
    fetch(`/api/movimentacoes?${p}`).then(r => r.json()).then(d => { setMovs(d.movimentacoes ?? []); setLoading(false); });
  }, [cicloId, filtroTipo, filtroStatus, busca]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    fetch(`/api/agrupamentos?cicloId=${cicloId}`).then(r => r.json()).then(d => setAgrupamentos(d.agrupamentos ?? []));
  }, [cicloId]);


  function parseDados(json: string | null) {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  async function ignorar(id: number) {
    await fetch("/api/movimentacoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acao: "IGNORAR" }),
    });
    carregar();
  }

  const LABEL_MAP: Record<string, string> = {
    cargo: "Cargo", centroCusto: "Centro de Custo", matriculaGestor: "Matrícula Gestor",
    nomeGestor: "Nome Gestor", status: "Status", nome: "Nome", grade: "Grade",
    codEmpresa: "Cód. Empresa", dataDesligamento: "Data Desligamento", tipoDesligamento: "Tipo Desligamento",
  };

  // Contadores para resumo
  const pendentes = movs.filter(m => m.statusTratamento === "PENDENTE").length;
  const requerPainel = movs.filter(m => m.requerNovoPainel && m.statusTratamento === "PENDENTE").length;
  const desaparecidos = movs.filter(m => m.tipo === "POSSIVEL_DESLIGAMENTO" && m.statusTratamento === "PENDENTE").length;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      {pendentes > 0 && (
        <div className="flex gap-3">
          {requerPainel > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <AlertCircle size={16} className="text-amber-600" />
              <span className="text-sm text-amber-800"><strong>{requerPainel}</strong> colaborador(es) requerem novo painel</span>
            </div>
          )}
          {desaparecidos > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <UserX size={16} className="text-red-600" />
              <span className="text-sm text-red-800"><strong>{desaparecidos}</strong> possível(is) desligamento(s) pendente(s)</span>
            </div>
          )}
        </div>
      )}

      {/* Filtros e Ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar matrícula..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="TRATADO">Tratado</option>
          <option value="IGNORADO">Ignorado</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {desaparecidos > 0 && (
            <>
              <button onClick={() => window.location.href = `/api/movimentacoes/export-pendentes?cicloId=${cicloId}`}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
                <FileDown size={14} /> Exportar Pendentes
              </button>
              <button onClick={() => setModalImportDeslig(true)}
                className="flex items-center gap-1.5 border border-red-300 text-red-700 text-sm px-3 py-2 rounded-lg hover:bg-red-50">
                <FileUp size={14} /> Importar Desligamentos
              </button>
            </>
          )}
          <button onClick={() => setModalConfig(true)}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
            <Settings size={14} /> Campos
          </button>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
      ) : movs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <ArrowLeftRight size={32} className="mb-2 text-gray-300" />
          <p className="text-sm">Nenhuma movimentação registrada</p>
          <p className="text-xs mt-1">As movimentações são detectadas automaticamente no import</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-24">Data</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Colaborador</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-40">Tipo</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Antes → Depois</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-24">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m, i) => {
                const ant = parseDados(m.dadosAntigos);
                const nov = parseDados(m.dadosNovos);
                const keys = nov ? Object.keys(nov) : ant ? Object.keys(ant) : [];
                return (
                  <tr key={m.id} className={`border-b border-gray-100 align-top ${i % 2 === 0 ? "" : "bg-gray-50/40"} ${m.statusTratamento === "PENDENTE" ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtData(m.dataEfetiva)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{m.nomeColaborador ?? "—"}</p>
                      <p className="text-xs font-mono text-gray-400">{m.matricula}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${TIPO_COR[m.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                        {TIPO_LABEL[m.tipo] ?? m.tipo}
                      </span>
                      {m.requerNovoPainel && m.statusTratamento === "PENDENTE" && (
                        <span className="block mt-1 text-2xs text-amber-600 font-medium">Requer novo painel</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {keys.length === 0 ? <span className="text-gray-400">—</span> : keys.map(k => (
                        <div key={k} className="mb-0.5">
                          <span className="text-gray-400 mr-1">{LABEL_MAP[k] ?? k}:</span>
                          {ant?.[k] != null && <span className="text-red-600 line-through mr-1">{String(ant[k])}</span>}
                          {nov?.[k] != null && <span className="text-green-700 font-medium">{String(nov[k])}</span>}
                        </div>
                      ))}
                      {m.painelAnteriorNome && (
                        <div className="mt-1 text-[11px]">
                          <span className="text-gray-400">Painel: </span>
                          <span className="text-red-600 line-through mr-1">{m.painelAnteriorNome}</span>
                          {m.painelNovoNome && <><ArrowRight size={10} className="inline text-gray-400 mx-0.5" /><span className="text-green-700 font-medium">{m.painelNovoNome}</span></>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${STATUS_TRAT_COR[m.statusTratamento] ?? ""}`}>
                        {m.statusTratamento}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {m.tipo === "POSSIVEL_DESLIGAMENTO" && m.statusTratamento === "PENDENTE" && (
                          <>
                            <button onClick={() => setModalDesligamento(m)}
                              className="text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 hover:bg-red-50 whitespace-nowrap">
                              Confirmar Deslig.
                            </button>
                            <button onClick={() => ignorar(m.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                              Ignorar
                            </button>
                          </>
                        )}
                        {m.requerNovoPainel && m.statusTratamento === "PENDENTE" && (
                          <button onClick={() => setModalPainel(m)}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 whitespace-nowrap">
                            Atribuir Painel
                          </button>
                        )}
                        {m.tipo === "ADMISSAO" && (
                          <button onClick={() => router.push("/metas")}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50">
                            Atribuir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modais */}
      {modalConfig && <ModalConfigCampos cicloId={cicloId} onClose={() => { setModalConfig(false); carregar(); }} />}
      {modalDesligamento && <ModalDesligamento mov={modalDesligamento} onSave={carregar} onClose={() => setModalDesligamento(null)} />}
      {modalPainel && <ModalAtribuirPainel mov={modalPainel} cicloId={cicloId} agrupamentos={agrupamentos} onSave={carregar} onClose={() => setModalPainel(null)} />}
      {modalImportDeslig && <ModalImportDesligamentos cicloId={cicloId} onDone={carregar} onClose={() => setModalImportDeslig(false)} />}
    </div>
  );
}

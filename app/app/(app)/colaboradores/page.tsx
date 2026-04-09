"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, X, Pencil, Trash2, Upload, Download,
  Search, Users, Building2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useCiclo } from "@/app/lib/ciclo-context";

// ─── Types ───────────────────────────────────────────────
interface Area {
  id: number;
  cicloId: number;
  centroCusto: string;
  codEmpresa: string;
  nivel1: string;
  nivel2?: string | null;
  nivel3?: string | null;
  nivel4?: string | null;
  nivel5?: string | null;
}

interface Colaborador {
  id: number;
  cicloId: number;
  areaId?: number | null;
  area?: Area | null;
  nome: string;
  email?: string | null;
  matricula: string;
  cargo: string;
  grade?: string | null;
  salarioBase: number;
  target: number;
  centroCusto?: string | null;
  codEmpresa?: string | null;
  admissao?: string | null;
  gestorId?: number | null;
  matriculaGestor?: string | null;
  nomeGestor?: string | null;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-green-100 text-green-700",
  INATIVO: "bg-gray-100 text-gray-500",
  AFASTADO: "bg-yellow-100 text-yellow-700",
};

// ─── Modal Área ───────────────────────────────────────────
function ModalArea({
  area, cicloId, onSave, onClose,
}: {
  area: Area | null;
  cicloId: number;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    centroCusto: area?.centroCusto ?? "",
    codEmpresa: area?.codEmpresa ?? "",
    nivel1: area?.nivel1 ?? "",
    nivel2: area?.nivel2 ?? "",
    nivel3: area?.nivel3 ?? "",
    nivel4: area?.nivel4 ?? "",
    nivel5: area?.nivel5 ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const method = area ? "PUT" : "POST";
    const body = area ? { id: area.id, ...form } : { cicloId, ...form };
    const res = await fetch("/api/areas", {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { setErro("Erro ao salvar"); setSalvando(false); return; }
    onSave();
    onClose();
  }

  const campo = (label: string, key: keyof typeof form, obrigatorio = false) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{obrigatorio && " *"}</label>
      <input
        required={obrigatorio}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{area ? "Editar Área" : "Nova Área"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {campo("Centro de Custo", "centroCusto", true)}
            {campo("Cód. Empresa", "codEmpresa", true)}
          </div>
          {campo("Nível 1", "nivel1", true)}
          {campo("Nível 2", "nivel2")}
          {campo("Nível 3", "nivel3")}
          <div className="grid grid-cols-2 gap-3">
            {campo("Nível 4", "nivel4")}
            {campo("Nível 5", "nivel5")}
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Colaborador ────────────────────────────────────
function ModalColaborador({
  colab, cicloId, areas, onSave, onClose,
}: {
  colab: Colaborador | null;
  cicloId: number;
  areas: Area[];
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nome: colab?.nome ?? "",
    email: colab?.email ?? "",
    matricula: colab?.matricula ?? "",
    cargo: colab?.cargo ?? "",
    grade: colab?.grade ?? "",
    salarioBase: colab?.salarioBase?.toString() ?? "",
    target: colab?.target?.toString() ?? "",
    centroCusto: colab?.centroCusto ?? "",
    codEmpresa: colab?.codEmpresa ?? "",
    admissao: colab?.admissao ? colab.admissao.slice(0, 10) : "",
    areaId: colab?.areaId?.toString() ?? "",
    matriculaGestor: colab?.matriculaGestor ?? "",
    nomeGestor: colab?.nomeGestor ?? "",
    status: colab?.status ?? "ATIVO",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    const body = {
      ...(colab ? { id: colab.id } : { cicloId }),
      ...form,
      areaId: form.areaId ? Number(form.areaId) : null,
      salarioBase: Number(form.salarioBase),
      target: Number(form.target),
      admissao: form.admissao || null,
    };
    const res = await fetch("/api/colaboradores", {
      method: colab ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const d = await res.json(); setErro(d.error ?? "Erro ao salvar"); setSalvando(false); return; }
    onSave();
    onClose();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{colab ? "Editar Colaborador" : "Novo Colaborador"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
              <input required value={form.nome} onChange={set("nome")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Matrícula *</label>
              <input required value={form.matricula} onChange={set("matricula")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set("email")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo *</label>
              <input required value={form.cargo} onChange={set("cargo")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade</label>
              <input value={form.grade} onChange={set("grade")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salário Base *</label>
              <input required type="number" min="0" step="0.01" value={form.salarioBase} onChange={set("salarioBase")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target (múltiplo) *</label>
              <input required type="number" min="0" step="0.01" value={form.target} onChange={set("target")} placeholder="ex: 1.5" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Área</label>
              <select value={form.areaId} onChange={set("areaId")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sem área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nivel1}{a.nivel2 ? ` / ${a.nivel2}` : ""} ({a.centroCusto})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Admissão</label>
              <input type="date" value={form.admissao} onChange={set("admissao")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Centro de Custo</label>
              <input value={form.centroCusto} onChange={set("centroCusto")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cód. Empresa</label>
              <input value={form.codEmpresa} onChange={set("codEmpresa")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Matrícula Gestor</label>
              <input value={form.matriculaGestor} onChange={set("matriculaGestor")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome Gestor</label>
              <input value={form.nomeGestor} onChange={set("nomeGestor")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={set("status")} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
                <option value="AFASTADO">Afastado</option>
              </select>
            </div>
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Importação ─────────────────────────────────────
function ModalImport({
  tipo, cicloId, onDone, onClose,
}: {
  tipo: "colaboradores" | "areas";
  cicloId: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ criados: number; erros: string[] } | null>(null);

  async function importar() {
    if (!file) return;
    setEnviando(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("cicloId", String(cicloId));
    const res = await fetch(`/api/${tipo}/import`, { method: "POST", body: fd });
    const data = await res.json();
    setResultado(data);
    setEnviando(false);
    if (data.criados > 0) onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Importar {tipo === "areas" ? "Áreas" : "Colaboradores"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {!resultado ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-3">Selecione o arquivo .xlsx</p>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-600"
              />
            </div>
            {file && <p className="text-xs text-gray-500">Arquivo: {file.name}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={importar}
                disabled={!file || enviando}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm py-2 rounded-lg"
              >
                {enviando ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium">{resultado.criados} registro(s) importado(s)</span>
            </div>
            {resultado.erros.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-red-700 text-sm font-medium mb-1">
                  <AlertCircle size={15} />
                  {resultado.erros.length} erro(s):
                </div>
                {resultado.erros.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">{e}</p>
                ))}
              </div>
            )}
            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 rounded-lg">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba Áreas ────────────────────────────────────────────
function AbaAreas({ cicloId }: { cicloId: number }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [modalArea, setModalArea] = useState<Area | null | "new">(null);
  const [modalImport, setModalImport] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const carregar = useCallback(() => {
    fetch(`/api/areas?cicloId=${cicloId}`).then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
  }, [cicloId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(id: number) {
    if (!confirm("Excluir esta área?")) return;
    setExcluindo(id);
    await fetch(`/api/areas?id=${id}`, { method: "DELETE" });
    setExcluindo(null);
    carregar();
  }

  function baixarTemplate() {
    window.location.href = "/api/areas/template";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end">
        <button onClick={baixarTemplate} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Download size={15} /> Template
        </button>
        <button onClick={() => setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Upload size={15} /> Importar
        </button>
        <button onClick={() => setModalArea("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg">
          <Plus size={15} /> Nova Área
        </button>
      </div>

      {areas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Building2 size={36} className="mx-auto mb-2 text-gray-300" />
          Nenhuma área cadastrada neste ciclo
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Centro Custo", "Cód. Empresa", "Nível 1", "Nível 2", "Nível 3", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">{a.centroCusto}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.codEmpresa}</td>
                  <td className="px-4 py-2.5 text-gray-700">{a.nivel1}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.nivel2 ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.nivel3 ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModalArea(a)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                      <button onClick={() => excluir(a.id)} disabled={excluindo === a.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalArea !== null && (
        <ModalArea
          area={modalArea === "new" ? null : modalArea}
          cicloId={cicloId}
          onSave={carregar}
          onClose={() => setModalArea(null)}
        />
      )}
      {modalImport && (
        <ModalImport tipo="areas" cicloId={cicloId} onDone={carregar} onClose={() => setModalImport(false)} />
      )}
    </div>
  );
}

// ─── Aba Colaboradores ────────────────────────────────────
function AbaColaboradores({ cicloId }: { cicloId: number }) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [busca, setBusca] = useState("");
  const [modalColab, setModalColab] = useState<Colaborador | null | "new">(null);
  const [modalImport, setModalImport] = useState(false);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const carregar = useCallback(() => {
    fetch(`/api/colaboradores?cicloId=${cicloId}&busca=${encodeURIComponent(busca)}`)
      .then((r) => r.json()).then((d) => setColaboradores(d.colaboradores ?? []));
    fetch(`/api/areas?cicloId=${cicloId}`).then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
  }, [cicloId, busca]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(id: number) {
    if (!confirm("Excluir este colaborador?")) return;
    setExcluindo(id);
    await fetch(`/api/colaboradores?id=${id}`, { method: "DELETE" });
    setExcluindo(null);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button onClick={() => window.location.href = "/api/colaboradores/template"} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Download size={15} /> Template
        </button>
        <button onClick={() => setModalImport(true)} className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50">
          <Upload size={15} /> Importar
        </button>
        <button onClick={() => setModalColab("new")} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-2 rounded-lg">
          <Plus size={15} /> Novo
        </button>
      </div>

      {colaboradores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-2 text-gray-300" />
          Nenhum colaborador neste ciclo
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Matrícula", "Nome", "Cargo / Grade", "Área", "Salário Base", "Target", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {colaboradores.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.matricula}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{c.nome}</p>
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-700">{c.cargo}</p>
                    {c.grade && <p className="text-xs text-gray-400">{c.grade}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{c.area?.nivel1 ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {c.salarioBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.target}x</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModalColab(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Pencil size={14} /></button>
                      <button onClick={() => excluir(c.id)} disabled={excluindo === c.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalColab !== null && (
        <ModalColaborador
          colab={modalColab === "new" ? null : modalColab}
          cicloId={cicloId}
          areas={areas}
          onSave={carregar}
          onClose={() => setModalColab(null)}
        />
      )}
      {modalImport && (
        <ModalImport tipo="colaboradores" cicloId={cicloId} onDone={carregar} onClose={() => setModalImport(false)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function ColaboradoresPage() {
  const { cicloAtivo } = useCiclo();
  const [aba, setAba] = useState<"colaboradores" | "areas">("colaboradores");

  if (!cicloAtivo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["colaboradores", "areas"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              aba === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "colaboradores" ? (
              <span className="flex items-center gap-1.5"><Users size={14} /> Colaboradores</span>
            ) : (
              <span className="flex items-center gap-1.5"><Building2 size={14} /> Áreas</span>
            )}
          </button>
        ))}
      </div>

      {aba === "colaboradores" ? (
        <AbaColaboradores cicloId={cicloAtivo.id} />
      ) : (
        <AbaAreas cicloId={cicloAtivo.id} />
      )}
    </div>
  );
}

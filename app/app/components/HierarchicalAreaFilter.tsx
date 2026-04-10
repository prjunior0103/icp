"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";

// ─── Types ───────────────────────────────────────────────
export interface AreaFilters {
  nivel1: string;
  nivel2: string;
  nivel3: string;
  nivel4: string;
  nivel5: string;
  cc: string;
}

export const EMPTY_FILTERS: AreaFilters = {
  nivel1: "", nivel2: "", nivel3: "", nivel4: "", nivel5: "", cc: "",
};

interface AreaLike {
  nivel1: string;
  nivel2?: string | null;
  nivel3?: string | null;
  nivel4?: string | null;
  nivel5?: string | null;
  centroCusto: string;
}

interface ColabLike {
  area?: { nivel1: string; nivel2?: string | null; nivel3?: string | null; nivel4?: string | null; nivel5?: string | null } | null;
  centroCusto?: string | null;
}

/** Todas as áreas candidatas de um colaborador: área vinculada + todas com o mesmo CC */
export function resolveAreas(c: ColabLike, areas?: AreaLike[]): AreaLike[] {
  const candidates: AreaLike[] = [];
  if (c.area) candidates.push(c.area as AreaLike);
  if (areas && c.centroCusto) {
    for (const a of areas) {
      if (a.centroCusto === c.centroCusto) candidates.push(a);
    }
  }
  return candidates;
}

/** Retorna o nível 1 resolvido (para exibição em colunas de área) */
export function resolveNivel1(c: ColabLike, areas?: AreaLike[]): string | null {
  return resolveAreas(c, areas).find(a => a.nivel1)?.nivel1 ?? null;
}

export function matchesAreaFilter(c: ColabLike, f: AreaFilters, areas?: AreaLike[]): boolean {
  const hasAny = f.nivel1 || f.nivel2 || f.nivel3 || f.nivel4 || f.nivel5 || f.cc;
  if (!hasAny) return true;

  // Usa TODAS as áreas candidatas — cobre areaId vinculado E lookup por CC
  const candidates = resolveAreas(c, areas);

  if (f.cc  && (c.centroCusto === f.cc  || candidates.some(a => a.centroCusto === f.cc))) return true;
  if (f.nivel1 && candidates.some(a => a.nivel1 === f.nivel1)) return true;
  if (f.nivel2 && candidates.some(a => a.nivel2 === f.nivel2)) return true;
  if (f.nivel3 && candidates.some(a => a.nivel3 === f.nivel3)) return true;
  if (f.nivel4 && candidates.some(a => a.nivel4 === f.nivel4)) return true;
  if (f.nivel5 && candidates.some(a => a.nivel5 === f.nivel5)) return true;
  return false;
}

// ─── Mini combobox (interno) ─────────────────────────────
function MiniCombo({
  label, value, options, onChange, disabled,
}: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = busca
    ? options.filter(o => o.toLowerCase().includes(busca.toLowerCase()))
    : options;

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setBusca("");
      }
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function openIt() {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function select(v: string) { onChange(v); setOpen(false); setBusca(""); }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openIt}
        disabled={disabled}
        className={`flex items-center gap-1 w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none transition-colors
          ${disabled ? "opacity-40 cursor-not-allowed border-gray-200" : "cursor-pointer"}
          ${open ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300 hover:border-gray-400"}`}
      >
        <span className="text-[10px] text-gray-400 shrink-0 mr-0.5">{label}</span>
        {value ? (
          <>
            <span className="flex-1 text-left truncate text-gray-800 font-medium">{value}</span>
            <span
              onClick={e => { e.stopPropagation(); onChange(""); setBusca(""); }}
              className="text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X size={10} />
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-gray-400">Todos</span>
            <ChevronDown size={10} className="text-gray-400 shrink-0" />
          </>
        )}
      </button>

      {open && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-gray-100">
            <div className="relative">
              <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {!busca && (
              <button type="button" className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
                onClick={() => select("")}>Todos</button>
            )}
            {filtered.sort().map(o => (
              <button key={o} type="button"
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                  ${value === o ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-blue-50"}`}
                onClick={() => select(o)}
              >{o}</button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">Sem resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────
interface Props {
  areas: AreaLike[];
  value: AreaFilters;
  onChange: (f: AreaFilters) => void;
  className?: string;
}

export function HierarchicalAreaFilter({ areas, value, onChange, className = "" }: Props) {
  function opts(field: keyof AreaLike, cascadeFilters: Partial<AreaFilters>) {
    let filtered = areas;
    if (cascadeFilters.nivel1) filtered = filtered.filter(a => a.nivel1 === cascadeFilters.nivel1);
    if (cascadeFilters.nivel2) filtered = filtered.filter(a => a.nivel2 === cascadeFilters.nivel2);
    if (cascadeFilters.nivel3) filtered = filtered.filter(a => a.nivel3 === cascadeFilters.nivel3);
    if (cascadeFilters.nivel4) filtered = filtered.filter(a => a.nivel4 === cascadeFilters.nivel4);
    return [...new Set(filtered.map(a => a[field] as string).filter(Boolean))];
  }

  function change(field: keyof AreaFilters, v: string) {
    const next = { ...value, [field]: v };
    // cascade reset: downstream levels when an upstream changes
    if (field === "nivel1") { next.nivel2 = ""; next.nivel3 = ""; next.nivel4 = ""; next.nivel5 = ""; }
    if (field === "nivel2") { next.nivel3 = ""; next.nivel4 = ""; next.nivel5 = ""; }
    if (field === "nivel3") { next.nivel4 = ""; next.nivel5 = ""; }
    if (field === "nivel4") { next.nivel5 = ""; }
    onChange(next);
  }

  const n1opts = opts("nivel1", {});
  const n2opts = opts("nivel2", { nivel1: value.nivel1 });
  const n3opts = opts("nivel3", { nivel1: value.nivel1, nivel2: value.nivel2 });
  const n4opts = opts("nivel4", { nivel1: value.nivel1, nivel2: value.nivel2, nivel3: value.nivel3 });
  const n5opts = opts("nivel5", { nivel1: value.nivel1, nivel2: value.nivel2, nivel3: value.nivel3, nivel4: value.nivel4 });
  const ccOpts = [...new Set(areas.map(a => a.centroCusto).filter(Boolean))];

  const hasFilter = Object.values(value).some(Boolean);

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {n1opts.length > 0 && (
        <MiniCombo label="N1" value={value.nivel1} options={n1opts} onChange={v => change("nivel1", v)} />
      )}
      {n2opts.length > 0 && (
        <MiniCombo label="N2" value={value.nivel2} options={n2opts} onChange={v => change("nivel2", v)} />
      )}
      {n3opts.length > 0 && (
        <MiniCombo label="N3" value={value.nivel3} options={n3opts} onChange={v => change("nivel3", v)} />
      )}
      {n4opts.length > 0 && (
        <MiniCombo label="N4" value={value.nivel4} options={n4opts} onChange={v => change("nivel4", v)} />
      )}
      {n5opts.length > 0 && (
        <MiniCombo label="N5" value={value.nivel5} options={n5opts} onChange={v => change("nivel5", v)} />
      )}
      {ccOpts.length > 0 && (
        <MiniCombo label="CC" value={value.cc} options={ccOpts} onChange={v => change("cc", v)} />
      )}
      {hasFilter && (
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1">
          <X size={11} /> Limpar
        </button>
      )}
    </div>
  );
}

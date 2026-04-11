"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";

interface Area {
  nivel1: string;
  nivel2?: string | null;
  nivel3?: string | null;
  nivel4?: string | null;
  nivel5?: string | null;
  centroCusto: string;
}

interface Props {
  areas: Area[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export function AreaCCCombobox({ areas, value, onChange, className = "", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const py = size === "md" ? "py-2" : "py-1.5";
  const textSize = size === "md" ? "text-sm" : "text-xs";

  const grupos = [
    { label: "Nível 1", values: [...new Set(areas.map(a => a.nivel1).filter(Boolean))] },
    { label: "Nível 2", values: [...new Set(areas.map(a => a.nivel2 ?? "").filter(Boolean))] },
    { label: "Nível 3", values: [...new Set(areas.map(a => a.nivel3 ?? "").filter(Boolean))] },
    { label: "Nível 4", values: [...new Set(areas.map(a => a.nivel4 ?? "").filter(Boolean))] },
    { label: "Nível 5", values: [...new Set(areas.map(a => a.nivel5 ?? "").filter(Boolean))] },
    { label: "Centro de Custo", values: [...new Set(areas.map(a => a.centroCusto).filter(Boolean))] },
  ].filter(g => g.values.length > 0);

  const gruposFiltrados = busca.trim()
    ? grupos
        .map(g => ({ ...g, values: g.values.filter(v => v.toLowerCase().includes(busca.toLowerCase())) }))
        .filter(g => g.values.length > 0)
    : grupos;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openDropdown() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setBusca("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setBusca("");
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={openDropdown}
        className={`flex items-center gap-1.5 w-full border rounded-lg px-3 ${py} ${textSize} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${open ? "border-blue-500 ring-2 ring-blue-500" : "border-gray-300"}`}
      >
        {value ? (
          <>
            <span className="flex-1 text-left truncate text-gray-800">{value}</span>
            <span onClick={clear} className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5 rounded hover:bg-gray-100">
              <X size={11} />
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-gray-500">Todas as áreas / CC</span>
            <ChevronDown size={11} className="text-gray-400 shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {!busca && (
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-blue-50"
                onClick={() => select("")}
              >
                Todas as áreas / CC
              </button>
            )}
            {gruposFiltrados.map(g => (
              <div key={g.label}>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-50 select-none">
                  {g.label}
                </div>
                {[...g.values].sort().map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      value === v
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-blue-50"
                    }`}
                    onClick={() => select(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ))}
            {gruposFiltrados.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

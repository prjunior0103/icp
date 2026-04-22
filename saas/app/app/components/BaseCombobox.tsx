"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Search } from "lucide-react";

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Texto quando nenhum item selecionado (padrão: "Todos") */
  placeholder?: string;
  /** Label prefixo exibido antes do valor (ex: "N1") */
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  /** Texto da opção "limpar" (padrão igual a placeholder) */
  clearLabel?: string;
}

export function BaseCombobox({
  options,
  value,
  onChange,
  placeholder = "Todos",
  label,
  size = "sm",
  disabled = false,
  className = "",
  clearLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const py = size === "md" ? "py-2" : "py-1.5";
  const textSize = size === "md" ? "text-sm" : "text-xs";

  const filtered = busca.trim()
    ? options.filter(o => o.toLowerCase().includes(busca.toLowerCase()))
    : options;

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBusca("");
      }
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  function openDropdown() {
    if (disabled) return;
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
    <div ref={ref} className={`relative ${className}`} role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        aria-label={value || placeholder}
        className={`flex items-center gap-1.5 w-full border rounded-lg px-2.5 ${py} ${textSize} bg-white focus:outline-none transition-colors
          ${disabled ? "opacity-40 cursor-not-allowed border-gray-200" : "cursor-pointer"}
          ${open ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-300 hover:border-gray-400"}`}
      >
        {label && (
          <span className="text-[10px] text-gray-500 shrink-0 mr-0.5">{label}</span>
        )}
        {value ? (
          <>
            <span className="flex-1 text-left truncate text-gray-800 font-medium">{value}</span>
            <span onClick={clear} className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5 rounded hover:bg-gray-100">
              <X size={10} />
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-gray-500">{placeholder}</span>
            <ChevronDown size={10} className="text-gray-400 shrink-0" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {options.length > 5 && (
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
          )}
          <div className="max-h-52 overflow-y-auto">
            {!busca && (
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                onClick={() => select("")}
              >
                {clearLabel ?? placeholder}
              </button>
            )}
            {[...filtered].sort().map(o => (
              <button
                key={o}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                  ${value === o ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-blue-50"}`}
                onClick={() => select(o)}
              >
                {o}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">Sem resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

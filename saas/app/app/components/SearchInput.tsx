"use client";

import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** aria-label para acessibilidade (padrão: usa o placeholder) */
  label?: string;
}

export function SearchInput({ value, onChange, placeholder = "Buscar...", className = "", label }: Props) {
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

"use client";

export function NotaBadge({ nota }: { nota: number | null | undefined }) {
  if (nota == null) return <span className="text-gray-300 text-xs">—</span>;
  const cls =
    nota >= 100
      ? "bg-green-100 text-green-700"
      : nota > 0
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-600";
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {nota.toFixed(1)}%
    </span>
  );
}

"use client";

export interface Column<T> {
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
  /** Classe aplicada em cada <tr> */
  rowClassName?: string | ((row: T) => string);
  onRowClick?: (row: T) => void;
}

const TH_DEFAULT = "text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide";
const TD_DEFAULT = "px-4 py-2.5 text-sm";

export function DataTable<T>({
  columns,
  rows,
  keyFn,
  emptyMessage = "Nenhum item encontrado.",
  className = "",
  rowClassName,
  onRowClick,
}: Props<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                className={`${TH_DEFAULT} ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const trCls =
                typeof rowClassName === "function"
                  ? rowClassName(row)
                  : (rowClassName ?? "hover:bg-gray-50");
              return (
                <tr
                  key={keyFn(row, i)}
                  className={`${trCls} ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  {...(onRowClick ? {
                    role: "button",
                    tabIndex: 0,
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row); }
                    },
                  } : {})}
                >
                  {columns.map((col, j) => (
                    <td key={j} className={`${TD_DEFAULT} ${col.className ?? ""}`}>
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

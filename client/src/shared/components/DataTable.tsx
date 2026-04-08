import { useState, ReactNode } from "react";
import { cn } from "../lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  highlightFn?: (row: T) => string | undefined;
  pageSize?: number;
  className?: string;
  selectable?: boolean;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export function DataTable<T>({
  columns, data, onRowClick, rowKey, highlightFn, pageSize = 20, className,
  selectable = false, selectedRows, onSelectionChange,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const selected = selectedRows ?? new Set<string>();

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };

  const sorted = sortKey
    ? [...data].sort((a: any, b: any) => {
        const av = a[sortKey], bv = b[sortKey];
        const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const allPageKeys = paginated.map(rowKey);
  const allPageSelected = allPageKeys.length > 0 && allPageKeys.every(k => selected.has(k));
  const somePageSelected = allPageKeys.some(k => selected.has(k));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (allPageSelected) {
      allPageKeys.forEach(k => next.delete(k));
    } else {
      allPageKeys.forEach(k => next.add(k));
    }
    onSelectionChange(next);
  };

  const toggleRow = (key: string, e: React.MouseEvent) => {
    if (!onSelectionChange) return;
    e.stopPropagation();
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  return (
    <div className={cn("", className)}>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-[#293b83] focus:ring-[#293b83]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap", col.sortable && "cursor-pointer hover:text-slate-700 select-none")}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {sortDir === "asc"
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        }
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-50">
            {paginated.map((row) => {
              const key = rowKey(row);
              const highlight = highlightFn?.(row);
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-slate-50",
                    isSelected && "bg-blue-50/60",
                    !isSelected && highlight
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-3 w-10" onClick={(e) => toggleRow(key, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-[#293b83] focus:ring-[#293b83]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>
            Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de {sorted.length} itens
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              Anterior
            </button>
            <span className="px-3 py-1.5 text-slate-700 font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

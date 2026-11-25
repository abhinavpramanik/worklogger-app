import React, { useMemo, useState } from 'react';
import { Copy, Search, X } from 'lucide-react';
import { Category, TaskStatus, TASK_STATUSES, WorkLog } from '../types';
import { formatDateShort, formatDurationHrs } from '../lib/dateUtils';

interface CopyPreviousModalProps {
  isOpen: boolean;
  onClose: () => void;
  workLogs: WorkLog[];
  categories: Category[];
  onSelectCopy: (sourceLog: WorkLog) => void;
}

export const CopyPreviousModal: React.FC<CopyPreviousModalProps> = ({
  isOpen,
  onClose,
  workLogs,
  categories,
  onSelectCopy,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');

  const uniqueCategories = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => {
      if (c.name) names.add(c.name);
    });
    workLogs.forEach((l) => {
      if (l.categoryName) names.add(l.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, workLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workLogs.filter((log) => {
      if (categoryFilter !== 'ALL' && log.categoryName !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
      if (
        q &&
        !log.tasks.toLowerCase().includes(q) &&
        !log.categoryName.toLowerCase().includes(q) &&
        !log.outcome.toLowerCase().includes(q) &&
        !log.customOutcome.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [workLogs, search, categoryFilter, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Copy Previous Work Log</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a previous entry to duplicate into a fresh draft for today. Original records remain untouched.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task or outcome..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Categories</option>
            {uniqueCategories.map((catName) => (
              <option key={catName} value={catName}>
                {catName}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Task Statuses</option>
            {TASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No matching previous work logs found.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-mono font-medium text-slate-700">
                      {formatDateShort(log.date)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{log.categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{log.status}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Planned {formatDurationHrs(log.plannedMinutes)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 line-clamp-2">{log.tasks || 'Untitled task'}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    Outcome: {log.customOutcome || log.outcome || '-'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCopy(log);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy to New Log
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

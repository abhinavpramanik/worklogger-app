import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  History,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AuditLog, Holiday, TASK_STATUSES, TaskStatus, WorkLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort, formatDuration, formatTime12h } from '../lib/dateUtils';
import { deleteWorkLog, fetchAuditLogsForWorkLog } from '../lib/firestoreService';

interface WorkLogHistoryProps {
  workLogs: WorkLog[];
  holidays?: Holiday[];
  onEditLog: (log: WorkLog) => void;
  onDuplicateLog: (log: WorkLog) => void;
}

const PAGE_SIZE = 15;

export const WorkLogHistory: React.FC<WorkLogHistoryProps> = ({
  workLogs,
  onEditLog,
  onDuplicateLog,
}) => {
  const { userProfile } = useAuth();

  const [tab, setTab] = useState<'Submitted' | 'Draft'>('Submitted');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const [selectedDetail, setSelectedDetail] = useState<WorkLog | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const uniqueCategories = useMemo(() => {
    const names = new Set<string>();
    workLogs.forEach((l) => {
      if (l.categoryName) names.add(l.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [workLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workLogs.filter((log) => {
      if (log.entryStatus !== tab) return false;
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      if (categoryFilter !== 'ALL' && log.categoryName !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
      if (
        q &&
        !log.tasks.toLowerCase().includes(q) &&
        !log.outcome.toLowerCase().includes(q) &&
        !log.customOutcome.toLowerCase().includes(q) &&
        !log.categoryName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [workLogs, tab, startDate, endDate, categoryFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const submittedCount = workLogs.filter((l) => l.entryStatus === 'Submitted').length;
  const draftCount = workLogs.filter((l) => l.entryStatus === 'Draft').length;

  const openDetailModal = async (log: WorkLog) => {
    setSelectedDetail(log);
    setAuditLogs([]);
    setAuditLoading(true);
    try {
      const logs = await fetchAuditLogsForWorkLog(log.id, userProfile?.uid);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteWorkLog(confirmDeleteId);
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tabs & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setTab('Submitted');
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'Submitted'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Submitted Logs ({submittedCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('Draft');
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'Draft'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Drafts ({draftCount})
            </button>
          </div>

          <span className="text-xs text-slate-500 tabular-nums">
            Showing {filteredLogs.length} record{filteredLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search task or outcome..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            aria-label="Filter from date"
            className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            aria-label="Filter to date"
            className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as TaskStatus | 'ALL');
              setPage(1);
            }}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Standard In-App Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {pagedLogs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No {tab.toLowerCase()} work logs match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Tasks &amp; Outcome</th>
                  <th className="py-3 px-4">Task Status</th>
                  <th className="py-3 px-4 text-right">Planned</th>
                  <th className="py-3 px-4 text-right">Actual</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {formatDateShort(log.date)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {log.categoryName}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="text-slate-900 line-clamp-2">{log.tasks || 'Untitled draft'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Outcome: {log.customOutcome || log.outcome || '-'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {log.status}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDuration(log.plannedMinutes)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-xs font-medium text-slate-900 whitespace-nowrap">
                      {formatDuration(log.actualMinutes)}
                      {log.startTime && log.endTime && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          {formatTime12h(log.startTime)}–{formatTime12h(log.endTime)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void openDetailModal(log)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditLog(log)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateLog(log)}
                          title="Copy to New Entry"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(log.id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Detail Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Work Log Details</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedDetail.date} · {selectedDetail.categoryName} · {selectedDetail.entryStatus}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-medium text-slate-500">Tasks</span>
                  <p className="mt-1 text-slate-900 whitespace-pre-wrap">{selectedDetail.tasks || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">Outcome</span>
                  <p className="mt-1 text-slate-900 whitespace-pre-wrap">
                    {selectedDetail.customOutcome || selectedDetail.outcome || '-'}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <span className="text-xs text-slate-500">Task Status</span>
                    <p className="font-medium text-slate-900 mt-0.5">{selectedDetail.status}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Planned</span>
                    <p className="font-mono tabular-nums text-slate-900 mt-0.5">
                      {formatDuration(selectedDetail.plannedMinutes)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Time Range</span>
                    <p className="font-mono tabular-nums text-slate-900 mt-0.5">
                      {formatTime12h(selectedDetail.startTime) || '-'} to{' '}
                      {formatTime12h(selectedDetail.endTime) || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Actual</span>
                    <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                      {formatDuration(selectedDetail.actualMinutes)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Edit History
                </h4>
                {auditLoading ? (
                  <p className="text-xs text-slate-500">Loading edit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No edits recorded after initial save.</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-slate-600 mb-1">
                          <span className="font-semibold text-slate-900">
                            {a.changedByName} · edited
                          </span>
                          <span className="font-mono">
                            {a.timestamp ? a.timestamp.toDate().toLocaleString() : 'Pending'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 mt-2">
                          <div className="bg-slate-50 p-2 rounded">
                            <span className="font-medium text-slate-700">Previous:</span>{' '}
                            {String(a.previousData?.tasks || '-')}
                          </div>
                          <div className="bg-blue-50/50 p-2 rounded">
                            <span className="font-medium text-slate-700">Updated:</span>{' '}
                            {String(a.updatedData?.tasks || '-')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete Work Log?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This work log entry will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

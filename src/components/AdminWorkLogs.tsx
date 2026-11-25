import React, { useMemo, useState } from 'react';
import { Eye, History, X } from 'lucide-react';
import { AuditLog, TASK_STATUSES, TaskStatus, WorkLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort, formatDuration, formatTime12h } from '../lib/dateUtils';
import { fetchAuditLogsForWorkLog } from '../lib/firestoreService';

interface AdminWorkLogsProps {
  workLogs: WorkLog[];
}

export const AdminWorkLogs: React.FC<AdminWorkLogsProps> = ({ workLogs }) => {
  const { categories } = useAuth();

  const [empNameFilter, setEmpNameFilter] = useState('');
  const [empIdFilter, setEmpIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatus | 'ALL'>('ALL');

  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

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
    const nq = empNameFilter.trim().toLowerCase();
    const iq = empIdFilter.trim().toLowerCase();
    return workLogs.filter((log) => {
      if (log.entryStatus !== 'Submitted') return false;
      if (nq && !log.employeeName.toLowerCase().includes(nq)) return false;
      if (iq && !log.employeeId.toLowerCase().includes(iq)) return false;
      if (startDate && log.date < startDate) return false;
      if (endDate && log.date > endDate) return false;
      if (categoryFilter !== 'ALL' && log.categoryName !== categoryFilter) return false;
      if (taskStatusFilter !== 'ALL' && log.status !== taskStatusFilter) return false;
      return true;
    });
  }, [
    workLogs,
    empNameFilter,
    empIdFilter,
    startDate,
    endDate,
    categoryFilter,
    taskStatusFilter,
  ]);

  const openDetailModal = async (log: WorkLog) => {
    setSelectedLog(log);
    setAuditLoading(true);
    try {
      const logs = await fetchAuditLogsForWorkLog(log.id);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">All Organization Work Logs</h2>
            <p className="text-xs text-slate-500">
              Filter submissions and inspect edit audit trails. Employees can freely edit their own work logs without admin review.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {filteredLogs.length} submission{filteredLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input
            type="text"
            value={empNameFilter}
            onChange={(e) => setEmpNameFilter(e.target.value)}
            placeholder="Employee Name..."
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            value={empIdFilter}
            onChange={(e) => setEmpIdFilter(e.target.value)}
            placeholder="Employee ID..."
            className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">All Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={taskStatusFilter}
            onChange={(e) => setTaskStatusFilter(e.target.value as TaskStatus | 'ALL')}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">All Task Status</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No submitted work logs match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Tasks &amp; Outcome</th>
                  <th className="py-3 px-4">Task Status</th>
                  <th className="py-3 px-4 text-right">Planned / Actual</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {formatDateShort(log.date)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{log.employeeName}</p>
                      <p className="text-xs font-mono text-slate-500">{log.employeeId}</p>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {log.categoryName}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-slate-900 line-clamp-2">{log.tasks}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Outcome: {log.customOutcome || log.outcome || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {log.status}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      {formatDuration(log.plannedMinutes)} /{' '}
                      <span className="font-semibold text-slate-900">
                        {formatDuration(log.actualMinutes)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void openDetailModal(log)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Read-Only Detail & Audit History Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Work Log Details · {selectedLog.employeeName}
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  {selectedLog.employeeId} · {selectedLog.date} · {selectedLog.categoryName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
                <p className="font-medium text-slate-900 whitespace-pre-wrap">{selectedLog.tasks}</p>
                <p className="text-xs text-slate-600">
                  Outcome: {selectedLog.customOutcome || selectedLog.outcome || '-'}
                </p>
                <p className="text-xs font-mono text-slate-600 tabular-nums">
                  Task Status: {selectedLog.status} · Planned {formatDuration(selectedLog.plannedMinutes)} · Actual {formatDuration(selectedLog.actualMinutes)} ({formatTime12h(selectedLog.startTime) || '-'} to {formatTime12h(selectedLog.endTime) || '-'})
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Edit Audit History
                </h4>
                {auditLoading ? (
                  <p className="text-xs text-slate-500">Loading audit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No edits recorded after submission.</p>
                ) : (
                  <div className="space-y-2.5">
                    {auditLogs.map((a) => (
                      <div key={a.id} className="p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-slate-600 mb-1">
                          <span className="font-semibold text-slate-900">
                            {a.changedByName} · {a.action.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono">
                            {a.timestamp ? a.timestamp.toDate().toLocaleString() : 'Pending'}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          Previous: {String(a.previousData?.tasks || '-')}
                        </p>
                        <p className="text-slate-800 mt-0.5">
                          Updated: {String(a.updatedData?.tasks || '-')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

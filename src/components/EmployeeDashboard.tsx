import React, { useMemo } from 'react';
import {
  BookmarkPlus,
  CalendarDays,
  Copy,
  FileSpreadsheet,
  History,
  PlusCircle,
} from 'lucide-react';
import { AppView, Holiday, WorkLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  enumerateDateRange,
  formatDateShort,
  formatDuration,
  getNowFormattedInTimezone,
  getTodayInTimezone,
  isSundayDate,
} from '../lib/dateUtils';
import { addDays, format, parseISO } from 'date-fns';

interface EmployeeDashboardProps {
  workLogs: WorkLog[];
  holidays: Holiday[];
  loading: boolean;
  onNavigate: (view: AppView) => void;
  onNewWorkLog: () => void;
  onEditLog: (log: WorkLog) => void;
  onOpenCopyModal: () => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  workLogs,
  holidays,
  loading,
  onNavigate,
  onNewWorkLog,
  onEditLog,
  onOpenCopyModal,
}) => {
  const { userProfile, settings } = useAuth();
  const today = getTodayInTimezone(settings.timezone);
  const formattedToday = getNowFormattedInTimezone(settings.timezone);

  const metrics = useMemo(() => {
    const submittedToday = workLogs.filter(
      (l) => l.date === today && l.entryStatus === 'Submitted'
    );
    const completedToday = submittedToday.filter((l) => l.status === 'Completed').length;
    const pendingToday = submittedToday.filter((l) => l.status !== 'Completed').length;
    const plannedMinsToday = submittedToday.reduce((s, l) => s + (l.plannedMinutes || 0), 0);
    const actualMinsToday = submittedToday.reduce((s, l) => s + (l.actualMinutes || 0), 0);
    const draftsCount = workLogs.filter((l) => l.entryStatus === 'Draft').length;

    return {
      totalTasksToday: submittedToday.length,
      completedToday,
      pendingToday,
      plannedMinsToday,
      actualMinsToday,
      draftsCount,
      submittedToday,
    };
  }, [workLogs, today]);

  const recentEntries = useMemo(
    () => workLogs.filter((l) => l.entryStatus === 'Submitted').slice(0, 6),
    [workLogs]
  );

  const upcomingItems = useMemo(() => {
    const horizon = format(addDays(parseISO(today), 30), 'yyyy-MM-dd');
    const nextDates = enumerateDateRange(today, horizon);
    const items: Array<{ date: string; title: string; subtitle: string; kind: 'sunday' | 'holiday' }> = [];

    for (const d of nextDates) {
      if (isSundayDate(d)) {
        items.push({ date: d, title: 'Weekly Sunday Holiday', subtitle: 'Weekly Holiday', kind: 'sunday' });
      }
      const dayHolidays = holidays.filter((h) => h.active && h.date === d);
      for (const h of dayHolidays) {
        items.push({ date: d, title: h.name, subtitle: h.type, kind: 'holiday' });
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  }, [today, holidays]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Tasks Today', value: String(metrics.totalTasksToday), sub: 'Submitted entries' },
    { label: 'Completed Tasks', value: String(metrics.completedToday), sub: 'Today' },
    { label: 'Pending Tasks', value: String(metrics.pendingToday), sub: 'In progress / open' },
    { label: 'Planned Hours', value: formatDuration(metrics.plannedMinsToday), sub: 'Today planned' },
    { label: 'Actual Hours', value: formatDuration(metrics.actualMinsToday), sub: 'Today logged' },
    { label: 'Draft Work Logs', value: String(metrics.draftsCount), sub: 'Unfinished drafts' },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {formattedToday} · {settings.timezone}
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Welcome back, {userProfile?.fullName}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Employee ID <span className="font-mono font-medium text-slate-800">{userProfile?.employeeId}</span>
            {userProfile?.department ? ` · ${userProfile.department}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onNewWorkLog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Add New Work Log
          </button>
          <button
            type="button"
            onClick={() => onNavigate('my-presets')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <BookmarkPlus className="w-4 h-4" />
            My Presets
          </button>
          <button
            type="button"
            onClick={onOpenCopyModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Copy className="w-4 h-4" />
            Copy Previous
          </button>
          <button
            type="button"
            onClick={() => onNavigate('work-log-history')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            View History
          </button>
          <button
            type="button"
            onClick={() => onNavigate('export-reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Logs
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 truncate">{card.label}</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
              {card.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Work Log Summary */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Today&apos;s Work Log Summary</h3>
              <span className="text-xs font-mono text-slate-500">{today}</span>
            </div>
            {metrics.submittedToday.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-600 mb-3">
                  No work logs submitted for today yet.
                </p>
                <button
                  type="button"
                  onClick={onNewWorkLog}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  <PlusCircle className="w-4 h-4" />
                  Log First Entry Today
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Task</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Planned</th>
                      <th className="py-2.5 px-4 text-right">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {metrics.submittedToday.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => onEditLog(log)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {log.categoryName}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                          {log.tasks}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {log.status}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatDuration(log.plannedMinutes)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          {formatDuration(log.actualMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Work Log Entries */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Recent Work Log Entries</h3>
              <button
                type="button"
                onClick={() => onNavigate('work-log-history')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                View all
              </button>
            </div>
            {recentEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Your recent work logs will appear here.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentEntries.map((log) => (
                  <div
                    key={log.id}
                    className="px-6 py-3.5 hover:bg-slate-50 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-medium text-slate-700">
                          {formatDateShort(log.date)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700">{log.categoryName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{log.status}</span>
                      </div>
                      <p className="text-sm text-slate-900 mt-1 line-clamp-1">{log.tasks}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-mono tabular-nums font-medium text-slate-900">
                        {formatDuration(log.actualMinutes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditLog(log)}
                        className="block text-xs text-blue-700 hover:underline mt-0.5 ml-auto"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="bg-white border border-slate-200 rounded-xl overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Upcoming Holidays</h3>
            <CalendarDays className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-200">
            {upcomingItems.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No upcoming holidays in the next 30 days.
              </div>
            ) : (
              upcomingItems.map((item, idx) => (
                <div key={`${item.date}-${idx}`} className="px-6 py-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{formatDateShort(item.date)}</span>
                    <span
                      className={
                        item.kind === 'holiday'
                          ? 'text-teal-700 font-medium'
                          : 'text-slate-500'
                      }
                    >
                      {item.subtitle}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-1">{item.title}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

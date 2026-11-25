import React, { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import {
  TASK_STATUSES,
  TaskStatus,
  UserProfile,
  WorkLog,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  formatDuration,
  formatDurationHrs,
  formatTime12h,
  getTodayInTimezone,
  timestampToDateInTimezone,
} from '../lib/dateUtils';
import {
  buildDateWiseReportDataset,
  exportDateWiseCsv,
  exportDateWiseExcel,
  getEffectiveOutcome,
} from '../lib/exportUtils';

interface ExportReportsProps {
  isAdminMode: boolean;
  workLogs: WorkLog[];
  employees: UserProfile[];
}

export const ExportReports: React.FC<ExportReportsProps> = ({
  isAdminMode,
  workLogs,
  employees,
}) => {
  const { userProfile, settings, categories, holidays } = useAuth();
  const today = getTodayInTimezone(settings.timezone);
  const thirteenDaysAgo = format(subDays(new Date(`${today}T00:00:00`), 13), 'yyyy-MM-dd');

  const [selectedEmpUid, setSelectedEmpUid] = useState<string>(
    isAdminMode ? 'ALL' : userProfile?.uid || ''
  );

  const effectiveEmployees = useMemo(() => {
    if (isAdminMode) return employees;
    return userProfile ? [userProfile] : [];
  }, [isAdminMode, employees, userProfile]);

  const effectiveEmpUid = isAdminMode ? selectedEmpUid : userProfile?.uid || '';

  // Earliest account creation date among the selected employee(s)
  const accountCreatedDate = useMemo(() => {
    const scope =
      effectiveEmpUid === 'ALL'
        ? effectiveEmployees
        : effectiveEmployees.filter((e) => e.uid === effectiveEmpUid);
    const dates = scope
      .map((e) => timestampToDateInTimezone(e.createdAt, settings.timezone))
      .filter((d): d is string => Boolean(d));
    if (dates.length === 0) return today;
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  }, [effectiveEmployees, effectiveEmpUid, settings.timezone, today]);

  const defaultStart =
    accountCreatedDate > thirteenDaysAgo ? accountCreatedDate : thirteenDaysAgo;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [categoryId, setCategoryId] = useState('ALL');
  const [taskStatus, setTaskStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [includeDrafts, setIncludeDrafts] = useState(false);

  // Keep startDate clamped so it never precedes account creation date
  useEffect(() => {
    if (startDate < accountCreatedDate) {
      setStartDate(accountCreatedDate <= endDate ? accountCreatedDate : endDate);
    }
  }, [accountCreatedDate, startDate, endDate]);

  const categoryFilterOptions = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => {
      if (c.name) names.add(c.name);
    });
    workLogs.forEach((l) => {
      if (l.categoryName) names.add(l.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, workLogs]);

  const dataset = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return null;
    return buildDateWiseReportDataset({
      filters: {
        startDate,
        endDate,
        employeeUid: effectiveEmpUid,
        categoryId,
        taskStatus,
        includeDrafts,
        timezone: settings.timezone,
      },
      allLogs: workLogs,
      allHolidays: holidays,
      allLeaves: [],
      employees: effectiveEmployees,
    });
  }, [
    startDate,
    endDate,
    effectiveEmpUid,
    categoryId,
    taskStatus,
    includeDrafts,
    settings.timezone,
    workLogs,
    holidays,
    effectiveEmployees,
  ]);

  const isMultiEmployee = dataset ? dataset.targetEmployees.length !== 1 : false;

  const filenamePrefix = useMemo(() => {
    if (!isAdminMode && userProfile) {
      return `WorkLog_${userProfile.employeeId}`;
    }
    if (effectiveEmpUid !== 'ALL') {
      const emp = employees.find((e) => e.uid === effectiveEmpUid);
      if (emp) return `WorkLog_${emp.employeeId}`;
    }
    return 'WorkLog_Organization_Report';
  }, [isAdminMode, userProfile, effectiveEmpUid, employees]);

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isAdminMode ? 'Organization Work Log Export' : 'Personal Work Log Export'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exported latest-to-earliest from account creation ({accountCreatedDate}) with no pre-account default rows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={!dataset || dataset.dates.length === 0}
              onClick={() => dataset && exportDateWiseCsv(dataset, filenamePrefix)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              Export CSV (.csv)
            </button>
            <button
              type="button"
              disabled={!dataset || dataset.dates.length === 0}
              onClick={() => dataset && exportDateWiseExcel(dataset, filenamePrefix)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
            <input
              type="date"
              min={accountCreatedDate}
              max={endDate}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
            <input
              type="date"
              min={accountCreatedDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          {isAdminMode && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
              <select
                value={selectedEmpUid}
                onChange={(e) => setSelectedEmpUid(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Employees ({employees.length})</option>
                {employees.map((e) => (
                  <option key={e.uid} value={e.uid}>
                    {e.fullName} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Categories</option>
              {categoryFilterOptions.map((catName) => (
                <option key={catName} value={catName}>
                  {catName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Task Status</label>
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as TaskStatus | 'ALL')}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
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

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={(e) => setIncludeDrafts(e.target.checked)}
            className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
          />
          Include unfinished Draft entries (off by default)
        </label>
      </div>

      {/* Worksheet 2 Preview: Summary */}
      {dataset && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Report Summary (Worksheet 2 Preview)
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {dataset.dates.length} calendar day{dataset.dates.length === 1 ? '' : 's'} covered
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4 text-right">Working Days</th>
                  <th className="py-2.5 px-4 text-right">Sundays</th>
                  <th className="py-2.5 px-4 text-right">Holidays</th>
                  <th className="py-2.5 px-4 text-right">Work Logs</th>
                  <th className="py-2.5 px-4 text-right">Completed</th>
                  <th className="py-2.5 px-4 text-right">Planned</th>
                  <th className="py-2.5 px-4 text-right">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {dataset.summaries.map((s) => (
                  <tr key={s.employeeUid} className="hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{s.employeeName}</span>
                      <span className="text-xs font-mono text-slate-500 ml-2">{s.employeeId}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.totalWorkingDays}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.totalSundays}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.totalCompanyHolidays}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.totalWorkLogs}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{s.completedTasks}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatDuration(s.totalPlannedMinutes)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatDuration(s.totalActualMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Worksheet 1 Preview: Exact Export File Format (Latest Date First) */}
      {dataset && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Export Sheet Preview (Latest Date at Top)
            </h3>
            <span className="text-xs text-slate-500">
              Exact layout used in downloaded .xlsx &amp; .csv files
            </span>
          </div>

          {dataset.sections.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No days in range starting from account creation date ({accountCreatedDate}).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                <thead>
                  <tr className="bg-[#C9DAF8] border-b border-slate-300 font-semibold text-slate-900">
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Date
                    </th>
                    {isMultiEmployee && (
                      <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                        Employee
                      </th>
                    )}
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Category
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Tasks
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center">
                      Outcome
                      <div className="text-[11px] font-medium">(As specific as Possible)</div>
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Status
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Total Planned Time
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      Start Time
                    </th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center whitespace-nowrap">
                      End Time
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Total Actual Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.sections.map((section, sectionIdx) => {
                    const specialLabels: string[] = [];
                    if (section.isSunday) specialLabels.push('Sunday');
                    for (const h of section.holidays) {
                      specialLabels.push(`Holiday: ${h.name} (${h.type})`);
                    }
                    for (const l of section.leavesOnDate) {
                      const who = isMultiEmployee ? `${l.employeeName} (${l.employeeId}) - ` : '';
                      if (l.status === 'Approved') {
                        specialLabels.push(`${who}Leave: ${l.leaveType} (Approved)`);
                      } else if (l.status === 'Pending') {
                        specialLabels.push(`${who}Pending Leave: ${l.leaveType}`);
                      } else if (l.status === 'Rejected') {
                        specialLabels.push(`${who}Leave Rejected: ${l.leaveType}`);
                      }
                    }

                    const colSpanAll = isMultiEmployee ? 10 : 9;

                    let lastCategory = '';
                    let lastEmpUid = '';

                    return (
                      <React.Fragment key={section.date}>
                        {section.logs.length > 0 ? (
                          section.logs.map((log, rowIdx) => {
                            const showDate = rowIdx === 0;
                            const showCategory =
                              rowIdx === 0 ||
                              log.categoryName !== lastCategory ||
                              (isMultiEmployee && log.employeeUid !== lastEmpUid);
                            lastCategory = log.categoryName;
                            lastEmpUid = log.employeeUid;

                            const categoryDisplay =
                              rowIdx === 0 && specialLabels.length > 0
                                ? `${specialLabels.join(' · ')} — ${log.categoryName}`
                                : showCategory
                                  ? log.categoryName
                                  : '';

                            return (
                              <tr
                                key={log.id}
                                className="border-b border-slate-200 hover:bg-blue-50/30"
                              >
                                <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                  {showDate ? section.shortDate : ''}
                                </td>
                                {isMultiEmployee && (
                                  <td className="py-2 px-3 border-r border-slate-200 text-slate-800 whitespace-nowrap">
                                    {log.employeeName} ({log.employeeId})
                                  </td>
                                )}
                                <td className="py-2 px-3 border-r border-slate-200 text-slate-800 whitespace-nowrap">
                                  {categoryDisplay}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-slate-900 min-w-[200px]">
                                  {log.tasks || 'Untitled draft'}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-slate-800 min-w-[240px]">
                                  {getEffectiveOutcome(log)}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                                  {log.status}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                  {formatDurationHrs(log.plannedMinutes)}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                  {formatTime12h(log.startTime) || '-'}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                  {formatTime12h(log.endTime) || '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                                  {formatDurationHrs(log.actualMinutes)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr
                            className={`border-b border-slate-200 ${
                              section.holidays.length > 0
                                ? 'bg-teal-50/60 text-teal-900'
                                : section.isSunday
                                  ? 'bg-slate-100/80 text-slate-700'
                                  : section.approvedLeaves.length > 0
                                    ? 'bg-emerald-50/70 text-emerald-900'
                                    : section.pendingLeaves.length > 0
                                      ? 'bg-amber-50/70 text-amber-900'
                                      : 'bg-slate-50/60 text-slate-500'
                            }`}
                          >
                            <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums whitespace-nowrap">
                              {section.shortDate}
                            </td>
                            {isMultiEmployee && (
                              <td className="py-2 px-3 border-r border-slate-200" />
                            )}
                            <td className="py-2 px-3 border-r border-slate-200 font-medium whitespace-nowrap">
                              {specialLabels.length > 0
                                ? specialLabels.join(' | ')
                                : 'No Work Log Submitted'}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3 border-r border-slate-200" />
                            <td className="py-2 px-3" />
                          </tr>
                        )}
                        {sectionIdx < dataset.sections.length - 1 && (
                          <tr className="h-4 bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={colSpanAll} />
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

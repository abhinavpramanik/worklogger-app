import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eachDayOfInterval, format, startOfWeek, subDays } from 'date-fns';
import { UserCheck, UserX, X } from 'lucide-react';
import { TASK_STATUSES, UserProfile, WorkLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  formatDateShort,
  formatDuration,
  formatDurationHrs,
  getTodayInTimezone,
} from '../lib/dateUtils';
import { adminUpdateEmployeeStatus } from '../lib/firestoreService';

interface AdminDashboardProps {
  employees: UserProfile[];
  workLogs: WorkLog[];
  showEmployeesTableOnly?: boolean;
}

const CHART_COLORS = ['#1D4ED8', '#0F766E', '#D97706', '#DC2626', '#64748B'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  employees,
  workLogs,
  showEmployeesTableOnly = false,
}) => {
  const { settings } = useAuth();
  const today = getTodayInTimezone(settings.timezone);

  const [activityGranularity, setActivityGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);
  const [statusUpdatingUid, setStatusUpdatingUid] = useState<string | null>(null);

  const submittedLogs = useMemo(
    () => workLogs.filter((l) => l.entryStatus === 'Submitted'),
    [workLogs]
  );

  const overview = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.accountStatus === 'active').length;
    const todayLogs = submittedLogs.filter((l) => l.date === today).length;
    const completedTasks = submittedLogs.filter((l) => l.status === 'Completed').length;
    const inProgressTasks = submittedLogs.filter((l) => l.status === 'In Progress').length;
    const totalPlannedMins = submittedLogs.reduce((s, l) => s + (l.plannedMinutes || 0), 0);
    const totalActualMins = submittedLogs.reduce((s, l) => s + (l.actualMinutes || 0), 0);

    return {
      totalEmployees: employees.length,
      activeEmployees,
      todayLogs,
      completedTasks,
      inProgressTasks,
      totalPlannedMins,
      totalActualMins,
    };
  }, [employees, submittedLogs, today]);

  const activityChartData = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    if (activityGranularity === 'daily') {
      const days = eachDayOfInterval({ start: subDays(todayDate, 13), end: todayDate });
      return days.map((d) => {
        const iso = format(d, 'yyyy-MM-dd');
        const logsOnDay = submittedLogs.filter((l) => l.date === iso);
        return {
          label: format(d, 'dd MMM'),
          submissions: logsOnDay.length,
          plannedHours: Number((logsOnDay.reduce((s, l) => s + l.plannedMinutes, 0) / 60).toFixed(1)),
          actualHours: Number((logsOnDay.reduce((s, l) => s + l.actualMinutes, 0) / 60).toFixed(1)),
        };
      });
    }

    if (activityGranularity === 'weekly') {
      const buckets = new Map<string, { label: string; submissions: number; plannedHours: number; actualHours: number }>();
      for (let i = 7; i >= 0; i--) {
        const weekStart = startOfWeek(subDays(todayDate, i * 7), { weekStartsOn: 1 });
        const key = format(weekStart, 'yyyy-MM-dd');
        buckets.set(key, {
          label: format(weekStart, 'dd MMM'),
          submissions: 0,
          plannedHours: 0,
          actualHours: 0,
        });
      }
      submittedLogs.forEach((l) => {
        const wk = format(startOfWeek(new Date(`${l.date}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const bucket = buckets.get(wk);
        if (bucket) {
          bucket.submissions += 1;
          bucket.plannedHours = Number((bucket.plannedHours + l.plannedMinutes / 60).toFixed(1));
          bucket.actualHours = Number((bucket.actualHours + l.actualMinutes / 60).toFixed(1));
        }
      });
      return Array.from(buckets.values());
    }

    const monthBuckets = new Map<string, { label: string; submissions: number; plannedHours: number; actualHours: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      const key = format(d, 'yyyy-MM');
      monthBuckets.set(key, {
        label: format(d, 'MMM yyyy'),
        submissions: 0,
        plannedHours: 0,
        actualHours: 0,
      });
    }
    submittedLogs.forEach((l) => {
      const key = l.date.slice(0, 7);
      const bucket = monthBuckets.get(key);
      if (bucket) {
        bucket.submissions += 1;
        bucket.plannedHours = Number((bucket.plannedHours + l.plannedMinutes / 60).toFixed(1));
        bucket.actualHours = Number((bucket.actualHours + l.actualMinutes / 60).toFixed(1));
      }
    });
    return Array.from(monthBuckets.values());
  }, [activityGranularity, submittedLogs, today]);

  const statusDistributionData = useMemo(() => {
    return TASK_STATUSES.map((st) => ({
      name: st,
      count: submittedLogs.filter((l) => l.status === st).length,
    }));
  }, [submittedLogs]);

  const employeeStats = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees
      .map((emp) => {
        const logs = submittedLogs.filter((l) => l.employeeUid === emp.uid);
        const completed = logs.filter((l) => l.status === 'Completed').length;
        const plannedMins = logs.reduce((s, l) => s + (l.plannedMinutes || 0), 0);
        const actualMins = logs.reduce((s, l) => s + (l.actualMinutes || 0), 0);
        const latestDate = logs.length > 0 ? logs[0].date : '';
        return {
          emp,
          totalTasks: logs.length,
          completedTasks: completed,
          plannedMins,
          actualMins,
          latestDate,
        };
      })
      .filter((row) => {
        if (!q) return true;
        return (
          row.emp.fullName.toLowerCase().includes(q) ||
          row.emp.employeeId.toLowerCase().includes(q) ||
          row.emp.email.toLowerCase().includes(q)
        );
      });
  }, [employees, submittedLogs, empSearch]);

  const employeeChartDistribution = useMemo(
    () =>
      employeeStats.slice(0, 10).map((row) => ({
        name: row.emp.fullName.split(' ')[0] || row.emp.employeeId,
        tasks: row.totalTasks,
        completed: row.completedTasks,
        plannedHours: Number((row.plannedMins / 60).toFixed(1)),
        actualHours: Number((row.actualMins / 60).toFixed(1)),
      })),
    [employeeStats]
  );

  const selectedEmployeeDetails = useMemo(() => {
    if (!selectedEmployee) return null;
    const logs = submittedLogs.filter((l) => l.employeeUid === selectedEmployee.uid);
    const todayCount = logs.filter((l) => l.date === today).length;
    const weekStart = format(startOfWeek(new Date(`${today}T00:00:00`), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weeklyMins = logs.filter((l) => l.date >= weekStart).reduce((s, l) => s + l.actualMinutes, 0);
    const monthPrefix = today.slice(0, 7);
    const monthlyMins = logs
      .filter((l) => l.date.startsWith(monthPrefix))
      .reduce((s, l) => s + l.actualMinutes, 0);

    return {
      logs,
      todayCount,
      weeklyMins,
      monthlyMins,
    };
  }, [selectedEmployee, submittedLogs, today]);

  const handleToggleEmployeeStatus = async (emp: UserProfile) => {
    if (emp.role !== 'employee') return;
    setStatusUpdatingUid(emp.uid);
    try {
      const next = emp.accountStatus === 'active' ? 'inactive' : 'active';
      await adminUpdateEmployeeStatus(emp.uid, next);
      if (selectedEmployee?.uid === emp.uid) {
        setSelectedEmployee({ ...emp, accountStatus: next });
      }
    } finally {
      setStatusUpdatingUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {!showEmployeesTableOnly && (
        <>
          {/* 7 Overview Metrics */}
          <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Total Employees', value: overview.totalEmployees },
              { label: 'Active Employees', value: overview.activeEmployees },
              { label: 'Logs Today', value: overview.todayLogs },
              { label: 'Completed Tasks', value: overview.completedTasks },
              { label: 'In Progress', value: overview.inProgressTasks },
              { label: 'Planned Hours', value: formatDuration(overview.totalPlannedMins) },
              { label: 'Actual Hours', value: formatDuration(overview.totalActualMins) },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-medium text-slate-500 truncate">{m.label}</p>
                <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                  {m.value}
                </p>
              </div>
            ))}
          </section>

          {/* Charts Row 1: Activity (Daily/Weekly/Monthly) + Planned vs Actual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Work Log Activity</h3>
                  <p className="text-xs text-slate-500">Work log entries across time</p>
                </div>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setActivityGranularity(g)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize ${
                        activityGranularity === g
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="submissions" name="Work Logs" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">Planned vs Actual Hours</h3>
                <p className="text-xs text-slate-500">Hours comparison for the selected period</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="plannedHours" name="Planned (h)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualHours" name="Actual (h)" fill="#0F766E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Charts Row 2: Employee Task Distribution + Task Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Employee Task Distribution
              </h3>
              <p className="text-xs text-slate-500 mb-4">Total vs completed tasks per employee</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={employeeChartDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="tasks" name="Total" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#16A34A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Task Status Distribution
              </h3>
              <p className="text-xs text-slate-500 mb-4">Breakdown across all work logs</p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {statusDistributionData.map((entry, idx) => (
                        <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Employee Directory Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Employee Activity Directory</h3>
            <p className="text-xs text-slate-500">
              Click any employee row to view their profile, work logs, and hours summary.
            </p>
          </div>
          <input
            type="text"
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            placeholder="Search name, ID, or email..."
            className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg sm:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total Tasks</th>
                <th className="py-3 px-4 text-right">Completed</th>
                <th className="py-3 px-4 text-right">Planned</th>
                <th className="py-3 px-4 text-right">Actual</th>
                <th className="py-3 px-4">Latest Entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {employeeStats.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No employees found.
                  </td>
                </tr>
              ) : (
                employeeStats.map((row) => (
                  <tr
                    key={row.emp.uid}
                    onClick={() => setSelectedEmployee(row.emp)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {row.emp.fullName}
                      {row.emp.role !== 'employee' && (
                        <span className="ml-2 text-[11px] font-mono text-blue-700">
                          {row.emp.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {row.emp.employeeId}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{row.emp.email}</td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span
                        className={
                          row.emp.accountStatus === 'active'
                            ? 'text-emerald-700 font-medium'
                            : 'text-red-700 font-medium'
                        }
                      >
                        {row.emp.accountStatus === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{row.totalTasks}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {row.completedTasks}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatDuration(row.plannedMins)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatDuration(row.actualMins)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {row.latestDate ? formatDateShort(row.latestDate) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Employee Profile Drawer */}
      {selectedEmployee && selectedEmployeeDetails && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40">
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto border-l border-slate-200 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedEmployee.fullName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedEmployee.employeeId} · {selectedEmployee.email} · {selectedEmployee.role}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedEmployee.role === 'employee' && (
                  <button
                    type="button"
                    disabled={statusUpdatingUid === selectedEmployee.uid}
                    onClick={() => void handleToggleEmployeeStatus(selectedEmployee)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      selectedEmployee.accountStatus === 'active'
                        ? 'border-red-200 text-red-700 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {selectedEmployee.accountStatus === 'active' ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        Deactivate Employee
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Activate Employee
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Daily / Weekly / Monthly Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <span className="text-xs text-slate-500">Tasks Today</span>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {selectedEmployeeDetails.todayCount}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <span className="text-xs text-slate-500">Weekly Actual Hours</span>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {formatDuration(selectedEmployeeDetails.weeklyMins)}
                  </p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3.5">
                  <span className="text-xs text-slate-500">Monthly Actual Hours</span>
                  <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {formatDuration(selectedEmployeeDetails.monthlyMins)}
                  </p>
                </div>
              </div>

              {/* Work Log History */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">
                  Work Log History ({selectedEmployeeDetails.logs.length})
                </h4>
                {selectedEmployeeDetails.logs.length === 0 ? (
                  <p className="text-xs text-slate-500">No work logs recorded yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-80 overflow-y-auto">
                    {selectedEmployeeDetails.logs.map((log) => (
                      <div key={log.id} className="p-3 text-xs">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                          <span className="font-mono font-medium text-slate-800">
                            {log.date} · {log.categoryName}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatDurationHrs(log.actualMinutes)} · {log.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{log.tasks}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Outcome: {log.customOutcome || log.outcome || '-'}
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

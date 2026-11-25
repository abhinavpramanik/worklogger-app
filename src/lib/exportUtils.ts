import XLSX from 'xlsx-js-style';
import {
  DEFAULT_TIMEZONE,
  Holiday,
  LeaveRequest,
  TaskStatus,
  UserProfile,
  WorkLog,
} from '../types';
import {
  enumerateDateRange,
  formatDateSheet,
  formatDuration,
  formatDurationHrs,
  formatTime12h,
  getDayOfWeekName,
  isSundayDate,
  minutesToHoursDecimal,
  timestampToDateInTimezone,
} from './dateUtils';

export interface ExportFilterParams {
  startDate: string;
  endDate: string;
  employeeUid: string; // 'ALL' for Admin all-employees export, or specific uid
  categoryId: string; // 'ALL' or specific categoryName/categoryId
  taskStatus: TaskStatus | 'ALL';
  includeDrafts: boolean;
  timezone?: string;
}

export type DayClassification =
  | 'Working Day'
  | 'Weekly Sunday Holiday'
  | 'Company/Public Holiday'
  | 'Approved Leave'
  | 'Pending Leave'
  | 'Rejected Leave';

export interface DateWiseLeaveNotice {
  employeeUid: string;
  employeeName: string;
  employeeId: string;
  leaveType: string;
  status: LeaveRequest['status'];
  reason: string;
}

export interface DateWiseSection {
  date: string; // YYYY-MM-DD
  shortDate: string; // MM/dd e.g. 09/19
  dayOfWeek: string;
  isSunday: boolean;
  holidays: Holiday[];
  leavesOnDate: DateWiseLeaveNotice[];
  approvedLeaves: DateWiseLeaveNotice[];
  pendingLeaves: DateWiseLeaveNotice[];
  logs: WorkLog[];
  primaryClassification: DayClassification;
}

export interface EmployeeSummaryRow {
  employeeUid: string;
  employeeName: string;
  employeeId: string;
  reportPeriod: string;
  totalWorkingDays: number;
  totalSundays: number;
  totalCompanyHolidays: number;
  totalApprovedLeaveDays: number;
  totalPendingLeaveDays: number;
  totalWorkLogs: number;
  completedTasks: number;
  inProgressTasks: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
}

export interface DateWiseReportDataset {
  filters: ExportFilterParams;
  effectiveStartDate: string;
  dates: string[];
  sections: DateWiseSection[];
  summaries: EmployeeSummaryRow[];
  targetEmployees: { uid: string; fullName: string; employeeId: string; createdDate: string | null }[];
}

export function getEffectiveOutcome(log: WorkLog): string {
  if (log.outcome === 'Other' && log.customOutcome) {
    return log.customOutcome;
  }
  return log.customOutcome || log.outcome || '-';
}

export function buildDateWiseReportDataset(params: {
  filters: ExportFilterParams;
  allLogs: WorkLog[];
  allHolidays: Holiday[];
  allLeaves?: LeaveRequest[];
  employees: UserProfile[];
}): DateWiseReportDataset {
  const { filters, allLogs, allHolidays, allLeaves = [], employees } = params;
  const tz = filters.timezone || DEFAULT_TIMEZONE;

  const selectedEmployees =
    filters.employeeUid === 'ALL'
      ? [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName))
      : employees.filter((e) => e.uid === filters.employeeUid);

  const targetEmployees = selectedEmployees.map((emp) => ({
    uid: emp.uid,
    fullName: emp.fullName,
    employeeId: emp.employeeId,
    createdDate: timestampToDateInTimezone(emp.createdAt, tz),
  }));

  // Do not emit any pre-account-creation default rows: clamp start date to earliest employee createdDate
  const createdDates = targetEmployees
    .map((e) => e.createdDate)
    .filter((d): d is string => Boolean(d));
  const earliestAccountDate =
    createdDates.length > 0 ? createdDates.reduce((min, d) => (d < min ? d : min), createdDates[0]) : null;

  const effectiveStartDate =
    earliestAccountDate && earliestAccountDate > filters.startDate
      ? earliestAccountDate
      : filters.startDate;

  // Enumerate from effectiveStartDate to endDate, then reverse so latest date is at the top (last to first)
  const datesAsc =
    effectiveStartDate <= filters.endDate
      ? enumerateDateRange(effectiveStartDate, filters.endDate)
      : [];
  const dates = [...datesAsc].reverse();

  const targetUids = new Set(targetEmployees.map((e) => e.uid));
  const createdDateByUid = new Map(targetEmployees.map((e) => [e.uid, e.createdDate]));

  const filteredLogs = allLogs.filter((log) => {
    if (!targetUids.has(log.employeeUid)) return false;
    const empCreated = createdDateByUid.get(log.employeeUid);
    if (empCreated && log.date < empCreated) return false;
    if (log.date < effectiveStartDate || log.date > filters.endDate) return false;
    if (!filters.includeDrafts && log.entryStatus === 'Draft') return false;
    if (
      filters.categoryId !== 'ALL' &&
      log.categoryId !== filters.categoryId &&
      log.categoryName !== filters.categoryId
    ) {
      return false;
    }
    if (filters.taskStatus !== 'ALL' && log.status !== filters.taskStatus) return false;
    return true;
  });

  const activeHolidays = allHolidays.filter(
    (h) => h.active && h.date >= effectiveStartDate && h.date <= filters.endDate
  );

  const relevantLeaves = allLeaves.filter(
    (l) =>
      targetUids.has(l.employeeUid) &&
      l.status !== 'Withdrawn' &&
      l.endDate >= effectiveStartDate &&
      l.startDate <= filters.endDate
  );

  const sections: DateWiseSection[] = dates.map((date) => {
    const dayOfWeek = getDayOfWeekName(date);
    const shortDate = formatDateSheet(date);
    const isSunday = isSundayDate(date);
    const holidays = activeHolidays.filter((h) => h.date === date);
    const leavesOnDate: DateWiseLeaveNotice[] = relevantLeaves
      .filter((l) => {
        const empCreated = createdDateByUid.get(l.employeeUid);
        if (empCreated && date < empCreated) return false;
        return l.startDate <= date && l.endDate >= date;
      })
      .map((l) => ({
        employeeUid: l.employeeUid,
        employeeName: l.employeeName,
        employeeId: l.employeeId,
        leaveType: l.leaveType,
        status: l.status,
        reason: l.reason,
      }));

    const approvedLeaves = leavesOnDate.filter((l) => l.status === 'Approved');
    const pendingLeaves = leavesOnDate.filter((l) => l.status === 'Pending');
    const logs = filteredLogs
      .filter((log) => log.date === date)
      .sort((a, b) => {
        const nameCmp = a.employeeName.localeCompare(b.employeeName);
        if (nameCmp !== 0) return nameCmp;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

    let primaryClassification: DayClassification = 'Working Day';
    if (holidays.length > 0) {
      primaryClassification = 'Company/Public Holiday';
    } else if (isSunday) {
      primaryClassification = 'Weekly Sunday Holiday';
    } else if (approvedLeaves.length > 0) {
      primaryClassification = 'Approved Leave';
    } else if (pendingLeaves.length > 0) {
      primaryClassification = 'Pending Leave';
    } else if (leavesOnDate.some((l) => l.status === 'Rejected')) {
      primaryClassification = 'Rejected Leave';
    }

    return {
      date,
      shortDate,
      dayOfWeek,
      isSunday,
      holidays,
      leavesOnDate,
      approvedLeaves,
      pendingLeaves,
      logs,
      primaryClassification,
    };
  });

  const summaries: EmployeeSummaryRow[] = targetEmployees.map((emp) => {
    let totalWorkingDays = 0;
    let totalSundays = 0;
    let totalCompanyHolidays = 0;
    let totalApprovedLeaveDays = 0;
    let totalPendingLeaveDays = 0;

    const empStart =
      emp.createdDate && emp.createdDate > effectiveStartDate
        ? emp.createdDate
        : effectiveStartDate;

    for (const date of dates) {
      if (emp.createdDate && date < emp.createdDate) continue;
      const sunday = isSundayDate(date);
      const hasCompanyHoliday = activeHolidays.some((h) => h.date === date);
      const empLeavesOnDate = relevantLeaves.filter(
        (l) => l.employeeUid === emp.uid && l.startDate <= date && l.endDate >= date
      );
      const hasApprovedLeave = empLeavesOnDate.some((l) => l.status === 'Approved');
      const hasPendingLeave = empLeavesOnDate.some((l) => l.status === 'Pending');

      if (sunday) totalSundays++;
      if (hasCompanyHoliday) totalCompanyHolidays++;

      if (!sunday && !hasCompanyHoliday) {
        if (hasApprovedLeave) {
          totalApprovedLeaveDays++;
        } else {
          totalWorkingDays++;
          if (hasPendingLeave) {
            totalPendingLeaveDays++;
          }
        }
      }
    }

    const empLogs = filteredLogs.filter((l) => l.employeeUid === emp.uid);
    const periodLabel =
      empStart <= filters.endDate ? `${empStart} to ${filters.endDate}` : 'No days in range';

    return {
      employeeUid: emp.uid,
      employeeName: emp.fullName,
      employeeId: emp.employeeId,
      reportPeriod: periodLabel,
      totalWorkingDays,
      totalSundays,
      totalCompanyHolidays,
      totalApprovedLeaveDays,
      totalPendingLeaveDays,
      totalWorkLogs: empLogs.length,
      completedTasks: empLogs.filter((l) => l.status === 'Completed').length,
      inProgressTasks: empLogs.filter((l) => l.status === 'In Progress').length,
      totalPlannedMinutes: empLogs.reduce((acc, l) => acc + (l.plannedMinutes || 0), 0),
      totalActualMinutes: empLogs.reduce((acc, l) => acc + (l.actualMinutes || 0), 0),
    };
  });

  return {
    filters,
    effectiveStartDate,
    dates,
    sections,
    summaries,
    targetEmployees,
  };
}

// ============================================================================
// CSV EXPORT (Matches Screenshot Sheet Format, Latest Date at Top)
// ============================================================================
function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportDateWiseCsv(dataset: DateWiseReportDataset, filenamePrefix = 'WorkLog_Report'): void {
  const isMultiEmployee = dataset.targetEmployees.length !== 1;
  const headers = isMultiEmployee
    ? [
        'Date',
        'Employee Name',
        'Employee ID',
        'Category',
        'Tasks',
        'Outcome (As specific as Possible)',
        'Status',
        'Total Planned Time',
        'Start Time',
        'End Time',
        'Total Actual Time',
      ]
    : [
        'Date',
        'Category',
        'Tasks',
        'Outcome (As specific as Possible)',
        'Status',
        'Total Planned Time',
        'Start Time',
        'End Time',
        'Total Actual Time',
      ];

  const rows: string[][] = [headers];

  for (const section of dataset.sections) {
    const specialLabels: string[] = [];
    if (section.isSunday) specialLabels.push('Sunday');
    for (const h of section.holidays) specialLabels.push(`Holiday: ${h.name} (${h.type})`);
    for (const l of section.leavesOnDate) {
      const who = isMultiEmployee ? `${l.employeeName} (${l.employeeId}) - ` : '';
      if (l.status === 'Approved') specialLabels.push(`${who}Leave: ${l.leaveType} (Approved)`);
      else if (l.status === 'Pending') specialLabels.push(`${who}Pending Leave: ${l.leaveType}`);
      else if (l.status === 'Rejected') specialLabels.push(`${who}Leave Rejected: ${l.leaveType}`);
    }

    if (section.logs.length > 0) {
      let lastCategory = '';
      let lastEmpUid = '';
      section.logs.forEach((log, idx) => {
        const showDate = idx === 0;
        const showCategory =
          idx === 0 || log.categoryName !== lastCategory || (isMultiEmployee && log.employeeUid !== lastEmpUid);
        lastCategory = log.categoryName;
        lastEmpUid = log.employeeUid;

        if (idx === 0 && specialLabels.length > 0) {
          const bannerCategory = `${specialLabels.join(' | ')} — ${log.categoryName}`;
          if (isMultiEmployee) {
            rows.push([
              section.shortDate,
              log.employeeName,
              log.employeeId,
              bannerCategory,
              log.tasks,
              getEffectiveOutcome(log),
              log.status,
              formatDurationHrs(log.plannedMinutes),
              formatTime12h(log.startTime),
              formatTime12h(log.endTime),
              formatDurationHrs(log.actualMinutes),
            ]);
            return;
          }
          rows.push([
            section.shortDate,
            bannerCategory,
            log.tasks,
            getEffectiveOutcome(log),
            log.status,
            formatDurationHrs(log.plannedMinutes),
            formatTime12h(log.startTime),
            formatTime12h(log.endTime),
            formatDurationHrs(log.actualMinutes),
          ]);
          return;
        }

        if (isMultiEmployee) {
          rows.push([
            showDate ? section.shortDate : '',
            log.employeeName,
            log.employeeId,
            showCategory ? log.categoryName : '',
            log.tasks,
            getEffectiveOutcome(log),
            log.status,
            formatDurationHrs(log.plannedMinutes),
            formatTime12h(log.startTime),
            formatTime12h(log.endTime),
            formatDurationHrs(log.actualMinutes),
          ]);
        } else {
          rows.push([
            showDate ? section.shortDate : '',
            showCategory ? log.categoryName : '',
            log.tasks,
            getEffectiveOutcome(log),
            log.status,
            formatDurationHrs(log.plannedMinutes),
            formatTime12h(log.startTime),
            formatTime12h(log.endTime),
            formatDurationHrs(log.actualMinutes),
          ]);
        }
      });
    } else {
      const catText = specialLabels.length > 0 ? specialLabels.join(' | ') : 'No Work Log Submitted';
      if (isMultiEmployee) {
        rows.push([section.shortDate, '', '', catText, '', '', '', '', '', '', '']);
      } else {
        rows.push([section.shortDate, catText, '', '', '', '', '', '', '']);
      }
    }

    // Blank spacer row between date blocks
    rows.push(Array.from({ length: headers.length }, () => ''));
  }

  const csvContent =
    '\uFEFF' + rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${dataset.effectiveStartDate}_to_${dataset.filters.endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// EXCEL EXPORT (.xlsx matching Screenshot Layout, Latest Date at Top)
// ============================================================================
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const SHEET_HEADER_STYLE = {
  font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
  fill: { fgColor: { rgb: 'C9DAF8' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: THIN_BORDER,
};

function makeCellStyle(
  bgRgb = 'FFFFFF',
  align: 'left' | 'center' | 'right' = 'left',
  bold = false,
  textRgb = '0F172A',
  wrapText = false
) {
  return {
    font: { name: 'Calibri', sz: 10, bold, color: { rgb: textRgb } },
    fill: { fgColor: { rgb: bgRgb } },
    alignment: { horizontal: align, vertical: 'center', wrapText },
    border: THIN_BORDER,
  };
}

export function exportDateWiseExcel(dataset: DateWiseReportDataset, filenamePrefix = 'WorkLog_Report'): void {
  const wb = XLSX.utils.book_new();
  const isMultiEmployee = dataset.targetEmployees.length !== 1;

  const headers = isMultiEmployee
    ? [
        'Date',
        'Employee Name',
        'Employee ID',
        'Category',
        'Tasks',
        'Outcome\n(As specific as Possible)',
        'Status',
        'Total Planned Time',
        'Start Time',
        'End Time',
        'Total Actual Time',
      ]
    : [
        'Date',
        'Category',
        'Tasks',
        'Outcome\n(As specific as Possible)',
        'Status',
        'Total Planned Time',
        'Start Time',
        'End Time',
        'Total Actual Time',
      ];

  const colCount = headers.length;
  const ws1Data: Array<Array<{ v: string | number; s?: Record<string, unknown> }>> = [
    headers.map((h) => ({ v: h, s: SHEET_HEADER_STYLE })),
  ];
  const rowHeights: Array<{ hpt: number }> = [{ hpt: 32 }];

  for (const section of dataset.sections) {
    const specialLabels: string[] = [];
    if (section.isSunday) specialLabels.push('Sunday');
    for (const h of section.holidays) specialLabels.push(`Holiday: ${h.name} (${h.type})`);
    for (const l of section.leavesOnDate) {
      const who = isMultiEmployee ? `${l.employeeName} (${l.employeeId}) - ` : '';
      if (l.status === 'Approved') specialLabels.push(`${who}Leave: ${l.leaveType} (Approved)`);
      else if (l.status === 'Pending') specialLabels.push(`${who}Pending Leave: ${l.leaveType}`);
      else if (l.status === 'Rejected') specialLabels.push(`${who}Leave Rejected: ${l.leaveType}`);
    }

    if (section.logs.length > 0) {
      let lastCategory = '';
      let lastEmpUid = '';

      section.logs.forEach((log, idx) => {
        const showDate = idx === 0;
        const showCategory =
          idx === 0 || log.categoryName !== lastCategory || (isMultiEmployee && log.employeeUid !== lastEmpUid);
        lastCategory = log.categoryName;
        lastEmpUid = log.employeeUid;

        const categoryDisplay =
          idx === 0 && specialLabels.length > 0
            ? `${specialLabels.join(' · ')} — ${log.categoryName}`
            : showCategory
              ? log.categoryName
              : '';

        const rowCells = isMultiEmployee
          ? [
              { v: showDate ? section.shortDate : '', s: makeCellStyle('FFFFFF', 'right') },
              { v: log.employeeName, s: makeCellStyle('FFFFFF', 'left') },
              { v: log.employeeId, s: makeCellStyle('FFFFFF', 'center') },
              { v: categoryDisplay, s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: log.tasks, s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: getEffectiveOutcome(log), s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: log.status, s: makeCellStyle('FFFFFF', 'left') },
              { v: formatDurationHrs(log.plannedMinutes), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatTime12h(log.startTime), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatTime12h(log.endTime), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatDurationHrs(log.actualMinutes), s: makeCellStyle('FFFFFF', 'right') },
            ]
          : [
              { v: showDate ? section.shortDate : '', s: makeCellStyle('FFFFFF', 'right') },
              { v: categoryDisplay, s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: log.tasks, s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: getEffectiveOutcome(log), s: makeCellStyle('FFFFFF', 'left', false, '0F172A', true) },
              { v: log.status, s: makeCellStyle('FFFFFF', 'left') },
              { v: formatDurationHrs(log.plannedMinutes), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatTime12h(log.startTime), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatTime12h(log.endTime), s: makeCellStyle('FFFFFF', 'right') },
              { v: formatDurationHrs(log.actualMinutes), s: makeCellStyle('FFFFFF', 'right') },
            ];

        ws1Data.push(rowCells);
        rowHeights.push({ hpt: 20 });
      });
    } else {
      let rowBg = 'F8FAFC';
      let textColor = '334155';
      let label = 'No Work Log Submitted';
      if (section.holidays.length > 0) {
        rowBg = 'CCFBF1';
        textColor = '115E59';
        label = specialLabels.join(' | ');
      } else if (section.isSunday) {
        rowBg = 'F1F5F9';
        textColor = '334155';
        label = specialLabels.join(' | ');
      } else if (section.approvedLeaves.length > 0) {
        rowBg = 'D1FAE5';
        textColor = '065F46';
        label = specialLabels.join(' | ');
      } else if (section.pendingLeaves.length > 0) {
        rowBg = 'FEF3C7';
        textColor = '92400E';
        label = specialLabels.join(' | ');
      } else if (specialLabels.length > 0) {
        label = specialLabels.join(' | ');
      }

      const emptyDayRow = isMultiEmployee
        ? [
            { v: section.shortDate, s: makeCellStyle(rowBg, 'right', false, textColor) },
            { v: '', s: makeCellStyle(rowBg) },
            { v: '', s: makeCellStyle(rowBg) },
            { v: label, s: makeCellStyle(rowBg, 'left', true, textColor, true) },
            ...Array.from({ length: colCount - 4 }, () => ({ v: '', s: makeCellStyle(rowBg) })),
          ]
        : [
            { v: section.shortDate, s: makeCellStyle(rowBg, 'right', false, textColor) },
            { v: label, s: makeCellStyle(rowBg, 'left', true, textColor, true) },
            ...Array.from({ length: colCount - 2 }, () => ({ v: '', s: makeCellStyle(rowBg) })),
          ];

      ws1Data.push(emptyDayRow);
      rowHeights.push({ hpt: 20 });
    }

    // Blank separator row between dates
    ws1Data.push(
      Array.from({ length: colCount }, () => ({
        v: '',
        s: makeCellStyle('FFFFFF'),
      }))
    );
    rowHeights.push({ hpt: 16 });
  }

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!rows'] = rowHeights;
  ws1['!cols'] = isMultiEmployee
    ? [
        { wch: 9 },
        { wch: 20 },
        { wch: 13 },
        { wch: 20 },
        { wch: 36 },
        { wch: 48 },
        { wch: 14 },
        { wch: 18 },
        { wch: 13 },
        { wch: 13 },
        { wch: 18 },
      ]
    : [
        { wch: 9 },
        { wch: 20 },
        { wch: 38 },
        { wch: 52 },
        { wch: 14 },
        { wch: 18 },
        { wch: 13 },
        { wch: 13 },
        { wch: 18 },
      ];
  ws1['!views'] = [{ state: 'frozen', ySplit: 1 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Detailed Work Logs');

  // --------------------------------------------------------------------------
  // WORKSHEET 2: Summary
  // --------------------------------------------------------------------------
  const summaryHeaders = [
    'Employee Name',
    'Employee ID',
    'Report Period',
    'Total Working Days',
    'Total Sundays',
    'Total Company Holidays',
    'Total Work Logs',
    'Completed Tasks',
    'In-Progress Tasks',
    'Total Planned Hours',
    'Total Actual Hours',
  ];

  const ws2Data: Array<Array<{ v: string | number; s?: Record<string, unknown> }>> = [
    summaryHeaders.map((h) => ({ v: h, s: SHEET_HEADER_STYLE })),
  ];

  dataset.summaries.forEach((row, idx) => {
    const bg = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';
    ws2Data.push([
      { v: row.employeeName, s: makeCellStyle(bg, 'left') },
      { v: row.employeeId, s: makeCellStyle(bg, 'center') },
      { v: row.reportPeriod, s: makeCellStyle(bg, 'center') },
      { v: row.totalWorkingDays, s: makeCellStyle(bg, 'right') },
      { v: row.totalSundays, s: makeCellStyle(bg, 'right') },
      { v: row.totalCompanyHolidays, s: makeCellStyle(bg, 'right') },
      { v: row.totalWorkLogs, s: makeCellStyle(bg, 'right') },
      { v: row.completedTasks, s: makeCellStyle(bg, 'right') },
      { v: row.inProgressTasks, s: makeCellStyle(bg, 'right') },
      {
        v: `${formatDuration(row.totalPlannedMinutes)} (${minutesToHoursDecimal(row.totalPlannedMinutes)}h)`,
        s: makeCellStyle(bg, 'right'),
      },
      {
        v: `${formatDuration(row.totalActualMinutes)} (${minutesToHoursDecimal(row.totalActualMinutes)}h)`,
        s: makeCellStyle(bg, 'right'),
      },
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
  ];
  ws2['!autofilter'] = { ref: `A1:K${Math.max(1, dataset.summaries.length + 1)}` };
  ws2['!views'] = [{ state: 'frozen', ySplit: 1 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  XLSX.writeFile(wb, `${filenamePrefix}_${dataset.effectiveStartDate}_to_${dataset.filters.endDate}.xlsx`);
}

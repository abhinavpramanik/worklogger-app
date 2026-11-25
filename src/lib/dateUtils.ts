import { addDays, format, getDay, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_TIMEZONE } from '../types';

export const AVAILABLE_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(new Date(), DEFAULT_TIMEZONE, 'yyyy-MM-dd');
  }
}

export function timestampToDateInTimezone(
  ts: { toDate?: () => Date } | Date | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string | null {
  if (!ts) return null;
  const d =
    typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : ts instanceof Date
        ? ts
        : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  try {
    return formatInTimeZone(d, timezone, 'yyyy-MM-dd');
  } catch {
    return formatInTimeZone(d, DEFAULT_TIMEZONE, 'yyyy-MM-dd');
  }
}

export function getNowFormattedInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    return formatInTimeZone(new Date(), timezone, 'EEEE, dd MMMM yyyy');
  } catch {
    return formatInTimeZone(new Date(), DEFAULT_TIMEZONE, 'EEEE, dd MMMM yyyy');
  }
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return format(parseISO(dateStr), 'dd MMMM yyyy');
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return format(parseISO(dateStr), 'dd MMM yyyy');
}

/** Matches the spreadsheet screenshot format: e.g. 09/19 */
export function formatDateSheet(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return format(parseISO(dateStr), 'MM/dd');
}

export function getDayOfWeekName(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  return format(parseISO(dateStr), 'EEEE');
}

export function isSundayDate(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return getDay(parseISO(dateStr)) === 0;
}

export function enumerateDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates: string[] = [];
  let cursor = parseISO(startDate);
  const end = parseISO(endDate);
  let guard = 0;
  while (cursor <= end && guard < 1096) {
    dates.push(format(cursor, 'yyyy-MM-dd'));
    cursor = addDays(cursor, 1);
    guard++;
  }
  return dates;
}

export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Formats 24-hr "09:20" / "13:00" as "9:20 AM" / "1:00 PM" matching screenshot */
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Formats minutes as "01:30 Hrs" / "00:30 Hrs" matching screenshot */
export function formatDurationHrs(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} Hrs`;
}

export interface TimeCalcResult {
  actualMinutes: number;
  isOvernight: boolean;
  isValid: boolean;
  error?: string;
}

export function calculateActualMinutes(
  startTime: string,
  endTime: string,
  breakMinutes: number
): TimeCalcResult {
  if (!startTime && !endTime) {
    return { actualMinutes: 0, isOvernight: false, isValid: true };
  }
  if (!startTime || !endTime) {
    return {
      actualMinutes: 0,
      isOvernight: false,
      isValid: false,
      error: 'Enter both start time and end time.',
    };
  }
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) {
    return { actualMinutes: 0, isOvernight: false, isValid: false, error: 'Invalid time format.' };
  }

  let grossMinutes = end - start;
  let isOvernight = false;
  if (grossMinutes === 0) {
    return {
      actualMinutes: 0,
      isOvernight: false,
      isValid: false,
      error: 'Start time and end time cannot be identical.',
    };
  }
  if (grossMinutes < 0) {
    grossMinutes += 24 * 60;
    isOvernight = true;
  }

  const safeBreak = Math.max(0, Math.floor(breakMinutes || 0));
  if (safeBreak >= grossMinutes) {
    return {
      actualMinutes: 0,
      isOvernight,
      isValid: false,
      error: 'Break duration must be less than total elapsed shift time.',
    };
  }

  return {
    actualMinutes: grossMinutes - safeBreak,
    isOvernight,
    isValid: true,
  };
}

export function formatDuration(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesToHoursDecimal(totalMinutes: number): string {
  return ((totalMinutes || 0) / 60).toFixed(2);
}

export function splitMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  };
}

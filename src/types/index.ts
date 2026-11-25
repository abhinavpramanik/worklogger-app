import { Timestamp } from 'firebase/firestore';

export type UserRole = 'employee' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'inactive';

export type TaskStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'Blocked'
  | 'On Hold';

export type EntryStatus = 'Draft' | 'Submitted';
export type PresetType = 'task' | 'outcome';

export type HolidayType =
  | 'Weekly Holiday'
  | 'Public Holiday'
  | 'Company Holiday'
  | 'Special Holiday';

export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Personal Leave'
  | 'Unpaid Leave'
  | 'Other';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

export const TASK_STATUSES: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Completed',
  'Blocked',
  'On Hold',
];

export const HOLIDAY_TYPES: HolidayType[] = [
  'Public Holiday',
  'Company Holiday',
  'Special Holiday',
  'Weekly Holiday',
];

export const LEAVE_TYPES: LeaveType[] = [
  'Casual Leave',
  'Sick Leave',
  'Earned Leave',
  'Personal Leave',
  'Unpaid Leave',
  'Other',
];

export const LEAVE_STATUSES: LeaveStatus[] = [
  'Pending',
  'Approved',
  'Rejected',
  'Withdrawn',
];

export const VALIDATION_LIMITS = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 120,
  EMPLOYEE_ID_MIN: 2,
  EMPLOYEE_ID_MAX: 40,
  EMPLOYEE_ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  EMAIL_MAX: 254,
  DEPARTMENT_MAX: 80,
  TASKS_MAX: 4000,
  OUTCOME_MAX: 1000,
  CUSTOM_OUTCOME_MAX: 500,
  ADMIN_COMMENT_MAX: 1000,
  CATEGORY_NAME_MAX: 80,
  CATEGORY_DESC_MAX: 300,
  HOLIDAY_NAME_MAX: 120,
  HOLIDAY_DESC_MAX: 500,
  LEAVE_REASON_MAX: 1000,
  LEAVE_NOTE_MAX: 1000,
  ORG_NAME_MAX: 120,
} as const;

export const BOOTSTRAPPED_SUPER_ADMIN_EMAIL = 'abhinavpramanikatwork@gmail.com';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export interface UserProfile {
  uid: string;
  fullName: string;
  employeeId: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  department?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkLog {
  id: string;
  employeeUid: string;
  employeeName: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  categoryId: string;
  categoryName: string;
  tasks: string;
  outcome: string;
  customOutcome: string;
  status: TaskStatus;
  plannedMinutes: number;
  startTime: string; // HH:mm or ''
  endTime: string; // HH:mm or ''
  breakMinutes: number;
  actualMinutes: number;
  entryStatus: EntryStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  submittedAt?: Timestamp | null;
}

export interface UserPreset {
  id: string;
  employeeUid: string;
  presetType: PresetType;
  text: string;
  categoryName: string;
  plannedMinutes: number;
  taskText?: string;
  outcomeText?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  description: string;
  active: boolean;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LeaveRequest {
  id: string;
  employeeUid: string;
  employeeName: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: LeaveType;
  reason: string;
  supportingNote: string;
  status: LeaveStatus;
  adminComment: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AuditLog {
  id: string;
  entityType: 'workLog' | 'leaveRequest' | 'holiday' | 'category' | 'user' | 'settings';
  entityId: string;
  employeeUid: string;
  action: string;
  previousData: Record<string, unknown>;
  updatedData: Record<string, unknown>;
  changedBy: string;
  changedByName: string;
  timestamp?: Timestamp;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'review' | 'leave' | 'system';
  read: boolean;
  createdAt?: Timestamp;
}

export interface AppSettings {
  id: string;
  organizationName: string;
  timezone: string;
  standardDailyMinutes: number;
  requireEmailVerification: boolean;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export type AppView =
  | 'employee-dashboard'
  | 'add-work-log'
  | 'work-log-history'
  | 'my-presets'
  | 'holiday-calendar'
  | 'export-reports'
  | 'profile'
  | 'admin-dashboard'
  | 'admin-employees'
  | 'admin-all-logs'
  | 'admin-holidays'
  | 'admin-categories'
  | 'admin-reports'
  | 'admin-settings';

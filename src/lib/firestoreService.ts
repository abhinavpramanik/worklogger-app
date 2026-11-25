import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AccountStatus,
  AppSettings,
  AuditLog,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  Category,
  HolidayType,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  TaskStatus,
  UserPreset,
  UserProfile,
  UserRole,
  VALIDATION_LIMITS,
  WorkLog,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

function clampString(val: string | undefined | null, max: number): string {
  return (val ?? '').toString().trim().slice(0, max);
}

export async function isEmployeeIdAvailable(employeeId: string): Promise<boolean> {
  const normalized = clampString(employeeId, VALIDATION_LIMITS.EMPLOYEE_ID_MAX).toUpperCase();
  if (!VALIDATION_LIMITS.EMPLOYEE_ID_PATTERN.test(normalized)) return false;
  const ref = doc(db, 'employeeIdIndex', normalized);
  try {
    const snap = await getDoc(ref);
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `employeeIdIndex/${normalized}`);
  }
}

export async function createUserProfileWithEmployeeId(params: {
  uid: string;
  fullName: string;
  employeeId: string;
  email: string;
  emailVerified: boolean;
  department?: string;
}): Promise<UserProfile> {
  const normalizedEmpId = clampString(params.employeeId, VALIDATION_LIMITS.EMPLOYEE_ID_MAX).toUpperCase();
  const fullName = clampString(params.fullName, VALIDATION_LIMITS.FULL_NAME_MAX);
  const email = clampString(params.email, VALIDATION_LIMITS.EMAIL_MAX).toLowerCase();
  const department = clampString(params.department, VALIDATION_LIMITS.DEPARTMENT_MAX);

  const empIndexRef = doc(db, 'employeeIdIndex', normalizedEmpId);
  const userRef = doc(db, 'users', params.uid);

  try {
    const existingEmp = await getDoc(empIndexRef);
    if (existingEmp.exists() && existingEmp.data()?.uid !== params.uid) {
      throw new Error('EMPLOYEE_ID_TAKEN');
    }

    const isBootstrapAdmin =
      params.emailVerified && email === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase();
    const role: UserRole = isBootstrapAdmin ? 'super_admin' : 'employee';

    const batch = writeBatch(db);
    if (!existingEmp.exists()) {
      batch.set(empIndexRef, {
        uid: params.uid,
        employeeId: normalizedEmpId,
        createdAt: serverTimestamp(),
      });
    }

    const userPayload: Record<string, unknown> = {
      uid: params.uid,
      fullName,
      employeeId: normalizedEmpId,
      email,
      role,
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (department) {
      userPayload.department = department;
    }

    batch.set(userRef, userPayload);
    await batch.commit();

    return {
      uid: params.uid,
      fullName,
      employeeId: normalizedEmpId,
      email,
      role,
      accountStatus: 'active',
      department: department || undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'EMPLOYEE_ID_TAKEN') {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function claimBootstrappedSuperAdminRole(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      role: 'super_admin',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateOwnProfile(
  uid: string,
  updates: { fullName: string; department?: string }
): Promise<void> {
  const ref = doc(db, 'users', uid);
  try {
    await updateDoc(ref, {
      fullName: clampString(updates.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
      department: clampString(updates.department, VALIDATION_LIMITS.DEPARTMENT_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function adminUpdateEmployeeStatus(
  targetUid: string,
  accountStatus: AccountStatus
): Promise<void> {
  const ref = doc(db, 'users', targetUid);
  try {
    await updateDoc(ref, {
      accountStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function superAdminUpdateUserRoleAndStatus(
  targetUid: string,
  updates: { role: UserRole; accountStatus: AccountStatus; department?: string }
): Promise<void> {
  const ref = doc(db, 'users', targetUid);
  try {
    const payload: Record<string, unknown> = {
      role: updates.role,
      accountStatus: updates.accountStatus,
      updatedAt: serverTimestamp(),
    };
    if (updates.department !== undefined) {
      payload.department = clampString(updates.department, VALIDATION_LIMITS.DEPARTMENT_MAX);
    }
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export interface WorkLogInputPayload {
  date: string;
  categoryId: string;
  categoryName: string;
  tasks: string;
  outcome: string;
  customOutcome: string;
  status: TaskStatus;
  plannedMinutes: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  actualMinutes: number;
}

function sanitizeWorkLogFields(input: WorkLogInputPayload) {
  return {
    date: clampString(input.date, 10),
    categoryId: clampString(input.categoryId, 128) || 'custom',
    categoryName: clampString(input.categoryName, VALIDATION_LIMITS.CATEGORY_NAME_MAX),
    tasks: (input.tasks ?? '').slice(0, VALIDATION_LIMITS.TASKS_MAX),
    outcome: clampString(input.outcome, VALIDATION_LIMITS.OUTCOME_MAX),
    customOutcome: clampString(input.customOutcome, VALIDATION_LIMITS.CUSTOM_OUTCOME_MAX),
    status: input.status,
    plannedMinutes: Math.max(0, Math.min(1440, Math.round(input.plannedMinutes || 0))),
    startTime: clampString(input.startTime, 5),
    endTime: clampString(input.endTime, 5),
    breakMinutes: Math.max(0, Math.min(720, Math.round(input.breakMinutes || 0))),
    actualMinutes: Math.max(0, Math.min(1440, Math.round(input.actualMinutes || 0))),
  };
}

export async function createWorkLogDraft(
  user: UserProfile,
  input: WorkLogInputPayload
): Promise<string> {
  const path = 'workLogs';
  try {
    const fields = sanitizeWorkLogFields(input);
    const docRef = await addDoc(collection(db, path), {
      employeeUid: user.uid,
      employeeName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
      employeeId: clampString(user.employeeId, VALIDATION_LIMITS.EMPLOYEE_ID_MAX),
      ...fields,
      entryStatus: 'Draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkLogDraft(
  logId: string,
  user: UserProfile,
  input: WorkLogInputPayload
): Promise<void> {
  const path = `workLogs/${logId}`;
  try {
    const fields = sanitizeWorkLogFields(input);
    await updateDoc(doc(db, 'workLogs', logId), {
      employeeName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
      ...fields,
      entryStatus: 'Draft',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitWorkLog(params: {
  existingLogId?: string | null;
  existingLogSnapshot?: WorkLog | null;
  user: UserProfile;
  input: WorkLogInputPayload;
}): Promise<string> {
  const { existingLogId, existingLogSnapshot, user, input } = params;
  const fields = sanitizeWorkLogFields(input);

  if (!existingLogId) {
    const path = 'workLogs';
    try {
      const docRef = await addDoc(collection(db, path), {
        employeeUid: user.uid,
        employeeName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
        employeeId: clampString(user.employeeId, VALIDATION_LIMITS.EMPLOYEE_ID_MAX),
        ...fields,
        entryStatus: 'Submitted',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  const wasSubmitted = existingLogSnapshot?.entryStatus === 'Submitted';
  const workLogRef = doc(db, 'workLogs', existingLogId);

  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      employeeName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
      ...fields,
      entryStatus: 'Submitted',
      updatedAt: serverTimestamp(),
    };
    if (!wasSubmitted || !existingLogSnapshot?.submittedAt) {
      updatePayload.submittedAt = serverTimestamp();
    }
    batch.update(workLogRef, updatePayload);

    if (wasSubmitted && existingLogSnapshot) {
      const auditRef = doc(collection(db, 'auditLogs'));
      batch.set(auditRef, {
        entityType: 'workLog',
        entityId: existingLogId,
        employeeUid: existingLogSnapshot.employeeUid,
        action: 'edited_work_log',
        previousData: {
          date: existingLogSnapshot.date,
          categoryId: existingLogSnapshot.categoryId,
          categoryName: existingLogSnapshot.categoryName,
          tasks: existingLogSnapshot.tasks,
          outcome: existingLogSnapshot.outcome,
          status: existingLogSnapshot.status,
          plannedMinutes: existingLogSnapshot.plannedMinutes,
          startTime: existingLogSnapshot.startTime,
          endTime: existingLogSnapshot.endTime,
          breakMinutes: existingLogSnapshot.breakMinutes,
          actualMinutes: existingLogSnapshot.actualMinutes,
        },
        updatedData: {
          ...fields,
        },
        changedBy: user.uid,
        changedByName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
        timestamp: serverTimestamp(),
      });
    }

    await batch.commit();
    return existingLogId;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workLogs/${existingLogId}`);
  }
}

export async function deleteWorkLog(logId: string): Promise<void> {
  const path = `workLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'workLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// User-owned Separate Task & Outcome Presets
export async function createUserPreset(
  uid: string,
  input: {
    presetType: 'task' | 'outcome';
    text: string;
    categoryName: string;
    plannedMinutes: number;
  }
): Promise<string> {
  const path = 'userPresets';
  const maxLen = input.presetType === 'task' ? VALIDATION_LIMITS.TASKS_MAX : VALIDATION_LIMITS.OUTCOME_MAX;
  try {
    const docRef = await addDoc(collection(db, path), {
      employeeUid: uid,
      presetType: input.presetType,
      text: clampString(input.text, maxLen),
      categoryName: clampString(input.categoryName, VALIDATION_LIMITS.CATEGORY_NAME_MAX),
      plannedMinutes:
        input.presetType === 'task'
          ? Math.max(0, Math.min(1440, Math.round(input.plannedMinutes || 0)))
          : 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserPreset(
  presetId: string,
  input: {
    presetType: 'task' | 'outcome';
    text: string;
    categoryName: string;
    plannedMinutes: number;
  }
): Promise<void> {
  const path = `userPresets/${presetId}`;
  const maxLen = input.presetType === 'task' ? VALIDATION_LIMITS.TASKS_MAX : VALIDATION_LIMITS.OUTCOME_MAX;
  try {
    await updateDoc(doc(db, 'userPresets', presetId), {
      presetType: input.presetType,
      text: clampString(input.text, maxLen),
      categoryName: clampString(input.categoryName, VALIDATION_LIMITS.CATEGORY_NAME_MAX),
      plannedMinutes:
        input.presetType === 'task'
          ? Math.max(0, Math.min(1440, Math.round(input.plannedMinutes || 0)))
          : 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserPreset(presetId: string): Promise<void> {
  const path = `userPresets/${presetId}`;
  try {
    await deleteDoc(doc(db, 'userPresets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCategory(name: string, description: string): Promise<string> {
  const path = 'categories';
  try {
    const docRef = await addDoc(collection(db, path), {
      name: clampString(name, VALIDATION_LIMITS.CATEGORY_NAME_MAX),
      description: clampString(description, VALIDATION_LIMITS.CATEGORY_DESC_MAX),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCategory(
  id: string,
  updates: { name: string; description: string; active: boolean }
): Promise<void> {
  const path = `categories/${id}`;
  try {
    await updateDoc(doc(db, 'categories', id), {
      name: clampString(updates.name, VALIDATION_LIMITS.CATEGORY_NAME_MAX),
      description: clampString(updates.description, VALIDATION_LIMITS.CATEGORY_DESC_MAX),
      active: updates.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createHoliday(params: {
  date: string;
  name: string;
  type: HolidayType;
  description: string;
  createdBy: string;
}): Promise<string> {
  const path = 'holidays';
  try {
    const docRef = await addDoc(collection(db, path), {
      date: clampString(params.date, 10),
      name: clampString(params.name, VALIDATION_LIMITS.HOLIDAY_NAME_MAX),
      type: params.type,
      description: clampString(params.description, VALIDATION_LIMITS.HOLIDAY_DESC_MAX),
      active: true,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateHoliday(
  id: string,
  updates: { date: string; name: string; type: HolidayType; description: string; active: boolean }
): Promise<void> {
  const path = `holidays/${id}`;
  try {
    await updateDoc(doc(db, 'holidays', id), {
      date: clampString(updates.date, 10),
      name: clampString(updates.name, VALIDATION_LIMITS.HOLIDAY_NAME_MAX),
      type: updates.type,
      description: clampString(updates.description, VALIDATION_LIMITS.HOLIDAY_DESC_MAX),
      active: updates.active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHoliday(id: string): Promise<void> {
  const path = `holidays/${id}`;
  try {
    await deleteDoc(doc(db, 'holidays', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createLeaveRequest(
  user: UserProfile,
  input: {
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason: string;
    supportingNote: string;
  }
): Promise<string> {
  const path = 'leaveRequests';
  try {
    const docRef = await addDoc(collection(db, path), {
      employeeUid: user.uid,
      employeeName: clampString(user.fullName, VALIDATION_LIMITS.FULL_NAME_MAX),
      employeeId: clampString(user.employeeId, VALIDATION_LIMITS.EMPLOYEE_ID_MAX),
      startDate: clampString(input.startDate, 10),
      endDate: clampString(input.endDate, 10),
      leaveType: input.leaveType,
      reason: clampString(input.reason, VALIDATION_LIMITS.LEAVE_REASON_MAX),
      supportingNote: clampString(input.supportingNote, VALIDATION_LIMITS.LEAVE_NOTE_MAX),
      status: 'Pending',
      adminComment: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePendingLeaveRequest(
  leaveId: string,
  input: {
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason: string;
    supportingNote: string;
  }
): Promise<void> {
  const path = `leaveRequests/${leaveId}`;
  try {
    await updateDoc(doc(db, 'leaveRequests', leaveId), {
      startDate: clampString(input.startDate, 10),
      endDate: clampString(input.endDate, 10),
      leaveType: input.leaveType,
      reason: clampString(input.reason, VALIDATION_LIMITS.LEAVE_REASON_MAX),
      supportingNote: clampString(input.supportingNote, VALIDATION_LIMITS.LEAVE_NOTE_MAX),
      status: 'Pending',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function withdrawLeaveRequest(leaveId: string): Promise<void> {
  const path = `leaveRequests/${leaveId}`;
  try {
    await updateDoc(doc(db, 'leaveRequests', leaveId), {
      status: 'Withdrawn',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminReviewLeaveRequest(params: {
  leave: LeaveRequest;
  reviewer: UserProfile;
  decision: Extract<LeaveStatus, 'Approved' | 'Rejected'>;
  adminComment: string;
}): Promise<void> {
  const { leave, reviewer, decision, adminComment } = params;
  const cleanComment = clampString(adminComment, VALIDATION_LIMITS.ADMIN_COMMENT_MAX);
  const leaveRef = doc(db, 'leaveRequests', leave.id);

  try {
    const batch = writeBatch(db);
    batch.update(leaveRef, {
      status: decision,
      adminComment: cleanComment,
      reviewedBy: reviewer.uid,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, 'notifications'));
    batch.set(notifRef, {
      recipientUid: leave.employeeUid,
      title: `Leave Request ${decision}`,
      message: `Your ${leave.leaveType} (${leave.startDate} to ${leave.endDate}) was ${decision.toLowerCase()}${cleanComment ? `: ${cleanComment}` : '.'}`,
      type: 'leave',
      read: false,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leaveRequests/${leave.id}`);
  }
}

export async function fetchAuditLogsForWorkLog(
  workLogId: string,
  employeeUid?: string
): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const q = employeeUid
      ? query(
          collection(db, path),
          where('employeeUid', '==', employeeUid),
          where('entityId', '==', workLogId)
        )
      : query(collection(db, path), where('entityId', '==', workLogId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
      .sort((a, b) => (b.timestamp?.toMillis() ?? 0) - (a.timestamp?.toMillis() ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAppSettings(
  settings: Omit<AppSettings, 'id' | 'updatedAt' | 'updatedBy'>
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const path = 'settings/app';
  try {
    const ref = doc(db, 'settings', 'app');
    const batch = writeBatch(db);
    batch.set(
      ref,
      {
        organizationName: clampString(settings.organizationName, VALIDATION_LIMITS.ORG_NAME_MAX),
        timezone: clampString(settings.timezone, 80),
        standardDailyMinutes: Math.max(60, Math.min(960, Math.round(settings.standardDailyMinutes || 480))),
        requireEmailVerification: Boolean(settings.requireEmailVerification),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function sortWorkLogsDesc(logs: WorkLog[]): WorkLog[] {
  return [...logs].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    const aTime = a.startTime || '';
    const bTime = b.startTime || '';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    const aMs = a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0;
    const bMs = b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0;
    return bMs - aMs;
  });
}

export function sortLeavesDesc(leaves: LeaveRequest[]): LeaveRequest[] {
  return [...leaves].sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
  });
}

export function normalizeAndSortPresets(raw: UserPreset[]): UserPreset[] {
  const list: UserPreset[] = [];
  for (const p of raw) {
    if (p.presetType === 'task' || p.presetType === 'outcome') {
      list.push({
        ...p,
        text: p.text || '',
        categoryName: p.categoryName || '',
        plannedMinutes: p.plannedMinutes || 0,
      });
    } else {
      // Normalize any legacy combined preset document cleanly into separate entries
      if (p.taskText) {
        list.push({
          ...p,
          presetType: 'task',
          text: p.taskText,
          categoryName: p.categoryName || '',
          plannedMinutes: p.plannedMinutes || 0,
        });
      }
      if (p.outcomeText) {
        list.push({
          ...p,
          id: `${p.id}__outcome`,
          presetType: 'outcome',
          text: p.outcomeText,
          categoryName: p.categoryName || '',
          plannedMinutes: 0,
        });
      }
    }
  }
  return list.sort((a, b) => (a.text || '').localeCompare(b.text || ''));
}

export function sortPresetsAsc(presets: UserPreset[]): UserPreset[] {
  return normalizeAndSortPresets(presets);
}

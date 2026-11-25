/**
 * Security Rules Verification Specification (Dirty Dozen Payloads)
 * Designed for verification against @firebase/rules-unit-testing when emulator is available.
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'get' | 'list' | 'update' | 'delete';
  actorRole: 'employee' | 'admin' | 'unverified';
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin on Signup',
    collection: 'users',
    operation: 'create',
    actorRole: 'employee',
    payload: { uid: 'emp1', fullName: 'Attacker', employeeId: 'EMP001', email: 'a@corp.com', role: 'admin', accountStatus: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Role Escalation Update by Employee',
    collection: 'users',
    operation: 'update',
    actorRole: 'employee',
    payload: { role: 'super_admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Employee WorkLog Read',
    collection: 'workLogs',
    operation: 'get',
    actorRole: 'employee',
    payload: { targetEmployeeUid: 'emp2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field Injection on WorkLog',
    collection: 'workLogs',
    operation: 'create',
    actorRole: 'employee',
    payload: { employeeUid: 'emp1', ghostField: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Employee Self-Approving WorkLog Review',
    collection: 'workLogs',
    operation: 'update',
    actorRole: 'employee',
    payload: { reviewStatus: 'Approved', adminComment: 'LGTM' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Employee Deleting Submitted WorkLog',
    collection: 'workLogs',
    operation: 'delete',
    actorRole: 'employee',
    payload: { entryStatus: 'Submitted' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Employee Self-Approving Leave Request',
    collection: 'leaveRequests',
    operation: 'update',
    actorRole: 'employee',
    payload: { status: 'Approved' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Employee Creating Leave for Another UID',
    collection: 'leaveRequests',
    operation: 'create',
    actorRole: 'employee',
    payload: { employeeUid: 'emp2', status: 'Pending' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Employee Creating Company Holiday',
    collection: 'holidays',
    operation: 'create',
    actorRole: 'employee',
    payload: { date: '2026-12-25', name: 'Fake Holiday', type: 'Company Holiday' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Tampering with Immutable Audit Log',
    collection: 'auditLogs',
    operation: 'delete',
    actorRole: 'admin',
    payload: { auditId: 'audit1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Backdated Client Timestamp Forgery',
    collection: 'workLogs',
    operation: 'create',
    actorRole: 'employee',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Oversized Tasks String Resource Poisoning',
    collection: 'workLogs',
    operation: 'create',
    actorRole: 'employee',
    payload: { tasks: 'x'.repeat(20000) },
    expectedResult: 'PERMISSION_DENIED',
  },
];

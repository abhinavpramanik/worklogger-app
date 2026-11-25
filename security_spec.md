# WorkLog Security Specification (Phase 0)

## 1. Data Invariants

1. **Identity & Role Isolation (`users` & `employeeIdIndex`)**:
   - A user document `users/{userId}` can only be created for `request.auth.uid == userId`.
   - Public registration MUST strictly enforce `role == 'employee'` and `accountStatus == 'active'` (only the bootstrapped Super Admin email with `email_verified == true` may initialize as `super_admin`).
   - An employee CANNOT modify `uid`, `role`, `accountStatus`, `employeeId`, `email`, or `createdAt` on their own `users` profile.
   - Only an active `super_admin` can assign/revoke `admin` or `super_admin` roles or deactivate administrators. Active `admin` users can deactivate/reactivate `employee` accounts.
   - Employee IDs are reserved atomically in `employeeIdIndex/{empId}` so duplicate Employee IDs are rejected.

2. **WorkLog Ownership, State & Audit Integrity (`workLogs` & `auditLogs`)**:
   - All operational reads and writes require `request.auth.token.email_verified == true` and an `active` user account.
   - Employees can ONLY create, read, list, update (their own), and delete (only `entryStatus == 'Draft'`) work logs where `employeeUid == request.auth.uid`.
   - Employees CANNOT modify `reviewStatus`, `adminComment`, `reviewedBy`, or `reviewedAt` on a work log (except resetting `reviewStatus` to `'Pending Review'` when editing/resubmitting their own log or initializing as `'Pending Review'` on create).
   - Admins can read/list all work logs and update ONLY `reviewStatus`, `adminComment`, `reviewedBy`, `reviewedAt`, and `updatedAt`.
   - `auditLogs` are append-only (`allow update, delete: if false;`) and can only be read by Admins or the owning employee (`employeeUid == request.auth.uid`).

3. **Leave Request Integrity (`leaveRequests`)**:
   - Employees can create leave requests ONLY for themselves (`employeeUid == request.auth.uid`) with `status == 'Pending'` and empty `adminComment`.
   - Employees can edit or withdraw ONLY their own `Pending` leave requests (cannot set `status` to `'Approved'` or `'Rejected'`).
   - Employees CANNOT approve or reject their own leave requests; only active Admins can transition leave `status` to `'Approved'` or `'Rejected'` and attach `adminComment`, `reviewedBy`, `reviewedAt`.

4. **Holidays, Categories, Outcomes, and Settings**:
   - Only active Admins/Super Admins can create, update, or delete `categories`, `outcomeOptions`, and `holidays`.
   - Only active Super Admins can write `settings`.
   - Verified active employees can read `categories`, `outcomeOptions`, `holidays`, and `settings`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Assigned Admin on Signup**: `POST /users/{uid}` with `role: "admin"` or `role: "super_admin"` by non-bootstrapped user -> `PERMISSION_DENIED`.
2. **Role Escalation Update**: Employee sends `updateDoc(users/{uid}, { role: "super_admin" })` -> `PERMISSION_DENIED`.
3. **Cross-Employee WorkLog Read/List**: Employee A queries `workLogs` without `where("employeeUid", "==", uidA)` or reads `workLogs/{logOfB}` -> `PERMISSION_DENIED`.
4. **Shadow/Ghost Field Injection**: Creating a `workLogs` doc with extra field `isApprovedOverride: true` -> `PERMISSION_DENIED` (`hasOnly` check).
5. **Employee Self-Approving WorkLog Review**: Employee updates `workLogs/{id}` setting `reviewStatus: "Approved"` -> `PERMISSION_DENIED`.
6. **Deleting Submitted WorkLog**: Employee attempts `deleteDoc(workLogs/{id})` when `entryStatus == "Submitted"` -> `PERMISSION_DENIED`.
7. **Employee Self-Approving Leave**: Employee updates `leaveRequests/{id}` setting `status: "Approved"` -> `PERMISSION_DENIED`.
8. **Employee Creating Leave for Another UID**: Employee creates `leaveRequests` with `employeeUid: "victim_uid"` -> `PERMISSION_DENIED`.
9. **Employee Creating Company Holiday**: Employee attempts `addDoc(holidays, ...)` -> `PERMISSION_DENIED`.
10. **Tampering with Audit Trail**: Any user or admin attempts `updateDoc` or `deleteDoc` on `auditLogs/{id}` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery / Backdating**: Creating `workLogs` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Resource Poisoning / Oversized Path ID or String**: Writing document with 500-char ID or 20,000-char `tasks` field -> `PERMISSION_DENIED`.

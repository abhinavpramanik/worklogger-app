import React, { useState } from 'react';
import { CheckCircle2, Globe, Save, ShieldCheck, User } from 'lucide-react';
import { AccountStatus, UserProfile, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AVAILABLE_TIMEZONES } from '../lib/dateUtils';
import {
  superAdminUpdateUserRoleAndStatus,
  updateAppSettings,
  updateOwnProfile,
} from '../lib/firestoreService';

interface ProfileSettingsProps {
  mode: 'profile' | 'settings';
  employees?: UserProfile[];
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ mode, employees = [] }) => {
  const { userProfile, settings } = useAuth();

  // Own profile form
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [department, setDepartment] = useState(userProfile?.department || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  // Super Admin settings form
  const [orgName, setOrgName] = useState(settings.organizationName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [standardHours, setStandardHours] = useState(
    Math.round((settings.standardDailyMinutes || 480) / 60)
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [roleUpdatingUid, setRoleUpdatingUid] = useState<string | null>(null);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !fullName.trim()) return;
    setProfileSaving(true);
    setProfileSavedMsg(null);
    try {
      await updateOwnProfile(userProfile.uid, {
        fullName: fullName.trim(),
        department: department.trim(),
      });
      setProfileSavedMsg('Profile updated.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSettingsSaving(true);
    setSettingsSavedMsg(null);
    try {
      await updateAppSettings({
        organizationName: orgName.trim() || 'WorkLog Enterprise',
        timezone,
        standardDailyMinutes: Math.max(1, Math.min(16, standardHours)) * 60,
        requireEmailVerification: true,
      });
      setSettingsSavedMsg('Application settings saved.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleRoleChange = async (emp: UserProfile, role: UserRole) => {
    if (!isSuperAdmin || emp.uid === userProfile?.uid) return;
    setRoleUpdatingUid(emp.uid);
    try {
      await superAdminUpdateUserRoleAndStatus(emp.uid, {
        role,
        accountStatus: emp.accountStatus,
      });
    } finally {
      setRoleUpdatingUid(null);
    }
  };

  const handleStatusChange = async (emp: UserProfile, accountStatus: AccountStatus) => {
    if (!isSuperAdmin || emp.uid === userProfile?.uid) return;
    setRoleUpdatingUid(emp.uid);
    try {
      await superAdminUpdateUserRoleAndStatus(emp.uid, {
        role: emp.role,
        accountStatus,
      });
    } finally {
      setRoleUpdatingUid(null);
    }
  };

  if (mode === 'profile') {
    return (
      <div className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
            <User className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Employee Profile</h2>
            <p className="text-xs text-slate-500">
              Your Employee ID, Work Email, and Role are locked for security.
            </p>
          </div>
        </div>

        {profileSavedMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>{profileSavedMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Employee ID</label>
              <input
                type="text"
                disabled
                value={userProfile?.employeeId || ''}
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Work Email</label>
              <input
                type="text"
                disabled
                value={userProfile?.email || ''}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Access Role</label>
              <input
                type="text"
                disabled
                value={
                  userProfile?.role === 'super_admin'
                    ? 'Super Admin'
                    : userProfile?.role === 'admin'
                      ? 'Admin'
                      : 'Employee'
                }
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Application Settings (Super Admin Only Editable) */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Globe className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Application Settings</h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          {isSuperAdmin
            ? 'Configure organization-wide timezone and standard daily work hours.'
            : 'Only Super Admins can modify organization-wide application settings.'}
        </p>

        {settingsSavedMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4" />
            <span>{settingsSavedMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              disabled={!isSuperAdmin}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Application Timezone
            </label>
            <select
              disabled={!isSuperAdmin}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:bg-slate-50"
            >
              {AVAILABLE_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Standard Daily Work Hours
            </label>
            <input
              type="number"
              min={1}
              max={16}
              disabled={!isSuperAdmin}
              value={standardHours}
              onChange={(e) => setStandardHours(Number(e.target.value) || 8)}
              className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          {isSuperAdmin && (
            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {settingsSaving ? 'Saving Settings...' : 'Save Application Settings'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Role & Admin Access Control (Super Admin Only) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-blue-700" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Role &amp; Administrator Management
            </h3>
            <p className="text-xs text-slate-500">
              {isSuperAdmin
                ? 'Assign or revoke Admin privileges and manage administrator account status.'
                : 'Super Admin privileges are required to assign or revoke Admin roles.'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {employees.map((emp) => {
                const isSelf = emp.uid === userProfile?.uid;
                const disabled = !isSuperAdmin || isSelf || roleUpdatingUid === emp.uid;
                return (
                  <tr key={emp.uid} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {emp.fullName} {isSelf && <span className="text-xs text-slate-400">(You)</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{emp.employeeId}</td>
                    <td className="py-3 px-4 text-slate-600">{emp.email}</td>
                    <td className="py-3 px-4">
                      <select
                        disabled={disabled}
                        value={emp.role}
                        onChange={(e) => void handleRoleChange(emp, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        disabled={disabled}
                        value={emp.accountStatus}
                        onChange={(e) =>
                          void handleStatusChange(emp, e.target.value as AccountStatus)
                        }
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

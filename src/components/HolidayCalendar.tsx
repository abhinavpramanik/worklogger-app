import React, { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Trash2,
} from 'lucide-react';
import { HOLIDAY_TYPES, Holiday, HolidayType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateShort, getTodayInTimezone, isSundayDate } from '../lib/dateUtils';
import { createHoliday, deleteHoliday, updateHoliday } from '../lib/firestoreService';

interface HolidayCalendarProps {
  isAdminMode: boolean;
}

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({ isAdminMode }) => {
  const { userProfile, settings, holidays } = useAuth();
  const today = getTodayInTimezone(settings.timezone);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date(`${today}T00:00:00`));
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(today);
  const [name, setName] = useState('');
  const [type, setType] = useState<HolidayType>('Company Holiday');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const monthPrefix = format(currentMonth, 'yyyy-MM');

  const monthHolidays = useMemo(
    () =>
      holidays
        .filter((h) => h.date.startsWith(monthPrefix) && (isAdminMode || h.active))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, monthPrefix, isAdminMode]
  );

  const resetForm = () => {
    setEditingHoliday(null);
    setDate(today);
    setName('');
    setType('Company Holiday');
    setDescription('');
    setActive(true);
    setError(null);
    setShowForm(false);
  };

  const openAddForm = (prefillDate?: string) => {
    setEditingHoliday(null);
    setDate(prefillDate || today);
    setName('');
    setType('Company Holiday');
    setDescription('');
    setActive(true);
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (h: Holiday) => {
    setEditingHoliday(h);
    setDate(h.date);
    setName(h.name);
    setType(h.type);
    setDescription(h.description);
    setActive(h.active);
    setError(null);
    setShowForm(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setError(null);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Select a valid date.');
      return;
    }
    if (!name.trim()) {
      setError('Holiday name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, {
          date,
          name: name.trim(),
          type,
          description: description.trim(),
          active,
        });
      } else {
        await createHoliday({
          date,
          name: name.trim(),
          type,
          description: description.trim(),
          createdBy: userProfile.uid,
        });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!confirmDeleteId) return;
    setSaving(true);
    try {
      await deleteHoliday(confirmDeleteId);
      setConfirmDeleteId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Admin Add Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {isAdminMode ? 'Holiday Management & Calendar' : 'Organization Holiday Calendar'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sundays are automatically recognized as Weekly Holidays. Configured company and public holidays appear below.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-l-lg"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-1.5 text-sm font-semibold text-slate-900 min-w-[140px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-r-lg"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isAdminMode && (
            <button
              type="button"
              onClick={() => openAddForm()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Admin Add/Edit Holiday Form */}
      {isAdminMode && showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            {editingHoliday ? 'Edit Holiday' : 'Add Company / Public Holiday'}
          </h3>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <form onSubmit={handleSaveHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Holiday Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company Foundation Day"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Classification</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HolidayType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {HOLIDAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={active ? 'active' : 'inactive'}
                onChange={(e) => setActive(e.target.value === 'active')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes or regional applicability"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingHoliday ? 'Update' : 'Save Holiday'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="py-2 px-3 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visual Calendar Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2.5 px-3 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
          {calendarDays.map((dayObj) => {
            const iso = format(dayObj, 'yyyy-MM-dd');
            const inMonth = isSameMonth(dayObj, currentMonth);
            const isToday = iso === today;
            const sunday = isSundayDate(iso);
            const dayHolidays = holidays.filter((h) => h.date === iso && (isAdminMode || h.active));

            return (
              <div
                key={iso}
                onClick={() => {
                  if (isAdminMode && inMonth) openAddForm(iso);
                }}
                className={`min-h-[92px] p-2 transition-colors ${
                  !inMonth
                    ? 'bg-slate-50/70 text-slate-400'
                    : sunday
                      ? 'bg-slate-50'
                      : 'bg-white'
                } ${isAdminMode && inMonth ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-mono tabular-nums ${
                      isToday
                        ? 'px-1.5 py-0.5 rounded bg-blue-700 text-white font-semibold'
                        : inMonth
                          ? 'text-slate-700 font-medium'
                          : 'text-slate-400'
                    }`}
                  >
                    {format(dayObj, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {sunday && inMonth && (
                    <p className="text-[11px] leading-tight font-medium text-slate-500 truncate">
                      Weekly Sunday
                    </p>
                  )}
                  {dayHolidays.map((h) => (
                    <p
                      key={h.id}
                      className={`text-[11px] leading-tight font-medium truncate ${
                        h.active ? 'text-teal-800' : 'text-slate-400 line-through'
                      }`}
                      title={`${h.name} (${h.type})`}
                    >
                      {h.name}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configured Holidays Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">
              Configured Holidays ({format(currentMonth, 'MMMM yyyy')})
            </h3>
          </div>
          <span className="text-xs text-slate-500">All Sundays are auto-included</span>
        </div>
        {monthHolidays.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No company or public holidays configured for {format(currentMonth, 'MMMM yyyy')}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Holiday Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Status</th>
                  {isAdminMode && <th className="py-2.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {monthHolidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {formatDateShort(h.date)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{h.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">{h.type}</td>
                    <td className="py-3 px-4 text-slate-600">{h.description || '-'}</td>
                    <td className="py-3 px-4 text-xs">
                      <span className={h.active ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                        {h.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdminMode && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditForm(h)}
                          className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
                          title="Edit Holiday"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(h.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 ml-1"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete Holiday?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This holiday will be removed from employee calendars and future reports.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeleteHoliday()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {saving ? 'Deleting...' : 'Delete Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

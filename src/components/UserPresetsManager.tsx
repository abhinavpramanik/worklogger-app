import React, { useMemo, useState } from 'react';
import { BookmarkPlus, CheckSquare, Edit3, Plus, Target, Trash2 } from 'lucide-react';
import { PresetType, UserPreset, VALIDATION_LIMITS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDurationHrs, splitMinutes } from '../lib/dateUtils';
import { createUserPreset, deleteUserPreset, updateUserPreset } from '../lib/firestoreService';

export const UserPresetsManager: React.FC = () => {
  const { userProfile, userPresets, categories } = useAuth();

  const [activeTab, setActiveTab] = useState<PresetType>('task');
  const [editingPreset, setEditingPreset] = useState<UserPreset | null>(null);

  // Task Preset form state
  const [taskText, setTaskText] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [plannedHours, setPlannedHours] = useState(0);
  const [plannedMins, setPlannedMins] = useState(30);

  // Outcome Preset form state
  const [outcomeText, setOutcomeText] = useState('');
  const [outcomeCategory, setOutcomeCategory] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<UserPreset | null>(null);

  const taskPresets = useMemo(
    () => userPresets.filter((p) => p.presetType === 'task'),
    [userPresets]
  );

  const outcomePresets = useMemo(
    () => userPresets.filter((p) => p.presetType === 'outcome'),
    [userPresets]
  );

  const categorySuggestions = useMemo(() => {
    const names = new Set<string>();
    categories.filter((c) => c.active).forEach((c) => names.add(c.name));
    userPresets.forEach((p) => {
      if (p.categoryName) names.add(p.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, userPresets]);

  const resetForms = () => {
    setEditingPreset(null);
    setTaskText('');
    setTaskCategory('');
    setPlannedHours(0);
    setPlannedMins(30);
    setOutcomeText('');
    setOutcomeCategory('');
    setError(null);
  };

  const openEdit = (preset: UserPreset) => {
    setEditingPreset(preset);
    setActiveTab(preset.presetType);
    setError(null);
    if (preset.presetType === 'task') {
      setTaskText(preset.text);
      setTaskCategory(preset.categoryName || '');
      const p = splitMinutes(preset.plannedMinutes);
      setPlannedHours(p.hours);
      setPlannedMins(p.minutes);
    } else {
      setOutcomeText(preset.text);
      setOutcomeCategory(preset.categoryName || '');
    }
  };

  const handleSaveTaskPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setError(null);

    if (!taskText.trim()) {
      setError('Task description is required.');
      return;
    }

    const totalPlanned = Math.max(0, Math.min(1440, (plannedHours || 0) * 60 + (plannedMins || 0)));

    setSaving(true);
    try {
      const isLegacy = editingPreset && Boolean(editingPreset.taskText || editingPreset.outcomeText);
      if (editingPreset && !isLegacy) {
        await updateUserPreset(editingPreset.id, {
          presetType: 'task',
          text: taskText.trim(),
          categoryName: taskCategory.trim(),
          plannedMinutes: totalPlanned,
        });
      } else {
        await createUserPreset(userProfile.uid, {
          presetType: 'task',
          text: taskText.trim(),
          categoryName: taskCategory.trim(),
          plannedMinutes: totalPlanned,
        });
        if (editingPreset && !editingPreset.id.endsWith('__outcome')) {
          await deleteUserPreset(editingPreset.id);
        }
      }
      resetForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task preset.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOutcomePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setError(null);

    if (!outcomeText.trim()) {
      setError('Outcome description is required.');
      return;
    }

    setSaving(true);
    try {
      const isLegacy =
        editingPreset &&
        (editingPreset.id.endsWith('__outcome') || Boolean(editingPreset.taskText || editingPreset.outcomeText));
      if (editingPreset && !isLegacy) {
        await updateUserPreset(editingPreset.id, {
          presetType: 'outcome',
          text: outcomeText.trim(),
          categoryName: outcomeCategory.trim(),
          plannedMinutes: 0,
        });
      } else {
        await createUserPreset(userProfile.uid, {
          presetType: 'outcome',
          text: outcomeText.trim(),
          categoryName: outcomeCategory.trim(),
          plannedMinutes: 0,
        });
      }
      resetForms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save outcome preset.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeletePreset) return;
    setSaving(true);
    try {
      const rawId = confirmDeletePreset.id.replace(/__outcome$/, '');
      await deleteUserPreset(rawId);
      setConfirmDeletePreset(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <datalist id="preset-category-suggestions">
        {categorySuggestions.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Header + Separate Preset Type Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <BookmarkPlus className="w-5 h-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-slate-900">
                My Task &amp; Outcome Presets
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Create separate reusable presets for Tasks and Outcomes. In the Work Log form, you can select independently from both lists or type custom text.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('task');
                resetForms();
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'task'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Task Presets ({taskPresets.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('outcome');
                resetForms();
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'outcome'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Outcome Presets ({outcomePresets.length})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {activeTab === 'task' ? (
          <form onSubmit={handleSaveTaskPreset} className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingPreset?.presetType === 'task' ? 'Edit Task Preset' : 'Add New Task Preset'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Task Name / Description
                </label>
                <input
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.TASKS_MAX}
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  placeholder="e.g., Prepared for Online Demo, Upskilling in Math Code implementation"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Default Category (Optional)
                </label>
                <input
                  type="text"
                  list="preset-category-suggestions"
                  maxLength={VALIDATION_LIMITS.CATEGORY_NAME_MAX}
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  placeholder="e.g., NIAT - Learnings"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Default Planned Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={plannedHours}
                      onChange={(e) =>
                        setPlannedHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)))
                      }
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      h
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={plannedMins}
                      onChange={(e) =>
                        setPlannedMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                      }
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      m
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving
                  ? 'Saving...'
                  : editingPreset?.presetType === 'task'
                    ? 'Update Task Preset'
                    : 'Save Task Preset'}
              </button>
              {editingPreset?.presetType === 'task' && (
                <button
                  type="button"
                  onClick={resetForms}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveOutcomePreset} className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingPreset?.presetType === 'outcome'
                ? 'Edit Outcome Preset'
                : 'Add New Outcome Preset'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Outcome Description (As specific as Possible)
                </label>
                <input
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.OUTCOME_MAX}
                  value={outcomeText}
                  onChange={(e) => setOutcomeText(e.target.value)}
                  placeholder="e.g., Watched Lecture, Revised the PPT, Prepared Pedagogical techniques for session"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category Tag (Optional)
                </label>
                <input
                  type="text"
                  list="preset-category-suggestions"
                  maxLength={VALIDATION_LIMITS.CATEGORY_NAME_MAX}
                  value={outcomeCategory}
                  onChange={(e) => setOutcomeCategory(e.target.value)}
                  placeholder="e.g., NIAT - Learnings"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving
                  ? 'Saving...'
                  : editingPreset?.presetType === 'outcome'
                    ? 'Update Outcome Preset'
                    : 'Save Outcome Preset'}
              </button>
              {editingPreset?.presetType === 'outcome' && (
                <button
                  type="button"
                  onClick={resetForms}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Side-by-Side Lists: Saved Task Presets & Saved Outcome Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saved Task Presets */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-700" />
              Task Presets ({taskPresets.length})
            </h3>
          </div>
          {taskPresets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No task presets saved yet. Add your frequent tasks above.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {taskPresets.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3.5 hover:bg-slate-50 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{p.text}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      {p.categoryName ? `${p.categoryName} · ` : ''}
                      Planned: {formatDurationHrs(p.plannedMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
                      title="Edit Task Preset"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePreset(p)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete Task Preset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Outcome Presets */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-700" />
              Outcome Presets ({outcomePresets.length})
            </h3>
          </div>
          {outcomePresets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No outcome presets saved yet. Add your frequent outcomes using the Outcome Presets tab above.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {outcomePresets.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3.5 hover:bg-slate-50 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{p.text}</p>
                    {p.categoryName && (
                      <p className="text-xs text-slate-500 mt-0.5">{p.categoryName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50"
                      title="Edit Outcome Preset"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePreset(p)}
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete Outcome Preset"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDeletePreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Delete {confirmDeletePreset.presetType === 'task' ? 'Task' : 'Outcome'} Preset?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              This preset will be removed from your personal presets list. Existing work logs are unaffected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeletePreset(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {saving ? 'Deleting...' : 'Delete Preset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

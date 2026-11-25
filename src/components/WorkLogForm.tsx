import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import {
  Holiday,
  TASK_STATUSES,
  TaskStatus,
  UserPreset,
  VALIDATION_LIMITS,
  WorkLog,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  calculateActualMinutes,
  formatDurationHrs,
  formatTime12h,
  getTodayInTimezone,
  isSundayDate,
  splitMinutes,
} from '../lib/dateUtils';
import {
  createUserPreset,
  createWorkLogDraft,
  deleteWorkLog,
  submitWorkLog,
  updateWorkLogDraft,
  WorkLogInputPayload,
} from '../lib/firestoreService';

interface WorkLogFormProps {
  initialLog: WorkLog | null;
  copiedFromLog?: WorkLog | null;
  draftLogs: WorkLog[];
  holidays: Holiday[];
  onOpenCopyModal: () => void;
  onSelectDraft: (draft: WorkLog) => void;
  onSavedSuccess: () => void;
  onCancel: () => void;
}

type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

export const WorkLogForm: React.FC<WorkLogFormProps> = ({
  initialLog,
  copiedFromLog,
  draftLogs,
  holidays,
  onOpenCopyModal,
  onSelectDraft,
  onSavedSuccess,
  onCancel,
}) => {
  const { userProfile, settings, categories, userPresets } = useAuth();
  const today = getTodayInTimezone(settings.timezone);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active),
    [categories]
  );

  const [activeDocId, setActiveDocId] = useState<string | null>(initialLog?.id ?? null);
  const [activeSnapshot, setActiveSnapshot] = useState<WorkLog | null>(initialLog);
  const isEditingSubmitted = activeSnapshot?.entryStatus === 'Submitted';

  const [date, setDate] = useState<string>(initialLog?.date || today);
  const [categoryName, setCategoryName] = useState<string>(
    initialLog?.categoryName ||
      copiedFromLog?.categoryName ||
      activeCategories[0]?.name ||
      'NIAT - Learnings'
  );
  const [tasks, setTasks] = useState<string>(initialLog?.tasks || copiedFromLog?.tasks || '');
  const [outcome, setOutcome] = useState<string>(
    initialLog?.outcome || initialLog?.customOutcome || copiedFromLog?.outcome || copiedFromLog?.customOutcome || ''
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialLog?.status || (copiedFromLog ? 'Not Started' : 'Completed')
  );

  const initPlanned = splitMinutes(initialLog?.plannedMinutes ?? copiedFromLog?.plannedMinutes ?? 0);
  const [plannedHours, setPlannedHours] = useState<number>(initPlanned.hours);
  const [plannedMins, setPlannedMins] = useState<number>(initPlanned.minutes);

  const [startTime, setStartTime] = useState<string>(initialLog?.startTime || '');
  const [endTime, setEndTime] = useState<string>(initialLog?.endTime || '');

  const initBreak = splitMinutes(initialLog?.breakMinutes ?? copiedFromLog?.breakMinutes ?? 0);
  const [breakHours, setBreakHours] = useState<number>(initBreak.hours);
  const [breakMins, setBreakMins] = useState<number>(initBreak.minutes);

  const [draftState, setDraftState] = useState<DraftSaveState>('idle');
  const [draftErrorMsg, setDraftErrorMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const [savingTaskPreset, setSavingTaskPreset] = useState(false);
  const [savingOutcomePreset, setSavingOutcomePreset] = useState(false);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);

  const isDirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const saveLockRef = useRef(false);

  // Separate Task Presets and Outcome Presets owned by the user
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
    activeCategories.forEach((c) => names.add(c.name));
    userPresets.forEach((p) => {
      if (p.categoryName) names.add(p.categoryName);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [activeCategories, userPresets]);

  useEffect(() => {
    setActiveDocId(initialLog?.id ?? null);
    setActiveSnapshot(initialLog);
    setDate(initialLog?.date || today);
    setCategoryName(
      initialLog?.categoryName ||
        copiedFromLog?.categoryName ||
        activeCategories[0]?.name ||
        ''
    );
    setTasks(initialLog?.tasks || copiedFromLog?.tasks || '');
    setOutcome(
      initialLog?.customOutcome ||
        initialLog?.outcome ||
        copiedFromLog?.customOutcome ||
        copiedFromLog?.outcome ||
        ''
    );
    setStatus(initialLog?.status || (copiedFromLog ? 'Not Started' : 'Completed'));

    const p = splitMinutes(initialLog?.plannedMinutes ?? copiedFromLog?.plannedMinutes ?? 0);
    setPlannedHours(p.hours);
    setPlannedMins(p.minutes);
    setStartTime(initialLog?.startTime || '');
    setEndTime(initialLog?.endTime || '');

    const b = splitMinutes(initialLog?.breakMinutes ?? copiedFromLog?.breakMinutes ?? 0);
    setBreakHours(b.hours);
    setBreakMins(b.minutes);
    setDraftState(initialLog?.entryStatus === 'Draft' ? 'saved' : 'idle');
    setSubmitError(null);
    setDraftErrorMsg(null);
    setPresetNotice(null);
    isDirtyRef.current = Boolean(copiedFromLog);
  }, [initialLog, copiedFromLog, today]);

  const plannedMinutes = Math.max(0, (Number(plannedHours) || 0) * 60 + (Number(plannedMins) || 0));
  const breakMinutes = Math.max(0, (Number(breakHours) || 0) * 60 + (Number(breakMins) || 0));
  const timeCalc = useMemo(
    () => calculateActualMinutes(startTime, endTime, breakMinutes),
    [startTime, endTime, breakMinutes]
  );

  const dateContextNotices = useMemo(() => {
    const notices: string[] = [];
    if (isSundayDate(date)) {
      notices.push('Selected date is a Sunday (Weekly Holiday). Work logs are optional.');
    }
    const dayHolidays = holidays.filter((h) => h.active && h.date === date);
    dayHolidays.forEach((h) => {
      notices.push(`Holiday on ${date}: ${h.name} (${h.type}). Work logs are optional.`);
    });
    return notices;
  }, [date, holidays]);

  const buildPayload = useCallback((): WorkLogInputPayload => {
    const matchedCat = activeCategories.find(
      (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
    );
    return {
      date,
      categoryId: matchedCat?.id || 'custom',
      categoryName: categoryName.trim() || 'General',
      tasks,
      outcome: outcome.trim(),
      customOutcome: '',
      status,
      plannedMinutes,
      startTime,
      endTime,
      breakMinutes,
      actualMinutes: timeCalc.isValid ? timeCalc.actualMinutes : 0,
    };
  }, [
    date,
    activeCategories,
    categoryName,
    tasks,
    outcome,
    status,
    plannedMinutes,
    startTime,
    endTime,
    breakMinutes,
    timeCalc,
  ]);

  const performAutoSave = useCallback(async () => {
    if (!userProfile || isEditingSubmitted || submitting) return;
    if (saveLockRef.current) return;

    const payload = buildPayload();
    const hasMeaningfulInput =
      payload.tasks.trim().length > 0 ||
      payload.outcome.trim().length > 0 ||
      payload.plannedMinutes > 0 ||
      payload.startTime !== '' ||
      payload.endTime !== '';

    if (!hasMeaningfulInput && !activeDocId) return;

    saveLockRef.current = true;
    setDraftState('saving');
    setDraftErrorMsg(null);

    try {
      if (activeDocId) {
        await updateWorkLogDraft(activeDocId, userProfile, payload);
      } else {
        const newId = await createWorkLogDraft(userProfile, payload);
        setActiveDocId(newId);
      }
      isDirtyRef.current = false;
      setDraftState('saved');
    } catch (err) {
      setDraftState('error');
      setDraftErrorMsg(err instanceof Error ? err.message : 'Network error saving draft.');
    } finally {
      saveLockRef.current = false;
    }
  }, [userProfile, isEditingSubmitted, submitting, buildPayload, activeDocId]);

  useEffect(() => {
    if (isEditingSubmitted || !isDirtyRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void performAutoSave();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    date,
    categoryName,
    tasks,
    outcome,
    status,
    plannedHours,
    plannedMins,
    startTime,
    endTime,
    breakHours,
    breakMins,
    isEditingSubmitted,
    performAutoSave,
  ]);

  const markDirty = () => {
    isDirtyRef.current = true;
  };

  // Independent Task Preset selection
  const applyTaskPreset = (presetId: string) => {
    const preset = taskPresets.find((p) => p.id === presetId);
    if (!preset) return;
    setTasks(preset.text);
    if (preset.categoryName) setCategoryName(preset.categoryName);
    if (preset.plannedMinutes > 0) {
      const p = splitMinutes(preset.plannedMinutes);
      setPlannedHours(p.hours);
      setPlannedMins(p.minutes);
    }
    markDirty();
  };

  // Independent Outcome Preset selection
  const applyOutcomePreset = (presetId: string) => {
    const preset = outcomePresets.find((p) => p.id === presetId);
    if (!preset) return;
    setOutcome(preset.text);
    if (!categoryName.trim() && preset.categoryName) {
      setCategoryName(preset.categoryName);
    }
    markDirty();
  };

  const handleSaveTaskPreset = async () => {
    if (!userProfile || !tasks.trim()) return;
    setSavingTaskPreset(true);
    setPresetNotice(null);
    try {
      await createUserPreset(userProfile.uid, {
        presetType: 'task',
        text: tasks.trim(),
        categoryName: categoryName.trim(),
        plannedMinutes,
      });
      setPresetNotice('Task saved to My Task Presets.');
      window.setTimeout(() => setPresetNotice(null), 3000);
    } finally {
      setSavingTaskPreset(false);
    }
  };

  const handleSaveOutcomePreset = async () => {
    if (!userProfile || !outcome.trim()) return;
    setSavingOutcomePreset(true);
    setPresetNotice(null);
    try {
      await createUserPreset(userProfile.uid, {
        presetType: 'outcome',
        text: outcome.trim(),
        categoryName: categoryName.trim(),
        plannedMinutes: 0,
      });
      setPresetNotice('Outcome saved to My Outcome Presets.');
      window.setTimeout(() => setPresetNotice(null), 3000);
    } finally {
      setSavingOutcomePreset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSubmitError(null);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSubmitError('Please select a valid date.');
      return;
    }
    if (!categoryName.trim()) {
      setSubmitError('Please enter or select a category.');
      return;
    }
    if (!tasks.trim()) {
      setSubmitError('Please enter or choose a task.');
      return;
    }
    if (!outcome.trim()) {
      setSubmitError('Please enter or choose an outcome.');
      return;
    }
    if (!timeCalc.isValid) {
      setSubmitError(timeCalc.error || 'Please verify start time, end time, and break duration.');
      return;
    }
    if (plannedMinutes > 1440) {
      setSubmitError('Planned time cannot exceed 24 hours per entry.');
      return;
    }

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    setSubmitting(true);
    try {
      await submitWorkLog({
        existingLogId: activeDocId,
        existingLogSnapshot: activeSnapshot,
        user: userProfile,
        input: buildPayload(),
      });
      isDirtyRef.current = false;
      onSavedSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save work log.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscardOrDelete = async () => {
    if (!activeDocId) return;
    setDiscarding(true);
    try {
      await deleteWorkLog(activeDocId);
      setConfirmDiscard(false);
      onSavedSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isEditingSubmitted && draftLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 mb-2.5">
            <span className="text-xs font-semibold text-slate-700">
              Saved Drafts ({draftLogs.length})
            </span>
            <span className="text-xs text-slate-500">Click any draft to resume editing</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {draftLogs.map((d) => {
              const isCurrent = d.id === activeDocId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDraft(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors text-left max-w-xs truncate ${
                    isCurrent
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono">{d.date}</span> · {d.categoryName || 'Uncategorized'} ·{' '}
                  {d.tasks ? d.tasks.slice(0, 28) : 'Untitled draft'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Form Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEditingSubmitted
                ? 'Edit Work Log'
                : activeDocId
                  ? 'Resume Draft Work Log'
                  : 'New Work Log Entry'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditingSubmitted
                ? 'You can update your tasks, outcomes, and times freely at any time without needing admin review.'
                : 'Select independently from your Task Presets and Outcome Presets, or type freely. Drafts auto-save.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isEditingSubmitted && (
              <div className="flex items-center gap-1.5 text-xs">
                {draftState === 'saving' && (
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                    Saving...
                  </span>
                )}
                {draftState === 'saved' && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Draft saved
                  </span>
                )}
                {draftState === 'error' && (
                  <button
                    type="button"
                    onClick={() => void performAutoSave()}
                    className="inline-flex items-center gap-1.5 text-red-700 font-medium hover:underline"
                    title={draftErrorMsg || 'Retry saving draft'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Failed to save. Retry
                  </button>
                )}
              </div>
            )}

            {!isEditingSubmitted && (
              <button
                type="button"
                onClick={onOpenCopyModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Previous Work Log
              </button>
            )}
          </div>
        </div>

        {dateContextNotices.length > 0 && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-blue-50 border border-blue-200 space-y-1 text-xs text-blue-900">
            {dateContextNotices.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        )}

        {submitError && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  markDirty();
                }}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <input
                type="text"
                required
                list="worklog-category-suggestions"
                maxLength={VALIDATION_LIMITS.CATEGORY_NAME_MAX}
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  markDirty();
                }}
                placeholder="e.g., NIAT - Learnings"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <datalist id="worklog-category-suggestions">
                {categorySuggestions.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as TaskStatus);
                  markDirty();
                }}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {TASK_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks: Select from Task Presets OR type freely */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Tasks</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) applyTaskPreset(e.target.value);
                  }}
                  aria-label="Select from My Task Presets"
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 max-w-xs"
                >
                  <option value="">
                    {taskPresets.length > 0
                      ? 'Select from Task Presets...'
                      : 'No Task Presets saved yet'}
                  </option>
                  {taskPresets.map((p: UserPreset) => (
                    <option key={p.id} value={p.id}>
                      {p.text.slice(0, 64)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!tasks.trim() || savingTaskPreset}
                  onClick={() => void handleSaveTaskPreset()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-40"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  {savingTaskPreset ? 'Saving...' : 'Save as Task Preset'}
                </button>
              </div>
            </div>
            <input
              type="text"
              maxLength={VALIDATION_LIMITS.TASKS_MAX}
              value={tasks}
              onChange={(e) => {
                setTasks(e.target.value);
                markDirty();
              }}
              placeholder="Type your task or pick from Task Presets above..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Outcome: Select from Outcome Presets OR type freely */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">
                Outcome (As specific as Possible)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) applyOutcomePreset(e.target.value);
                  }}
                  aria-label="Select from My Outcome Presets"
                  className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 max-w-xs"
                >
                  <option value="">
                    {outcomePresets.length > 0
                      ? 'Select from Outcome Presets...'
                      : 'No Outcome Presets saved yet'}
                  </option>
                  {outcomePresets.map((p: UserPreset) => (
                    <option key={p.id} value={p.id}>
                      {p.text.slice(0, 64)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!outcome.trim() || savingOutcomePreset}
                  onClick={() => void handleSaveOutcomePreset()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 disabled:opacity-40"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  {savingOutcomePreset ? 'Saving...' : 'Save as Outcome Preset'}
                </button>
              </div>
            </div>
            <textarea
              rows={2}
              maxLength={VALIDATION_LIMITS.OUTCOME_MAX}
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                markDirty();
              }}
              placeholder="Type your specific outcome or pick from Outcome Presets above..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {presetNotice && (
              <p className="text-xs text-emerald-700 font-medium">{presetNotice}</p>
            )}
          </div>

          {/* Time Tracking Section */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Time &amp; Duration Tracking
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Total Planned Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={plannedHours}
                      onChange={(e) => {
                        setPlannedHours(Math.max(0, Math.min(24, Number(e.target.value) || 0)));
                        markDirty();
                      }}
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                      onChange={(e) => {
                        setPlannedMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)));
                        markDirty();
                      }}
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      m
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  {formatDurationHrs(plannedMinutes)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {startTime && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {formatTime12h(startTime)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    markDirty();
                  }}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                {endTime && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {formatTime12h(endTime)} {timeCalc.isOvernight && timeCalc.isValid ? '(+24h)' : ''}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Break Duration (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={breakHours}
                      onChange={(e) => {
                        setBreakHours(Math.max(0, Math.min(12, Number(e.target.value) || 0)));
                        markDirty();
                      }}
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                      value={breakMins}
                      onChange={(e) => {
                        setBreakMins(Math.max(0, Math.min(59, Number(e.target.value) || 0)));
                        markDirty();
                      }}
                      className="w-full pl-3 pr-7 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      m
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  {formatDurationHrs(breakMinutes)}
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500">Total Actual Time (Auto-calculated)</span>
                <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                  {timeCalc.isValid ? formatDurationHrs(timeCalc.actualMinutes) : 'Invalid range'}
                </p>
              </div>
              {!timeCalc.isValid && (
                <span className="text-xs font-medium text-red-700">{timeCalc.error}</span>
              )}
              {timeCalc.isValid && (
                <div className="text-xs text-slate-600 font-mono tabular-nums">
                  Planned {formatDurationHrs(plannedMinutes)} · Actual {formatDurationHrs(timeCalc.actualMinutes)}
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {activeDocId && (
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isEditingSubmitted ? 'Delete Entry' : 'Discard Draft'}
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-3">
              {!isEditingSubmitted && (
                <button
                  type="button"
                  disabled={draftState === 'saving' || submitting}
                  onClick={() => {
                    isDirtyRef.current = true;
                    void performAutoSave();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Draft Now
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                {isEditingSubmitted ? <FileText className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {submitting
                  ? 'Saving...'
                  : isEditingSubmitted
                    ? 'Save Changes'
                    : 'Save Work Log'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              {isEditingSubmitted ? 'Delete Work Log Entry?' : 'Discard Draft Work Log?'}
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              This work log entry will be permanently removed from Firestore.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={discarding}
                onClick={() => void handleDiscardOrDelete()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {discarding ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

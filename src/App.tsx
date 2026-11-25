import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AppView, UserProfile, WorkLog } from './types';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { sortWorkLogsDesc } from './lib/firestoreService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  AuthPages,
  CompleteProfileGate,
  EmailVerificationGate,
  InactiveAccountGate,
} from './components/AuthPages';
import { Layout } from './components/Layout';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { WorkLogForm } from './components/WorkLogForm';
import { WorkLogHistory } from './components/WorkLogHistory';
import { UserPresetsManager } from './components/UserPresetsManager';
import { CopyPreviousModal } from './components/CopyPreviousModal';
import { HolidayCalendar } from './components/HolidayCalendar';
import { ExportReports } from './components/ExportReports';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminWorkLogs } from './components/AdminWorkLogs';
import { AdminCategoriesOutcomes } from './components/AdminCategoriesOutcomes';
import { ProfileSettings } from './components/ProfileSettings';

const AuthenticatedWorkspace: React.FC = () => {
  const { userProfile, categories, holidays } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const [currentView, setCurrentView] = useState<AppView>(() =>
    isAdmin ? 'admin-dashboard' : 'employee-dashboard'
  );

  // Personal employee streams
  const [myWorkLogs, setMyWorkLogs] = useState<WorkLog[]>([]);
  const [myDataLoading, setMyDataLoading] = useState(true);

  // Admin organization-wide streams
  const [allEmployees, setAllEmployees] = useState<UserProfile[]>([]);
  const [allWorkLogs, setAllWorkLogs] = useState<WorkLog[]>([]);

  // Work log form / copy state
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [copiedFromLog, setCopiedFromLog] = useState<WorkLog | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  // Subscribe to employee's own workLogs
  useEffect(() => {
    if (!userProfile) return;
    setMyDataLoading(true);

    const unsubLogs = onSnapshot(
      query(collection(db, 'workLogs'), where('employeeUid', '==', userProfile.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WorkLog, 'id'>),
        }));
        setMyWorkLogs(sortWorkLogsDesc(list));
        setMyDataLoading(false);
      },
      (error) => {
        setMyDataLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'workLogs');
      }
    );

    return () => {
      unsubLogs();
    };
  }, [userProfile]);

  // Subscribe to admin streams when user is Admin or Super Admin
  useEffect(() => {
    if (!userProfile || !isAdmin) {
      setAllEmployees([]);
      setAllWorkLogs([]);
      return;
    }

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserProfile)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setAllEmployees(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    const unsubAllLogs = onSnapshot(
      collection(db, 'workLogs'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WorkLog, 'id'>),
        }));
        setAllWorkLogs(sortWorkLogsDesc(list));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'workLogs')
    );

    return () => {
      unsubUsers();
      unsubAllLogs();
    };
  }, [userProfile, isAdmin]);

  const draftLogs = useMemo(
    () => myWorkLogs.filter((l) => l.entryStatus === 'Draft'),
    [myWorkLogs]
  );

  const handleNavigate = (view: AppView) => {
    if (view.startsWith('admin-') && !isAdmin) {
      setCurrentView('employee-dashboard');
      return;
    }
    setCurrentView(view);
  };

  const handleStartNewWorkLog = () => {
    setEditingLog(null);
    setCopiedFromLog(null);
    setCurrentView('add-work-log');
  };

  const handleEditLog = (log: WorkLog) => {
    setCopiedFromLog(null);
    setEditingLog(log);
    setCurrentView('add-work-log');
  };

  const handleCopyLog = (source: WorkLog) => {
    setEditingLog(null);
    setCopiedFromLog(source);
    setCurrentView('add-work-log');
  };

  const safeView: AppView =
    currentView.startsWith('admin-') && !isAdmin ? 'employee-dashboard' : currentView;

  return (
    <Layout
      currentView={safeView}
      onNavigate={handleNavigate}
      onNewWorkLog={handleStartNewWorkLog}
    >
      {safeView === 'employee-dashboard' && (
        <EmployeeDashboard
          workLogs={myWorkLogs}
          holidays={holidays}
          loading={myDataLoading}
          onNavigate={handleNavigate}
          onNewWorkLog={handleStartNewWorkLog}
          onEditLog={handleEditLog}
          onOpenCopyModal={() => setCopyModalOpen(true)}
        />
      )}

      {safeView === 'add-work-log' && (
        <WorkLogForm
          initialLog={editingLog}
          copiedFromLog={copiedFromLog}
          draftLogs={draftLogs}
          holidays={holidays}
          onOpenCopyModal={() => setCopyModalOpen(true)}
          onSelectDraft={(draft) => {
            setCopiedFromLog(null);
            setEditingLog(draft);
          }}
          onSavedSuccess={() => {
            setEditingLog(null);
            setCopiedFromLog(null);
            setCurrentView('work-log-history');
          }}
          onCancel={() => {
            setEditingLog(null);
            setCopiedFromLog(null);
            setCurrentView('employee-dashboard');
          }}
        />
      )}

      {safeView === 'work-log-history' && (
        <WorkLogHistory
          workLogs={myWorkLogs}
          holidays={holidays}
          onEditLog={handleEditLog}
          onDuplicateLog={handleCopyLog}
        />
      )}

      {safeView === 'my-presets' && <UserPresetsManager />}

      {safeView === 'holiday-calendar' && <HolidayCalendar isAdminMode={false} />}

      {safeView === 'export-reports' && (
        <ExportReports
          isAdminMode={false}
          workLogs={myWorkLogs}
          employees={userProfile ? [userProfile] : []}
        />
      )}

      {safeView === 'profile' && <ProfileSettings mode="profile" />}

      {safeView === 'admin-dashboard' && isAdmin && (
        <AdminDashboard
          employees={allEmployees}
          workLogs={allWorkLogs}
        />
      )}

      {safeView === 'admin-employees' && isAdmin && (
        <AdminDashboard
          employees={allEmployees}
          workLogs={allWorkLogs}
          showEmployeesTableOnly
        />
      )}

      {safeView === 'admin-all-logs' && isAdmin && (
        <AdminWorkLogs workLogs={allWorkLogs} />
      )}

      {safeView === 'admin-holidays' && isAdmin && (
        <HolidayCalendar isAdminMode />
      )}

      {safeView === 'admin-categories' && isAdmin && (
        <AdminCategoriesOutcomes />
      )}

      {safeView === 'admin-reports' && isAdmin && (
        <ExportReports
          isAdminMode
          workLogs={allWorkLogs}
          employees={allEmployees}
        />
      )}

      {safeView === 'admin-settings' && isAdmin && (
        <ProfileSettings mode="settings" employees={allEmployees} />
      )}

      <CopyPreviousModal
        isOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        workLogs={myWorkLogs}
        categories={categories}
        onSelectCopy={handleCopyLog}
      />
    </Layout>
  );
};

const AppRouter: React.FC = () => {
  const { firebaseUser, userProfile, authReady, profileLoading, needsProfileSetup } = useAuth();

  if (!authReady || (firebaseUser && profileLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-600">Loading WorkLog workspace...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <AuthPages />;
  }

  if (needsProfileSetup) {
    return <CompleteProfileGate />;
  }

  if (!firebaseUser.emailVerified) {
    return <EmailVerificationGate />;
  }

  if (userProfile?.accountStatus === 'inactive') {
    return <InactiveAccountGate />;
  }

  return <AuthenticatedWorkspace />;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}

import React, { useState } from 'react';
import {
  Bell,
  BookmarkPlus,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import { AppView } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { markNotificationRead } from '../lib/firestoreService';

interface LayoutProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onNewWorkLog: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EMPLOYEE_NAV: NavItem[] = [
  { id: 'employee-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'add-work-log', label: 'Add Work Log', icon: PlusCircle },
  { id: 'work-log-history', label: 'Work Log History', icon: History },
  { id: 'my-presets', label: 'My Presets', icon: BookmarkPlus },
  { id: 'holiday-calendar', label: 'Holiday Calendar', icon: CalendarDays },
  { id: 'export-reports', label: 'Export Reports', icon: FileSpreadsheet },
  { id: 'profile', label: 'Profile', icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'admin-employees', label: 'Employees', icon: Users },
  { id: 'admin-all-logs', label: 'All Work Logs', icon: ListChecks },
  { id: 'admin-holidays', label: 'Holiday Management', icon: CalendarDays },
  { id: 'admin-categories', label: 'Categories', icon: FolderKanban },
  { id: 'admin-reports', label: 'Reports & Exports', icon: FileSpreadsheet },
  { id: 'admin-settings', label: 'Settings', icon: Settings },
];

const VIEW_TITLES: Record<AppView, string> = {
  'employee-dashboard': 'Employee Dashboard',
  'add-work-log': 'Work Log Entry',
  'work-log-history': 'Work Log History',
  'my-presets': 'My Task & Outcome Presets',
  'holiday-calendar': 'Holiday Calendar',
  'export-reports': 'Export Reports',
  profile: 'My Profile',
  'admin-dashboard': 'Admin Overview',
  'admin-employees': 'Employees',
  'admin-all-logs': 'All Work Logs',
  'admin-holidays': 'Holiday Management',
  'admin-categories': 'Work Categories',
  'admin-reports': 'Organization Reports & Exports',
  'admin-settings': 'Settings & Access Control',
};

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  onNavigate,
  onNewWorkLog,
  children,
}) => {
  const { userProfile, settings, notifications, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isAdminView = currentView.startsWith('admin-');
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSelectNav = (view: AppView) => {
    if (view === 'add-work-log') {
      onNewWorkLog();
    } else {
      onNavigate(view);
    }
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900 font-display truncate">
          WorkLog
        </span>
      </div>

      {isAdmin && (
        <div className="px-4 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleSelectNav('employee-dashboard')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !isAdminView
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Employee
            </button>
            <button
              type="button"
              onClick={() => handleSelectNav('admin-dashboard')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isAdminView
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {(isAdminView && isAdmin ? ADMIN_NAV : EMPLOYEE_NAV).map((item) => {
          const Icon = item.icon;
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 shrink-0">
            {(userProfile?.fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{userProfile?.fullName}</p>
            <p className="text-xs text-slate-500 truncate font-mono">
              {userProfile?.employeeId} ·{' '}
              {userProfile?.role === 'super_admin'
                ? 'Super Admin'
                : userProfile?.role === 'admin'
                  ? 'Admin'
                  : 'Employee'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                <span>{settings.organizationName}</span>
                <span aria-hidden="true">/</span>
                <span>{isAdminView && isAdmin ? 'Administration' : 'Workspace'}</span>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {VIEW_TITLES[currentView]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-700 text-white text-[11px] font-medium flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.slice(0, 15).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.read) void markNotificationRead(n.id);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            !n.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                            {!n.read && (
                              <span className="text-[11px] font-medium text-blue-700">New</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {!isAdminView && (
              <button
                type="button"
                onClick={onNewWorkLog}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Work Log</span>
              </button>
            )}

            {isAdminView && isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin-reports')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Shield className="w-4 h-4" />
                <span>Export Reports</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

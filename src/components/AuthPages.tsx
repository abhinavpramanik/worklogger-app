import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { createUserProfileWithEmployeeId, isEmployeeIdAvailable } from '../lib/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { VALIDATION_LIMITS } from '../types';

type AuthScreen = 'login' | 'register' | 'forgot-password';

function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  if (msg === 'EMPLOYEE_ID_TAKEN') {
    return 'That Employee ID is already registered to another account.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Authentication for this project. Enable Email/Password in Firebase Console → Authentication → Sign-in method, or sign in with Google below.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this work email already exists. Please sign in instead.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid work email or password.';
  }
  if (code === 'auth/weak-password') {
    return 'Password must be at least 6 characters long.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completion.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export const AuthPages: React.FC = () => {
  const [screen, setScreen] = useState<AuthScreen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const switchScreen = (next: AuthScreen) => {
    setScreen(next);
    setError(null);
    setInfoMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setError('Enter both work email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanName = fullName.trim();
    const cleanEmpId = employeeId.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < VALIDATION_LIMITS.FULL_NAME_MIN || cleanName.length > VALIDATION_LIMITS.FULL_NAME_MAX) {
      setError('Full Name must be between 2 and 120 characters.');
      return;
    }
    if (
      cleanEmpId.length < VALIDATION_LIMITS.EMPLOYEE_ID_MIN ||
      cleanEmpId.length > VALIDATION_LIMITS.EMPLOYEE_ID_MAX ||
      !VALIDATION_LIMITS.EMPLOYEE_ID_PATTERN.test(cleanEmpId)
    ) {
      setError('Employee ID must be 2–40 characters using only letters, numbers, hyphens, or underscores.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid work email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      try {
        const available = await isEmployeeIdAvailable(cleanEmpId);
        if (!available) {
          await cred.user.delete();
          setError('That Employee ID is already registered to another employee.');
          setSubmitting(false);
          return;
        }
        await updateProfile(cred.user, { displayName: cleanName });
        await createUserProfileWithEmployeeId({
          uid: cred.user.uid,
          fullName: cleanName,
          employeeId: cleanEmpId,
          email: cleanEmail,
          emailVerified: cred.user.emailVerified,
          department: department.trim(),
        });
        await sendEmailVerification(cred.user);
      } catch (innerErr) {
        try {
          await cred.user.delete();
        } catch {
          // Best-effort rollback of unprofiled Auth user
        }
        throw innerErr;
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid work email address.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMessage(`Password reset instructions have been sent to ${cleanEmail}.`);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900 font-display">
            WorkLog
          </span>
        </div>
        <p className="mt-2 text-center text-sm text-slate-600">
          Employee Work Log &amp; Leave Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          {screen === 'login' && (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">Sign in to your account</h1>
              <p className="text-sm text-slate-500 mb-6">
                Enter your work credentials to record daily logs and manage leave.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => switchScreen('forgot-password')}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-500">or continue with</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Sign in with Google
              </button>

              <p className="mt-6 text-center text-sm text-slate-600">
                New employee?{' '}
                <button
                  type="button"
                  onClick={() => switchScreen('register')}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Create an employee account
                </button>
              </p>
            </>
          )}

          {screen === 'register' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="w-5 h-5 text-slate-700" />
                <h1 className="text-xl font-semibold text-slate-900">Employee Registration</h1>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Public registration creates an Employee account. Admin roles are assigned internally.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      required
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="EMP-1042"
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Department (Optional)
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Engineering"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya@company.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creating Account...' : 'Create Employee Account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => switchScreen('login')}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {screen === 'forgot-password' && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-5 h-5 text-slate-700" />
                <h1 className="text-xl font-semibold text-slate-900">Reset Password</h1>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Enter your work email and we will send a password reset link.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-sm text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Sending Reset Link...' : 'Send Reset Link'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => switchScreen('login')}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const CompleteProfileGate: React.FC = () => {
  const { firebaseUser, logout } = useAuth();
  const [fullName, setFullName] = useState(firebaseUser?.displayName || '');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!firebaseUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanName = fullName.trim();
    const cleanEmpId = employeeId.trim().toUpperCase();

    if (cleanName.length < 2) {
      setError('Full Name must be at least 2 characters.');
      return;
    }
    if (!VALIDATION_LIMITS.EMPLOYEE_ID_PATTERN.test(cleanEmpId) || cleanEmpId.length < 2) {
      setError('Employee ID must be 2–40 characters (letters, numbers, hyphens, underscores).');
      return;
    }

    setSubmitting(true);
    try {
      const available = await isEmployeeIdAvailable(cleanEmpId);
      if (!available) {
        setError('That Employee ID is already assigned to another employee.');
        setSubmitting(false);
        return;
      }

      await createUserProfileWithEmployeeId({
        uid: firebaseUser.uid,
        fullName: cleanName,
        employeeId: cleanEmpId,
        email: firebaseUser.email || '',
        emailVerified: firebaseUser.emailVerified,
        department: department.trim(),
      });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Complete Employee Profile</h1>
        <p className="text-sm text-slate-600 mb-6">
          Signed in as <span className="font-medium text-slate-900">{firebaseUser.email}</span>.
          Enter your Employee ID to activate your workspace.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
            <input
              type="text"
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-1001"
              className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Department (Optional)
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Engineering"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Saving Profile...' : 'Save & Continue'}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="py-2.5 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const EmailVerificationGate: React.FC = () => {
  const { firebaseUser, refreshAuthUser, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!firebaseUser) return null;

  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      await sendEmailVerification(firebaseUser);
      setMessage(`Verification email sent to ${firebaseUser.email}. Check your inbox and spam folder.`);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSending(false);
    }
  };

  const handleCheckVerified = async () => {
    setError(null);
    setMessage(null);
    setChecking(true);
    try {
      const verified = await refreshAuthUser();
      if (!verified) {
        setError('Your email is not verified yet. Please click the verification link in your inbox first.');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
        <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-4">
          <Mail className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Verify your work email</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          We sent a verification link to{' '}
          <span className="font-medium text-slate-900">{firebaseUser.email}</span>. Verify your
          email address to unlock work log submissions, leave requests, and reports.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckVerified}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking Status...' : "I've Verified My Email"}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={handleResend}
            className="w-full py-2.5 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full py-2 px-4 text-sm font-medium text-slate-500 hover:text-slate-800 inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export const InactiveAccountGate: React.FC = () => {
  const { userProfile, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
        <div className="w-11 h-11 rounded-lg bg-red-50 text-red-700 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Account Deactivated</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          The account for <span className="font-medium text-slate-900">{userProfile?.email}</span>{' '}
          is currently marked inactive. Contact your organization administrator to restore access.
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full py-2.5 px-4 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

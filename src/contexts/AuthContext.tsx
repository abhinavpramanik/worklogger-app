import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AppNotification,
  AppSettings,
  BOOTSTRAPPED_SUPER_ADMIN_EMAIL,
  Category,
  DEFAULT_TIMEZONE,
  Holiday,
  UserPreset,
  UserProfile,
} from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { claimBootstrappedSuperAdminRole, sortPresetsAsc } from '../lib/firestoreService';
import { ensureInitialDataSeeded } from '../lib/seedService';

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  needsProfileSetup: boolean;
  settings: AppSettings;
  categories: Category[];
  userPresets: UserPreset[];
  holidays: Holiday[];
  notifications: AppNotification[];
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  organizationName: 'WorkLog Enterprise',
  timezone: DEFAULT_TIMEZONE,
  standardDailyMinutes: 480,
  requireEmailVerification: true,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setUserProfile(null);
        setNeedsProfileSetup(false);
        setProfileLoading(false);
        setCategories([]);
        setUserPresets([]);
        setHolidays([]);
        setNotifications([]);
      } else {
        setProfileLoading(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const path = `users/${firebaseUser.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserProfile(data);
          setNeedsProfileSetup(false);

          if (
            firebaseUser.emailVerified &&
            firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_SUPER_ADMIN_EMAIL.toLowerCase() &&
            data.role !== 'super_admin'
          ) {
            void claimBootstrappedSuperAdminRole(firebaseUser.uid);
          }
        } else {
          setUserProfile(null);
          setNeedsProfileSetup(true);
        }
        setProfileLoading(false);
      },
      (error) => {
        setProfileLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  const isVerifiedAndActive = Boolean(
    firebaseUser?.emailVerified && userProfile && userProfile.accountStatus === 'active'
  );

  useEffect(() => {
    if (!isVerifiedAndActive || !userProfile || !firebaseUser) return;

    const isAdminOrSuper = userProfile.role === 'admin' || userProfile.role === 'super_admin';
    const isSuper = userProfile.role === 'super_admin';
    if (isAdminOrSuper) {
      void ensureInitialDataSeeded(isAdminOrSuper, isSuper);
    }

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'app'),
      (snap) => {
        if (snap.exists()) {
          setSettings({ id: snap.id, ...(snap.data() as Omit<AppSettings, 'id'>) });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'settings/app')
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCategories(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
    );

    const unsubPresets = onSnapshot(
      query(collection(db, 'userPresets'), where('employeeUid', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<UserPreset, 'id'>),
        }));
        setUserPresets(sortPresetsAsc(list));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'userPresets')
    );

    const unsubHolidays = onSnapshot(
      collection(db, 'holidays'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Holiday, 'id'>) }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setHolidays(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'holidays')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('recipientUid', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setNotifications(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'notifications')
    );

    return () => {
      unsubSettings();
      unsubCategories();
      unsubPresets();
      unsubHolidays();
      unsubNotifs();
    };
  }, [isVerifiedAndActive, userProfile, firebaseUser]);

  const refreshAuthUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const reloaded = auth.currentUser;
    setFirebaseUser(reloaded ? ({ ...reloaded } as User) : null);
    return Boolean(reloaded?.emailVerified);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authReady,
        profileLoading,
        needsProfileSetup,
        settings,
        categories,
        userPresets,
        holidays,
        notifications,
        refreshAuthUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

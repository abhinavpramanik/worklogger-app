import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEFAULT_TIMEZONE } from '../types';

export interface SeedCategorySpec {
  id: string;
  name: string;
  description: string;
}

export const INITIAL_CATEGORIES: SeedCategorySpec[] = [
  { id: 'cat_development', name: 'Development', description: 'Feature implementation, API integration, and module engineering.' },
  { id: 'cat_testing', name: 'Testing', description: 'QA execution, regression checks, and test suite automation.' },
  { id: 'cat_debugging', name: 'Debugging', description: 'Root-cause investigation, log tracing, and hotfix validation.' },
  { id: 'cat_meetings', name: 'Meetings', description: 'Sprint planning, architecture reviews, and stakeholder syncs.' },
  { id: 'cat_documentation', name: 'Documentation', description: 'Technical specs, API docs, runbooks, and release notes.' },
  { id: 'cat_learning', name: 'Learning', description: 'Upskilling, technical training, and framework study.' },
  { id: 'cat_research', name: 'Research', description: 'Architecture spikes, feasibility studies, and tool evaluation.' },
  { id: 'cat_code_review', name: 'Code Review', description: 'Pull request reviews and mentoring feedback.' },
  { id: 'cat_support', name: 'Support', description: 'Incident triage, user support, and production troubleshooting.' },
  { id: 'cat_deployment', name: 'Deployment', description: 'CI/CD releases, environment configuration, and verification.' },
  { id: 'cat_other', name: 'Other', description: 'General operational or cross-functional tasks.' },
];

let seedInFlight: Promise<void> | null = null;

export async function ensureInitialDataSeeded(isAdminOrSuperAdmin: boolean, isSuperAdmin: boolean): Promise<void> {
  if (!isAdminOrSuperAdmin) return;
  if (seedInFlight) return seedInFlight;

  seedInFlight = (async () => {
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      if (catSnap.empty) {
        const batch = writeBatch(db);
        for (const cat of INITIAL_CATEGORIES) {
          batch.set(doc(db, 'categories', cat.id), {
            name: cat.name,
            description: cat.description,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      if (isSuperAdmin && auth.currentUser) {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          const batch = writeBatch(db);
          batch.set(settingsRef, {
            organizationName: 'WorkLog Enterprise',
            timezone: DEFAULT_TIMEZONE,
            standardDailyMinutes: 480,
            requireEmailVerification: true,
            updatedBy: auth.currentUser.uid,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }
      }
    } catch (error) {
      console.warn('Initial seed check skipped or deferred:', error);
    } finally {
      seedInFlight = null;
    }
  })();

  return seedInFlight;
}

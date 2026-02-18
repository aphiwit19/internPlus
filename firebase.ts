import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

function requireEnv(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file (Vite requires the VITE_ prefix) or your deployment environment.`
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  measurementId: requireEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

export const firebaseApp: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const secondaryFirebaseApp: FirebaseApp = (() => {
  try {
    return getApp('secondary');
  } catch {
    return initializeApp(firebaseConfig, 'secondary');
  }
})();

export const firebaseAuth: Auth = getAuth(firebaseApp);
export const secondaryAuth: Auth = getAuth(secondaryFirebaseApp);
export const firestoreDb: Firestore = getFirestore(firebaseApp);
export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);
export const firebaseFunctions: Functions = getFunctions(firebaseApp, 'asia-southeast1');

export let firebaseAnalytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    try {
      const opts = firebaseApp.options as any;
      console.log('Firebase runtime config', {
        projectId: opts?.projectId,
        authDomain: opts?.authDomain,
        storageBucket: opts?.storageBucket,
      });
    } catch {
      // ignore
    }
  }
  void isAnalyticsSupported()
    .then((supported) => {
      if (!supported) return;
      firebaseAnalytics = getAnalytics(firebaseApp);
    })
    .catch(() => {
      firebaseAnalytics = null;
    });
}

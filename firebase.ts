import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBRs8gePiHk2S7Qrj1YnwFzA2R0_QViAJ0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'system-internplus.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'system-internplus',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'system-internplus.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '843153329218',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:843153329218:web:8f66deb5b86d5c292df1db',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-XC5V3Y05JT',
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
  void isAnalyticsSupported()
    .then((supported) => {
      if (!supported) return;
      firebaseAnalytics = getAnalytics(firebaseApp);
    })
    .catch(() => {
      firebaseAnalytics = null;
    });
}

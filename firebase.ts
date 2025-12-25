import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, type Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBRs8gePiHk2S7Qrj1YnwFzA2R0_QViAJ0',
  authDomain: 'system-internplus.firebaseapp.com',
  projectId: 'system-internplus',
  storageBucket: 'system-internplus.firebasestorage.app',
  messagingSenderId: '843153329218',
  appId: '1:843153329218:web:8f66deb5b86d5c292df1db',
  measurementId: 'G-XC5V3Y05JT',
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

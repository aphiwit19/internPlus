import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Language, UserProfile, UserRole } from '@/types';
import i18n, { APP_LANG_TO_I18N_LANG } from '@/i18n';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { firebaseAuth } from '@/firebase';
import { firestoreDb } from '@/firebase';
import { createUserProfileIfMissing, getUserProfileByUid, subscribeUserProfileByUid } from './firestoreUserRepository';

interface AppContextValue {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  isAuthLoading: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  lang: Language;
  toggleLang: () => void;
}

const STORAGE_KEYS = {
  activeRole: 'internPlus.activeRole',
  lang: 'internPlus.lang',
} as const;

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'INTERN' || value === 'SUPERVISOR' || value === 'HR_ADMIN';
}

function isLanguage(value: unknown): value is Language {
  return value === 'EN' || value === 'TH';
}

function chooseInitialActiveRole(roles: UserRole[], saved: string | null): UserRole {
  const safeRoles = roles.length > 0 ? roles : (['INTERN'] as UserRole[]);
  if (isUserRole(saved) && safeRoles.includes(saved)) return saved;
  return safeRoles[0] ?? 'INTERN';
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [activeRole, setActiveRoleState] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'INTERN';
    const saved = window.localStorage.getItem(STORAGE_KEYS.activeRole);
    return isUserRole(saved) ? saved : 'INTERN';
  });

  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'EN';
    const saved = window.localStorage.getItem(STORAGE_KEYS.lang);
    return isLanguage(saved) ? saved : 'EN';
  });

  useEffect(() => {
    const next = APP_LANG_TO_I18N_LANG[lang];
    if (i18n.language !== next) {
      void i18n.changeLanguage(next);
    }
  }, [lang]);

  const setUser = useCallback((nextUser: UserProfile | null) => {
    setUserState(nextUser);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsub = onIdTokenChanged(firebaseAuth, async (fbUser) => {
      setIsAuthLoading(true);
      try {
        if (!fbUser) {
          if (unsubscribeProfile) {
            unsubscribeProfile();
            unsubscribeProfile = null;
          }
          setUserState(null);
          return;
        }

        try {
          await fbUser.getIdToken(true);
        } catch (err) {
          console.error('Failed to get auth token before Firestore profile fetch', err);
        }

        const uid = fbUser.uid;
        const email = fbUser.email ?? '';
        const name = fbUser.displayName ?? email.split('@')[0] ?? 'User';

        let profile: UserProfile | null = null;
        try {
          profile = await getUserProfileByUid(uid);
          if (!profile) profile = await createUserProfileIfMissing({ uid, email, name });
        } catch (err) {
          console.error('Failed to load or create user profile', { uid }, err);
          setUserState(null);
          return;
        }

        if (profile.hasLoggedIn === false) {
          try {
            await updateDoc(doc(firestoreDb, 'users', uid), {
              hasLoggedIn: true,
              firstLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // ignore
          }
        }

        setUserState(profile);
        if (typeof window !== 'undefined') {
          const saved = window.localStorage.getItem(STORAGE_KEYS.activeRole);
          const nextActiveRole = chooseInitialActiveRole(profile.roles, saved);
          setActiveRoleState(nextActiveRole);
          window.localStorage.setItem(STORAGE_KEYS.activeRole, nextActiveRole);
        } else {
          setActiveRoleState(profile.roles[0] ?? 'INTERN');
        }

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        unsubscribeProfile = subscribeUserProfileByUid(
          uid,
          (nextProfile) => {
            if (!nextProfile) return;
            setUserState(nextProfile);

            if (typeof window !== 'undefined') {
              const saved = window.localStorage.getItem(STORAGE_KEYS.activeRole);
              const nextActiveRole = chooseInitialActiveRole(nextProfile.roles, saved);
              setActiveRoleState(nextActiveRole);
              window.localStorage.setItem(STORAGE_KEYS.activeRole, nextActiveRole);
            } else {
              setActiveRoleState(nextProfile.roles[0] ?? 'INTERN');
            }
          },
          (err) => {
            console.error(
              'User profile subscription failed',
              {
                uid,
                authUid: firebaseAuth.currentUser?.uid ?? null,
              },
              err,
            );
          },
        );
      } finally {
        setIsAuthLoading(false);
      }
    });

    return () => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      unsub();
    };
  }, []);

  const setActiveRole = useCallback((nextRole: UserRole) => {
    setActiveRoleState((prev) => {
      if (user && !user.roles.includes(nextRole)) return prev;
      return nextRole;
    });
    if (typeof window === 'undefined') return;
    if (user && !user.roles.includes(nextRole)) return;
    window.localStorage.setItem(STORAGE_KEYS.activeRole, nextRole);
  }, [user]);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const next = prev === 'EN' ? 'TH' : 'EN';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.lang, next);
      }
      return next;
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      setUser,
      isAuthLoading,
      activeRole,
      setActiveRole,
      lang,
      toggleLang,
    }),
    [user, setUser, isAuthLoading, activeRole, setActiveRole, lang, toggleLang],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return ctx;
}

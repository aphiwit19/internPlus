import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Language, UserProfile, UserRole } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';

import { firebaseAuth } from '@/firebase';
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

  const setUser = useCallback((nextUser: UserProfile | null) => {
    setUserState(nextUser);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
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

        const uid = fbUser.uid;
        const email = fbUser.email ?? '';
        const name = fbUser.displayName ?? email.split('@')[0] ?? 'User';

        let profile = await getUserProfileByUid(uid);
        if (!profile) profile = await createUserProfileIfMissing({ uid, email, name });

        setUserState(profile);
        setActiveRoleState(profile.role);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEYS.activeRole, profile.role);
        }

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        unsubscribeProfile = subscribeUserProfileByUid(uid, (nextProfile) => {
          if (!nextProfile) return;
          setUserState(nextProfile);
          setActiveRoleState(nextProfile.role);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEYS.activeRole, nextProfile.role);
          }
        });
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
    setActiveRoleState(nextRole);
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.activeRole, nextRole);
  }, []);

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

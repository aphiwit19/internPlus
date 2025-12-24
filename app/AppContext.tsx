import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { Language, UserProfile, UserRole } from '@/types';

interface AppContextValue {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  lang: Language;
  toggleLang: () => void;
}

 const STORAGE_KEYS = {
   user: 'internPlus.user',
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
  const [user, setUserState] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    return safeParseJson<UserProfile>(window.localStorage.getItem(STORAGE_KEYS.user));
  });

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
    if (typeof window === 'undefined') return;
    if (!nextUser) {
      window.localStorage.removeItem(STORAGE_KEYS.user);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
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
      activeRole,
      setActiveRole,
      lang,
      toggleLang,
    }),
    [user, setUser, activeRole, setActiveRole, lang, toggleLang],
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

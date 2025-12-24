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

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('INTERN');
  const [lang, setLang] = useState<Language>('EN');

  const toggleLang = useCallback(() => {
    setLang(prev => (prev === 'EN' ? 'TH' : 'EN'));
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
    [user, activeRole, lang, toggleLang],
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

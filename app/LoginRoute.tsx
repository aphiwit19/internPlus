import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LoginPage from '@/pages/shared/LoginPage';
import { UserProfile } from '@/types';

import { createAuthRepository } from './authRepository';
import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { user, setUser, setActiveRole } = useAppContext();
  const authRepo = useMemo(() => createAuthRepository(), []);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate(pageIdToPath(user.role, 'dashboard'), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);
    setIsLoading(true);

    authRepo
      .listProfiles()
      .then((list) => {
        if (cancelled) return;
        setProfiles(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load profiles.');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authRepo]);

  const handleLogin = (selectedUser: UserProfile) => {
    setUser(selectedUser);
    setActiveRole(selectedUser.role);

    const from = location?.state?.from;
    if (typeof from === 'string' && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }

    navigate(pageIdToPath(selectedUser.role, 'dashboard'), { replace: true });
  };

  const handleJoinWithInvite = async (code: string): Promise<UserProfile> => {
    setErrorMessage(null);
    try {
      const joined = await authRepo.joinWithInvite(code);
      setProfiles((prev) => {
        if (prev.some((p) => p.id === joined.id)) return prev;
        return [joined, ...prev];
      });
      return joined;
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to join with invitation code.');
      throw err;
    }
  };

  return (
    <LoginPage
      profiles={profiles}
      isLoading={isLoading}
      errorMessage={errorMessage}
      onLogin={handleLogin}
      onJoinWithInvite={handleJoinWithInvite}
    />
  );
}

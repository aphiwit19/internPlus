import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LoginPage from '@/pages/shared/LoginPage';

import { signInWithEmailAndPassword } from 'firebase/auth';

import { firebaseAuth } from '@/firebase';
import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { user, isAuthLoading, activeRole } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) return;

    const from = location?.state?.from;
    if (typeof from === 'string' && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }

    navigate(pageIdToPath(activeRole, 'dashboard'), { replace: true });
  }, [user, isAuthLoading, navigate, location?.state?.from, activeRole]);

  const handleLogin = async (email: string, password: string) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginPage
      isLoading={isLoading}
      errorMessage={errorMessage}
      onLogin={handleLogin}
    />
  );
}

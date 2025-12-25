import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LoginPage from '@/pages/shared/LoginPage';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';

import { firebaseAuth } from '@/firebase';
import { createUserProfileIfMissing } from './firestoreUserRepository';
import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { user, isAuthLoading } = useAppContext();
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

    navigate(pageIdToPath(user.role, 'dashboard'), { replace: true });
  }, [user, isAuthLoading, navigate, location?.state?.from]);

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

  const handleJoinWithInvite = async (name: string, email: string, password: string): Promise<void> => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Please enter your name.');

      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(cred.user, { displayName: trimmedName });
      await createUserProfileIfMissing({ uid: cred.user.uid, email: cred.user.email ?? email.trim(), name: trimmedName, role: 'INTERN' });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to register.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginPage
      isLoading={isLoading}
      errorMessage={errorMessage}
      onLogin={handleLogin}
      onJoinWithInvite={handleJoinWithInvite}
    />
  );
}

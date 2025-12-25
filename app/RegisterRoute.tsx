import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import RegisterPage from '@/pages/shared/RegisterPage';

import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

import { firebaseAuth } from '@/firebase';
import { createUserProfileIfMissing } from './firestoreUserRepository';

export default function RegisterRoute() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async (name: string, email: string, password: string): Promise<void> => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Please enter your name.');

      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(cred.user, { displayName: trimmedName });
      await createUserProfileIfMissing({ uid: cred.user.uid, email: cred.user.email ?? email.trim(), name: trimmedName, roles: ['INTERN'] });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to register.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/', { replace: true });
  };

  return (
    <RegisterPage
      isLoading={isLoading}
      errorMessage={errorMessage}
      onRegister={handleRegister}
      onContinue={handleContinue}
    />
  );
}

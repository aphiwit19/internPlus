import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LoginPage from '@/pages/shared/LoginPage';
import { UserProfile } from '@/types';

import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { user, setUser, setActiveRole } = useAppContext();

  useEffect(() => {
    if (user) {
      navigate(pageIdToPath(user.role, 'dashboard'), { replace: true });
    }
  }, [user, navigate]);

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

  return <LoginPage onLogin={handleLogin} />;
}

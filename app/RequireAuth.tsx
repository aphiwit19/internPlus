import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAppContext } from './AppContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading } = useAppContext();
  const location = useLocation();

  if (isAuthLoading) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

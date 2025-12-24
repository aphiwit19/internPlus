import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAppContext } from './AppContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAppContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

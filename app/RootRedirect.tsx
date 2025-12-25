import React from 'react';
import { Navigate } from 'react-router-dom';

import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function RootRedirect() {
  const { user, isAuthLoading, activeRole } = useAppContext();

  if (isAuthLoading) return null;

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={pageIdToPath(activeRole, 'dashboard')} replace />;
}

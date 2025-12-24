import React from 'react';
import { Navigate } from 'react-router-dom';

import { useAppContext } from './AppContext';
import { pageIdToPath } from './routeUtils';

export default function RootRedirect() {
  const { user, activeRole } = useAppContext();

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={pageIdToPath(activeRole, 'dashboard')} replace />;
}

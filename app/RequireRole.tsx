import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { PageId } from '@/pageTypes';

import { useAppContext } from './AppContext';
import { pageIdToPath, RoleSlug, slugToRole } from './routeUtils';

export default function RequireRole({ children }: { children: React.ReactNode }) {
  const { roleSlug } = useParams<{ roleSlug: RoleSlug }>();
  const { activeRole } = useAppContext();

  const routeRole = roleSlug ? slugToRole(roleSlug) : null;

  if (!routeRole || routeRole !== activeRole) {
    return <Navigate to={pageIdToPath(activeRole, 'dashboard' as PageId)} replace />;
  }

  return <>{children}</>;
}

import React from 'react';

import SupervisorDashboard from '@/pages/supervisor/SupervisorDashboard';

import { Language, UserProfile, UserRole } from '@/types';

export type SupervisorPageId = 'dashboard' | 'manage-interns';

export interface SupervisorPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: string) => void;
}

const supervisorPageRegistry: Record<SupervisorPageId, (ctx: SupervisorPageContext) => React.ReactNode> = {
  dashboard: ({ user, onNavigate }) => <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="dashboard" />,
  'manage-interns': ({ user, onNavigate }) => <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="manage-interns" />,
};

export function renderSupervisorRegistryPage(
  activePage: string,
  ctx: SupervisorPageContext,
): React.ReactNode | null {
  const renderer = (supervisorPageRegistry as Record<string, (ctx: SupervisorPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

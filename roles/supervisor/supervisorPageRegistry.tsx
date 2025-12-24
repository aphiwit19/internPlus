import React from 'react';

import SupervisorDashboard from '@/pages/supervisor/SupervisorDashboard';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

export type SupervisorPageId = 'dashboard' | 'manage-interns';

export interface SupervisorPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

const supervisorPageRegistry: Record<SupervisorPageId, (ctx: SupervisorPageContext) => React.ReactNode> = {
  dashboard: ({ user, onNavigate }) => <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="dashboard" />,
  'manage-interns': ({ user, onNavigate }) => <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="manage-interns" />,
};

export function renderSupervisorRegistryPage(
  activePage: PageId,
  ctx: SupervisorPageContext,
): React.ReactNode | null {
  const renderer = (supervisorPageRegistry as Record<string, (ctx: SupervisorPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

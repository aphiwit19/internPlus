import React from 'react';

import DashboardPage from '@/pages/supervisor/DashboardPage';
import InternManagementPage from '@/pages/supervisor/InternManagementPage';
import LeaveRequestPage from '@/pages/supervisor/LeaveRequestPage';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

export type SupervisorPageId = 'dashboard' | 'manage-interns' | 'leave';

export interface SupervisorPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

const supervisorPageRegistry: Record<SupervisorPageId, (ctx: SupervisorPageContext) => React.ReactNode> = {
  dashboard: ({ user, onNavigate, lang }) => <DashboardPage user={user} onNavigate={onNavigate} lang={lang} />,
  'manage-interns': ({ user, onNavigate, lang }) => <InternManagementPage user={user} onNavigate={onNavigate} lang={lang} />,
  leave: ({ lang, activeRole }) => <LeaveRequestPage lang={lang} role={activeRole} />,
};

export function renderSupervisorRegistryPage(
  activePage: PageId,
  ctx: SupervisorPageContext,
): React.ReactNode | null {
  const renderer = (supervisorPageRegistry as Record<string, (ctx: SupervisorPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

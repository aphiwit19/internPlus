import React from 'react';

import DashboardPage from '@/pages/admin/DashboardPage';
import InternManagementPage from '@/pages/admin/InternManagementPage';
import LeaveRequestPage from '@/pages/admin/LeaveRequestPage';
import InvitationsPage from '@/pages/admin/InvitationsPage';
import SystemSettingsPage from '@/pages/admin/SystemSettingsPage';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

export type AdminPageId = 'dashboard' | 'manage-interns' | 'leave' | 'invitations' | 'system-settings';

export interface AdminPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

const adminPageRegistry: Record<AdminPageId, (ctx: AdminPageContext) => React.ReactNode> = {
  dashboard: () => <DashboardPage />,
  'manage-interns': () => <InternManagementPage />,
  leave: ({ lang, activeRole }) => <LeaveRequestPage lang={lang} role={activeRole} />,
  invitations: () => <InvitationsPage />,
  'system-settings': ({ lang }) => <SystemSettingsPage lang={lang} />,
};

export function renderAdminRegistryPage(activePage: PageId, ctx: AdminPageContext): React.ReactNode | null {
  const renderer = (adminPageRegistry as Record<string, (ctx: AdminPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

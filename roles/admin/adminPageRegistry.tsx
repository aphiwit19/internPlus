import React from 'react';

import InvitationsPage from '@/pages/admin/InvitationsPage';
import SystemSettingsPage from '@/pages/admin/SystemSettingsPage';

import AdminDashboard from './pages/AdminDashboard';

import { Language, UserProfile, UserRole } from '@/types';

export type AdminPageId = 'dashboard' | 'invitations' | 'system-settings';

export interface AdminPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: string) => void;
}

const adminPageRegistry: Record<AdminPageId, (ctx: AdminPageContext) => React.ReactNode> = {
  dashboard: () => <AdminDashboard />,
  invitations: () => <InvitationsPage />,
  'system-settings': ({ lang }) => <SystemSettingsPage lang={lang} />,
};

export function renderAdminRegistryPage(activePage: string, ctx: AdminPageContext): React.ReactNode | null {
  const renderer = (adminPageRegistry as Record<string, (ctx: AdminPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

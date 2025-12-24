import React from 'react';

import LeaveRequestPage from '@/pages/shared/LeaveRequestPage';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

export type SharedPageId = 'leave';

export interface SharedPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

const sharedPageRegistry: Record<SharedPageId, (ctx: SharedPageContext) => React.ReactNode> = {
  leave: ({ lang, activeRole }) => <LeaveRequestPage lang={lang} role={activeRole} />,
};

export function renderSharedPage(activePage: PageId, ctx: SharedPageContext): React.ReactNode | null {
  const renderer = (sharedPageRegistry as Record<string, (ctx: SharedPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

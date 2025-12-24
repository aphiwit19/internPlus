import React from 'react';

import { renderSupervisorRegistryPage } from './supervisorPageRegistry';
import { renderSharedPage } from '../shared/sharedPageRegistry';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

interface RenderSupervisorPageParams {
  activePage: PageId;
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

export function renderSupervisorPage({
  activePage,
  activeRole,
  user,
  lang,
  onNavigate,
}: RenderSupervisorPageParams): React.ReactNode {
  const page = renderSupervisorRegistryPage(activePage, { activeRole, user, lang, onNavigate });
  if (page) return page;

  const shared = renderSharedPage(activePage, { activeRole, user, lang, onNavigate });
  if (shared) return shared;

  return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
}

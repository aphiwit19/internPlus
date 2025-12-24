import React from 'react';

import { renderAdminRegistryPage } from './adminPageRegistry';
import { renderSharedPage } from '../shared/sharedPageRegistry';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';

interface RenderAdminPageParams {
  activePage: PageId;
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

export function renderAdminPage({
  activePage,
  activeRole,
  user,
  lang,
  onNavigate,
}: RenderAdminPageParams): React.ReactNode {
  const page = renderAdminRegistryPage(activePage, { activeRole, user, lang, onNavigate });
  if (page) return page;

  const shared = renderSharedPage(activePage, { activeRole, user, lang, onNavigate });
  if (shared) return shared;

  return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
}

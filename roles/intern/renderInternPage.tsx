import React from 'react';

import { renderInternRegistryPage } from './internPageRegistry';
import { renderSharedPage } from '../shared/sharedPageRegistry';

import { Language, UserProfile, UserRole } from '@/types';

interface RenderInternPageParams {
  activePage: string;
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: string) => void;
}

export function renderInternPage({
  activePage,
  activeRole,
  user,
  lang,
  onNavigate,
}: RenderInternPageParams): React.ReactNode {
  const page = renderInternRegistryPage(activePage, { activeRole, user, lang, onNavigate });
  if (page) return page;

  const shared = renderSharedPage(activePage, { activeRole, user, lang, onNavigate });
  if (shared) return shared;

  return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
}

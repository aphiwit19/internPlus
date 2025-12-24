import React from 'react';

import { Language, UserProfile, UserRole } from '@/types';
import { PageId } from '@/pageTypes';
import { renderAdminPage } from './admin/renderAdminPage';
import { renderInternPage } from './intern/renderInternPage';
import { renderSupervisorPage } from './supervisor/renderSupervisorPage';

interface RenderAppPageParams {
  activePage: PageId;
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: PageId) => void;
}

export function renderAppPage({
  activePage,
  activeRole,
  user,
  lang,
  onNavigate,
}: RenderAppPageParams): React.ReactNode {
  if (activeRole === 'HR_ADMIN') {
    return renderAdminPage({ activePage, activeRole, user, lang, onNavigate });
  }

  if (activeRole === 'SUPERVISOR') {
    return renderSupervisorPage({ activePage, activeRole, user, lang, onNavigate });
  }

  return renderInternPage({ activePage, activeRole, user, lang, onNavigate });
}

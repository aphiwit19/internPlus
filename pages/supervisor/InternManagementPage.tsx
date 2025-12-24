import React from 'react';

import { Language, UserProfile } from '@/types';
import { PageId } from '@/pageTypes';
import SupervisorDashboard from './SupervisorDashboard';

interface InternManagementPageProps {
  user: UserProfile;
  onNavigate: (pageId: PageId) => void;
  lang: Language;
}

const InternManagementPage: React.FC<InternManagementPageProps> = ({ user, onNavigate }) => {
  return <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="manage-interns" />;
};

export default InternManagementPage;

import React from 'react';

import { Language, UserProfile } from '@/types';
import { PageId } from '@/pageTypes';
import SupervisorDashboard from './SupervisorDashboard';

interface DashboardPageProps {
  user: UserProfile;
  onNavigate: (pageId: PageId) => void;
  lang: Language;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate }) => {
  return <SupervisorDashboard user={user} onNavigate={onNavigate} currentTab="dashboard" />;
};

export default DashboardPage;

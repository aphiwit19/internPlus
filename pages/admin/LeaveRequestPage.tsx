import React from 'react';

import SharedLeaveRequestPage from '@/pages/shared/LeaveRequestPage';
import { Language, UserRole } from '@/types';

interface AdminLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<AdminLeaveRequestPageProps> = ({ lang, role }) => {
  return <SharedLeaveRequestPage lang={lang} role={role} />;
};

export default LeaveRequestPage;

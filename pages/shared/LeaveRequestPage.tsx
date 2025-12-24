import React from 'react';
import { Language, UserRole } from '@/types';
import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';

interface LeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<LeaveRequestPageProps> = ({ lang, role }) => {
  return <LeaveRequestCore lang={lang} role={role} />;
};

export default LeaveRequestPage;

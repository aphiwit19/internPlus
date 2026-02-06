import React from 'react';
import { Language, UserRole } from '@/types';
import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';

interface LeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<LeaveRequestPageProps> = ({ lang: _lang, role }) => {
  return <LeaveRequestCore lang={_lang} role={role} />;
};

export default LeaveRequestPage;

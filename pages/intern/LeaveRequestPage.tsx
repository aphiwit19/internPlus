import React from 'react';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language } from '@/types';

interface InternLeaveRequestPageProps {
  lang: Language;
}

const LeaveRequestPage: React.FC<InternLeaveRequestPageProps> = ({ lang }) => {
  return <LeaveRequestCore lang={lang} role="INTERN" />;
};

export default LeaveRequestPage;

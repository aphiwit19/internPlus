import React from 'react';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language, UserRole } from '@/types';
import { useTranslation } from 'react-i18next';

interface SupervisorLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<SupervisorLeaveRequestPageProps> = ({ lang, role }) => {
  const { t } = useTranslation();
  return (
    <LeaveRequestCore
      lang={lang}
      role={role}
      headerTitle={t('leave.approval_center_title')}
      headerSubtitle={t('leave.approval_center_subtitle')}
      protocolTitle={t('leave.protocol_title')}
      protocolSubtitle={t('leave.protocol_subtitle')}
      sidePanel={null}
    />
  );
};

export default LeaveRequestPage;

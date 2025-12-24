import React from 'react';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language, UserRole } from '@/types';

interface AdminLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<AdminLeaveRequestPageProps> = ({ lang, role }) => {
  return (
    <LeaveRequestCore
      lang={lang}
      role={role}
      headerTitle={lang === 'EN' ? 'Admin Approval Center' : 'ศูนย์อนุมัติ (แอดมิน)'}
      headerSubtitle={
        lang === 'EN'
          ? 'Review and manage leave requests across the entire organization.'
          : 'ตรวจสอบและจัดการคำขอลาทั้งหมดในระบบ'
      }
      protocolTitle={lang === 'EN' ? 'Admin Protocol' : 'แนวทางสำหรับแอดมิน'}
      protocolSubtitle={
        lang === 'EN'
          ? 'Review leave requests for policy compliance and maintain staffing continuity.'
          : 'ตรวจสอบคำขอลาตามนโยบายและความพร้อมของกำลังคน'
      }
    />
  );
};

export default LeaveRequestPage;

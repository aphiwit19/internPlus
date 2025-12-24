import React from 'react';

import LeaveRequestCore from '@/pages/shared/LeaveRequestCore';
import { Language, UserRole } from '@/types';

interface SupervisorLeaveRequestPageProps {
  lang: Language;
  role: UserRole;
}

const LeaveRequestPage: React.FC<SupervisorLeaveRequestPageProps> = ({ lang, role }) => {
  return (
    <LeaveRequestCore
      lang={lang}
      role={role}
      headerTitle={lang === 'EN' ? 'Supervisor Approval Center' : 'ศูนย์อนุมัติ (หัวหน้างาน)'}
      headerSubtitle={
        lang === 'EN'
          ? 'Monitor and manage intern absences across your assigned group.'
          : 'ตรวจสอบและจัดการคำขอลาของอินเทิร์นในทีมที่คุณดูแล'
      }
      protocolTitle={lang === 'EN' ? 'Supervisor Protocol' : 'แนวทางสำหรับหัวหน้างาน'}
      protocolSubtitle={
        lang === 'EN'
          ? "Evaluate requests based on remaining quota and project deadlines. Approved leave is 'Without Pay' per policy."
          : 'พิจารณาคำขอตามโควตาคงเหลือและเส้นตายงาน การลาที่อนุมัติเป็นลาไม่รับค่าจ้างตามนโยบาย'
      }
    />
  );
};

export default LeaveRequestPage;

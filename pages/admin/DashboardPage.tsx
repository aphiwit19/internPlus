import React, { useMemo } from 'react';

import { useLocation } from 'react-router-dom';

import AdminDashboard from './AdminDashboard';

const DashboardPage: React.FC = () => {
  const location = useLocation();

  const initialTab = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = String(params.get('tab') ?? '').trim();
    if (raw === 'roster' || raw === 'attendance' || raw === 'allowances') return raw;
    return undefined;
  }, [location.search]);

  return <AdminDashboard initialTab={initialTab} />;
};

export default DashboardPage;

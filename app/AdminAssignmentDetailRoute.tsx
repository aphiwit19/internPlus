import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import AssignmentDetailPage from '@/pages/admin/components/AssignmentDetailPage';

export default function AdminAssignmentDetailRoute() {
  const navigate = useNavigate();
  const { internId, projectId } = useParams<{ internId: string; projectId: string }>();

  if (!internId || !projectId) return <Navigate to="/admin/manage-interns" replace />;

  return (
    <AssignmentDetailPage
      internId={internId}
      projectId={projectId}
      onBack={() => navigate('/admin/manage-interns', { replace: true })}
    />
  );
}

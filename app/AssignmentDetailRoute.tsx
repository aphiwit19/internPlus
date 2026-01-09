import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import AssignmentDetailPage from '@/pages/admin/components/AssignmentDetailPage';

export default function AssignmentDetailRoute() {
  const navigate = useNavigate();
  const { roleSlug, pageId, internId, projectKind, projectId } = useParams<{
    roleSlug: string;
    pageId: string;
    internId: string;
    projectKind?: string;
    projectId: string;
  }>();

  if (!roleSlug || !pageId) return <Navigate to="/" replace />;

  // Only allow this nested route from manage-interns page.
  if (pageId !== 'manage-interns') {
    return <Navigate to={`/${roleSlug}/${pageId}`} replace />;
  }

  if (!internId || !projectId) {
    return <Navigate to={`/${roleSlug}/${pageId}`} replace />;
  }

  return (
    <AssignmentDetailPage
      internId={internId}
      projectKind={projectKind}
      projectId={projectId}
      onBack={() => navigate(`/${roleSlug}/${pageId}`, { replace: true })}
    />
  );
}

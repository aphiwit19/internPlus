import React, { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { PageId } from '@/pageTypes';
import { NAV_ITEMS } from '@/constants';
import { UserRole } from '@/types';

import { useAppContext } from './AppContext';
import { isPageId, pageIdToPath, RoleSlug, slugToRole } from './routeUtils';

import InternDashboard from '@/pages/intern/InternDashboard';
import OnboardingPage from '@/pages/intern/OnboardingPage';
import ProfilePage from '@/pages/intern/ProfilePage';
import TrainingPage from '@/pages/intern/TrainingPage';
import AttendancePage from '@/pages/intern/AttendancePage';
import AssignmentPage from '@/pages/intern/AssignmentPage';
import ActivitiesPage from '@/pages/intern/ActivitiesPage';
import FeedbackPage from '@/pages/intern/FeedbackPage';
import EvaluationPage from '@/pages/intern/EvaluationPage';
import CertificatesPage from '@/pages/intern/CertificatesPage';
import OffboardingPage from '@/pages/intern/OffboardingPage';
import AllowancePage from '@/pages/intern/AllowancePage';
import WithdrawalPage from '@/pages/intern/WithdrawalPage';
import InternLeaveRequestPage from '@/pages/intern/LeaveRequestPage';

import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminInternManagementPage from '@/pages/admin/InternManagementPage';
import AdminInvitationsPage from '@/pages/admin/InvitationsPage';
import AdminSystemSettingsPage from '@/pages/admin/SystemSettingsPage';
import AdminLeaveRequestPage from '@/pages/admin/LeaveRequestPage';

import SupervisorDashboardPage from '@/pages/supervisor/DashboardPage';
import SupervisorInternManagementPage from '@/pages/supervisor/InternManagementPage';
import SupervisorLeaveRequestPage from '@/pages/supervisor/LeaveRequestPage';

export default function RolePage() {
  const navigate = useNavigate();
  const { roleSlug, pageId } = useParams<{ roleSlug: RoleSlug; pageId: string }>();
  const { user, activeRole, lang } = useAppContext();

  const roleFromRoute = roleSlug ? slugToRole(roleSlug) : null;

  const resolvedPageId = useMemo<PageId>(() => {
    if (pageId && isPageId(pageId)) return pageId;
    return 'dashboard';
  }, [pageId]);

  if (!user) return null;

  if (!roleFromRoute) {
    return <Navigate to={pageIdToPath(activeRole, 'dashboard')} replace />;
  }

  const allowed = NAV_ITEMS.some((it) => it.id === resolvedPageId && it.roles.includes(roleFromRoute));
  if (!allowed) {
    return <Navigate to={pageIdToPath(roleFromRoute, 'dashboard')} replace />;
  }

  const onNavigate = (id: PageId) => navigate(pageIdToPath(roleFromRoute, id));

  if (roleFromRoute === 'INTERN') {
    switch (resolvedPageId) {
      case 'dashboard':
        return <InternDashboard user={user} onNavigate={onNavigate} lang={lang} />;
      case 'onboarding':
        return <OnboardingPage onNavigate={onNavigate} lang={lang} />;
      case 'profile':
        return <ProfilePage lang={lang} />;
      case 'training':
        return <TrainingPage onNavigate={onNavigate} lang={lang} />;
      case 'attendance':
        return <AttendancePage lang={lang} />;
      case 'leave':
        return <InternLeaveRequestPage lang={lang} />;
      case 'assignment':
        return <AssignmentPage lang={lang} />;
      case 'activities':
        return <ActivitiesPage lang={lang} />;
      case 'feedback':
        return <FeedbackPage lang={lang} user={user} />;
      case 'evaluation':
        return <EvaluationPage lang={lang} />;
      case 'certificates':
        return <CertificatesPage lang={lang} />;
      case 'offboarding':
        return <OffboardingPage lang={lang} />;
      case 'allowance':
        return <AllowancePage lang={lang} />;
      case 'withdrawal':
        return <WithdrawalPage lang={lang} />;
      default:
        return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
    }
  }

  if (roleFromRoute === 'SUPERVISOR') {
    switch (resolvedPageId) {
      case 'dashboard':
        return <SupervisorDashboardPage user={user} onNavigate={onNavigate} lang={lang} />;
      case 'manage-interns':
        return <SupervisorInternManagementPage user={user} onNavigate={onNavigate} lang={lang} />;
      case 'leave':
        return <SupervisorLeaveRequestPage lang={lang} role={roleFromRoute} />;
      default:
        return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
    }
  }

  if (roleFromRoute === 'HR_ADMIN') {
    switch (resolvedPageId) {
      case 'dashboard':
        return <AdminDashboardPage />;
      case 'manage-interns':
        return <AdminInternManagementPage />;
      case 'leave':
        return <AdminLeaveRequestPage lang={lang} role={roleFromRoute} />;
      case 'invitations':
        return <AdminInvitationsPage />;
      case 'system-settings':
        return <AdminSystemSettingsPage lang={lang} />;
      default:
        return <div className="p-20 text-center font-bold text-slate-400">Page under development.</div>;
    }
  }

  return <Navigate to={pageIdToPath(activeRole, 'dashboard')} replace />;
}

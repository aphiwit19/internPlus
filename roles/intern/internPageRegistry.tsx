import React from 'react';

import ActivitiesPage from '@/pages/intern/ActivitiesPage';
import AllowancePage from '@/pages/intern/AllowancePage';
import AssignmentPage from '@/pages/intern/AssignmentPage';
import AttendancePage from '@/pages/intern/AttendancePage';
import CertificatesPage from '@/pages/intern/CertificatesPage';
import EvaluationPage from '@/pages/intern/EvaluationPage';
import FeedbackPage from '@/pages/intern/FeedbackPage';
import OffboardingPage from '@/pages/intern/OffboardingPage';
import OnboardingPage from '@/pages/intern/OnboardingPage';
import ProfilePage from '@/pages/intern/ProfilePage';
import TrainingPage from '@/pages/intern/TrainingPage';
import WithdrawalPage from '@/pages/intern/WithdrawalPage';

import InternDashboard from './pages/InternDashboard';

import { Language, UserProfile, UserRole } from '@/types';

export type InternPageId =
  | 'dashboard'
  | 'onboarding'
  | 'profile'
  | 'training'
  | 'attendance'
  | 'assignment'
  | 'activities'
  | 'feedback'
  | 'evaluation'
  | 'certificates'
  | 'offboarding'
  | 'allowance'
  | 'withdrawal';

export interface InternPageContext {
  activeRole: UserRole;
  user: UserProfile;
  lang: Language;
  onNavigate: (pageId: string) => void;
}

const internPageRegistry: Record<InternPageId, (ctx: InternPageContext) => React.ReactNode> = {
  dashboard: ({ user, onNavigate, lang }) => <InternDashboard user={user} onNavigate={onNavigate} lang={lang} />,
  onboarding: ({ onNavigate, lang }) => <OnboardingPage onNavigate={onNavigate} lang={lang} />,
  profile: ({ lang }) => <ProfilePage lang={lang} />,
  training: ({ onNavigate, lang }) => <TrainingPage onNavigate={onNavigate} lang={lang} />,
  attendance: ({ lang }) => <AttendancePage lang={lang} />,
  assignment: ({ lang }) => <AssignmentPage lang={lang} />,
  activities: ({ lang }) => <ActivitiesPage lang={lang} />,
  feedback: ({ lang, user }) => <FeedbackPage lang={lang} user={user} />,
  evaluation: ({ lang }) => <EvaluationPage lang={lang} />,
  certificates: ({ lang }) => <CertificatesPage lang={lang} />,
  offboarding: ({ lang }) => <OffboardingPage lang={lang} />,
  allowance: ({ lang }) => <AllowancePage lang={lang} />,
  withdrawal: ({ lang }) => <WithdrawalPage lang={lang} />,
};

export function renderInternRegistryPage(activePage: string, ctx: InternPageContext): React.ReactNode | null {
  const renderer = (internPageRegistry as Record<string, (ctx: InternPageContext) => React.ReactNode>)[activePage];
  return renderer ? renderer(ctx) : null;
}

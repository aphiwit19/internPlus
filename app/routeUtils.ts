import { PageId } from '@/pageTypes';
import { UserRole } from '@/types';

export type RoleSlug = 'intern' | 'supervisor' | 'admin';

export function roleToSlug(role: UserRole): RoleSlug {
  if (role === 'HR_ADMIN') return 'admin';
  if (role === 'SUPERVISOR') return 'supervisor';
  return 'intern';
}

export function slugToRole(slug: string): UserRole | null {
  if (slug === 'admin') return 'HR_ADMIN';
  if (slug === 'supervisor') return 'SUPERVISOR';
  if (slug === 'intern') return 'INTERN';
  return null;
}

export function pageIdToPath(role: UserRole, pageId: PageId): string {
  return `/${roleToSlug(role)}/${pageId}`;
}

export function isPageId(value: string): value is PageId {
  return (
    value === 'dashboard' ||
    value === 'onboarding' ||
    value === 'profile' ||
    value === 'documents' ||
    value === 'training' ||
    value === 'attendance' ||
    value === 'leave' ||
    value === 'assignment' ||
    value === 'activities' ||
    value === 'feedback' ||
    value === 'evaluation' ||
    value === 'university-evaluation' ||
    value === 'appointment-requests' ||
    value === 'self-evaluation' ||
    value === 'certificates' ||
    value === 'offboarding' ||
    value === 'allowance' ||
    value === 'withdrawal' ||
    value === 'withdrawn-offboarding-users' ||
    value === 'withdrawn-withdrawal-users' ||
    value === 'manage-interns' ||
    value === 'invitations' ||
    value === 'system-settings'
  );
}

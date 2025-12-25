import { UserProfile } from '@/types';

const STORAGE_KEY = 'internPlus.auth.profiles';

function getDefaultProfiles(): UserProfile[] {
  return [
    {
      id: 'u-1',
      name: 'Alex Rivera',
      roles: ['INTERN'],
      avatar:
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
      systemId: 'USR-001',
      studentId: 'STD-6704021',
      department: 'Design',
      email: 'alex.r@internplus.io',
      position: 'Junior UI/UX Designer',
      internPeriod: 'Jan 2024 - Jun 2024',
    },
    {
      id: 'u-2',
      name: 'Sarah Connor',
      roles: ['SUPERVISOR', 'HR_ADMIN'],
      avatar:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop',
      systemId: 'USR-002',
      department: 'Product',
      email: 'sarah.c@internplus.io',
      assignedInterns: ['u-1'],
      isDualRole: true,
    },
    {
      id: 'u-3',
      name: 'HR Admin',
      roles: ['HR_ADMIN'],
      avatar: 'https://picsum.photos/seed/admin/100/100',
      systemId: 'ADM-001',
      department: 'Operations',
      email: 'admin@internplus.io',
    },
  ];
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readProfilesFromStorage(): UserProfile[] {
  if (typeof window === 'undefined') return getDefaultProfiles();
  const parsed = safeParseJson<UserProfile[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return getDefaultProfiles();
  return parsed;
}

function writeProfilesToStorage(profiles: UserProfile[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export interface AuthRepository {
  listProfiles: () => Promise<UserProfile[]>;
  joinWithInvite: (code: string) => Promise<UserProfile>;
}

export function createAuthRepository(): AuthRepository {
  return {
    async listProfiles() {
      await sleep(150);
      const profiles = readProfilesFromStorage();
      writeProfilesToStorage(profiles);
      return profiles;
    },

    async joinWithInvite(code: string) {
      await sleep(350);

      const normalized = code.trim().toUpperCase();
      if (normalized !== 'W' && normalized !== 'WELCOME2024') {
        throw new Error('Invalid invitation code. Please try "W" or "WELCOME2024".');
      }

      const profiles = readProfilesFromStorage();

      const existing = profiles.find((p) => p.roles.includes('INTERN'));
      if (existing) return existing;

      const created: UserProfile = {
        id: 'u-invite-1',
        name: 'New Intern',
        roles: ['INTERN'],
        avatar: 'https://picsum.photos/seed/intern/100/100',
        systemId: 'USR-NEW',
        studentId: 'STD-NEW',
        department: 'Unknown',
        email: 'new.intern@internplus.io',
        position: 'Intern',
        internPeriod: 'TBD',
      };

      const next = [created, ...profiles];
      writeProfilesToStorage(next);
      return created;
    },
  };
}

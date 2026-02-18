import { UserProfile } from '@/types';

const STORAGE_KEY = 'internPlus.auth.profiles';

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
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<UserProfile[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return [];
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
      return profiles;
    },

    async joinWithInvite(code: string) {
      await sleep(150);
      void code;
      throw new Error('Invite flow is not supported in this environment.');
    },
  };
}

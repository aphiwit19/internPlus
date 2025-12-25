import { UserProfile, UserRole } from '@/types';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { firestoreDb } from '@/firebase';

function randomAvatar(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/100/100`;
}

function buildSystemId(uid: string): string {
  const short = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
  return `USR-${short || 'USER'}`;
}

type UserProfileDoc = Omit<UserProfile, 'id'> & {
  createdAt?: unknown;
  updatedAt?: unknown;
  role?: UserRole;
};

function normalizeRoles(data: { roles?: UserRole[]; role?: UserRole; isDualRole?: boolean } | null | undefined): UserRole[] {
  if (!data) return ['INTERN'];
  if (Array.isArray(data.roles) && data.roles.length > 0) return data.roles;
  if (data.role) return [data.role];
  if (data.isDualRole) return ['SUPERVISOR', 'HR_ADMIN'];
  return ['INTERN'];
}

export async function getUserProfileByUid(uid: string): Promise<UserProfile | null> {
  const ref = doc(firestoreDb, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfileDoc;
  const roles = normalizeRoles(data);
  return {
    id: uid,
    name: data.name,
    roles,
    avatar: data.avatar,
    systemId: data.systemId,
    studentId: data.studentId,
    department: data.department,
    email: data.email,
    phone: data.phone,
    position: data.position,
    internPeriod: data.internPeriod,
    assignedInterns: data.assignedInterns,
    isDualRole: roles.includes('SUPERVISOR') && roles.includes('HR_ADMIN') ? true : data.isDualRole,
  };
}

export function subscribeUserProfileByUid(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (err: unknown) => void,
): () => void {
  const ref = doc(firestoreDb, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data() as UserProfileDoc;
      const roles = normalizeRoles(data);
      onChange({
        id: uid,
        name: data.name,
        roles,
        avatar: data.avatar,
        systemId: data.systemId,
        studentId: data.studentId,
        department: data.department,
        email: data.email,
        phone: data.phone,
        position: data.position,
        internPeriod: data.internPeriod,
        assignedInterns: data.assignedInterns,
        isDualRole: roles.includes('SUPERVISOR') && roles.includes('HR_ADMIN') ? true : data.isDualRole,
      });
    },
    (err) => {
      onError?.(err);
    },
  );
}

export interface CreateUserProfileInput {
  uid: string;
  email: string;
  name: string;
  roles?: UserRole[];
  role?: UserRole;
}

export async function createUserProfileIfMissing(input: CreateUserProfileInput): Promise<UserProfile> {
  const { uid, email, name } = input;
  const roles: UserRole[] =
    input.roles && input.roles.length > 0
      ? input.roles
      : input.role
        ? [input.role]
        : ['INTERN'];

  const existing = await getUserProfileByUid(uid);
  if (existing) return existing;

  const docData: UserProfileDoc = {
    name,
    roles,
    avatar: randomAvatar(uid),
    systemId: buildSystemId(uid),
    studentId: '',
    department: 'Unknown',
    email,
    phone: '',
    position: 'Intern',
    internPeriod: 'TBD',
    isDualRole: roles.includes('SUPERVISOR') && roles.includes('HR_ADMIN') ? true : false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(firestoreDb, 'users', uid), docData);

  return {
    id: uid,
    name: docData.name,
    roles: docData.roles ?? roles,
    avatar: docData.avatar,
    systemId: docData.systemId,
    studentId: docData.studentId,
    department: docData.department,
    email: docData.email,
    phone: docData.phone,
    position: docData.position,
    internPeriod: docData.internPeriod,
  };
}

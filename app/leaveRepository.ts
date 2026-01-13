import { LeaveRequest, LeaveStatus, LeaveType, UserProfile, UserRole } from '@/types';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type QueryConstraint,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { firestoreDb } from '@/firebase';

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

type LeaveRequestDoc = Omit<LeaveRequest, 'id'> & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveListParams {
  role: UserRole;
  user: UserProfile | null;
}

export interface LeaveRepository {
  list: (params: LeaveListParams) => Promise<LeaveRequest[]>;
  createForUser: (user: UserProfile, input: CreateLeaveRequestInput) => Promise<LeaveRequest>;
  updateStatus: (id: string, status: LeaveStatus, approvedBy?: string) => Promise<LeaveRequest>;
}

export function createLeaveRepository(): LeaveRepository {
  return {
    async list(params: LeaveListParams) {
      const ref = collection(firestoreDb, 'leaveRequests');

      const constraints: QueryConstraint[] = [];

      // Require login for role-specific filtering.
      if (!params.user) {
        return [];
      }

      if (params.role === 'INTERN') {
        constraints.push(where('internId', '==', params.user.id));
      } else if (params.role === 'SUPERVISOR') {
        constraints.push(where('supervisorId', '==', params.user.id));
      } else if (params.role === 'HR_ADMIN') {
        // No filter; safe to use server-side ordering without composite index.
        constraints.push(orderBy('requestedAt', 'desc'));
      }

      const q = query(ref, ...constraints);
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data() as LeaveRequestDoc;
        return {
          id: d.id,
          internId: data.internId,
          supervisorId: data.supervisorId,
          internName: data.internName,
          internAvatar: data.internAvatar,
          internPosition: data.internPosition,
          type: data.type,
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason,
          status: data.status,
          requestedAt: data.requestedAt,
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
        };
      });

      // Avoid composite index (where + orderBy). Sort client-side for filtered queries.
      if (params.role === 'INTERN' || params.role === 'SUPERVISOR') {
        items.sort((a, b) => {
          const byDate = (b.requestedAt || '').localeCompare(a.requestedAt || '');
          if (byDate !== 0) return byDate;
          return b.id.localeCompare(a.id);
        });
      }

      return items;
    },

    async createForUser(user: UserProfile, input: CreateLeaveRequestInput) {
      const docData: LeaveRequestDoc = {
        internId: user.id,
        supervisorId: user.supervisorId,
        internName: user.name,
        internAvatar: user.avatar,
        internPosition: user.position || user.department,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        status: 'PENDING',
        requestedAt: todayIsoDate(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const createdRef = await addDoc(collection(firestoreDb, 'leaveRequests'), docData);
      return {
        id: createdRef.id,
        internId: docData.internId,
        supervisorId: docData.supervisorId,
        internName: docData.internName,
        internAvatar: docData.internAvatar,
        internPosition: docData.internPosition,
        type: docData.type,
        startDate: docData.startDate,
        endDate: docData.endDate,
        reason: docData.reason,
        status: docData.status,
        requestedAt: docData.requestedAt,
      };
    },

    async updateStatus(id: string, status: LeaveStatus, approvedBy?: string) {
      const ref = doc(firestoreDb, 'leaveRequests', id);
      const approvedAt = status === 'PENDING' ? undefined : todayIsoDate();
      const nextApprovedBy = status === 'PENDING' ? undefined : approvedBy;

      await updateDoc(ref, {
        status,
        approvedAt: approvedAt ?? null,
        approvedBy: nextApprovedBy ?? null,
        updatedAt: serverTimestamp(),
      });

      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('Leave request not found.');
      }

      const data = snap.data() as LeaveRequestDoc;
      return {
        id: snap.id,
        internId: data.internId,
        supervisorId: data.supervisorId,
        internName: data.internName,
        internAvatar: data.internAvatar,
        internPosition: data.internPosition,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        status: data.status,
        requestedAt: data.requestedAt,
        approvedAt: data.approvedAt,
        approvedBy: data.approvedBy,
      };
    },
  };
}

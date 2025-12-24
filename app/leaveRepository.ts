import { LeaveRequest, LeaveStatus, LeaveType, UserProfile } from '@/types';

const STORAGE_KEY = 'internPlus.leave.requests';

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

function getSeedRequests(): LeaveRequest[] {
  return [
    {
      id: 'lr-1',
      internName: 'Alex Rivera',
      internAvatar:
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
      internPosition: 'Junior UI/UX Designer',
      type: 'SICK',
      startDate: '2024-11-10',
      endDate: '2024-11-10',
      reason: 'Flu',
      status: 'APPROVED',
      requestedAt: '2024-11-09',
      approvedAt: '2024-11-09',
      approvedBy: 'System',
    },
    {
      id: 'lr-2',
      internName: 'James Wilson',
      internAvatar: 'https://picsum.photos/seed/james/100/100',
      internPosition: 'Backend Developer Intern',
      type: 'PERSONAL',
      startDate: '2024-11-25',
      endDate: '2024-11-26',
      reason: 'Family business',
      status: 'PENDING',
      requestedAt: '2024-11-20',
    },
  ];
}

function readAll(): LeaveRequest[] {
  if (typeof window === 'undefined') return getSeedRequests();
  const parsed = safeParseJson<LeaveRequest[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return getSeedRequests();
  return parsed;
}

function writeAll(list: LeaveRequest[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function createId(): string {
  return `lr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveRepository {
  list: () => Promise<LeaveRequest[]>;
  createForUser: (user: UserProfile, input: CreateLeaveRequestInput) => Promise<LeaveRequest>;
  updateStatus: (id: string, status: LeaveStatus, approvedBy?: string) => Promise<LeaveRequest>;
}

export function createLeaveRepository(): LeaveRepository {
  return {
    async list() {
      await sleep(200);
      const list = readAll();
      writeAll(list);
      return list;
    },

    async createForUser(user: UserProfile, input: CreateLeaveRequestInput) {
      await sleep(250);
      const list = readAll();
      const req: LeaveRequest = {
        id: createId(),
        internName: user.name,
        internAvatar: user.avatar,
        internPosition: user.position || user.department,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        status: 'PENDING',
        requestedAt: todayIsoDate(),
      };
      const next = [req, ...list];
      writeAll(next);
      return req;
    },

    async updateStatus(id: string, status: LeaveStatus, approvedBy?: string) {
      await sleep(200);
      const list = readAll();
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) {
        throw new Error('Leave request not found.');
      }

      const current = list[idx];
      const updated: LeaveRequest = {
        ...current,
        status,
        approvedAt: status === 'PENDING' ? undefined : todayIsoDate(),
        approvedBy: status === 'PENDING' ? undefined : approvedBy,
      };

      const next = [...list];
      next[idx] = updated;
      writeAll(next);
      return updated;
    },
  };
}

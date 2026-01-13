import React from 'react';
import { PageId } from './pageTypes';

export type UserRole = 'INTERN' | 'SUPERVISOR' | 'HR_ADMIN';
export type Language = 'EN' | 'TH';

export type LifecycleStatus =
  | 'ACTIVE'
  | 'WITHDRAWAL_REQUESTED'
  | 'OFFBOARDING_REQUESTED'
  | 'WITHDRAWN'
  | 'COMPLETION_REPORTED'
  | 'COMPLETED';

export type PostProgramAccessLevel = 'REVOCATION' | 'LIMITED' | 'EXTENDED';

export interface PerformanceMetrics {
  technical: number;
  communication: number;
  punctuality: number;
  initiative: number;
  overallRating: number;
}

export interface UserProfile {
  id: string;
  name: string;
  roles: UserRole[];
  avatar: string;
  systemId: string;
  studentId?: string;
  department: string;
  email: string;
  phone?: string;
  lineId?: string;
  position?: string;
  internPeriod?: string;
  supervisorId?: string;
  supervisorName?: string;
  assignedInterns?: string[]; // IDs of interns (for Supervisors)
  isDualRole?: boolean; // Can act as both Admin and Sup
  lifecycleStatus?: LifecycleStatus;
  withdrawalRequestedAt?: unknown;
  offboardingRequestedAt?: unknown;
  completionReportedAt?: unknown;
  withdrawalReason?: string;
  withdrawalDetail?: string;
  offboardingTasks?: unknown;
  postProgramAccessLevel?: PostProgramAccessLevel;
  postProgramRetentionPeriod?: string;
}

export interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

export interface Supervisor {
  name: string;
  role: string;
  avatar: string;
  email: string;
  phone?: string;
  department: string;
  lineId?: string;
}

export interface DocumentStatus {
  id: string;
  label: string;
  fileName?: string;
  isUploaded: boolean;
  icon: React.ReactNode;
}

export interface TaskLog {
  id: string;
  startTime: string; // ISO string
  endTime?: string;  // ISO string
}

export type TaskAttachment =
  | string
  | {
      fileName: string;
      storagePath: string;
    };

export interface SubTask {
  id: string;
  title: string;
  type: 'SINGLE' | 'CONTINUE';
  status: 'DONE' | 'IN_PROGRESS' | 'DELAYED' | 'REVISION';
  plannedStart: string; // ISO string
  plannedEnd: string;   // ISO string
  actualEnd?: string;   // ISO string
  timeLogs: TaskLog[];
  attachments: TaskAttachment[];
  isSessionActive: boolean;
  // Compatibility fields for Supervisor view
  date?: string;
  timeRange?: string;
}

export type LeaveType = 'SICK' | 'PERSONAL' | 'BUSINESS' | 'VACATION';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  internId?: string;
  supervisorId?: string;
  internName: string;
  internAvatar: string;
  internPosition: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

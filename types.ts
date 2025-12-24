import React from 'react';
import { PageId } from './pageTypes';

export type UserRole = 'INTERN' | 'SUPERVISOR' | 'HR_ADMIN';
export type Language = 'EN' | 'TH';

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
  role: UserRole;
  avatar: string;
  systemId: string;
  studentId?: string;
  department: string;
  email: string;
  phone?: string;
  position?: string;
  internPeriod?: string;
  assignedInterns?: string[]; // IDs of interns (for Supervisors)
  isDualRole?: boolean; // Can act as both Admin and Sup
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

export interface SubTask {
  id: string;
  title: string;
  type: 'SINGLE' | 'CONTINUE';
  status: 'DONE' | 'IN_PROGRESS' | 'DELAYED' | 'REVISION';
  plannedStart: string; // ISO string
  plannedEnd: string;   // ISO string
  actualEnd?: string;   // ISO string
  timeLogs: TaskLog[];
  attachments: string[];
  isSessionActive: boolean;
  // Compatibility fields for Supervisor view
  date?: string;
  timeRange?: string;
}

export type LeaveType = 'SICK' | 'PERSONAL' | 'BUSINESS' | 'VACATION';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
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

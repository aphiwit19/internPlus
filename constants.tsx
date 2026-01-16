
import React from 'react';
import { 
  LayoutDashboard, 
  UserCircle, 
  Rocket, 
  ShieldCheck, 
  Clock, 
  Briefcase, 
  Activity, 
  MessageSquare, 
  Star, 
  Award, 
  LogOut, 
  CreditCard,
  Users,
  Settings,
  Mail,
  XCircle,
  CalendarDays
} from 'lucide-react';
import { NavItem } from './types';

export const NAV_ITEMS: NavItem[] = [
  // Common
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['INTERN', 'SUPERVISOR', 'HR_ADMIN'] },
  
  // Intern Specific
  { id: 'onboarding', label: 'Onboarding', icon: <Rocket size={18} />, roles: ['INTERN'] },
  { id: 'profile', label: 'Profile & Documents', icon: <UserCircle size={18} />, roles: ['INTERN', 'SUPERVISOR', 'HR_ADMIN'] },
  { id: 'documents', label: 'Document Vault', icon: <CreditCard size={18} />, roles: ['INTERN'] },
  { id: 'training', label: 'Policy & Training', icon: <ShieldCheck size={18} />, roles: ['INTERN'] },
  { id: 'attendance', label: 'Time Attendance', icon: <Clock size={18} />, roles: ['INTERN'] },
  { id: 'leave', label: 'Leave Request', icon: <CalendarDays size={18} />, roles: ['INTERN', 'SUPERVISOR', 'HR_ADMIN'] },
  { id: 'assignment', label: 'Assignment', icon: <Briefcase size={18} />, roles: ['INTERN'] },
  { id: 'activities', label: 'Activities', icon: <Activity size={18} />, roles: ['INTERN'] },
  { id: 'feedback', label: 'Feedback & Self Evaluation', icon: <MessageSquare size={18} />, roles: ['INTERN'] },
  { id: 'evaluation', label: 'Evaluation', icon: <Star size={18} />, roles: ['INTERN'] },
  { id: 'certificates', label: 'Certificates', icon: <Award size={18} />, roles: ['INTERN', 'SUPERVISOR', 'HR_ADMIN'] },
  { id: 'offboarding', label: 'Offboarding', icon: <LogOut size={18} />, roles: ['INTERN'] },
  { id: 'allowance', label: 'Allowance', icon: <CreditCard size={18} />, roles: ['INTERN'] },
  { id: 'withdrawal', label: 'Withdrawal Program', icon: <XCircle size={18} />, roles: ['INTERN'] },

  // Admin / Supervisor Specific
  { id: 'university-evaluation', label: 'University Evaluation', icon: <Star size={18} />, roles: ['SUPERVISOR', 'HR_ADMIN'] },
  { id: 'manage-interns', label: 'Intern Management', icon: <Users size={18} />, roles: ['SUPERVISOR', 'HR_ADMIN'] },
  { id: 'invitations', label: 'Invites', icon: <Mail size={18} />, roles: ['HR_ADMIN'] },
  { id: 'system-settings', label: 'System Settings', icon: <Settings size={18} />, roles: ['HR_ADMIN'] },
];

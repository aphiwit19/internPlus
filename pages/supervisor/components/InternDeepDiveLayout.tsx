import React from 'react';
import { Briefcase, ChevronLeft, Clock, FolderOpen, MessageCircle, ShieldCheck } from 'lucide-react';

export type SupervisorDeepDiveTab = 'overview' | 'assets' | 'tasks' | 'assignments' | 'feedback' | 'attendance' | 'documents';

export interface DeepDiveInternSummary {
  name: string;
  avatar: string;
  position: string;
  internPeriod: string;
}

interface InternDeepDiveLayoutProps {
  intern: DeepDiveInternSummary;
  activeTab: SupervisorDeepDiveTab;
  onTabChange: (tab: SupervisorDeepDiveTab) => void;
  onBack: () => void;
  showAssignmentsTab?: boolean;
  children: React.ReactNode;
  assetsNotificationCount?: number;
  assignmentsNotificationCount?: number;
  attendanceNotificationCount?: number;
  feedbackNotificationCount?: number;
  documentsNotificationCount?: number;
}

const NavText = ({
  active,
  onClick,
  label,
  icon,
  hasNotification,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  hasNotification?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`relative flex items-center gap-2 px-3 py-2 rounded-[1rem] text-[8px] font-black uppercase tracking-[0.12em] transition-all whitespace-nowrap ${
      active ? 'bg-[#0B0F19] text-white shadow-2xl shadow-slate-900/30' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
    }`}
  >
    {icon}
    <span>{label}</span>
    {hasNotification && (
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
    )}
  </button>
);

const InternDeepDiveLayout: React.FC<InternDeepDiveLayoutProps> = ({
  intern,
  activeTab,
  onTabChange,
  onBack,
  showAssignmentsTab = false,
  children,
  assetsNotificationCount = 0,
  assignmentsNotificationCount = 0,
  attendanceNotificationCount = 0,
  feedbackNotificationCount = 0,
  documentsNotificationCount = 0,
}) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="bg-white border-b border-slate-100 p-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-6 min-w-0">
          <button
            onClick={onBack}
            className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-4">
            <img src={intern.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-50 shadow-sm" alt="" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-black text-slate-900 leading-none truncate">{intern.name}</h2>
                <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-emerald-100">
                  MONITORING ACTIVE
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {intern.position} <span className="mx-2 text-slate-200">•</span> {intern.internPeriod}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 justify-end whitespace-nowrap flex-shrink-0">
          <NavText active={activeTab === 'assets'} onClick={() => onTabChange('assets')} label="ASSETS" icon={<FolderOpen size={14} />} hasNotification={assetsNotificationCount > 0} />
            {showAssignmentsTab && (
              <NavText
                active={activeTab === 'assignments'}
                onClick={() => onTabChange('assignments')}
                label="ASSIGNMENTS"
                icon={<Briefcase size={14} />}
                hasNotification={assignmentsNotificationCount > 0}
              />
            )}
          <NavText active={activeTab === 'attendance'} onClick={() => onTabChange('attendance')} label="ATTENDANCE" icon={<Clock size={14} />} hasNotification={attendanceNotificationCount > 0} />
          <NavText
            active={activeTab === 'feedback'}
            onClick={() => onTabChange('feedback')}
            label="FEEDBACK & Self Evaluation"
            icon={<MessageCircle size={14} />}
            hasNotification={feedbackNotificationCount > 0}
          />
          <NavText active={activeTab === 'documents'} onClick={() => onTabChange('documents')} label="DOCUMENT" icon={<ShieldCheck size={14} />} hasNotification={documentsNotificationCount > 0} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </div>
    </div>
  );
};

export default InternDeepDiveLayout;

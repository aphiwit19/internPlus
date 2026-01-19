import React from 'react';
import { NAV_ITEMS } from '@/constants';
import { X, LogOut, ChevronRight, ShieldCheck, Users, Repeat } from 'lucide-react';
import { UserProfile, Language, UserRole, PostProgramAccessLevel } from '@/types';
import { PageId } from '@/pageTypes';

interface SidebarProps {
  activeId: PageId;
  activeRole: UserRole; // Current active role context
  onNavigate: (id: PageId) => void;
  onRoleSwitch?: (role: UserRole) => void; // Callback to change role context
  isOpen?: boolean;
  onClose?: () => void;
  user: UserProfile;
  onLogout: () => void;
  lang: Language;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeId, 
  activeRole, 
  onNavigate, 
  onRoleSwitch, 
  isOpen, 
  onClose, 
  user, 
  onLogout, 
  lang 
}) => {
  // Use activeRole instead of user.role for filtering navigation
  let filteredNavItems = NAV_ITEMS.filter(item => item.roles.includes(activeRole));

  if (activeRole === 'INTERN' && user.lifecycleStatus === 'WITHDRAWN') {
    const level: PostProgramAccessLevel = user.postProgramAccessLevel ?? 'EXTENDED';
    if (level === 'REVOCATION') {
      filteredNavItems = [];
    } else if (level === 'LIMITED') {
      filteredNavItems = filteredNavItems.filter((item) => item.id === 'dashboard' || item.id === 'profile' || item.id === 'certificates');
    } else {
      const extendedAllowed = new Set([
        'dashboard',
        'profile',
        'documents',
        'training',
        'activities',
        'feedback',
        'evaluation',
        'certificates',
      ]);
      filteredNavItems = filteredNavItems.filter((item) => extendedAllowed.has(item.id));
    }
  }

  const translations: Record<string, string> = {
    'dashboard': lang === 'TH' ? 'แผงควบคุม' : 'Dashboard',
    'onboarding': lang === 'TH' ? 'แผนผังฝึกงาน' : 'Onboarding',
    'profile': lang === 'TH' ? 'โปรไฟล์และเอกสาร' : 'Profile & Docs',
    'documents': lang === 'TH' ? 'คลังเอกสาร' : 'Document Vault',
    'training': lang === 'TH' ? 'นโยบายและอบรม' : 'Policy & Training',
    'attendance': lang === 'TH' ? 'ลงเวลาเข้างาน' : 'Attendance',
    'leave': lang === 'TH' ? 'การลางาน' : 'Leave Request',
    'assignment': lang === 'TH' ? 'งานที่ได้รับมอบหมาย' : 'Assignment',
    'activities': lang === 'TH' ? 'กิจกรรม' : 'Activities',
    'feedback': lang === 'TH' ? 'คำติชมและประเมินตนเอง' : 'Feedback & Self Evaluation',
    'evaluation': lang === 'TH' ? 'ประเมินมหาลัย' : 'Uni Evaluation',
    'certificates': lang === 'TH' ? 'ใบรับรอง' : 'Certificates',
    'offboarding': lang === 'TH' ? 'การแจ้งออก' : 'Offboarding',
    'allowance': lang === 'TH' ? 'เบี้ยเลี้ยง' : 'Allowance',
    'withdrawal': lang === 'TH' ? 'การถอนตัว' : 'Withdrawal',
    'manage-interns': lang === 'TH' ? 'จัดการนักศึกษา' : 'Intern Management',
    'appointment-requests': lang === 'TH' ? 'นัดหมายขอเข้าพบ' : 'Appointment Requests',
    'invitations': lang === 'TH' ? 'การเชิญ' : 'Invites',
    'system-settings': lang === 'TH' ? 'ตั้งค่าระบบ' : 'System Settings',
    'menu_label': lang === 'TH' ? 'เมนูหลัก' : 'MAIN MENU',
    'logout_label': lang === 'TH' ? 'ออกจากระบบ' : 'Logout',
    'switch_label': lang === 'TH' ? 'สลับโหมด' : 'WORKSPACE CONTEXT'
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed left-0 top-0 h-screen bg-white border-r border-slate-100 flex flex-col z-[70] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        w-72
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className="p-8 pb-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logovannesplus.png"
              alt="VannesPlus"
              className="h-14 w-auto object-contain"
            />
            <div className="flex flex-col">
              <h1 className="text-slate-900 font-black text-xl leading-none tracking-tight">
                intern<span className="text-blue-600">Plus</span>
              </h1>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Portal v2.5</span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Dual Role Switcher - Specific for multi-role users */}
        {user.roles.includes('SUPERVISOR') && user.roles.includes('HR_ADMIN') && onRoleSwitch && (
          <div className="px-6 py-4 mx-4 mb-2 bg-slate-50 border border-slate-100 rounded-[1.5rem] animate-in fade-in slide-in-from-top-2 duration-500">
             <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.25em] mb-3 px-1 flex items-center justify-between">
                {translations['switch_label']}
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
             </div>
             <div className="flex bg-white p-1 rounded-xl border border-slate-200/50 shadow-sm overflow-hidden">
                <button 
                  onClick={() => onRoleSwitch('SUPERVISOR')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeRole === 'SUPERVISOR' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Users size={12} strokeWidth={3} /> Mentor
                </button>
                <button 
                  onClick={() => onRoleSwitch('HR_ADMIN')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeRole === 'HR_ADMIN' ? 'bg-[#111827] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <ShieldCheck size={12} strokeWidth={3} /> Admin
                </button>
             </div>
          </div>
        )}

        {/* Navigation Area - Scroll Bar Allowed */}
        <div className="flex-1 px-4 pt-4 overflow-y-auto scrollbar-hide">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4 px-4">
            {translations['menu_label']}
          </div>
          
          <nav className="space-y-1.5 pb-10">
            {filteredNavItems.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (window.innerWidth < 1024) onClose?.();
                  }}
                  className={`w-full flex items-center justify-between px-5 py-3.5 text-[13px] font-bold transition-all duration-300 rounded-[1.25rem] group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40 translate-x-1' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`transition-all duration-300 ${isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-blue-500'}`}>
                      {React.cloneElement(item.icon as React.ReactElement<any>, { size: 19, strokeWidth: isActive ? 2.5 : 2 })}
                    </span>
                    <span className="truncate tracking-tight">{translations[item.id] || item.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} strokeWidth={3} className="animate-in slide-in-from-left-2 duration-300" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Card Fixed at Bottom */}
        <div className="p-4 mt-auto border-t border-slate-50 bg-white flex-shrink-0">
          <div className="bg-slate-50/80 rounded-[1.5rem] p-4 flex items-center gap-4 border border-slate-100 shadow-sm transition-all hover:bg-slate-100/50 cursor-default group">
            <div className="relative flex-shrink-0">
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md transition-transform group-hover:scale-105"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[13px] font-black text-slate-900 truncate leading-tight">
                {user.name}
              </h4>
              <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-0.5 truncate">
                {activeRole === 'HR_ADMIN' ? 'Administrator' : (user.position || user.department)}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3.5 text-[10px] font-black text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[1rem] transition-all uppercase tracking-[0.25em]"
          >
            <LogOut size={14} /> {translations['logout_label']}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

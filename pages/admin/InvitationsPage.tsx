
import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  User, 
  Mail, 
  ShieldCheck, 
  Calendar, 
  Clock, 
  Send, 
  Plus,
  UserCheck,
  Briefcase,
  Users
} from 'lucide-react';
import { UserRole } from '@/types';

const InvitationsPage: React.FC = () => {
  const [inviteRole, setInviteRole] = useState<UserRole>('INTERN');
  const [recipientName, setRecipientName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedHrLead, setSelectedHrLead] = useState('');
  const [selectedDept, setSelectedDept] = useState('Design');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');

  const [departments, setDepartments] = useState<string[]>(['Design', 'Engineering', 'Product', 'Operations']);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');

  const [hrLeads, setHrLeads] = useState<string[]>(['Vanness Plus', 'Alicia Keys', 'Tom Hardy']);
  const [isAddingHrLead, setIsAddingHrLead] = useState(false);
  const [newHrLeadName, setNewHrLeadName] = useState('');

  const [supervisors, setSupervisors] = useState<Array<{ name: string; department: string; position: string }>>([
    { name: 'Sarah Connor', department: 'Design', position: 'Senior Designer' },
    { name: 'Marcus Miller', department: 'Engineering', position: 'Engineering Manager' },
    { name: 'Emma Watson', department: 'Product', position: 'Product Lead' },
  ]);

  const safeParseJson = <T,>(value: string | null): T | null => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    setStartDate(`${yyyy}-${mm}-${dd}`);
    setStartTime(`${hh}:${min}`);

    const storedDepartments = safeParseJson<string[]>(localStorage.getItem('internPlus.departments'));
    if (storedDepartments && storedDepartments.length > 0) {
      setDepartments(storedDepartments);
      if (!storedDepartments.includes(selectedDept)) {
        setSelectedDept(storedDepartments[0]);
      }
    }

    const storedHrLeads = safeParseJson<string[]>(localStorage.getItem('internPlus.hrLeads'));
    if (storedHrLeads && storedHrLeads.length > 0) {
      setHrLeads(storedHrLeads);
      if (!storedHrLeads.includes(selectedHrLead)) {
        setSelectedHrLead(storedHrLeads[0]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('internPlus.departments', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('internPlus.hrLeads', JSON.stringify(hrLeads));
  }, [hrLeads]);

  const handleAddDepartment = () => {
    const name = newDepartmentName.trim();
    if (!name) {
      alert('Please enter a Department name.');
      return;
    }

    setDepartments((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert('This department already exists.');
        return prev;
      }
      return [...prev, name];
    });

    setSelectedDept(name);
    setNewDepartmentName('');
    setIsAddingDepartment(false);
  };

  const handleAddHrLead = () => {
    const name = newHrLeadName.trim();
    if (!name) {
      alert('Please enter an HR Lead name.');
      return;
    }

    setHrLeads((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert('This HR Lead already exists.');
        return prev;
      }
      return [...prev, name];
    });

    setSelectedHrLead(name);
    setNewHrLeadName('');
    setIsAddingHrLead(false);
  };

  const handleSendInvite = () => {
    if (!inviteEmail || !recipientName) {
      alert('Please fill in Name and Email.');
      return;
    }
    if (inviteRole === 'INTERN' && !selectedSupervisor) {
      alert('Please assign a Supervisor for the Trainee.');
      return;
    }
    if (inviteRole === 'SUPERVISOR' && !selectedHrLead) {
      alert('Please assign an HR Lead for the Supervisor.');
      return;
    }

    const selectedSupervisorInfo = supervisors.find((s) => s.name === selectedSupervisor);
    const leadInfo =
      inviteRole === 'INTERN'
        ? `Supervisor: ${selectedSupervisor}${selectedSupervisorInfo?.position ? ` (${selectedSupervisorInfo.position})` : ''}`
        : `HR Lead: ${selectedHrLead}`;
    alert(`Invitation deployed for ${recipientName} as ${inviteRole}\n${leadInfo}`);
    
    setRecipientName('');
    setInviteEmail('');
    setSelectedSupervisor('');
    setSelectedHrLead('');
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Invitations</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">Manage and deploy access invitations to new trainees or supervisors.</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-12 space-y-8">
              {/* Main Invitation Form Card */}
              <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
                
                {/* Role Switcher */}
                <div className="flex justify-center mb-12">
                   <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                      <button 
                        onClick={() => setInviteRole('INTERN')}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${inviteRole === 'INTERN' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <User size={16} /> Intern
                      </button>
                      <button 
                        onClick={() => setInviteRole('SUPERVISOR')}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${inviteRole === 'SUPERVISOR' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <ShieldCheck size={16} /> Supervisor
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 mb-10">
                  <div className={`w-14 h-14 ${inviteRole === 'INTERN' ? 'bg-blue-600' : 'bg-indigo-600'} text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-100 transition-colors`}>
                    {inviteRole === 'INTERN' ? <UserPlus size={28} /> : <UserCheck size={28} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Deploy {inviteRole === 'INTERN' ? 'Trainee' : 'Mentor'} Access</h2>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-1">Credentials Configuration</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Full Name</label>
                      <div className="relative">
                         <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <input type="text" placeholder="John Doe" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Recipient Email</label>
                      <div className="relative">
                         <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <input type="email" placeholder="user@company.io" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {inviteRole === 'INTERN' ? (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Assign Supervisor</label>
                        <div className="relative">
                         <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer" value={selectedSupervisor} onChange={(e) => setSelectedSupervisor(e.target.value)}>
                            <option value="">Select Supervisor...</option>
                            {supervisors.map((s) => (
                              <option key={s.name} value={s.name}>
                                {s.name} - {s.position} ({s.department})
                              </option>
                            ))}
                         </select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Assign HR Lead</label>
                          <div className="flex items-stretch gap-3">
                            <div className="relative flex-1">
                              <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer" value={selectedHrLead} onChange={(e) => setSelectedHrLead(e.target.value)}>
                                <option value="">Select HR Representative...</option>
                                {hrLeads.map((lead) => (
                                  <option key={lead} value={lead}>
                                    {lead}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsAddingHrLead((v) => !v)}
                              className="w-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                              aria-label="Add HR Lead"
                              title="Add HR Lead"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          {isAddingHrLead && (
                            <div className="mt-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">New HR Lead</label>
                                <div className="relative">
                                  <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input
                                    type="text"
                                    placeholder="e.g. Jane Doe"
                                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    value={newHrLeadName}
                                    onChange={(e) => setNewHrLeadName(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingHrLead(false);
                                    setNewHrLeadName('');
                                  }}
                                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddHrLead}
                                  className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Assign Department</label>
                          <div className="flex items-stretch gap-3">
                            <div className="relative flex-1">
                              <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                                {departments.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsAddingDepartment((v) => !v)}
                              className="w-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                              aria-label="Add Department"
                              title="Add Department"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          {isAddingDepartment && (
                            <div className="mt-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">New Department</label>
                                <div className="relative">
                                  <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input
                                    type="text"
                                    placeholder="e.g. Marketing"
                                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    value={newDepartmentName}
                                    onChange={(e) => setNewDepartmentName(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex gap-3 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingDepartment(false);
                                    setNewDepartmentName('');
                                  }}
                                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 transition-all"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddDepartment}
                                  className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Effective Date</label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Start Time</label>
                        <div className="relative">
                          <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                   <button className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Discard Draft</button>
                   <button onClick={handleSendInvite} className={`flex-[2] py-5 ${inviteRole === 'INTERN' ? 'bg-slate-900 hover:bg-blue-600' : 'bg-[#111827] hover:bg-indigo-600'} text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3`}>
                     <Send size={18} /> Deploy Official Invite
                   </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationsPage;

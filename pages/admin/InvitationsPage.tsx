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
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

import { firestoreDb, secondaryAuth } from '@/firebase';

import { useAppContext } from '@/app/AppContext';

const InvitationsPage: React.FC = () => {
  const { user } = useAppContext();

  const [inviteRole, setInviteRole] = useState<UserRole>('INTERN');
  const [supervisorCoAdmin, setSupervisorCoAdmin] = useState(false);
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

  const [supervisors, setSupervisors] = useState<Array<{ id: string; name: string; department: string; position: string }>>([]);

  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const buildSystemId = (uid: string): string => {
    const short = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return `USR-${short || 'USER'}`;
  };

  const randomAvatar = (seed: string): string => {
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/100/100`;
  };

  const normalizeUniqueList = (values: string[]) => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const raw of values) {
      const v = String(raw ?? '').trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(v);
    }
    return next;
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
  }, []);

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as { departments?: string[]; hrLeads?: string[] };

      if (Array.isArray(data.departments) && data.departments.length > 0) {
        const nextDepts = normalizeUniqueList(data.departments);
        if (nextDepts.length > 0) {
          setDepartments(nextDepts);
          setSelectedDept((prev) => (nextDepts.includes(prev) ? prev : nextDepts[0]));
        }
      }

      if (Array.isArray(data.hrLeads) && data.hrLeads.length > 0) {
        const nextLeads = normalizeUniqueList(data.hrLeads);
        if (nextLeads.length > 0) {
          setHrLeads(nextLeads);
          setSelectedHrLead((prev) => (nextLeads.includes(prev) ? prev : nextLeads[0]));
        }
      }
    });
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('roles', 'array-contains', 'SUPERVISOR'));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as { name?: string; department?: string; position?: string };
        return {
          id: d.id,
          name: data.name || 'Unknown',
          department: data.department || 'Unknown',
          position: data.position || 'Supervisor',
        };
      });
      setSupervisors(list);
    });
  }, []);

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
      const next = [...prev, name];
      void setDoc(
        doc(firestoreDb, 'config', 'systemSettings'),
        {
          departments: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return next;
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
      const next = [...prev, name];
      void setDoc(
        doc(firestoreDb, 'config', 'systemSettings'),
        {
          hrLeads: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return next;
    });

    setSelectedHrLead(name);
    setNewHrLeadName('');
    setIsAddingHrLead(false);
  };

  const handleSendInviteEmail = async () => {
    setInviteError(null);
    setInviteSuccess(null);

    if (!user || !user.roles.includes('HR_ADMIN')) {
      setInviteError('You do not have permission to send invitations.');
      return;
    }

    const email = inviteEmail.trim();
    const name = recipientName.trim();

    if (!email || !name) {
      setInviteError('Please fill in Name and Email.');
      return;
    }
    if (inviteRole === 'INTERN' && !selectedSupervisor) {
      setInviteError('Please assign a Supervisor for the Trainee.');
      return;
    }
    if (inviteRole === 'SUPERVISOR' && !selectedHrLead) {
      setInviteError('Please assign an HR Lead for the Supervisor.');
      return;
    }

    setIsSendingInvite(true);

    const actionCodeSettings = {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    };

    try {
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);

      await updateProfile(userCredential.user, {
        displayName: name,
      });

      const uid = userCredential.user.uid;

      const roles =
        inviteRole === 'SUPERVISOR' && supervisorCoAdmin
          ? (['SUPERVISOR', 'HR_ADMIN'] as UserRole[])
          : ([inviteRole] as UserRole[]);

      const profileDoc: Record<string, unknown> = {
        name,
        roles,
        avatar: randomAvatar(uid),
        systemId: buildSystemId(uid),
        email,
        phone: '',
        position: inviteRole === 'SUPERVISOR' ? 'Supervisor' : 'Intern',
        isDualRole: roles.includes('SUPERVISOR') && roles.includes('HR_ADMIN'),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (inviteRole === 'INTERN') {
        profileDoc.studentId = '';
        profileDoc.department = 'Unknown';
        profileDoc.internPeriod = 'TBD';
        const selectedSupervisorInfo = supervisors.find((s) => s.id === selectedSupervisor);
        profileDoc.supervisorId = selectedSupervisor;
        profileDoc.supervisorName = selectedSupervisorInfo?.name || '';
      }

      if (inviteRole === 'SUPERVISOR') {
        profileDoc.department = selectedDept;
        profileDoc.assignedInterns = [];
      }

      await setDoc(doc(firestoreDb, 'users', uid), profileDoc, { merge: true });

      let firestoreVerified = false;
      try {
        const snap = await getDoc(doc(firestoreDb, 'users', uid));
        firestoreVerified = snap.exists();
      } catch {
        firestoreVerified = false;
      }

      try {
        await sendPasswordResetEmail(secondaryAuth, email, actionCodeSettings);
      } catch (mailErr: unknown) {
        const me = mailErr as { code?: string; message?: string };
        setInviteError(
          `Failed to send password setup email (${me?.code ?? 'unknown'}). ` +
            `Check Firebase Auth email templates + authorized domains. ${me?.message ?? ''}`,
        );
        return;
      }

      const selectedSupervisorInfo = supervisors.find((s) => s.id === selectedSupervisor);
      const leadInfo =
        inviteRole === 'INTERN'
          ? `Supervisor: ${selectedSupervisorInfo?.name ?? ''}${selectedSupervisorInfo?.position ? ` (${selectedSupervisorInfo.position})` : ''}`
          : `HR Lead: ${selectedHrLead}`;

      setInviteSuccess(`Invitation sent to ${email}. Password setup email has been sent (check inbox/spam).`);

      setRecipientName('');
      setInviteEmail('');
      setSelectedSupervisor('');
      setSelectedHrLead('');
      setSupervisorCoAdmin(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'auth/email-already-in-use') {
        try {
          await sendPasswordResetEmail(secondaryAuth, email, actionCodeSettings);
          setInviteSuccess(`Account already exists. Password setup/reset email sent to ${email} (check inbox/spam).`);
          setRecipientName('');
          setInviteEmail('');
          setSelectedSupervisor('');
          setSelectedHrLead('');
          setSupervisorCoAdmin(false);
        } catch (resetErr: unknown) {
          const re = resetErr as { code?: string; message?: string };
          setInviteError(`${re?.code ?? 'unknown'}: ${re?.message ?? 'This email is already in use, and sending reset email failed.'}`);
        }
      } else {
        setInviteError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to send invitation.'}`);
      }
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {
        // ignore
      }
      setIsSendingInvite(false);
    }
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
                              <option key={s.id} value={s.id}>
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

                        <div className="flex items-center justify-between gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Co-Admin Access</div>
                            <div className="text-slate-700 text-sm font-bold mt-2">Allow this Supervisor to also act as HR Admin</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSupervisorCoAdmin((v) => !v)}
                            className={`h-10 px-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                              supervisorCoAdmin
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {supervisorCoAdmin ? 'Enabled' : 'Disabled'}
                          </button>
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
                   <button
                     onClick={() => void handleSendInviteEmail()}
                     disabled={isSendingInvite}
                     className={`flex-[2] py-5 ${
                       isSendingInvite
                         ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                         : inviteRole === 'INTERN'
                           ? 'bg-slate-900 hover:bg-blue-600 text-white'
                           : 'bg-[#111827] hover:bg-indigo-600 text-white'
                     } rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3`}
                   >
                     <Send size={18} /> Deploy Official Invite
                   </button>
                </div>

                {(!!inviteError || !!inviteSuccess) && (
                  <div className="mt-6">
                    {!!inviteError && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-bold whitespace-pre-line">
                        {inviteError}
                      </div>
                    )}
                    {!!inviteSuccess && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-bold whitespace-pre-line">
                        {inviteSuccess}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvitationsPage;

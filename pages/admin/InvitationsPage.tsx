import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { arrayRemove, arrayUnion, collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

import { firestoreDb, secondaryAuth } from '@/firebase';

import { useAppContext } from '@/app/AppContext';
import { getDefaultAvatarUrl } from '@/app/avatar';

const InvitationsPage: React.FC = () => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
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

  const [hrLeads, setHrLeads] = useState<string[]>([]);
  const [isAddingHrLead, setIsAddingHrLead] = useState(false);
  const [newHrLeadName, setNewHrLeadName] = useState('');
  const [isClearHrLeadsModalOpen, setIsClearHrLeadsModalOpen] = useState(false);
  const [isClearingHrLeads, setIsClearingHrLeads] = useState(false);

  const [supervisors, setSupervisors] = useState<
    Array<{ id: string; name: string; department: string; position: string; roles: UserRole[]; isDualRole?: boolean }>
  >([]);
  const [selectedSupervisorToManage, setSelectedSupervisorToManage] = useState('');
  const [coAdminAction, setCoAdminAction] = useState<'grant' | 'revoke' | null>(null);
  const [isCoAdminModalOpen, setIsCoAdminModalOpen] = useState(false);
  const [isUpdatingCoAdmin, setIsUpdatingCoAdmin] = useState(false);

  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const buildSystemId = (uid: string): string => {
    const short = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    return `USR-${short || 'USER'}`;
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

      if (Array.isArray(data.hrLeads)) {
        const nextLeads = normalizeUniqueList(data.hrLeads);
        setHrLeads(nextLeads);
        setSelectedHrLead((prev) => (nextLeads.includes(prev) ? prev : nextLeads[0] ?? ''));
      }
    });
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('roles', 'array-contains', 'SUPERVISOR'));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as { name?: string; department?: string; position?: string; roles?: UserRole[]; isDualRole?: boolean };
        return {
          id: d.id,
          name: data.name || tr('admin_invitations.unknown'),
          department: data.department || tr('admin_invitations.unknown'),
          position: data.position || tr('admin_invitations.supervisor_position'),
          roles: Array.isArray(data.roles) ? data.roles : (['SUPERVISOR'] as UserRole[]),
          isDualRole: data.isDualRole,
        };
      });
      setSupervisors(list);
      setSelectedSupervisorToManage((prev) => (prev && list.some((x) => x.id === prev) ? prev : list[0]?.id ?? ''));
    });
  }, []);

  const managedSupervisor = supervisors.find((s) => s.id === selectedSupervisorToManage) ?? null;
  const managedIsCoAdmin = managedSupervisor ? managedSupervisor.roles.includes('HR_ADMIN') : false;

  const openCoAdminModal = (action: 'grant' | 'revoke') => {
    setInviteError(null);
    setInviteSuccess(null);
    setCoAdminAction(action);
    setIsCoAdminModalOpen(true);
  };

  const handleConfirmCoAdminChange = async () => {
    if (!managedSupervisor || !coAdminAction) return;

    if (coAdminAction === 'revoke' && user?.id && managedSupervisor.id === user.id) {
      setInviteError(tr('admin_invitations.errors.cannot_revoke_self'));
      setIsCoAdminModalOpen(false);
      return;
    }

    setIsUpdatingCoAdmin(true);
    try {
      const ref = doc(firestoreDb, 'users', managedSupervisor.id);
      if (coAdminAction === 'grant') {
        await updateDoc(ref, {
          roles: arrayUnion('HR_ADMIN'),
          isDualRole: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          roles: arrayRemove('HR_ADMIN'),
          isDualRole: false,
          updatedAt: serverTimestamp(),
        });
      }
      setInviteSuccess(
        coAdminAction === 'grant'
          ? tr('admin_invitations.success.granted_co_admin')
          : tr('admin_invitations.success.revoked_co_admin'),
      );
      setIsCoAdminModalOpen(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setInviteError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('admin_invitations.errors.update_supervisor_roles_failed')}`);
    } finally {
      setIsUpdatingCoAdmin(false);
    }
  };

  const handleAddDepartment = () => {
    const name = newDepartmentName.trim();
    if (!name) {
      alert(tr('admin_invitations.errors.enter_department_name'));
      return;
    }

    setDepartments((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(tr('admin_invitations.errors.department_exists'));
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
      alert(tr('admin_invitations.errors.enter_hr_lead_name'));
      return;
    }

    setHrLeads((prev) => {
      const exists = prev.some((d) => d.toLowerCase() === name.toLowerCase());
      if (exists) {
        alert(tr('admin_invitations.errors.hr_lead_exists'));
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

  const handleClearHrLeads = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    setIsClearingHrLeads(true);
    try {
      await setDoc(
        doc(firestoreDb, 'config', 'systemSettings'),
        {
          hrLeads: [],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setHrLeads([]);
      setSelectedHrLead('');
      setIsAddingHrLead(false);
      setNewHrLeadName('');
      setIsClearHrLeadsModalOpen(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setInviteError(
        `${tr('admin_invitations.errors.clear_hr_leads_failed')} (${e?.code ?? 'unknown'}): ${e?.message ?? ''}`.trim(),
      );
    } finally {
      setIsClearingHrLeads(false);
    }
  };

  const handleSendInviteEmail = async () => {
    setInviteError(null);
    setInviteSuccess(null);

    if (!user || !user.roles.includes('HR_ADMIN')) {
      setInviteError(tr('admin_invitations.errors.no_permission_send_invitations'));
      return;
    }

    const email = inviteEmail.trim();
    const name = recipientName.trim();

    if (!email || !name) {
      setInviteError(tr('admin_invitations.errors.fill_name_and_email'));
      return;
    }
    if (inviteRole === 'INTERN' && !selectedSupervisor) {
      setInviteError(tr('admin_invitations.errors.assign_supervisor_for_trainee'));
      return;
    }
    if (inviteRole === 'SUPERVISOR' && !selectedHrLead) {
      setInviteError(tr('admin_invitations.errors.assign_hr_lead_for_supervisor'));
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
        avatar: getDefaultAvatarUrl(),
        systemId: buildSystemId(uid),
        email,
        phone: '',
        lineId: '',
        position: inviteRole === 'INTERN' ? 'Intern' : inviteRole === 'SUPERVISOR' ? 'Supervisor' : 'Admin',
        isDualRole: roles.includes('SUPERVISOR') && roles.includes('HR_ADMIN'),
        hasLoggedIn: false,
        invitedAt: serverTimestamp(),
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
          `${tr('admin_invitations.errors.send_password_setup_failed')} (${me?.code ?? 'unknown'}). ` +
            `${tr('admin_invitations.errors.check_firebase_auth_templates')} ${me?.message ?? ''}`,
        );
        return;
      }

      const selectedSupervisorInfo = supervisors.find((s) => s.id === selectedSupervisor);
      const leadInfo =
        inviteRole === 'INTERN'
          ? `Supervisor: ${selectedSupervisorInfo?.name ?? ''}${selectedSupervisorInfo?.position ? ` (${selectedSupervisorInfo.position})` : ''}`
          : `HR Lead: ${selectedHrLead}`;

      setInviteSuccess(tr('admin_invitations.success.invitation_sent', { email }));

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
          setInviteSuccess(tr('admin_invitations.success.account_exists_reset_sent', { email }));
          setRecipientName('');
          setInviteEmail('');
          setSelectedSupervisor('');
          setSelectedHrLead('');
          setSupervisorCoAdmin(false);
        } catch (resetErr: unknown) {
          const re = resetErr as { code?: string; message?: string };
          setInviteError(`${re?.code ?? 'unknown'}: ${re?.message ?? tr('admin_invitations.errors.reset_email_failed')}`);
        }
      } else {
        setInviteError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('admin_invitations.errors.send_invitation_failed')}`);
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
      {isClearHrLeadsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            onClick={() => (isClearingHrLeads ? null : setIsClearHrLeadsModalOpen(false))}
            className="absolute inset-0 bg-slate-900/40"
            aria-label={tr('admin_invitations.close')}
          />
          <div className="relative w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">{tr('admin_invitations.danger_zone')}</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">{tr('admin_invitations.clear_hr_leads_title')}</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">{tr('admin_invitations.clear_hr_leads_desc')}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-2xl font-black">×</div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsClearHrLeadsModalOpen(false)}
                disabled={isClearingHrLeads}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                {tr('admin_invitations.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleClearHrLeads()}
                disabled={isClearingHrLeads}
                className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {isClearingHrLeads ? tr('admin_invitations.clearing') : tr('admin_invitations.clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCoAdminModalOpen && coAdminAction && managedSupervisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            type="button"
            onClick={() => (isUpdatingCoAdmin ? null : setIsCoAdminModalOpen(false))}
            className="absolute inset-0 bg-slate-900/40"
            aria-label={tr('admin_invitations.close')}
          />
          <div className="relative w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-2xl p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('admin_invitations.confirm')}</div>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  {coAdminAction === 'grant' ? tr('admin_invitations.grant_co_admin') : tr('admin_invitations.revoke_co_admin')}
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {coAdminAction === 'grant'
                    ? tr('admin_invitations.grant_co_admin_desc')
                    : tr('admin_invitations.revoke_co_admin_desc')}
                </p>
                <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="text-xs font-black text-slate-900">{managedSupervisor.name}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {managedSupervisor.position} • {managedSupervisor.department}
                  </div>
                </div>
              </div>
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl font-black ${
                  coAdminAction === 'grant'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}
              >
                {coAdminAction === 'grant' ? '+' : '−'}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsCoAdminModalOpen(false)}
                disabled={isUpdatingCoAdmin}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                {tr('admin_invitations.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCoAdminChange()}
                disabled={isUpdatingCoAdmin}
                className={`flex-1 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-50 ${
                  coAdminAction === 'grant' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isUpdatingCoAdmin
                  ? tr('admin_invitations.updating')
                  : coAdminAction === 'grant'
                    ? tr('admin_invitations.grant')
                    : tr('admin_invitations.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_invitations.title')}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{tr('admin_invitations.subtitle')}</p>
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
                        <User size={16} /> {tr('admin_invitations.intern')}
                      </button>
                      <button 
                        onClick={() => setInviteRole('SUPERVISOR')}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${inviteRole === 'SUPERVISOR' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <ShieldCheck size={16} /> {tr('admin_invitations.supervisor')}
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 mb-10">
                  <div className={`w-14 h-14 ${inviteRole === 'INTERN' ? 'bg-blue-600' : 'bg-indigo-600'} text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-100 transition-colors`}>
                    {inviteRole === 'INTERN' ? <UserPlus size={28} /> : <UserCheck size={28} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{inviteRole === 'INTERN' ? tr('admin_invitations.deploy_trainee') : tr('admin_invitations.deploy_mentor')}</h2>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-1">{tr('admin_invitations.credentials_config')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.full_name')}</label>
                      <div className="relative">
                         <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <input type="text" placeholder={tr('admin_invitations.placeholders.full_name')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.recipient_email')}</label>
                      <div className="relative">
                         <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <input type="email" placeholder={tr('admin_invitations.placeholders.email')} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {inviteRole === 'INTERN' ? (
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.assign_supervisor')}</label>
                        <div className="relative">
                         <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                         <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer" value={selectedSupervisor} onChange={(e) => setSelectedSupervisor(e.target.value)}>
                            <option value="">{tr('admin_invitations.select_supervisor')}</option>
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
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.assign_hr_lead')}</label>
                          <div className="flex items-stretch gap-3">
                            <div className="relative flex-1">
                              <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                              <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer" value={selectedHrLead} onChange={(e) => setSelectedHrLead(e.target.value)}>
                                <option value="">{tr('admin_invitations.select_hr_rep')}</option>
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
                              aria-label={tr('admin_invitations.add_hr_lead')}
                              title={tr('admin_invitations.add_hr_lead')}
                            >
                              <Plus size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsClearHrLeadsModalOpen(true)}
                              className="w-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-all"
                              aria-label={tr('admin_invitations.clear_hr_leads_title')}
                              title={tr('admin_invitations.clear_hr_leads_title')}
                            >
                              ×
                            </button>
                          </div>

                          {isAddingHrLead && (
                            <div className="mt-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.new_hr_lead')}</label>
                                <div className="relative">
                                  <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input
                                    type="text"
                                    placeholder={tr('admin_invitations.placeholders.hr_lead')}
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
                                  {tr('admin_invitations.cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddHrLead}
                                  className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all"
                                >
                                  {tr('admin_invitations.add')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{tr('admin_invitations.co_admin_access')}</div>
                            <div className="text-slate-700 text-sm font-bold mt-2">{tr('admin_invitations.co_admin_desc')}</div>
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
                            {supervisorCoAdmin ? tr('admin_invitations.enabled') : tr('admin_invitations.disabled')}
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.assign_department')}</label>
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
                              aria-label={tr('admin_invitations.add_department')}
                              title={tr('admin_invitations.add_department')}
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                          {isAddingDepartment && (
                            <div className="mt-4 p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                              <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.new_department')}</label>
                                <div className="relative">
                                  <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input
                                    type="text"
                                    placeholder={tr('admin_invitations.placeholders.department')}
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
                                  {tr('admin_invitations.cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddDepartment}
                                  className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all"
                                >
                                  {tr('admin_invitations.add')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.effective_date')}</label>
                        <div className="relative">
                          <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.start_time')}</label>
                        <div className="relative">
                          <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                          <input type="time" className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                   <button className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">{tr('admin_invitations.discard_draft')}</button>
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
                     <Send size={18} /> {tr('admin_invitations.deploy_invite')}
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

              <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-emerald-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-100">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{tr('admin_invitations.supervisor_co_admin_title')}</h2>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-1">{tr('admin_invitations.supervisor_co_admin_subtitle')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{tr('admin_invitations.select_supervisor_manage')}</label>
                    <div className="relative">
                      <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                      <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                        value={selectedSupervisorToManage}
                        onChange={(e) => setSelectedSupervisorToManage(e.target.value)}
                      >
                        <option value="">{tr('admin_invitations.select_supervisor_manage_placeholder')}</option>
                        {supervisors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.department})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{tr('admin_invitations.current_status')}</div>
                      <div className="mt-3">
                        <div className="text-sm font-black text-slate-900">
                          {managedSupervisor ? managedSupervisor.name : tr('admin_invitations.dash')}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest mt-2">
                          {managedSupervisor
                            ? managedIsCoAdmin
                              ? tr('admin_invitations.co_admin_enabled')
                              : tr('admin_invitations.co_admin_disabled')
                            : tr('admin_invitations.select_a_supervisor')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => openCoAdminModal('grant')}
                        disabled={!managedSupervisor || managedIsCoAdmin}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {tr('admin_invitations.grant')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCoAdminModal('revoke')}
                        disabled={!managedSupervisor || !managedIsCoAdmin || (user?.id ? managedSupervisor?.id === user.id : false)}
                        className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rose-700 transition-all disabled:opacity-50"
                      >
                        {tr('admin_invitations.revoke')}
                      </button>
                    </div>
                    {managedSupervisor && user?.id && managedSupervisor.id === user.id ? (
                      <div className="mt-3 text-[11px] font-bold text-slate-500">{tr('admin_invitations.errors.cannot_revoke_self')}</div>
                    ) : null}
                  </div>
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

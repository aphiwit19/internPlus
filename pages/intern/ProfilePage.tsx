
import React, { useEffect, useMemo, useState } from 'react';
import { 
  CreditCard, 
  FileText, 
  GraduationCap, 
  Home, 
  Layout, 
  Files,
  Award,
  ChevronRight,
  Check,
  X,
  Plus,
  ShieldCheck,
  Globe,
  MessageSquare,
  Camera,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Search,
  LayoutGrid,
  FileCheck,
  Upload,
  Briefcase,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { UserProfile, Supervisor, DocumentStatus, Language } from '@/types';
import SupervisorCard from '@/components/SupervisorCard';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseAuth, firebaseStorage } from '@/firebase';
import { getUserProfileByUid } from '@/app/firestoreUserRepository';
import { pageIdToPath } from '@/app/routeUtils';
import { useTranslation } from 'react-i18next';

type InternProfileExtraDoc = {
  supervisorId?: string;
  supervisorName?: string;
};

interface ProfilePageProps {
  lang: Language;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const buildInitialDocuments = (): DocumentStatus[] => [
    { id: '1', label: tr('intern_profile.documents.national_id_passport'), fileName: 'Alex_Rivera_Passport.pdf', isUploaded: true, icon: <CreditCard size={18} /> },
    { id: '2', label: tr('intern_profile.documents.resume_cv'), fileName: 'Alex_Rivera_UX_Resume.pdf', isUploaded: true, icon: <FileText size={18} /> },
    { id: '3', label: tr('intern_profile.documents.academic_transcript'), isUploaded: false, icon: <GraduationCap size={18} /> },
    { id: '4', label: tr('intern_profile.documents.certificate'), isUploaded: false, icon: <Award size={18} /> },
    { id: '5', label: tr('intern_profile.documents.house_registration'), isUploaded: false, icon: <Home size={18} /> },
    { id: '6', label: tr('intern_profile.documents.bankbook_cover'), isUploaded: false, icon: <Layout size={18} /> },
    { id: '7', label: tr('intern_profile.documents.other'), isUploaded: false, icon: <Plus size={18} /> },
  ];

  const [docList, setDocList] = useState<DocumentStatus[]>(() => buildInitialDocuments());
  const summary = String(user?.professionalSummary ?? '').trim();
  const summaryPlaceholder = tr('intern_profile.summary_placeholder');
  const coreSkills = Array.isArray(user?.coreSkills) ? user.coreSkills.filter((x) => typeof x === 'string' && x.trim()) : [];
  const goal = String((user as any)?.professionalGoal ?? '').trim();
  const languageSkills = Array.isArray((user as any)?.languageSkills) ? ((user as any).languageSkills as any[]) : [];

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  const [extra, setExtra] = useState<InternProfileExtraDoc>({});
  const [supervisorProfile, setSupervisorProfile] = useState<UserProfile | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [isPwSaving, setIsPwSaving] = useState(false);

  const canChangePassword = useMemo(() => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return false;
    const providers = Array.isArray(fbUser.providerData) ? fbUser.providerData.map((p) => p?.providerId).filter(Boolean) : [];
    return providers.includes('password');
  }, [user?.id]);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
    position: '',
    studentId: '',
    internPeriod: '',
    bankName: '',
    bankAccountNumber: '',
    professionalSummary: '',
    coreSkillsText: '',
    professionalGoal: '',
    languageSkillsText: '',
  });

  useEffect(() => {
    if (!user) return;
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      department: user.department || '',
      position: user.position || '',
      studentId: user.studentId || '',
      internPeriod: user.internPeriod || '',
      bankName: user.bankName || '',
      bankAccountNumber: user.bankAccountNumber || '',
      professionalSummary: user.professionalSummary || '',
      coreSkillsText: Array.isArray((user as any).coreSkills) ? String((user as any).coreSkills.join(', ')) : '',
      professionalGoal: typeof (user as any).professionalGoal === 'string' ? (user as any).professionalGoal : '',
      languageSkillsText: Array.isArray((user as any).languageSkills)
        ? (user as any).languageSkills
            .map((x: any) => {
              const name = typeof x?.name === 'string' ? x.name : '';
              const level = typeof x?.level === 'string' ? x.level : '';
              return [name, level].filter(Boolean).join(':');
            })
            .filter(Boolean)
            .join(', ')
        : '',
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(firestoreDb, 'users', user.id);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as InternProfileExtraDoc;
      setExtra({
        supervisorId: data.supervisorId,
        supervisorName: data.supervisorName,
      });
    });
  }, [user]);

  useEffect(() => {
    let alive = true;
    if (!extra.supervisorId) {
      setSupervisorProfile(null);
      return;
    }
    void getUserProfileByUid(extra.supervisorId).then((p) => {
      if (!alive) return;
      setSupervisorProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [extra.supervisorId]);

  const supervisorCardData: Supervisor | null = useMemo(() => {
    if (!supervisorProfile) return null;
    return {
      name: supervisorProfile.name,
      role: supervisorProfile.position || (supervisorProfile.roles.includes('HR_ADMIN') ? 'Admin' : 'Supervisor'),
      avatar: supervisorProfile.avatar,
      email: supervisorProfile.email,
      phone: supervisorProfile.phone,
      department: supervisorProfile.department,
      lineId: supervisorProfile.lineId,
    };
  }, [supervisorProfile]);

  const handleRemoveDoc = (id: string) => {
    if (window.confirm(tr('intern_profile.confirm_remove_document'))) {
      setDocList(prev => prev.map(doc => doc.id === id ? { ...doc, isUploaded: false, fileName: undefined } : doc));
    }
  };

  const handleUploadDoc = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        setDocList(prev => prev.map(doc => doc.id === id ? { ...doc, isUploaded: true, fileName: file.name } : doc));
      }
    };
    input.click();
  };

  const uploadedCount = docList.filter(d => d.isUploaded).length;
  const progressPercent = Math.round((uploadedCount / docList.length) * 100);

  const handleSaveProfile = async () => {
    if (!user) return;
    const coreSkillsParsed = editForm.coreSkillsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const languageSkillsParsed = editForm.languageSkillsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((pair) => {
        const [name, ...rest] = pair.split(':').map((x) => x.trim());
        const level = rest.join(':').trim();
        return { name: name || '', level: level || '' };
      })
      .filter((x) => x.name);
    await updateDoc(doc(firestoreDb, 'users', user.id), {
      name: editForm.name,
      phone: editForm.phone,
      department: editForm.department,
      position: editForm.position,
      studentId: editForm.studentId,
      internPeriod: editForm.internPeriod,
      bankName: editForm.bankName,
      bankAccountNumber: editForm.bankAccountNumber,
      professionalSummary: editForm.professionalSummary,
      coreSkills: coreSkillsParsed,
      professionalGoal: editForm.professionalGoal,
      languageSkills: languageSkillsParsed,
    });
    setIsEditing(false);
  };

  const openChangePassword = () => {
    setPwError(null);
    setPwSuccess(null);
    setPwForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    setIsChangingPassword(true);
  };

  const handleChangePassword = async () => {
    if (isPwSaving) return;
    setPwError(null);
    setPwSuccess(null);

    const fbUser = firebaseAuth.currentUser;
    const email = fbUser?.email ?? '';
    if (!fbUser || !email) {
      setPwError(tr('intern_profile.password.errors.user_not_found'));
      return;
    }

    if (!pwForm.currentPassword.trim() || !pwForm.newPassword.trim()) {
      setPwError(tr('intern_profile.password.errors.fill_all'));
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmNewPassword) {
      setPwError(tr('intern_profile.password.errors.confirm_mismatch'));
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError(tr('intern_profile.password.errors.min_6'));
      return;
    }

    setIsPwSaving(true);
    try {
      const cred = EmailAuthProvider.credential(email, pwForm.currentPassword);
      await reauthenticateWithCredential(fbUser, cred);
      await updatePassword(fbUser, pwForm.newPassword);
      setPwSuccess(tr('intern_profile.password.success'));
      setPwForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const code = String(e?.code ?? 'unknown');
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError(tr('intern_profile.password.errors.wrong_current'));
      } else if (code === 'auth/too-many-requests') {
        setPwError(tr('intern_profile.password.errors.too_many'));
      } else if (code === 'auth/requires-recent-login') {
        setPwError(tr('intern_profile.password.errors.relogin'));
      } else {
        setPwError(`${e?.message ?? tr('intern_profile.password.errors.generic')}`);
      }
    } finally {
      setIsPwSaving(false);
    }
  };

  const handleAvatarSelected = async (file: File | null) => {
    if (!user || !file) return;

    setAvatarUploadError(null);

    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      setAvatarUploadError(tr('intern_profile.errors.image_only'));
      return;
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setAvatarUploadError(tr('intern_profile.errors.image_max_mb', { mb: 5 } as any));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `avatars/${user.id}/${Date.now()}_${safeName}`;
      const ref = storageRef(firebaseStorage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      await updateDoc(doc(firestoreDb, 'users', user.id), {
        avatar: url,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setAvatarUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_profile.errors.upload_failed')}`);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        id="intern-avatar-upload"
        onChange={(e) => void handleAvatarSelected(e.target.files?.[0] ?? null)}
      />
      {isEditing && (
        <EditProfileModal
          lang={_lang}
          form={editForm}
          onChange={setEditForm}
          onClose={() => setIsEditing(false)}
          onSave={() => void handleSaveProfile()}
        />
      )}

      {isChangingPassword && (
        <ChangePasswordModal
          lang={_lang}
          form={pwForm}
          error={pwError}
          success={pwSuccess}
          isSaving={isPwSaving}
          onChange={setPwForm}
          onClose={() => setIsChangingPassword(false)}
          onSave={() => void handleChangePassword()}
        />
      )}

      {avatarUploadError ? (
        <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
          {avatarUploadError}
        </div>
      ) : null}
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 px-2">
        <div className="animate-in fade-in slide-in-from-left-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] mb-2">{tr('intern_profile.breadcrumb')}</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{tr('intern_profile.title')}</h1>
          <p className="text-slate-400 text-sm font-medium mt-3">{tr('intern_profile.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="grid grid-cols-12 gap-8 max-w-[1700px] mx-auto">
          
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col items-center">
               <div className="relative mb-8">
                  <div className="w-40 h-40 rounded-[4rem] overflow-hidden ring-8 ring-slate-50 shadow-xl">
                     <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                  </div>
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => {
                      const input = document.getElementById('intern-avatar-upload') as HTMLInputElement | null;
                      if (input) input.click();
                    }}
                    className="absolute bottom-2 right-2 p-3 bg-blue-600 text-white rounded-2xl border-4 border-white shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                     <Camera size={18} />
                  </button>
               </div>
               
               <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{user.name}</h2>
                  <p className="text-blue-600 font-black text-[11px] uppercase tracking-[0.2em] mt-3">{user.position}</p>
               </div>

               <div className="w-full space-y-4 mb-10">
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <div className="w-1 h-3 bg-blue-600 rounded-full"></div> {tr('intern_profile.labels.position')}
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{user.position}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <div className="w-1 h-3 bg-indigo-600 rounded-full"></div> {tr('intern_profile.labels.period')}
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{user.internPeriod}</p>
                  </div>
               </div>

               <div className="w-full space-y-6 px-1">
                  <InfoRow label={tr('intern_profile.fields.student_id')} value={user.systemId} highlight />
                  <InfoRow label={tr('intern_profile.fields.department')} value={user.department} />
                  <InfoRow label={tr('intern_profile.fields.email')} value={user.email} />
                  <InfoRow label={tr('intern_profile.fields.phone')} value={user.phone || ''} />
                  <InfoRow label={tr('intern_profile.fields.bank')} value={user.bankName || '-'} />
                  <InfoRow label={tr('intern_profile.fields.account')} value={user.bankAccountNumber || '-'} />
               </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 h-full flex flex-col">
              <div className="h-full flex flex-col animate-in fade-in duration-500 slide-in-from-bottom-2">
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex-1 h-full">
                   <div className="flex items-center justify-between mb-10">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        {tr('intern_profile.summary.title')}
                      </h3>
                      <button onClick={() => setIsEditing(true)} className="text-blue-600 font-black text-[11px] uppercase tracking-widest hover:underline">{tr('intern_profile.actions.edit')}</button>
                   </div>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed mb-12 italic opacity-80">
                     {summary ? `"${summary}"` : summaryPlaceholder}
                   </p>
                   {(
                     !summary &&
                     coreSkills.length === 0 &&
                     !goal &&
                     (!Array.isArray(languageSkills) || languageSkills.length === 0)
                   ) && (
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.core_skills')}</h5>
                         <div className="flex flex-wrap gap-2">
                           {['Example: UI Design', 'Example: Figma', 'Example: React'].map((s) => (
                             <span key={s} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">
                               {s}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.goal')}</h5>
                         <p className="text-[11px] font-bold text-slate-600 leading-relaxed">Example: {tr('intern_profile.summary.goal_text')}</p>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.languages')}</h5>
                         <div className="space-y-3">
                           <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-slate-800">Example: {tr('intern_profile.languages.english')}</span>
                             <span className="text-blue-500">{tr('intern_profile.languages.advanced')}</span>
                           </div>
                           <div className="flex justify-between text-[11px] font-bold">
                             <span className="text-slate-800">Example: {tr('intern_profile.languages.spanish')}</span>
                             <span className="text-blue-500">{tr('intern_profile.languages.native')}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                   {(coreSkills.length > 0 || goal || (Array.isArray(languageSkills) && languageSkills.length > 0)) && (
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.core_skills')}</h5>
                         <div className="flex flex-wrap gap-2">
                           {(coreSkills.length > 0 ? coreSkills : ['-']).map((s) => (
                             <span key={s} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">
                               {s}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.goal')}</h5>
                         <p className="text-[11px] font-bold text-slate-600 leading-relaxed">{goal || '-'}</p>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{tr('intern_profile.summary.languages')}</h5>
                         <div className="space-y-3">
                           {(Array.isArray(languageSkills) && languageSkills.length > 0 ? languageSkills : [{ name: '-', level: '' }]).map((x: any, idx: number) => {
                             const name = typeof x?.name === 'string' ? x.name : '-';
                             const level = typeof x?.level === 'string' ? x.level : '';
                             return (
                               <div key={`${name}-${idx}`} className="flex justify-between text-[11px] font-bold">
                                 <span className="text-slate-800">{name}</span>
                                 <span className="text-blue-500">{level}</span>
                               </div>
                             );
                           })}
                         </div>
                       </div>
                     </div>
                   )}
                </div>

              </div>
          </div>

          <div className="col-span-12 lg:col-span-3">
            <button
              onClick={() => navigate(pageIdToPath('INTERN', 'documents'))}
              className="w-full mb-6 py-4 bg-blue-600 text-white rounded-[1.75rem] border border-blue-600 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
            >
              <CreditCard size={18} /> {tr('intern_profile.actions.document_vault')}
            </button>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-fit mb-6">
              <div className="mb-8">
                <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">{tr('intern_profile.security.title')}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                  {canChangePassword
                    ? tr('intern_profile.security.change_password.subtitle')
                    : tr('intern_profile.security.change_password.no_password_provider')}
                </p>
              </div>

              <button
                type="button"
                onClick={openChangePassword}
                disabled={!canChangePassword}
                className="w-full py-4 bg-slate-900 text-white rounded-[1.75rem] border border-slate-900 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50"
              >
                {tr('intern_profile.security.change_password.button')}
              </button>
            </div>

            {supervisorCardData ? (
              <SupervisorCard supervisor={supervisorCardData} lang={_lang} />
            ) : (
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-fit">
                <div className="mb-10">
                  <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">{tr('intern_profile.supervisor.title')}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{tr('intern_profile.supervisor.assigned_support')}</p>
                </div>
                <div className="py-14 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('intern_profile.supervisor.none_assigned')}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

const EditProfileModal: React.FC<{
  lang: Language;
  form: {
    name: string;
    phone: string;
    department: string;
    position: string;
    studentId: string;
    internPeriod: string;
    bankName: string;
    bankAccountNumber: string;
    professionalSummary: string;
    coreSkillsText: string;
    professionalGoal: string;
    languageSkillsText: string;
  };
  onChange: (next: {
    name: string;
    phone: string;
    department: string;
    position: string;
    studentId: string;
    internPeriod: string;
    bankName: string;
    bankAccountNumber: string;
    professionalSummary: string;
    coreSkillsText: string;
    professionalGoal: string;
    languageSkillsText: string;
  }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang: _lang, form, onChange, onClose, onSave }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('intern_profile.edit_modal.title')}</h3>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={tr('intern_profile.edit_modal.fields.name')} value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.phone')} value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.department')} value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.position')} value={form.position} onChange={(v) => onChange({ ...form, position: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.student_id')} value={form.studentId} onChange={(v) => onChange({ ...form, studentId: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.intern_period')} value={form.internPeriod} onChange={(v) => onChange({ ...form, internPeriod: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.bank')} value={form.bankName} onChange={(v) => onChange({ ...form, bankName: v })} />
              <Field label={tr('intern_profile.edit_modal.fields.bank_account_number')} value={form.bankAccountNumber} onChange={(v) => onChange({ ...form, bankAccountNumber: v })} />
            </div>
            <div className="mt-5">
              <label className="space-y-2 block">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_profile.summary.title')}</div>
                <textarea
                  value={form.professionalSummary}
                  onChange={(e) => onChange({ ...form, professionalSummary: e.target.value })}
                  placeholder={tr('intern_profile.summary_placeholder')}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[140px]"
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={tr('intern_profile.summary.core_skills')}
                value={form.coreSkillsText}
                onChange={(v) => onChange({ ...form, coreSkillsText: v })}
              />
              <Field
                label={tr('intern_profile.summary.languages')}
                value={form.languageSkillsText}
                onChange={(v) => onChange({ ...form, languageSkillsText: v })}
              />
            </div>

            <div className="mt-5">
              <label className="space-y-2 block">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_profile.summary.goal')}</div>
                <textarea
                  value={form.professionalGoal}
                  onChange={(e) => onChange({ ...form, professionalGoal: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[120px]"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all">
                {tr('intern_profile.edit_modal.actions.cancel')}
              </button>
              <button onClick={onSave} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                {tr('intern_profile.edit_modal.actions.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <label className="space-y-2">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
    />
  </label>
);

const PasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
}> = ({ label, value, onChange, reveal, onToggleReveal }) => (
  <label className="space-y-2">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</div>
    <div className="relative">
      <input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-14 px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
      />
      <button
        type="button"
        onClick={onToggleReveal}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all"
        aria-label={reveal ? 'Hide password' : 'Show password'}
      >
        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </label>
);

const ChangePasswordModal: React.FC<{
  lang: Language;
  form: { currentPassword: string; newPassword: string; confirmNewPassword: string };
  error: string | null;
  success: string | null;
  isSaving: boolean;
  onChange: (next: { currentPassword: string; newPassword: string; confirmNewPassword: string }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang, form, error, success, isSaving, onChange, onClose, onSave }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, { ...(options ?? {}), lng: lang === 'TH' ? 'th' : 'en' }));

  const [revealCurrent, setRevealCurrent] = useState(false);
  const [revealNext, setRevealNext] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('intern_profile.password.modal.title')}</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            {error ? <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-xs font-bold">{error}</div> : null}
            {success ? <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl px-5 py-4 text-xs font-bold">{success}</div> : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PasswordField
                label={tr('intern_profile.password.modal.fields.current')}
                value={form.currentPassword}
                onChange={(v) => onChange({ ...form, currentPassword: v })}
                reveal={revealCurrent}
                onToggleReveal={() => setRevealCurrent((v) => !v)}
              />
              <div className="hidden md:block" />
              <PasswordField
                label={tr('intern_profile.password.modal.fields.next')}
                value={form.newPassword}
                onChange={(v) => onChange({ ...form, newPassword: v })}
                reveal={revealNext}
                onToggleReveal={() => setRevealNext((v) => !v)}
              />
              <PasswordField
                label={tr('intern_profile.password.modal.fields.confirm')}
                value={form.confirmNewPassword}
                onChange={(v) => onChange({ ...form, confirmNewPassword: v })}
                reveal={revealConfirm}
                onToggleReveal={() => setRevealConfirm((v) => !v)}
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
              >
                {tr('intern_profile.password.modal.actions.cancel')}
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
              >
                {tr('intern_profile.password.modal.actions.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const InfoRow = ({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) => (
  <div className="flex justify-between items-center group/row cursor-default">
     <div className="flex items-center gap-4">
        <div className={`w-1.5 h-1.5 rounded-full transition-all group-hover/row:scale-150 ${highlight ? 'bg-blue-600' : 'bg-slate-200 group-hover/row:bg-blue-300'}`}></div>
        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
     </div>
     <span className={`text-[12px] font-black truncate max-w-[150px] ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</span>
  </div>
);

export default ProfilePage;

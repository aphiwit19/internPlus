
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
  Search,
  LayoutGrid,
  FileCheck,
  Upload,
  Briefcase,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile, Supervisor, DocumentStatus, Language } from '@/types';
import SupervisorCard from '@/components/SupervisorCard';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb } from '@/firebase';
import { getUserProfileByUid } from '@/app/firestoreUserRepository';
import { pageIdToPath } from '@/app/routeUtils';

type InternProfileExtraDoc = {
  supervisorId?: string;
  supervisorName?: string;
};

const INITIAL_DOCUMENTS: DocumentStatus[] = [
  { id: '1', label: 'NATIONAL ID / PASSPORT', fileName: 'Alex_Rivera_Passport.pdf', isUploaded: true, icon: <CreditCard size={18} /> },
  { id: '2', label: 'RESUME / CV', fileName: 'Alex_Rivera_UX_Resume.pdf', isUploaded: true, icon: <FileText size={18} /> },
  { id: '3', label: 'ACADEMIC TRANSCRIPT', isUploaded: false, icon: <GraduationCap size={18} /> },
  { id: '4', label: 'CERTIFICATE', isUploaded: false, icon: <Award size={18} /> },
  { id: '5', label: 'HOUSE REGISTRATION', isUploaded: false, icon: <Home size={18} /> },
  { id: '6', label: 'BANKBOOK COVER', isUploaded: false, icon: <Layout size={18} /> },
  { id: '7', label: 'OTHER', isUploaded: false, icon: <Plus size={18} /> }
];

interface ProfilePageProps {
  lang: Language;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ lang }) => {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [docList, setDocList] = useState<DocumentStatus[]>(INITIAL_DOCUMENTS);
  const [summary] = useState(`Dedicated Junior UI/UX Designer with a focus on creating intuitive digital experiences. Currently undergoing intensive training in the Product Design department at internPlus, focusing on user-centered methodologies and scalable design systems.`);

  const [extra, setExtra] = useState<InternProfileExtraDoc>({});
  const [supervisorProfile, setSupervisorProfile] = useState<UserProfile | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: '',
    position: '',
    studentId: '',
    internPeriod: '',
    bankName: '',
    bankAccountNumber: '',
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

  const t = {
    EN: {
      breadcrumb: "SETTINGS > ACCOUNT",
      title: "My Profile & Identity",
      subtitle: "Review your professional details and secure document storage.",
      progressTitle: "Onboarding Progress",
      summaryTitle: "Professional Summary",
      edit: "EDIT",
      skills: "CORE SKILLS",
      goal: "GOAL",
      langs: "LANGUAGES",
      supervisorTitle: "Supervisor",
      assigned: "ASSIGNED SUPPORT",
      btnMessage: "SEND MESSAGE"
    },
    TH: {
      breadcrumb: "ตั้งค่า > บัญชี",
      title: "โปรไฟล์และตัวตนของฉัน",
      subtitle: "ตรวจสอบรายละเอียดส่วนตัวและคลังเอกสารที่ปลอดภัย",
      progressTitle: "ความคืบหน้าการรับเข้าทำงาน",
      summaryTitle: "สรุปประวัติวิชาชีพ",
      edit: "แก้ไข",
      skills: "ทักษะหลัก",
      goal: "เป้าหมาย",
      langs: "ภาษา",
      supervisorTitle: "ที่ปรึกษา",
      assigned: "ผู้ดูแลที่ได้รับมอบหมาย",
      btnMessage: "ส่งข้อความ"
    }
  }[lang];

  const handleRemoveDoc = (id: string) => {
    if (window.confirm("Remove this document?")) {
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
    await updateDoc(doc(firestoreDb, 'users', user.id), {
      name: editForm.name,
      phone: editForm.phone,
      department: editForm.department,
      position: editForm.position,
      studentId: editForm.studentId,
      internPeriod: editForm.internPeriod,
      bankName: editForm.bankName,
      bankAccountNumber: editForm.bankAccountNumber,
    });
    setIsEditing(false);
  };

  if (!user) return null;

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      {isEditing && (
        <EditProfileModal
          lang={lang}
          form={editForm}
          onChange={setEditForm}
          onClose={() => setIsEditing(false)}
          onSave={() => void handleSaveProfile()}
        />
      )}
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 px-2">
        <div className="animate-in fade-in slide-in-from-left-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] mb-2">{t.breadcrumb}</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t.title}</h1>
          <p className="text-slate-400 text-sm font-medium mt-3">{t.subtitle}</p>
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
                  <button className="absolute bottom-2 right-2 p-3 bg-blue-600 text-white rounded-2xl border-4 border-white shadow-lg hover:bg-blue-700 transition-all">
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
                       <div className="w-1 h-3 bg-blue-600 rounded-full"></div> POSITION
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{user.position}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <div className="w-1 h-3 bg-indigo-600 rounded-full"></div> PERIOD
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{user.internPeriod}</p>
                  </div>
               </div>

               <div className="w-full space-y-6 px-1">
                  <InfoRow label="Student ID" value={user.systemId} highlight />
                  <InfoRow label="Dept." value={user.department} />
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Phone" value={user.phone || ''} />
                  <InfoRow label="Bank" value={user.bankName || '-'} />
                  <InfoRow label="Account" value={user.bankAccountNumber || '-'} />
               </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 space-y-8">
              <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
                <div className="bg-[#0B0F19] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                   <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
                      <div>
                        <h3 className="text-xl font-black tracking-tight">{t.progressTitle}</h3>
                        <p className="text-slate-400 text-xs font-bold mt-1">Completed {uploadedCount} of {docList.length} document uploads.</p>
                      </div>
                   </div>
                   <div className="relative h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-6">
                      <div className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)] transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                   </div>
                   <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <span>INITIATED</span>
                      <span className="text-blue-400">{progressPercent}% COMPLETED</span>
                      <span>VERIFIED</span>
                   </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                   <div className="flex items-center justify-between mb-10">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        {t.summaryTitle}
                      </h3>
                      <button onClick={() => setIsEditing(true)} className="text-blue-600 font-black text-[11px] uppercase tracking-widest hover:underline">{t.edit}</button>
                   </div>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed mb-12 italic opacity-80">
                     "{summary}"
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{t.skills}</h5>
                         <div className="flex flex-wrap gap-2">
                            {['UI Design', 'Figma', 'React'].map(s => (
                              <span key={s} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">{s}</span>
                            ))}
                         </div>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{t.goal}</h5>
                         <p className="text-[11px] font-bold text-slate-600 leading-relaxed">To master the transition from high-fidelity designs to production code.</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">{t.langs}</h5>
                         <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-bold">
                               <span className="text-slate-800">English</span>
                               <span className="text-blue-500">Advanced</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                               <span className="text-slate-800">Spanish</span>
                               <span className="text-blue-500">Native</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

              </div>
          </div>

          <div className="col-span-12 lg:col-span-3">
            <button
              onClick={() => navigate(pageIdToPath('INTERN', 'documents'))}
              className="w-full mb-6 py-4 bg-blue-600 text-white rounded-[1.75rem] border border-blue-600 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
            >
              <CreditCard size={18} /> Document Vault
            </button>
            {supervisorCardData ? (
              <SupervisorCard supervisor={supervisorCardData} lang={lang} />
            ) : (
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-fit">
                <div className="mb-10">
                  <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">{t.supervisorTitle}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t.assigned}</p>
                </div>
                <div className="py-14 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No supervisor assigned</p>
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
  }) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ lang, form, onChange, onClose, onSave }) => {
  const t = {
    EN: {
      title: 'Edit Profile',
      save: 'Save',
      cancel: 'Cancel',
      name: 'Name',
      phone: 'Phone',
      department: 'Department',
      position: 'Position',
      studentId: 'Student ID',
      internPeriod: 'Intern Period',
      bankName: 'Bank',
      bankAccountNumber: 'Bank Account Number',
    },
    TH: {
      title: 'แก้ไขโปรไฟล์',
      save: 'บันทึก',
      cancel: 'ยกเลิก',
      name: 'ชื่อ',
      phone: 'เบอร์โทร',
      department: 'แผนก',
      position: 'ตำแหน่ง',
      studentId: 'รหัสนักศึกษา',
      internPeriod: 'ช่วงฝึกงาน',
      bankName: 'ธนาคาร',
      bankAccountNumber: 'เลขบัญชี',
    },
  }[lang];

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.title}</h3>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
              <X size={18} />
            </button>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={t.name} value={form.name} onChange={(v) => onChange({ ...form, name: v })} />
              <Field label={t.phone} value={form.phone} onChange={(v) => onChange({ ...form, phone: v })} />
              <Field label={t.department} value={form.department} onChange={(v) => onChange({ ...form, department: v })} />
              <Field label={t.position} value={form.position} onChange={(v) => onChange({ ...form, position: v })} />
              <Field label={t.studentId} value={form.studentId} onChange={(v) => onChange({ ...form, studentId: v })} />
              <Field label={t.internPeriod} value={form.internPeriod} onChange={(v) => onChange({ ...form, internPeriod: v })} />
              <Field label={t.bankName} value={form.bankName} onChange={(v) => onChange({ ...form, bankName: v })} />
              <Field label={t.bankAccountNumber} value={form.bankAccountNumber} onChange={(v) => onChange({ ...form, bankAccountNumber: v })} />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={onClose} className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all">
                {t.cancel}
              </button>
              <button onClick={onSave} className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                {t.save}
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

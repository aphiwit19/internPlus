
import React, { useState } from 'react';
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
  Target,
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
import { UserProfile, Supervisor, DocumentStatus, Language } from '@/types';

const userData: UserProfile = {
  id: 'USR-2024-001',
  name: 'Alex Rivera',
  roles: ['INTERN'],
  avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
  systemId: 'STD-6704021',
  studentId: '6704021',
  department: 'Product Design',
  email: 'alex.rivera@internp...',
  phone: '+1 (555) 012-3456',
  position: 'Junior UI/UX Designer',
  internPeriod: 'Jan 2024 - Jun 2024'
};

const supervisorData: Supervisor = {
  name: 'Sarah Connor',
  role: 'LEAD DESIGN MENTOR',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop',
  email: 's.connor@internplus.io',
  phone: '+1 (555) 987-6543',
  department: 'Product Management',
  lineId: 's.connor_ip'
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
  const [docList, setDocList] = useState<DocumentStatus[]>(INITIAL_DOCUMENTS);
  const [summary] = useState(`Dedicated Junior UI/UX Designer with a focus on creating intuitive digital experiences. Currently undergoing intensive training in the Product Design department at internPlus, focusing on user-centered methodologies and scalable design systems.`);

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
      vaultTitle: "Document Vault",
      vaultSub: "Secure storage for your internship documentation.",
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
      vaultTitle: "คลังเอกสาร",
      vaultSub: "ที่จัดเก็บเอกสารการฝึกงานของคุณอย่างปลอดภัย",
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

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      
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
                     <img src={userData.avatar} className="w-full h-full object-cover" alt="" />
                  </div>
                  <button className="absolute bottom-2 right-2 p-3 bg-blue-600 text-white rounded-2xl border-4 border-white shadow-lg hover:bg-blue-700 transition-all">
                     <Camera size={18} />
                  </button>
               </div>
               
               <div className="text-center mb-10">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{userData.name}</h2>
                  <p className="text-blue-600 font-black text-[11px] uppercase tracking-[0.2em] mt-3">{userData.position}</p>
               </div>

               <div className="w-full space-y-4 mb-10">
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <div className="w-1 h-3 bg-blue-600 rounded-full"></div> POSITION
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{userData.position}</p>
                  </div>
                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                       <div className="w-1 h-3 bg-indigo-600 rounded-full"></div> PERIOD
                     </span>
                     <p className="text-[13px] font-black text-slate-800">{userData.internPeriod}</p>
                  </div>
               </div>

               <div className="w-full space-y-6 px-1">
                  <InfoRow label="Student ID" value={userData.systemId} highlight />
                  <InfoRow label="Dept." value={userData.department} />
                  <InfoRow label="Email" value={userData.email} />
                  <InfoRow label="Phone" value={userData.phone || ''} />
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
                      <button className="text-blue-600 font-black text-[11px] uppercase tracking-widest hover:underline">{t.edit}</button>
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

                {/* Unified Doc Vault Section */}
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                   <div className="flex items-center justify-between mb-12">
                     <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t.vaultTitle}</h3>
                       <p className="text-slate-400 text-xs font-bold mt-1">{t.vaultSub}</p>
                     </div>
                     <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                        <ShieldCheck size={16} /> SECURE
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {docList.map((doc) => (
                        <div key={doc.id} className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all relative overflow-hidden">
                          <div className="flex items-center gap-4 overflow-hidden">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-colors">
                               {doc.icon}
                             </div>
                             <div className="overflow-hidden">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{doc.label}</p>
                                <p className={`text-[12px] font-black truncate ${doc.isUploaded ? 'text-slate-800' : 'text-slate-400'}`}>
                                  {doc.fileName || 'Not Uploaded'}
                                </p>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {doc.isUploaded ? (
                               <>
                                  <button 
                                    onClick={() => handleUploadDoc(doc.id)}
                                    className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                    title="Replace"
                                  >
                                    <RefreshCw size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleRemoveDoc(doc.id)}
                                    className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"
                                    title="Remove"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                               </>
                             ) : (
                                <button 
                                  onClick={() => handleUploadDoc(doc.id)}
                                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                >
                                  <Upload size={18} />
                                </button>
                             )}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
          </div>

          <div className="col-span-12 lg:col-span-3">
             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm h-fit">
                <div className="mb-10">
                   <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">{t.supervisorTitle}</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t.assigned}</p>
                </div>

                <div className="flex items-center gap-5 p-5 bg-slate-50 border border-slate-100 rounded-3xl mb-10 transition-all hover:bg-white hover:shadow-xl">
                   <img src={supervisorData.avatar} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-sm" alt="" />
                   <div className="overflow-hidden">
                      <h4 className="text-sm font-black text-slate-900 leading-none truncate">{supervisorData.name}</h4>
                      <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-2 truncate">{supervisorData.role}</p>
                   </div>
                </div>

                <div className="space-y-6 mb-12 px-1">
                   <div className="flex items-center gap-4 group cursor-default">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
                        <Mail size={18} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 truncate">{supervisorData.email}</span>
                   </div>
                   <div className="flex items-center gap-4 group cursor-default">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
                        <Phone size={18} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 truncate">{supervisorData.phone}</span>
                   </div>
                   <div className="flex items-center gap-4 group cursor-default">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
                        <Briefcase size={18} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 truncate">{supervisorData.department}</span>
                   </div>
                </div>

                <button className="w-full py-4 bg-[#F0F7FF] text-blue-600 rounded-[1.75rem] border border-blue-100 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95">
                   <MessageSquare size={18} /> {t.btnMessage}
                </button>
             </div>
          </div>

        </div>
      </div>
    </div>
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

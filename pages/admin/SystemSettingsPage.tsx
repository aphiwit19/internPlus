import React, { useState, useRef, useEffect } from 'react';
import { 
  Rocket, 
  CreditCard, 
  Lock, 
  Plus, 
  Trash2, 
  Check, 
  ChevronRight, 
  Save, 
  AlertCircle, 
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Briefcase,
  Layers,
  Percent,
  Calculator,
  ChevronDown,
  X,
  Upload,
  PenTool,
  ExternalLink,
  MousePointer2,
  FileText,
  MessageSquare,
  Video,
  CheckCircle2,
  Workflow,
  Globe,
  Monitor,
  Trophy,
  History,
  Tag,
  Paperclip,
  FileSearch,
  Settings2,
  Edit3,
  Settings,
  Zap,
  Bell,
  Navigation,
  FileBadge,
  FileCheck,
  GraduationCap,
  Coins,
  ShieldAlert,
  Key,
  Fingerprint,
  Eye,
  EyeOff,
  Circle
} from 'lucide-react';
import { NAV_ITEMS } from '@/constants';
import { Language, PostProgramAccessLevel } from '@/types';
import { PageId } from '@/pageTypes';
import { firestoreDb } from '@/firebase';
import { collection, deleteField, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

import PolicyTrainingManager from '@/pages/admin/components/PolicyTrainingManager';

type SettingsTab = 'onboarding' | 'policy' | 'allowance' | 'access';

type ProcessType = 'DOC_UPLOAD' | 'NDA_SIGN' | 'MODULE_LINK' | 'EXTERNAL_URL';

type WithdrawalUserRow = {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  withdrawalReason?: string;
  withdrawalDetail?: string;
  postProgramAccessLevel?: PostProgramAccessLevel;
  postProgramRetentionPeriod?: string;
};

type PendingUserOperation =
  | {
      type: 'APPLY_WITHDRAWAL';
      userId: string;
      accessLevel: PostProgramAccessLevel;
      retentionPeriod: string;
      name: string;
      avatar: string;
      email?: string;
      withdrawalReason?: string;
      withdrawalDetail?: string;
    }
  ;

interface RoadmapStep {
  id: string;
  title: string;
  active: boolean;
  type: ProcessType;
  targetPage?: PageId;
  externalUrl?: string;
  attachedDocuments: string[];
}

const DEFAULT_ONBOARDING_STEPS: RoadmapStep[] = [
  { id: '1', title: 'Submit Documents (ID, Transcript)', active: true, type: 'DOC_UPLOAD', targetPage: 'profile', attachedDocuments: ['Standard_Verification_Pack.pdf', 'Educational_Consent_Form.pdf'] },
  { id: '2', title: 'Sign Policy & NDA Documents', active: true, type: 'NDA_SIGN', targetPage: 'training', attachedDocuments: ['Company_NDA_v2024.pdf', 'IT_Security_Policy.pdf'] },
  { id: '3', title: 'Check First Project Assignment', active: true, type: 'MODULE_LINK', targetPage: 'assignment', attachedDocuments: [] },
  { id: '4', title: 'Mid-term Performance Sync', active: true, type: 'MODULE_LINK', targetPage: 'feedback', attachedDocuments: [] },
];

interface SystemSettingsPageProps {
  lang: Language;
}

const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('onboarding');
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepType, setNewStepType] = useState<ProcessType>('MODULE_LINK');
  const [newStepTargetPage, setNewStepTargetPage] = useState<PageId | undefined>(undefined);
  const [newStepExternalUrl, setNewStepExternalUrl] = useState('');

  const t = {
    EN: {
      title: "System Settings",
      subtitle: "Global configuration for internship workflows and automation.",
      tabOnboarding: "Onboarding",
      tabPolicy: "Policy & Training",
      tabAllowance: "Allowance",
      tabAccess: "Access Control",
      saveBtn: "Deploy Config",
      saving: "Saving...",
      reset: "Reset Default",
      disclaimer: "Settings affect all users in current program",
      engineTitle: "Onboarding Flow Engine",
      engineSub: "CONFIGURE INTERNAL PROCESS MAPPING",
      allowanceTitle: "Allowance Rules",
      allowanceSub: "FINANCIAL DISBURSEMENT LOGIC",
      accessTitle: "Post-Program Access Control",
      accessSub: "MANAGE USER STATUS AFTER OFFBOARDING",
      addStep: "Add Custom Roadmap Step",
      attachDoc: "Attached Templates",
      docsLimit: "No files attached yet",
      targetModule: "Target Module",
    },
    TH: {
      title: "ตั้งค่าระบบ",
      subtitle: "การกำหนดค่าระดับโกลบอลสำหรับขั้นตอนการทำงานและระบบอัตโนมัติ",
      tabOnboarding: "การรับเข้าทำงาน",
      tabPolicy: "นโยบายและการฝึกอบรม",
      tabAllowance: "เบี้ยเลี้ยง",
      tabAccess: "การเข้าถึง",
      saveBtn: "ปรับใช้การตั้งค่า",
      saving: "กำลังบันทึก...",
      reset: "คืนค่าเริ่มต้น",
      disclaimer: "การตั้งค่าจะมีผลกับผู้ใช้ทุกคนในโปรแกรมปัจจุบัน",
      engineTitle: "เครื่องมือออกแบบการรับเข้าทำงาน",
      engineSub: "กำหนดค่าขั้นตอนการทำงานภายใน",
      allowanceTitle: "กฎระเบียบเบี้ยเลี้ยง",
      allowanceSub: "ตรรกะการจ่ายเงินสนับสนุน",
      accessTitle: "การควบคุมการเข้าถึงหลังจบโปรแกรม",
      accessSub: "จัดการสถานะผู้ใช้หลังจากการพ้นสภาพ",
      addStep: "เพิ่มขั้นตอนแผนผังงานใหม่",
      attachDoc: "แม่แบบเอกสารที่แนบ",
      docsLimit: "ยังไม่มีไฟล์ที่แนบ",
      targetModule: "โมดูลเป้าหมาย",
    }
  }[lang];

  const [onboardingSteps, setOnboardingSteps] = useState<RoadmapStep[]>(DEFAULT_ONBOARDING_STEPS);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(firestoreDb, 'config', 'systemSettings');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as { onboardingSteps?: RoadmapStep[] };
        if (Array.isArray(data.onboardingSteps) && data.onboardingSteps.length > 0) {
          const ordered = [...data.onboardingSteps].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
          setOnboardingSteps(ordered);
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  // Allowance States
  const [payoutFreq, setPayoutFreq] = useState<'MONTHLY' | 'END_PROGRAM'>('MONTHLY');
  const [wfoRate, setWfoRate] = useState(100);
  const [wfhRate, setWfhRate] = useState(50);
  const [applyTax, setApplyTax] = useState(true);
  const [taxPercent, setTaxPercent] = useState(3);

  // Access Control States
  const [accessLevel, setAccessLevel] = useState<'REVOCATION' | 'LIMITED' | 'EXTENDED'>('LIMITED');
  const [retentionPeriod, setRetentionPeriod] = useState('6 Months post-offboard');
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalUserRow[]>([]);
  const [pendingUserOperations, setPendingUserOperations] = useState<Record<string, PendingUserOperation>>({});

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('lifecycleStatus', '==', 'WITHDRAWAL_REQUESTED'));
    return onSnapshot(q, (snap) => {
      setWithdrawalRequests(
        snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            avatar?: string;
            email?: string;
            withdrawalReason?: string;
            withdrawalDetail?: string;
          };
          return {
            id: d.id,
            name: data.name || 'Unknown',
            avatar: data.avatar || `https://picsum.photos/seed/${encodeURIComponent(d.id)}/100/100`,
            email: data.email,
            withdrawalReason: data.withdrawalReason,
            withdrawalDetail: data.withdrawalDetail,
          };
        }),
      );
    });
  }, []);

  const stageSelectWithdrawalUser = (u: WithdrawalUserRow) => {
    setPendingUserOperations((prev) => ({
      ...prev,
      [u.id]: {
        type: 'APPLY_WITHDRAWAL',
        userId: u.id,
        accessLevel: accessLevel as PostProgramAccessLevel,
        retentionPeriod,
        name: u.name,
        avatar: u.avatar,
        email: u.email,
        withdrawalReason: u.withdrawalReason,
        withdrawalDetail: u.withdrawalDetail,
      },
    }));
  };

  const updatePendingApply = (userId: string, updates: Partial<Pick<PendingUserOperation, 'accessLevel' | 'retentionPeriod'>>) => {
    setPendingUserOperations((prev) => {
      const existing = prev[userId];
      if (!existing || existing.type !== 'APPLY_WITHDRAWAL') return prev;
      return {
        ...prev,
        [userId]: {
          ...existing,
          ...updates,
        },
      };
    });
  };

  const selectedUserIds = new Set(
    (Object.values(pendingUserOperations) as PendingUserOperation[])
      .filter((op) => op.type === 'APPLY_WITHDRAWAL')
      .map((op) => op.userId),
  );

  const clearPendingUserOperation = (userId: string) => {
    setPendingUserOperations((prev) => {
      if (!prev[userId]) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };



  const handleSave = async () => {
    setIsSaving(true);
    try {
      const orderedSteps = [...onboardingSteps].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      const batch = writeBatch(firestoreDb);

      const ref = doc(firestoreDb, 'config', 'systemSettings');
      batch.set(
        ref,
        {
          onboardingSteps: orderedSteps,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      for (const op of Object.values(pendingUserOperations) as PendingUserOperation[]) {
        const userRef = doc(firestoreDb, 'users', op.userId);
        if (op.type === 'APPLY_WITHDRAWAL') {
          batch.update(userRef, {
            lifecycleStatus: 'WITHDRAWN',
            postProgramAccessLevel: op.accessLevel,
            postProgramRetentionPeriod: op.retentionPeriod,
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();

      setOnboardingSteps(orderedSteps);
      setPendingUserOperations({});
      alert(lang === 'EN' ? 'System configuration deployed successfully.' : 'ปรับใช้การตั้งค่าระบบเรียบร้อยแล้ว');
    } catch {
      alert(lang === 'EN' ? 'Failed to deploy config.' : 'ไม่สามารถปรับใช้การตั้งค่าได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm(lang === 'EN' ? 'Are you sure you want to reset all settings to default?' : 'คุณแน่ใจหรือไม่ว่าต้องการล้างการตั้งค่าทั้งหมดเป็นค่าเริ่มต้น?')) {
      setOnboardingSteps(DEFAULT_ONBOARDING_STEPS);
    }
  };

  const handleToggleStep = (id: string) => {
    setOnboardingSteps(steps => steps.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const handleUpdateStep = (id: string, updates: Partial<RoadmapStep>) => {
    setOnboardingSteps(steps => steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleCreateNewStep = () => {
    const title = newStepTitle.trim();
    if (!title) {
      alert(lang === 'EN' ? 'Please enter Step Title.' : 'กรุณากรอกชื่อขั้นตอน');
      return;
    }
    if (newStepType === 'EXTERNAL_URL' && !newStepExternalUrl.trim()) {
      alert(lang === 'EN' ? 'Please enter External URL.' : 'กรุณากรอกลิงก์ภายนอก');
      return;
    }
    if (newStepType !== 'EXTERNAL_URL' && !newStepTargetPage) {
      alert(lang === 'EN' ? 'Please select Target Module.' : 'กรุณาเลือกโมดูลเป้าหมาย');
      return;
    }

    const nextId = (Math.max(0, ...onboardingSteps.map(s => Number(s.id) || 0)) + 1).toString();
    setOnboardingSteps((prev) =>
      [...prev,
        {
          id: nextId,
          title,
          active: true,
          type: newStepType,
          targetPage: newStepType === 'EXTERNAL_URL' ? undefined : newStepTargetPage,
          externalUrl: newStepType === 'EXTERNAL_URL' ? newStepExternalUrl.trim() : undefined,
          attachedDocuments: [],
        },
      ].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)),
    );

    setIsAddingStep(false);
    setNewStepTitle('');
    setNewStepType('MODULE_LINK');
    setNewStepTargetPage(undefined);
    setNewStepExternalUrl('');
  };

  const handleAttachFile = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files as FileList);
      if (files.length > 0) {
        setOnboardingSteps(steps => steps.map(s => {
          if (s.id !== id) return s;
          const newFileNames = files.map(f => f.name);
          return { ...s, attachedDocuments: [...s.attachedDocuments, ...newFileNames] };
        }));
      }
    };
    input.click();
  };

  const handleRemoveDoc = (stepId: string, fileName: string) => {
    setOnboardingSteps(steps => steps.map(s => {
      if (s.id !== stepId) return s;
      return { ...s, attachedDocuments: s.attachedDocuments.filter(name => name !== fileName) };
    }));
  };

  const getProcessTypeIcon = (type: ProcessType) => {
    switch(type) {
      case 'DOC_UPLOAD': return <Upload size={14} className="text-blue-500" />;
      case 'NDA_SIGN': return <PenTool size={14} className="text-indigo-500" />;
      case 'MODULE_LINK': return <MousePointer2 size={14} className="text-amber-500" />;
      case 'EXTERNAL_URL': return <ExternalLink size={14} className="text-slate-500" />;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-[1700px] mx-auto w-full flex flex-col h-full">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{t.title}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{t.subtitle}</p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
             <TabBtn active={activeTab === 'onboarding'} onClick={() => setActiveTab('onboarding')} icon={<Rocket size={16}/>} label={t.tabOnboarding} />
             <TabBtn active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} icon={<ShieldCheck size={16}/>} label={t.tabPolicy} />
             <TabBtn active={activeTab === 'allowance'} onClick={() => setActiveTab('allowance')} icon={<CreditCard size={16}/>} label={t.tabAllowance} />
             <TabBtn active={activeTab === 'access'} onClick={() => setActiveTab('access')} icon={<Lock size={16}/>} label={t.tabAccess} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide">
          
          {/* TAB: ONBOARDING */}
          {activeTab === 'onboarding' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="mb-12">
                       <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.engineTitle}</h2>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">{t.engineSub}</p>
                    </div>

                    <div className="space-y-4">
                       {onboardingSteps.map((step, idx) => (
                         <div key={step.id} className="space-y-2">
                           <div className={`flex items-center justify-between p-6 bg-[#F8FAFC]/80 border border-slate-100 rounded-[1.75rem] transition-all hover:bg-white hover:border-blue-200 hover:shadow-xl group relative ${editingStepId === step.id ? 'ring-4 ring-blue-500/10 border-blue-600 bg-white shadow-2xl' : ''}`}>
                              <div className="flex items-center gap-6 flex-1">
                                 <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-xs font-black text-slate-400 shadow-sm">
                                   {(idx + 1).toString().padStart(2, '0')}
                                 </div>
                                 <div className="flex-1">
                                    <h4 className={`text-[15px] font-bold tracking-tight transition-all ${step.active ? 'text-slate-900' : 'text-slate-300'}`}>{step.title}</h4>
                                    <div className="flex items-center gap-3 mt-1.5">
                                       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm">
                                          {getProcessTypeIcon(step.type)}
                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{step.type.replace('_', ' ')}</span>
                                       </div>
                                       {step.targetPage && (
                                         <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1">
                                            <ChevronRight size={10} strokeWidth={4}/> MODULE: {step.targetPage}
                                         </span>
                                       )}
                                       {step.attachedDocuments.length > 0 && (
                                         <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 ml-2">
                                            <Paperclip size={10} strokeWidth={4}/> {step.attachedDocuments.length} FILES
                                         </span>
                                       )}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <button 
                                   onClick={() => setEditingStepId(editingStepId === step.id ? null : step.id)} 
                                   className={`p-2.5 rounded-xl transition-all ${editingStepId === step.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'}`}
                                 >
                                   <Edit3 size={18}/>
                                 </button>
                                 <div 
                                   onClick={() => handleToggleStep(step.id)} 
                                   className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${step.active ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-200'}`}
                                 >
                                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${step.active ? 'left-7' : 'left-1'}`}></div>
                                 </div>
                              </div>
                           </div>

                           {/* EXPANDED EDIT VIEW (RESTORED) */}
                           {editingStepId === step.id && (
                             <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300 space-y-8 mx-2 mb-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Process Title</label>
                                    <input 
                                      type="text" 
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                                      value={step.title}
                                      onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Step Logic Type</label>
                                    <select 
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none appearance-none"
                                      value={step.type}
                                      onChange={(e) => handleUpdateStep(step.id, { type: e.target.value as ProcessType })}
                                    >
                                      <option value="DOC_UPLOAD">Document Submission (PDF/IMG)</option>
                                      <option value="NDA_SIGN">E-Signature Confirmation</option>
                                      <option value="MODULE_LINK">Internal Feature Redirection</option>
                                      <option value="EXTERNAL_URL">External Website Link</option>
                                    </select>
                                  </div>
                               </div>

                               {(step.type === 'NDA_SIGN' || step.type === 'DOC_UPLOAD') && (
                                 <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                       <div className="flex items-center gap-4">
                                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                             <FileSearch size={20}/>
                                          </div>
                                          <div>
                                             <h5 className="text-sm font-black text-slate-900 leading-none">{t.attachDoc}</h5>
                                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Serve multiple templates for this step</p>
                                          </div>
                                       </div>
                                       <button 
                                          onClick={() => handleAttachFile(step.id)}
                                          className="px-6 py-3 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl"
                                       >
                                          <Plus size={14}/> Add New Template
                                       </button>
                                    </div>

                                    <div className="space-y-2">
                                       {step.attachedDocuments.length > 0 ? (
                                         step.attachedDocuments.map((docName, dIdx) => (
                                          <div key={dIdx} className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center justify-between group/doc hover:bg-white hover:border-blue-200 transition-all">
                                             <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-500 border border-slate-100 shadow-sm">
                                                  <FileText size={16} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800">{docName}</span>
                                             </div>
                                             <button 
                                               onClick={() => handleRemoveDoc(step.id, docName)}
                                               className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/doc:opacity-100"
                                             >
                                                <Trash2 size={16}/>
                                             </button>
                                          </div>
                                         ))
                                       ) : (
                                         <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                            <FileText size={32} className="text-slate-200" />
                                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{t.docsLimit}</p>
                                         </div>
                                       )}
                                    </div>
                                 </div>
                               )}

                               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">{t.targetModule}</label>
                                     <div className="grid grid-cols-2 gap-2">
                                        {NAV_ITEMS.filter(n => n.roles.includes('INTERN')).map(item => (
                                          <button 
                                            key={item.id}
                                            onClick={() => handleUpdateStep(step.id, { targetPage: item.id })}
                                            className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-2 border ${step.targetPage === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200'}`}
                                          >
                                            {item.icon} {item.label}
                                          </button>
                                        ))}
                                     </div>
                                  </div>
                                  <div className="flex flex-col justify-end">
                                     <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-start gap-4">
                                        <AlertCircle size={20} className="text-blue-500 shrink-0"/>
                                        <p className="text-[11px] text-blue-700 leading-relaxed font-bold italic">
                                          Ensuring a target module is correctly mapped allows the system to provide "Next Action" shortcuts on the intern's home screen.
                                        </p>
                                     </div>
                                  </div>
                               </div>

                               <div className="pt-6 border-t border-slate-100 flex justify-end">
                                  <button onClick={() => setEditingStepId(null)} className="px-10 py-3 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl">Done Editing</button>
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                       
                       <button onClick={() => setIsAddingStep((v) => !v)} className="w-full py-6 border-4 border-dashed border-slate-100 text-slate-300 rounded-[2.25rem] font-black text-xs uppercase hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-3 group">
                          <Plus size={32}/> {t.addStep}
                       </button>

                       {isAddingStep && (
                         <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] animate-in slide-in-from-top-4 duration-300 space-y-8 mx-2 mt-4">
                           <div className="flex items-start justify-between gap-6">
                             <div>
                               <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">{lang === 'EN' ? 'CUSTOM WORKFLOW STEP' : 'เพิ่มขั้นตอนการทำงานที่กำหนดเอง'}</div>
                               <h3 className="text-2xl font-black text-slate-900 tracking-tight">{lang === 'EN' ? 'Integrate New Step' : 'เพิ่มขั้นตอนใหม่'}</h3>
                             </div>
                             <button
                               type="button"
                               onClick={() => setIsAddingStep(false)}
                               className="p-3 rounded-2xl text-slate-300 hover:text-slate-600 hover:bg-white transition-all"
                               aria-label="Close"
                             >
                               <X size={20} />
                             </button>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">STEP TITLE</label>
                               <input
                                 type="text"
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all"
                                 placeholder={lang === 'EN' ? 'e.g. Upload Identity Files' : 'เช่น อัปโหลดเอกสารสำคัญ'}
                                 value={newStepTitle}
                                 onChange={(e) => setNewStepTitle(e.target.value)}
                               />
                             </div>

                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">ACTION TYPE</label>
                               <select
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none appearance-none"
                                 value={newStepType}
                                 onChange={(e) => setNewStepType(e.target.value as ProcessType)}
                               >
                                 <option value="MODULE_LINK">Internal Module Path</option>
                                 <option value="DOC_UPLOAD">Document Submission (PDF/IMG)</option>
                                 <option value="NDA_SIGN">E-Signature Confirmation</option>
                                 <option value="EXTERNAL_URL">External Website Link</option>
                               </select>
                             </div>
                           </div>

                           {newStepType === 'EXTERNAL_URL' ? (
                             <div>
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">EXTERNAL URL</label>
                               <input
                                 type="url"
                                 className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:border-blue-200 transition-all"
                                 placeholder="https://..."
                                 value={newStepExternalUrl}
                                 onChange={(e) => setNewStepExternalUrl(e.target.value)}
                               />
                             </div>
                           ) : (
                             <div>
                               <div className="flex items-center justify-between mb-4">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">TARGET MODULE (REDIRECTION)</label>
                                 {newStepTargetPage && (
                                   <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{String(newStepTargetPage).replace('-', ' ')}</div>
                                 )}
                               </div>
                               <div className="p-6 bg-white rounded-[2rem] border border-slate-100">
                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                   {NAV_ITEMS.filter((n) => n.roles.includes('INTERN')).map((item) => (
                                     <button
                                       key={item.id}
                                       type="button"
                                       onClick={() => setNewStepTargetPage(item.id)}
                                       className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-left flex items-center gap-2 border ${newStepTargetPage === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-blue-200 hover:bg-white'}`}
                                     >
                                       {item.icon} {item.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>
                             </div>
                           )}

                           <div className="pt-2 flex items-center justify-end gap-3">
                             <button
                               type="button"
                               onClick={() => setIsAddingStep(false)}
                               className="px-10 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                             >
                               {lang === 'EN' ? 'Cancel' : 'ยกเลิก'}
                             </button>
                             <button
                               type="button"
                               onClick={handleCreateNewStep}
                               className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                             >
                               {lang === 'EN' ? 'Integrate Step' : 'เพิ่มขั้นตอน'}
                             </button>
                           </div>
                         </div>
                       )}
                    </div>
                 </section>
              </div>

              <div className="lg:col-span-4 space-y-8">
                 <div className="bg-[#0B0F19] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden h-fit">
                    <h3 className="text-2xl font-black mb-4 tracking-tight">Process Intelligence</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-6 italic">Mapping steps to actual modules ensures correct workspace redirection.</p>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] flex items-center gap-5">
                       <CheckCircle2 size={24} className="text-emerald-400"/>
                       <p className="text-[14px] font-black text-slate-100">Auto-Handoff Active</p>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* TAB: POLICY & TRAINING */}
          {activeTab === 'policy' && (
            <PolicyTrainingManager lang={lang} />
          )}

          {/* TAB: ALLOWANCE (EXACT MATCH TO PREVIOUS GOOD STATE) */}
          {activeTab === 'allowance' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center gap-6 mb-12">
                      <div className="w-16 h-16 bg-[#4F46E5] text-white rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-indigo-100">
                        <Calculator size={32} />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t.allowanceTitle}</h2>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">{t.allowanceSub}</p>
                      </div>
                    </div>

                    <div className="space-y-12">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">PAYOUT FREQUENCY</label>
                        <div className="flex gap-4">
                           <button 
                             onClick={() => setPayoutFreq('MONTHLY')}
                             className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${payoutFreq === 'MONTHLY' ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'}`}
                           >
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${payoutFreq === 'MONTHLY' ? 'border-blue-600' : 'border-slate-200'}`}>
                                {payoutFreq === 'MONTHLY' && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                             </div>
                             <span className={`text-xs font-black uppercase tracking-widest ${payoutFreq === 'MONTHLY' ? 'text-slate-900' : 'text-slate-300'}`}>MONTHLY</span>
                           </button>
                           <button 
                             onClick={() => setPayoutFreq('END_PROGRAM')}
                             className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-4 ${payoutFreq === 'END_PROGRAM' ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'}`}
                           >
                             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${payoutFreq === 'END_PROGRAM' ? 'border-blue-600' : 'border-slate-200'}`}>
                                {payoutFreq === 'END_PROGRAM' && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
                             </div>
                             <span className={`text-xs font-black uppercase tracking-widest ${payoutFreq === 'END_PROGRAM' ? 'text-slate-900' : 'text-slate-300'}`}>END PROGRAM</span>
                           </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">WFO RATE (DAY)</label>
                            <div className="relative group">
                               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-blue-600 transition-colors">฿</div>
                               <input 
                                 type="number" 
                                 className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 transition-all"
                                 value={wfoRate}
                                 onChange={e => setWfoRate(Number(e.target.value))}
                               />
                            </div>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">WFH RATE (DAY)</label>
                            <div className="relative group">
                               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-blue-600 transition-colors">฿</div>
                               <input 
                                 type="number" 
                                 className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] pl-14 pr-6 py-4 text-sm font-black text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 transition-all"
                                 value={wfhRate}
                                 onChange={e => setWfhRate(Number(e.target.value))}
                               />
                            </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="bg-[#EEF2FF] p-8 rounded-[2rem] border border-[#E0E7FF] relative">
                            <div className="flex items-center justify-between mb-8">
                               <span className="text-[10px] font-black text-[#4338CA] uppercase tracking-widest">APPLY LOCAL TAX</span>
                               <button 
                                 onClick={() => setApplyTax(!applyTax)}
                                 className={`w-12 h-6 rounded-full relative transition-all ${applyTax ? 'bg-[#4338CA]' : 'bg-slate-300'}`}
                               >
                                 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${applyTax ? 'left-7' : 'left-1'}`}></div>
                               </button>
                            </div>
                            <div className="relative bg-white rounded-2xl border border-[#E0E7FF] flex items-center justify-between px-6 py-4">
                               <input 
                                 type="number" 
                                 className="w-full bg-transparent text-xl font-black text-[#4338CA] outline-none"
                                 value={taxPercent}
                                 onChange={e => setTaxPercent(Number(e.target.value))}
                               />
                               <span className="text-slate-300 font-black">%</span>
                            </div>
                         </div>
                      </div>
                    </div>
                  </section>
               </div>

               <div className="lg:col-span-4 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-[#FFFCF0] border border-[#FEF3C7] rounded-[3.5rem] p-10 relative overflow-hidden flex flex-col h-fit shadow-lg shadow-amber-900/5">
                     <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-8">
                        <AlertCircle size={24} />
                     </div>
                     <h3 className="text-2xl font-black text-[#92400E] mb-6 tracking-tight">Financial Disclaimer</h3>
                     <p className="text-[#B45309] text-sm leading-relaxed font-medium italic">
                        Changing calculation methods or rates mid-month will only affect future records. Existing "Verified" records will retain original values.
                     </p>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ACCESS CONTROL (EXACT MATCH TO PREVIOUS GOOD STATE) */}
          {activeTab === 'access' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
               <div className="lg:col-span-8">
                  <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="mb-12">
                       <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{t.accessTitle}</h2>
                       <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-3">{t.accessSub}</p>
                    </div>

                    <div className="space-y-12">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block">STANDARD ACCESS LEVEL</label>
                          <div className="space-y-3">
                             <AccessCard 
                               active={accessLevel === 'REVOCATION'} 
                               onClick={() => setAccessLevel('REVOCATION')} 
                               title="IMMEDIATE REVOCATION" 
                               desc="Account locked instantly on finish" 
                             />
                             <AccessCard 
                               active={accessLevel === 'LIMITED'} 
                               onClick={() => setAccessLevel('LIMITED')} 
                               title="LIMITED (RECOMMENDED)" 
                               desc="Only certificates and profile access" 
                             />
                             <AccessCard 
                               active={accessLevel === 'EXTENDED'} 
                               onClick={() => setAccessLevel('EXTENDED')} 
                               title="EXTENDED VIEW" 
                               desc="Keep full read-only history" 
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">DEFAULT RETENTION PERIOD</label>
                             <div className="bg-[#F8FAFC] border border-slate-200 rounded-[1.75rem] flex items-center px-8 py-5 group hover:border-blue-300 transition-all cursor-pointer">
                                <Clock size={20} className="text-slate-300 mr-4" />
                                <span className="flex-1 text-[14px] font-bold text-slate-700">{retentionPeriod}</span>
                             </div>
                          </div>
                          <div className="flex flex-col justify-end">
                             <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[1.75rem] px-8 py-5 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                                   <ShieldCheck size={24} />
                                </div>
                                <span className="text-[11px] font-black text-blue-700 leading-tight uppercase italic">
                                   COMPLIANT WITH ENTERPRISE <br /> DATA RETENTION POLICY V4.0
                                </span>
                             </div>
                          </div>
                       </div>

                       <div className="pt-8 border-t border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">WITHDRAWAL REQUESTS</div>
                          <div className="space-y-3">
                            {withdrawalRequests.length === 0 ? (
                              <div className="py-10 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                                <Users size={28} className="text-slate-200" />
                                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{lang === 'EN' ? 'No withdrawal requests' : 'ยังไม่มีคำขอถอนตัว'}</p>
                              </div>
                            ) : (
                              withdrawalRequests.filter((u) => !selectedUserIds.has(u.id)).map((u) => (
                                (() => {
                                  const pending = pendingUserOperations[u.id];
                                  const isSelected = pending?.type === 'APPLY_WITHDRAWAL';
                                  return (
                                <div key={u.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-center gap-4">
                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <img src={u.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white" alt="" />
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-800 truncate">{u.name}</div>
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.withdrawalReason || '-'}</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => stageSelectWithdrawalUser(u)}
                                      disabled={isSelected}
                                      className="px-5 py-2 bg-[#111827] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all"
                                    >
                                      {isSelected ? (lang === 'EN' ? 'Selected' : 'เลือกแล้ว') : (lang === 'EN' ? 'Select' : 'เลือก')}
                                    </button>
                                  </div>

                                  {u.withdrawalDetail && (
                                    <div className="md:col-span-2 text-[11px] text-slate-500 font-medium italic pt-1 break-words">{u.withdrawalDetail}</div>
                                  )}
                                </div>
                                  );
                                })()
                              ))
                            )}
                          </div>
                       </div>
                    </div>
                  </section>
               </div>

               {/* Right Sidebar: Whitelist */}
               <div className="lg:col-span-4 space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-white border border-slate-100 rounded-[3.5rem] p-10 flex flex-col h-full shadow-sm">
                     <div className="flex items-center gap-3 mb-8">
                        <Plus size={20} className="text-slate-400" />
                        <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">POST-PROGRAM ACCESS LIST</h3>
                     </div>
                     <p className="text-slate-400 text-xs leading-relaxed font-medium mb-10">
                        {lang === 'EN' ? 'Selected withdrawal requests waiting for deploy.' : 'รายการที่ถูกเลือกเพื่อกำหนดสิทธิ์ (รอกด Deploy)'}
                     </p>

                     <div className="space-y-3 mb-10 flex-1">
                        {(Object.values(pendingUserOperations) as PendingUserOperation[]).filter((op) => op.type === 'APPLY_WITHDRAWAL').length === 0 ? (
                          <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3">
                            <History size={32} className="text-slate-200" />
                            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{lang === 'EN' ? 'No selected users yet' : 'ยังไม่มีรายชื่อที่ถูกเลือก'}</p>
                          </div>
                        ) : (
                          (Object.values(pendingUserOperations) as PendingUserOperation[])
                            .filter((op) => op.type === 'APPLY_WITHDRAWAL')
                            .map((op) => (
                              <div key={op.userId} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-3 hover:bg-white hover:border-blue-100 transition-all">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-4 min-w-0">
                                    <img src={op.avatar} className="w-10 h-10 rounded-xl object-cover ring-2 ring-white" alt="" />
                                    <div className="min-w-0">
                                      <div className="text-sm font-black text-slate-700 truncate">{op.name}</div>
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{op.withdrawalReason || op.email || op.userId}</div>
                                    </div>
                                  </div>
                                </div>

                                {op.withdrawalDetail && (
                                  <div className="text-[10px] text-slate-500 font-medium italic break-words">{op.withdrawalDetail}</div>
                                )}

                                <div className="flex items-center gap-2">
                                  <select
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-700"
                                    value={op.accessLevel}
                                    onChange={(e) => updatePendingApply(op.userId, { accessLevel: e.target.value as PostProgramAccessLevel })}
                                  >
                                    <option value="REVOCATION">REVOCATION</option>
                                    <option value="LIMITED">LIMITED</option>
                                    <option value="EXTENDED">EXTENDED</option>
                                  </select>

                                  <input
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[9px] font-black tracking-widest text-slate-700"
                                    value={op.retentionPeriod}
                                    onChange={(e) => updatePendingApply(op.userId, { retentionPeriod: e.target.value })}
                                  />

                                  <button
                                    onClick={() => clearPendingUserOperation(op.userId)}
                                    className="px-4 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:border-rose-200 transition-all"
                                  >
                                    {lang === 'EN' ? 'Delete' : 'ลบ'}
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                     </div>

                     <button className="w-full py-5 border-2 border-dashed border-blue-200 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all" disabled>
                        {lang === 'EN' ? 'ADD USER (COMING SOON)' : 'เพิ่มรายชื่อ (เร็วๆ นี้)'}
                     </button>
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* Global Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-72 bg-white/80 backdrop-blur-md border-t border-slate-100 p-6 z-40 flex justify-center">
           <div className="max-w-[1700px] w-full flex justify-between items-center px-4 md:px-10">
              <div className="flex items-center gap-4 text-slate-400">
                <AlertCircle size={18} className="text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t.disclaimer}</span>
              </div>
              <div className="flex gap-4">
                <button onClick={handleReset} className="px-10 py-3.5 bg-slate-100 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">{t.reset}</button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-14 py-3.5 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl flex items-center gap-3"
                >
                  {isSaving ? <><Clock className="animate-spin" size={18}/> {t.saving}</> : <><Save size={18}/> {t.saveBtn}</>}
                </button>
              </div>
           </div>
        </div>
      </div>

    </div>
  );
};

// --- SUB-COMPONENTS ---

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2.5 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
    {icon} {label}
  </button>
);

const AccessCard = ({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) => (
  <button 
    onClick={onClick}
    className={`w-full p-6 rounded-[1.75rem] border-2 transition-all flex items-center gap-6 text-left group ${
      active ? 'border-blue-600 bg-white shadow-xl shadow-blue-500/5' : 'border-slate-50 bg-[#F8FAFC]'
    }`}
  >
    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-blue-600' : 'border-slate-200'}`}>
       {active && <div className="w-3 h-3 bg-blue-600 rounded-full"></div>}
    </div>
    <div>
       <p className={`text-xs font-black uppercase tracking-widest mb-1 ${active ? 'text-slate-900' : 'text-slate-400'}`}>{title}</p>
       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{desc}</p>
    </div>
  </button>
);

export default SystemSettingsPage;

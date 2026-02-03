import React, { useEffect, useMemo, useState } from 'react';
import { 
  CheckCircle2, 
  Search,
  BookOpen,
  MessageSquare,
  Video,
  ClipboardCheck,
  GraduationCap,
  PenTool,
  Lock,
  Upload,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language } from '@/types';
import { PageId } from '@/pageTypes';
import { firestoreDb } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

type ProcessType = 'DOC_UPLOAD' | 'NDA_SIGN' | 'MODULE_LINK' | 'EXTERNAL_URL';

interface ConfigRoadmapStep {
  id: string;
  title: string;
  active?: boolean;
  type: ProcessType;
  targetPage?: PageId;
  externalUrl?: string;
  attachedDocuments: string[];
}

const DEFAULT_ONBOARDING_STEPS: ConfigRoadmapStep[] = [
  {
    id: '1',
    title: 'Submit Documents (ID, Transcript)',
    active: true,
    type: 'DOC_UPLOAD',
    targetPage: 'profile',
    attachedDocuments: ['Standard_Verification_Pack.pdf', 'Educational_Consent_Form.pdf'],
  },
  {
    id: '2',
    title: 'Sign Policy & NDA Documents',
    active: true,
    type: 'NDA_SIGN',
    targetPage: 'training',
    attachedDocuments: ['Company_NDA_v2024.pdf', 'IT_Security_Policy.pdf'],
  },
  {
    id: '3',
    title: 'Check First Project Assignment',
    active: true,
    type: 'MODULE_LINK',
    targetPage: 'assignment',
    attachedDocuments: [],
  },
  {
    id: '4',
    title: 'Mid-term Performance Sync',
    active: true,
    type: 'MODULE_LINK',
    targetPage: 'feedback',
    attachedDocuments: [],
  },
];

interface RoadmapStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'completed' | 'next-action' | 'locked';
  icon: React.ReactNode;
  category: 'onboarding' | 'internship' | 'evaluation' | 'offboarding';
  actionLabel?: string;
  targetPage?: PageId;
}

interface OnboardingPageProps {
  onNavigate: (id: PageId) => void;
  lang: Language;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onNavigate, lang }) => {
  const [configSteps, setConfigSteps] = useState<ConfigRoadmapStep[] | null>(null);
  const [roadmapPage, setRoadmapPage] = useState(1);

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setConfigSteps(null);
        return;
      }
      const data = snap.data() as { onboardingSteps?: ConfigRoadmapStep[] };
      if (!Array.isArray(data.onboardingSteps)) {
        setConfigSteps(null);
        return;
      }
      setConfigSteps(data.onboardingSteps);
    });
  }, []);
  const t = {
    EN: {
      title: "Internship Roadmap",
      subtitle: "Follow this journey designed by your supervisor to complete your program.",
      stepsDone: "STEPS DONE",
      step: "Step",
      details: "View Details",
      start: "Start Milestone",
      locked: "Locked",
      action: "Action"
    },
    TH: {
      title: "แผนผังการฝึกงาน",
      subtitle: "เดินตามแผนที่ที่ที่ปรึกษาของคุณกำหนดเพื่อจบโปรแกรมให้สมบูรณ์",
      stepsDone: "ขั้นตอนสำเร็จ",
      step: "ขั้นตอนที่",
      details: "ดูรายละเอียด",
      start: "เริ่มดำเนินการ",
      locked: "ล็อคอยู่",
      action: "ดำเนินการ"
    }
  }[lang];

  const orderedConfigSteps = useMemo(() => {
    const source = configSteps ?? DEFAULT_ONBOARDING_STEPS;
    return source
      .filter((s) => s.active !== false)
      .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  }, [configSteps]);

  const isUsingFallback = configSteps === null;

  const requiredDocs = useMemo(() => {
    const docs: string[] = [];
    for (const s of orderedConfigSteps) {
      for (const d of s.attachedDocuments ?? []) {
        docs.push(d);
      }
    }
    return docs;
  }, [orderedConfigSteps]);

  const getStepIcon = (type: ProcessType) => {
    switch (type) {
      case 'DOC_UPLOAD':
        return <Upload size={24} />;
      case 'NDA_SIGN':
        return <PenTool size={24} />;
      case 'EXTERNAL_URL':
        return <Search size={24} />;
      case 'MODULE_LINK':
      default:
        return <BookOpen size={24} />;
    }
  };

  const getStepDescription = (s: ConfigRoadmapStep, index: number) => {
    if (index === 0) {
      if (requiredDocs.length > 0) {
        return lang === 'EN' ? `Required templates: ${requiredDocs.join(', ')}` : `เอกสารที่ต้องใช้: ${requiredDocs.join(', ')}`;
      }
      return lang === 'EN'
        ? 'Upload required documents and manage your files.'
        : 'อัปโหลดเอกสารที่กำหนด และจัดการไฟล์ของคุณ';
    }
    if ((s.attachedDocuments ?? []).length > 0) {
      return lang === 'EN'
        ? `Templates: ${(s.attachedDocuments ?? []).join(', ')}`
        : `แม่แบบ: ${(s.attachedDocuments ?? []).join(', ')}`;
    }
    return lang === 'EN' ? 'View details and proceed to the required action.' : 'ดูรายละเอียดและดำเนินการตามขั้นตอนที่กำหนด';
  };

  const ROADMAP_STEPS: RoadmapStep[] = useMemo(() => {
    if (orderedConfigSteps.length === 0) return [];

    return orderedConfigSteps.map((s, idx) => {
      const status: RoadmapStep['status'] = idx <= 1 ? 'completed' : idx === 2 ? 'next-action' : 'locked';
      const isDocUpload = s.type === 'DOC_UPLOAD';
      const targetPage = isDocUpload ? 'documents' : s.targetPage;
      const actionLabel = status === 'next-action' ? t.start : t.details;

      return {
        id: s.id,
        stepNumber: idx + 1,
        title: s.title,
        description: getStepDescription(s, idx),
        status,
        icon: getStepIcon(s.type),
        category: 'onboarding',
        actionLabel,
        targetPage,
      };
    });
  }, [orderedConfigSteps, requiredDocs, lang, t.details, t.start]);

  const ROADMAP_PAGE_SIZE = 2;

  const roadmapPageCount = useMemo(() => {
    const count = Math.ceil(ROADMAP_STEPS.length / ROADMAP_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [ROADMAP_STEPS.length]);

  useEffect(() => {
    setRoadmapPage((prev) => {
      if (prev < 1) return 1;
      if (prev > roadmapPageCount) return roadmapPageCount;
      return prev;
    });
  }, [roadmapPageCount]);

  const DISPLAYED_ROADMAP_STEPS = useMemo(() => {
    const start = (roadmapPage - 1) * ROADMAP_PAGE_SIZE;
    return ROADMAP_STEPS.slice(start, start + ROADMAP_PAGE_SIZE);
  }, [ROADMAP_STEPS, roadmapPage]);

  const completedCount = ROADMAP_STEPS.filter((s) => s.status === 'completed').length;
  const totalSteps = ROADMAP_STEPS.length;

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative">
      <div className="p-6 md:p-10 pb-4 max-w-5xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-slate-500 text-xs md:text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase border border-blue-100 flex items-center gap-2 w-fit">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
          {completedCount} / {totalSteps} {t.stepsDone}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-6 pb-24 px-6 md:px-10 scrollbar-hide">
        <div className="max-w-5xl mx-auto relative">

          {DISPLAYED_ROADMAP_STEPS.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-8 text-slate-600">
              <div className="text-sm font-bold">
                {isUsingFallback
                  ? (lang === 'EN' ? 'No deployed roadmap config found. Showing default roadmap.' : 'ไม่พบการตั้งค่าที่ถูกปรับใช้ แสดงค่าเริ่มต้น')
                  : (lang === 'EN' ? 'No steps are currently enabled by admin.' : 'ยังไม่มีขั้นตอนที่เปิดใช้งานโดยแอดมิน')}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {lang === 'EN' ? 'Ask an admin to enable steps and deploy config in System Settings.' : 'ให้แอดมินเปิดใช้งานขั้นตอนและกดปรับใช้ในหน้า System Settings'}
              </div>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-12">
              {DISPLAYED_ROADMAP_STEPS.map((step) => (
              <div key={step.id} className="relative flex items-stretch gap-4 md:gap-8 group">
                <div className="relative flex-shrink-0 w-[4.5rem] md:w-[5.25rem] flex justify-center">
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200" />
                  <div className="relative z-10 pt-1">
                    <div className={`w-[3.5rem] h-[3.5rem] md:w-[4.5rem] md:h-[4.5rem] rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
                      step.status === 'completed'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                        : step.status === 'next-action'
                          ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50'
                          : 'bg-white border-slate-200 text-slate-300'
                    }`}>
                      <div className="scale-75 md:scale-100">{step.icon}</div>
                    </div>

                    {step.status === 'completed' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full border-2 md:border-4 border-white flex items-center justify-center text-white">
                        <CheckCircle2 size={10} strokeWidth={4} />
                      </div>
                    )}
                    {step.status === 'next-action' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-blue-500 rounded-full border-2 md:border-4 border-white flex items-center justify-center text-white">
                        <Clock size={10} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex-1 bg-white p-4 md:p-6 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  step.status === 'completed'
                    ? 'border-slate-100'
                    : step.status === 'next-action'
                      ? 'border-blue-200 shadow-md'
                      : 'border-slate-100 opacity-60'
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.step} {step.stepNumber}</span>
                    </div>
                    <h3 className={`text-base md:text-lg font-bold tracking-tight ${
                      step.status === 'completed' ? 'text-slate-600' : 'text-slate-900'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1 leading-snug">{step.description}</p>
                  </div>

                  <div className="flex-shrink-0">
                    {step.status === 'locked' ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 text-[10px] font-bold cursor-not-allowed">
                        <Lock size={12} /> {t.locked}
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          const cfg = orderedConfigSteps.find((s) => s.id === step.id);
                          if (cfg?.type === 'EXTERNAL_URL' && cfg.externalUrl) {
                            window.open(cfg.externalUrl, '_blank', 'noopener,noreferrer');
                            return;
                          }
                          if (step.targetPage) onNavigate(step.targetPage);
                        }}
                        className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-sm ${
                          step.status === 'completed'
                            ? 'bg-slate-50 text-blue-600 border border-slate-100 hover:bg-slate-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {step.actionLabel || t.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ))}

              {roadmapPageCount > 1 && (
                <div className="pt-2 flex justify-center">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRoadmapPage((p) => Math.max(1, p - 1))}
                      disabled={roadmapPage <= 1}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {Array.from({ length: roadmapPageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setRoadmapPage(p)}
                        className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                          p === roadmapPage
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setRoadmapPage((p) => Math.min(roadmapPageCount, p + 1))}
                      disabled={roadmapPage >= roadmapPageCount}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;

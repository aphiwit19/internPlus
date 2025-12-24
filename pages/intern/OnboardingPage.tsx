import React from 'react';
import { 
  CheckCircle2, 
  Search,
  BookOpen,
  MessageSquare,
  Video,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  PenTool,
  Lock,
  Upload,
  Clock
} from 'lucide-react';
import { Language } from '@/types';
import { PageId } from '@/pageTypes';

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

  const ROADMAP_STEPS: RoadmapStep[] = [
    { 
      id: '1', 
      stepNumber: 1,
      title: lang === 'EN' ? 'Submit Documents' : 'ส่งเอกสารสำคัญ', 
      description: lang === 'EN' ? 'Upload ID, academic records and bank details.' : 'อัปโหลดบัตรประชาชน, ผลการเรียน และข้อมูลธนาคาร', 
      status: 'completed', 
      icon: <Upload size={24} />,
      category: 'onboarding',
      actionLabel: t.details,
      targetPage: 'profile'
    },
    { 
      id: '2', 
      stepNumber: 2,
      title: lang === 'EN' ? 'Sign Policy & NDA' : 'ลงนามนโยบายและ NDA', 
      description: lang === 'EN' ? 'Read and sign internal security policies.' : 'อ่านและลงนามในนโยบายความปลอดภัยภายใน', 
      status: 'completed', 
      icon: <PenTool size={24} />,
      category: 'onboarding',
      actionLabel: t.details,
      targetPage: 'training'
    },
    { 
      id: '3', 
      stepNumber: 3,
      title: lang === 'EN' ? 'Review Orientation' : 'ปฐมนิเทศพนักงานใหม่', 
      description: lang === 'EN' ? 'Understand workflows and reporting here.' : 'ทำความเข้าใจขั้นตอนการทำงานและการรายงานผลที่นี่', 
      status: 'next-action', 
      icon: <Search size={24} />,
      category: 'onboarding',
      actionLabel: t.start
    },
    { 
      id: '4', 
      stepNumber: 4,
      title: lang === 'EN' ? 'Check First Assignment' : 'ตรวจสอบงานแรกที่ได้รับ', 
      description: lang === 'EN' ? 'Review objectives of your initial project.' : 'ดูวัตถุประสงค์ของโครงการเบื้องต้นของคุณ', 
      status: 'locked', 
      icon: <BookOpen size={24} />,
      category: 'internship'
    }
  ];

  const completedCount = ROADMAP_STEPS.filter(s => s.status === 'completed').length;
  const totalSteps = 10; // Keeping standard total for visual consistency

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
          <div className="absolute left-[1.75rem] md:left-[2.25rem] top-8 bottom-8 w-[1px] bg-slate-200"></div>

          <div className="space-y-8 md:space-y-12">
            {ROADMAP_STEPS.map((step) => (
              <div key={step.id} className="relative flex items-start gap-4 md:gap-8 group">
                <div className="relative z-10 flex-shrink-0">
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
                      step.status === 'completed' ? 'text-slate-400 line-through decoration-2' : 'text-slate-900'
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
                        onClick={() => step.targetPage && onNavigate(step.targetPage)}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;

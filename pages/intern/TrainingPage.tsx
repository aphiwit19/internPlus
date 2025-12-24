import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  ChevronRight, 
  Video,
  X,
  ShieldCheck,
  CheckCircle2,
  PenTool,
  ArrowRight
} from 'lucide-react';
import { Language } from '@/types';
import { PageId } from '@/pageTypes';

interface TrainingItem {
  id: string;
  title: string;
  meta: string;
  type: 'pdf' | 'video';
  content: string;
  isSignable: boolean;
}

interface TrainingPageProps {
  onNavigate: (id: PageId) => void;
  lang: Language;
}

const TrainingPage: React.FC<TrainingPageProps> = ({ onNavigate, lang }) => {
  const t = {
    EN: {
      title: "Policy & Training",
      subtitle: "Essential resources for your internship growth.",
      download: "Download All",
      signRequired: "Sign Required",
      signed: "Signed",
      docLabel: "Document",
      digitalSign: "Signed Digitally",
      signHint: "Electronic signature required.",
      signBtn: "Sign Now",
      ackLabel: "I acknowledge that I have read and understood the policy.",
      back: "Back",
      confirm: "Confirm & Sign",
      close: "Close"
    },
    TH: {
      title: "นโยบายและการฝึกอบรม",
      subtitle: "แหล่งข้อมูลสำคัญเพื่อการเติบโตในช่วงการฝึกงานของคุณ",
      download: "ดาวน์โหลดทั้งหมด",
      signRequired: "จำเป็นต้องลงนาม",
      signed: "ลงนามแล้ว",
      docLabel: "เอกสาร",
      digitalSign: "ลงนามแบบดิจิทัลแล้ว",
      signHint: "จำเป็นต้องลงลายมือชื่ออิเล็กทรอนิกส์",
      signBtn: "ลงนามตอนนี้",
      ackLabel: "ข้าพเจ้ายอมรับว่าได้รับทราบและทำความเข้าใจนโยบายนี้แล้ว",
      back: "ย้อนกลับ",
      confirm: "ยืนยันและลงนาม",
      close: "ปิดหน้าต่าง"
    }
  }[lang];

  const TRAINING_ITEMS: TrainingItem[] = [
    { 
      id: '1', 
      title: lang === 'EN' ? 'General Office Policy' : 'นโยบายสำนักงานทั่วไป', 
      meta: '2.4 MB', 
      type: 'pdf',
      isSignable: true,
      content: lang === 'EN' ? `
        1. WORK HOURS AND ATTENDANCE
        Standard office hours are from 9:00 AM to 6:00 PM, Monday through Friday. Interns are expected to be punctual. Any absence must be reported to your supervisor at least 24 hours in advance.

        2. DRESS CODE
        The office maintains a business casual dress code. On Fridays, casual attire is permitted. Professional appearance is required when meeting clients or attending external events.
      ` : `
        1. เวลาทำงานและการเข้างาน
        เวลาทำงานมาตรฐานคือ 09:00 น. ถึง 18:00 น. วันจันทร์ถึงวันศุกร์ นักศึกษาฝึกงานต้องตรงต่อเวลา หากมีการลาต้องแจ้งที่ปรึกษาล่วงหน้าอย่างน้อย 24 ชั่วโมง

        2. การแต่งกาย
        ทางสำนักงานใช้ระเบียบการแต่งกายแบบ Business Casual ในวันศุกร์อนุญาตให้แต่งกายชุดลำลองได้ ทั้งนี้ต้องรักษาภาพลักษณ์ความเป็นมืออาชีพเมื่อพบลูกค้า
      `
    },
    { 
      id: '2', 
      title: lang === 'EN' ? 'Security & Compliance' : 'ความปลอดภัยและการปฏิบัติตามกฎ', 
      meta: '1.2 MB', 
      type: 'pdf',
      isSignable: true,
      content: lang === 'EN' ? `
        1. DATA PRIVACY
        You must protect the confidentiality of all company and client data. Sharing internal documents or credentials with external parties is a serious violation of policy.
      ` : `
        1. ความเป็นส่วนตัวของข้อมูล
        คุณต้องรักษาความลับของข้อมูลบริษัทและลูกค้าทั้งหมด การแบ่งปันเอกสารภายในหรือข้อมูลการเข้าถึงกับบุคคลภายนอกถือเป็นการละเมิดนโยบายอย่างร้ายแรง
      `
    },
    { 
      id: '3', 
      title: lang === 'EN' ? 'Design System Guidelines' : 'คู่มือระบบการออกแบบ', 
      meta: '15:00 MIN', 
      type: 'video',
      isSignable: false,
      content: lang === 'EN' ? "Video content placeholder: A guide to using our internal Figma component library." : "เนื้อหาวิดีโอ: คู่มือการใช้งานไลบรารีส่วนประกอบ Figma ภายในของเรา"
    }
  ];

  const [selectedItem, setSelectedItem] = useState<TrainingItem | null>(null);
  const [signedDocs, setSignedDocs] = useState<Set<string>>(new Set());
  const [signingStep, setSigningStep] = useState<'reading' | 'signing' | 'completed'>('reading');

  const handleOpenDoc = (item: TrainingItem) => {
    setSelectedItem(item);
    setSigningStep('reading');
  };

  const handleSign = () => {
    if (selectedItem) {
      setSignedDocs(prev => new Set([...prev, selectedItem.id]));
      setSigningStep('completed');
    }
  };

  const isCurrentDocSigned = selectedItem && signedDocs.has(selectedItem.id);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">{t.subtitle}</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm w-fit">
            <Download size={14} />
            {t.download}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-20">
          {TRAINING_ITEMS.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleOpenDoc(item)}
              className="group bg-white rounded-3xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col relative"
            >
              {signedDocs.has(item.id) && (
                <div className="absolute top-4 right-4 z-10 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                  <CheckCircle2 size={12} strokeWidth={3} />
                </div>
              )}

              <div className="aspect-[16/9] rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-[0.98] bg-slate-50/80">
                {item.type === 'pdf' ? (
                  <FileText size={40} className="md:size-[48px] text-red-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <Video size={40} className="md:size-[48px] text-blue-400 group-hover:scale-110 transition-transform" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1 overflow-hidden pr-2">
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate text-sm md:text-base">
                    {item.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {item.meta}
                    </p>
                    {item.isSignable && !signedDocs.has(item.id) && (
                      <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter">{t.signRequired}</span>
                    )}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 flex-shrink-0">
                  {selectedItem.type === 'pdf' ? <FileText size={20} /> : <Video size={20} />}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-base md:text-xl font-bold text-slate-900 leading-tight truncate">{selectedItem.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t.docLabel}</span>
                     {signedDocs.has(selectedItem.id) && (
                       <span className="flex items-center gap-1 text-[8px] md:text-[9px] text-emerald-600 font-black uppercase bg-emerald-50 px-2 py-0.5 rounded-full">
                         <CheckCircle2 size={10} /> {t.signed}
                       </span>
                     )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 md:p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/30">
              <div className="bg-white p-6 md:p-12 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800 text-sm md:text-base leading-relaxed space-y-6">
                {selectedItem.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para.trim()}</p>
                ))}

                {selectedItem.isSignable && (
                  <div className={`mt-10 md:mt-16 p-6 md:p-8 rounded-2xl border-2 border-dashed transition-all duration-500 ${
                    signedDocs.has(selectedItem.id) 
                    ? 'bg-emerald-50/50 border-emerald-200' 
                    : 'bg-slate-50 border-slate-200'
                  }`}>
                    {signedDocs.has(selectedItem.id) ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
                          <CheckCircle2 size={24} />
                        </div>
                        <h5 className="italic text-2xl md:text-3xl text-slate-900 mb-1">Alex Rivera</h5>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.digitalSign}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <PenTool size={32} className="text-slate-300 mb-4" />
                        <p className="text-[13px] font-bold text-slate-400 mb-6">{t.signHint}</p>
                        <button 
                          onClick={() => setSigningStep('signing')}
                          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                          {t.signBtn} <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {signingStep === 'signing' && !signedDocs.has(selectedItem.id) && (
              <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex flex-col gap-6 flex-shrink-0">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="confirm-sign" className="w-5 h-5 mt-0.5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  <label htmlFor="confirm-sign" className="text-[13px] md:text-sm text-slate-600 font-medium cursor-pointer">{t.ackLabel}</label>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setSigningStep('reading')} className="px-5 py-3 rounded-2xl text-[13px] font-bold text-slate-500 hover:bg-slate-50">{t.back}</button>
                  <button onClick={handleSign} className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold text-[13px] shadow-xl hover:bg-blue-700 active:scale-95">{t.confirm}</button>
                </div>
              </div>
            )}
            
            {(signingStep === 'completed' || isCurrentDocSigned) && (
               <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex-shrink-0">
                 <button onClick={() => setSelectedItem(null)} className="w-full sm:w-auto mx-auto block px-12 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl">{t.close}</button>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingPage;

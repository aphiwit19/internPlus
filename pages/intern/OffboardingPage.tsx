
import React, { useState, useRef, useEffect } from 'react';
import { 
  Book, 
  Cpu, 
  ShieldCheck, 
  MessageSquare, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  PenTool, 
  Award,
  Heart,
  Eraser,
  Upload,
  ExternalLink,
  ChevronRight,
  X,
  FileCheck,
  AlertCircle,
  Lock,
  Info,
  Check
} from 'lucide-react';
import { Language } from '@/types';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '@/firebase';
import { useAppContext } from '@/app/AppContext';
import { useNavigate } from 'react-router-dom';

interface OffboardingTask {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  icon: React.ReactNode;
  actionType: 'UPLOAD' | 'FORM' | 'CONFIRM' | 'RECEIPT';
  completedAt?: string;
}

interface OffboardingPageProps {
  lang: Language;
}

const OffboardingPage: React.FC<OffboardingPageProps> = ({ lang }) => {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const t = {
    EN: {
      title: "Offboarding Progress",
      subtitle: "Complete these mandatory steps to formally conclude your tenure.",
      devBtn: "Dev: Finish All Tasks",
      ready: "READY FOR CLEARANCE",
      inProgress: "IN PROGRESS",
      taskHeader: "Required Offboarding Tasks",
      taskSub: "Verification process for intern departure",
      action: "Accept",
      totalHours: "Total Hours",
      tasksDone: "Tasks Done",
      certificates: "Certificates",
      finalScore: "Final Score",
      signatureTitle: "Clearance Signature",
      finalDecl: "FINAL DECLARATION",
      agree: "I hereby certify that I have returned all company property and completed the required handover processes.",
      pending: "TASKS PENDING",
      signHere: "SIGN BY HAND HERE",
      submitBtn: "Submit Final Clearance",
      thankYou: "THANK YOU FOR YOUR CONTRIBUTION",
      binding: "SIGNATURE IS BINDING AND IRREVERSIBLE ONCE SUBMITTED.",
      modalAction: "Action Required",
      completeSave: "Complete & Save Step"
    },
    TH: {
      title: "ความคืบหน้าการแจ้งออกจากงาน",
      subtitle: "ดำเนินการตามขั้นตอนที่กำหนดให้ครบถ้วนเพื่อจบโปรแกรมการฝึกงานอย่างเป็นทางการ",
      devBtn: "ทางลัด: เสร็จสิ้นงานทั้งหมด",
      ready: "พร้อมสำหรับการอนุมัติ",
      inProgress: "กำลังดำเนินการ",
      taskHeader: "รายการที่ต้องดำเนินการก่อนแจ้งออก",
      taskSub: "กระบวนการตรวจสอบสำหรับการพ้นสภาพนักศึกษาฝึกงาน",
      action: "ยอมรับ",
      totalHours: "ชั่วโมงรวม",
      tasksDone: "งานที่สำเร็จ",
      certificates: "ใบรับรอง",
      finalScore: "คะแนนสุดท้าย",
      signatureTitle: "ลายเซ็นเพื่ออนุมัติ",
      finalDecl: "คำประกาศขั้นสุดท้าย",
      agree: "ข้าพเจ้าขอรับรองว่าได้คืนทรัพย์สินของบริษัททั้งหมดและเสร็จสิ้นกระบวนการส่งมอบงานที่กำหนดแล้ว",
      pending: "รอการดำเนินการงาน",
      signHere: "ลงชื่อด้วยลายมือที่นี่",
      submitBtn: "ส่งคำขออนุมัติขั้นสุดท้าย",
      thankYou: "ขอบคุณสำหรับความทุ่มเทในการทำงานของคุณ",
      binding: "ลายเซ็นนี้มีผลผูกพันและไม่สามารถยกเลิกได้หลังจากส่งแล้ว",
      modalAction: "จำเป็นต้องดำเนินการ",
      completeSave: "เสร็จสิ้นและบันทึกขั้นตอน"
    }
  }[lang];

  const INITIAL_TASKS: OffboardingTask[] = [
    {
      id: 'ot-1',
      title: lang === 'EN' ? 'Knowledge Transfer Documents' : 'เอกสารส่งมอบงาน',
      description: lang === 'EN' ? 'Upload handover docs and logic maps.' : 'อัปโหลดเอกสารส่งมอบงานและแผนผังตรรกะงาน',
      status: 'IN_PROGRESS',
      icon: <Book size={20} />,
      actionType: 'UPLOAD'
    },
    {
      id: 'ot-2',
      title: lang === 'EN' ? 'Hardware Asset Return' : 'คืนทรัพย์สินอุปกรณ์',
      description: lang === 'EN' ? 'Return laptop and ID badge.' : 'คืนแล็ปท็อปและบัตรประจำตัวพนักงาน',
      status: 'PENDING',
      icon: <Cpu size={20} />,
      actionType: 'RECEIPT'
    },
    {
      id: 'ot-3',
      title: lang === 'EN' ? 'System Access Credentials' : 'สิทธิ์การเข้าถึงระบบ',
      description: lang === 'EN' ? 'Revocation of API keys and tokens.' : 'ยกเลิกการใช้รหัส API และรหัสผ่านต่างๆ',
      status: 'PENDING',
      icon: <ShieldCheck size={20} />,
      actionType: 'CONFIRM'
    }
  ];

  const [tasks, setTasks] = useState<OffboardingTask[]>(INITIAL_TASKS);
  const [activeActionTask, setActiveActionTask] = useState<OffboardingTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const alreadyRequested =
    user?.lifecycleStatus === 'OFFBOARDING_REQUESTED' || Boolean((user as any)?.offboardingRequestedAt);

  const completeAllTasks = () => {
    setTasks(prev => prev.map(t => ({ ...t, status: 'COMPLETED', completedAt: new Date().toLocaleDateString() })));
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'COMPLETED', completedAt: new Date().toLocaleDateString() } : t
    ));
  };

  const [completedTaskId, setCompletedTaskId] = useState<string | null>(null);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);

  const handleCompleteTaskWithFeedback = (taskId: string) => {
    setCompletedTaskId(taskId);
    setShowCompletionAnimation(true);
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'COMPLETED', completedAt: new Date().toLocaleDateString() } : t
    ));
    
    setTimeout(() => {
      setShowCompletionAnimation(false);
      setCompletedTaskId(null);
    }, 1500);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!allCompleted || !isAgreed || !hasSigned) return;

    setIsSubmitting(true);
    try {
      // Convert tasks to plain object to avoid Firestore serialization issues
      const plainTasks = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        actionType: task.actionType,
        completedAt: task.completedAt
        // Note: We don't include the icon (React element) as it causes serialization issues
      }));
      
      await updateDoc(doc(firestoreDb, 'users', user.id), {
        lifecycleStatus: 'OFFBOARDING_REQUESTED',
        offboardingRequestedAt: serverTimestamp(),
        offboardingTasks: plainTasks,
        updatedAt: serverTimestamp(),
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit offboarding request:', error);
      const errorMessage = (error as any).message || 'Unknown error';
      alert(lang === 'EN' 
        ? `Failed to submit offboarding request: ${errorMessage}` 
        : `ไม่สามารถส่งคำขอแจ้งออกจากงาน: ${errorMessage}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allCompleted = tasks.every(t => t.status === 'COMPLETED');
  const canSubmitClearance = allCompleted && isAgreed && hasSigned;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!allCompleted) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4338ca';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSigned) setHasSigned(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSigned(false);
    }
  };

  if (isSubmitted || alreadyRequested) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-[3rem] p-16 shadow-2xl border border-slate-100 max-w-2xl text-center">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-xl border border-emerald-100">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
            {lang === 'EN' ? 'Offboarding Request Submitted' : 'ส่งคำขอแจ้งออกจากงานเรียบร้อย'}
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed mb-10">
            {lang === 'EN' 
              ? 'Your request has been securely forwarded.'
              : 'คำขอของคุณได้รับการส่งต่ออย่างปลอดภัยแล้ว'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{t.title}</h1>
            <p className="text-slate-500 text-sm mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {!allCompleted && (
              <button onClick={completeAllTasks} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-colors">
                {t.devBtn}
              </button>
            )}
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 ${allCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              {allCompleted ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              {allCompleted ? t.ready : t.inProgress}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto pb-24 scrollbar-hide pr-1">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">{t.taskHeader}</h2>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">{t.taskSub}</p>
              </div>
              <div className="space-y-4">
                {tasks.map(task => (
                  <div key={task.id} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl border transition-all duration-300 ${task.status === 'COMPLETED' ? 'bg-slate-50/50 border-slate-100' : 'bg-white border-slate-100 shadow-sm hover:border-blue-200 group'} ${completedTaskId === task.id && showCompletionAnimation ? 'bg-emerald-50 border-emerald-200 scale-[1.02]' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-600'} ${completedTaskId === task.id && showCompletionAnimation ? 'bg-emerald-100 text-emerald-600 scale-110' : ''}`}>
                      {task.status === 'COMPLETED' ? <FileCheck size={20} /> : task.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{task.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed truncate">{task.description}</p>
                      {task.status === 'COMPLETED' && task.completedAt && (
                        <p className="text-[10px] text-emerald-600 font-medium mt-1">
                          {lang === 'EN' ? 'Completed' : 'เสร็จสิ้น'} • {task.completedAt}
                        </p>
                      )}
                      {completedTaskId === task.id && showCompletionAnimation && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle2 size={12} className="text-emerald-600 animate-pulse" />
                          <span className="text-[10px] text-emerald-600 font-medium animate-pulse">
                            {lang === 'EN' ? 'Task completed!' : 'งานเสร็จสิ้น!'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {task.status !== 'COMPLETED' ? (
                        <button 
                          onClick={() => navigate('/intern/training')} 
                          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 active:scale-95 transition-all"
                        >
                          {t.action}
                        </button>
                      ) : (
                        <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Check size={12} />
                          {lang === 'EN' ? 'Done' : 'เสร็จแล้ว'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 h-fit">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="w-full text-left mb-8">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t.signatureTitle}</h3>
                <p className="text-[11px] font-black text-slate-400 mt-1 uppercase tracking-widest">{t.finalDecl}</p>
              </div>
              <div className={`w-full p-6 rounded-[1.5rem] mb-8 flex items-start gap-4 ${isAgreed ? 'bg-blue-50/30 border border-blue-100' : 'bg-slate-50 border border-slate-100'}`}>
                <div onClick={() => allCompleted && setIsAgreed(!isAgreed)} className={`w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer ${isAgreed ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'} ${!allCompleted && 'opacity-30 cursor-not-allowed'}`}>
                  {isAgreed && <Check size={16} strokeWidth={4} />}
                </div>
                <p className={`text-[13px] font-medium leading-relaxed italic ${!allCompleted ? 'text-slate-300' : 'text-slate-500'}`}>{t.agree}</p>
              </div>
              <div className="w-full mb-10">
                <div className={`aspect-[5/4] rounded-[2rem] border-2 border-dashed relative overflow-hidden ${allCompleted ? 'bg-slate-50/30 border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <canvas ref={canvasRef} width={600} height={480} style={{ touchAction: 'none' }} className={`absolute inset-0 w-full h-full ${allCompleted ? 'cursor-crosshair' : 'pointer-events-none'}`} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  {hasSigned && allCompleted && (
                    <button onClick={clearSignature} className="absolute top-4 right-4 z-20 p-2 text-slate-300 hover:text-red-500"><Eraser size={24} /></button>
                  )}
                  {!hasSigned && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                      {!allCompleted ? (
                        <><Lock size={32} className="text-slate-200 mb-3" /><p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">{t.pending}</p></>
                      ) : (
                        <><PenTool size={32} className="text-slate-200 mb-3" /><p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">{t.signHere}</p></>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button disabled={!canSubmitClearance} onClick={handleSubmit} className={`w-full py-4 rounded-full font-black text-[15px] tracking-tight transition-all ${canSubmitClearance ? 'bg-blue-600 text-white shadow-xl hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}>
                {t.submitBtn}
              </button>
              <div className="mt-10 flex items-center justify-center gap-2.5 text-rose-400">
                <Heart size={20} fill="currentColor" />
                <span className="text-[11px] font-black uppercase tracking-widest">{t.thankYou}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffboardingPage;

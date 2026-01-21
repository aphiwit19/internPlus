
import React, { useState, useRef } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Trash2, 
  ChevronRight, 
  MessageSquare, 
  ShieldCheck, 
  Eraser, 
  PenTool, 
  Check, 
  Send, 
  Lock,
  ArrowLeft,
  Info
} from 'lucide-react';
import { Language } from '@/types';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

interface WithdrawalPageProps {
  lang: Language;
}

const WithdrawalPage: React.FC<WithdrawalPageProps> = ({ lang }) => {
  const { user } = useAppContext();

  const t = {
    EN: {
      title: "Withdrawal Program",
      subtitle: "Formal request for early internship termination.",
      confidential: "Confidential Processing",
      noticeTitle: "Withdrawal Notice",
      warning: "By submitting this request, you acknowledge early withdrawal results in:",
      rule1: "Unpaid Status",
      rule1Desc: "All pending stipends/allowances will be forfeited.",
      rule2: "Data Purge",
      rule2Desc: "Performance metrics and profile data will be permanently removed.",
      detailsHeader: "Withdrawal Details",
      reasonLabel: "Primary Reason for Withdrawal",
      reasonSelect: "Select a reason...",
      reason1: "Personal / Family Matters",
      reason2: "Academic Schedule Conflict",
      reason3: "Health Reasons",
      reason4: "External Opportunity",
      reasonOther: "Other Reasons",
      contextLabel: "Detailed Context (Confidential)",
      contextPlaceholder: "Please provide any additional information HR should know...",
      authTitle: "Final Authorization",
      authSub: "Security Signature Required",
      agree1: "I understand that early withdrawal forfeits all pending stipends.",
      agree2: "I consent to the permanent removal of my internship data.",
      signHint: "Sign here to confirm",
      submitBtn: "Submit Confidential Request",
      recordNote: "This document is a formal record. Submission will be logged.",
      successTitle: "Request Submitted",
      successMsg: "Your request has been securely forwarded."
    },
    TH: {
      title: "โปรแกรมการถอนตัว",
      subtitle: "การส่งคำขออย่างเป็นทางการเพื่อยุติการฝึกงานก่อนกำหนด",
      confidential: "การดำเนินการแบบลับเฉพาะ",
      noticeTitle: "ประกาศการถอนตัว",
      warning: "การส่งคำขอนี้แสดงว่าท่านรับทราบว่าการถอนตัวก่อนกำหนดจะส่งผลดังนี้:",
      rule1: "สถานะไม่ได้รับค่าตอบแทน",
      rule1Desc: "เบี้ยเลี้ยงหรือค่าตอบแทนที่ค้างจ่ายทั้งหมดจะถูกยกเลิก",
      rule2: "การล้างข้อมูล",
      rule2Desc: "ข้อมูลโปรไฟล์และผลการประเมินการทำงานจะถูกลบออกอย่างถาวร",
      detailsHeader: "รายละเอียดการถอนตัว",
      reasonLabel: "สาเหตุหลักในการถอนตัว",
      reasonSelect: "เลือกสาเหตุ...",
      reason1: "เรื่องส่วนตัว / ครอบครัว",
      reason2: "ตารางเรียนซ้อนทับ",
      reason3: "ปัญหาสุขภาพ",
      reason4: "ได้รับโอกาสการทำงานอื่น",
      reasonOther: "สาเหตุอื่นๆ",
      contextLabel: "ข้อมูลเพิ่มเติม (ข้อมูลลับ)",
      contextPlaceholder: "โปรดระบุข้อมูลเพิ่มเติมที่ฝ่ายบุคคลควรทราบเกี่ยวกับการลาออกของคุณ...",
      authTitle: "การอนุมัติขั้นสุดท้าย",
      authSub: "จำเป็นต้องลงนามเพื่อความปลอดภัย",
      agree1: "ข้าพเจ้ารับทราบว่าการถอนตัวก่อนกำหนดจะทำให้เสียสิทธิ์ในเบี้ยเลี้ยงที่ค้างอยู่",
      agree2: "ข้าพเจ้ายินยอมให้ลบข้อมูลการฝึกงานและประวัติทั้งหมดอย่างถาวร",
      signHint: "ลงชื่อที่นี่เพื่อยืนยัน",
      submitBtn: "ส่งคำขอลาออกอย่างเป็นทางการ",
      recordNote: "เอกสารนี้เป็นบันทึกทางการ การส่งข้อมูลจะถูกบันทึกด้วย ID และที่อยู่ IP ของคุณ",
      successTitle: "ส่งคำขอเรียบร้อยแล้ว",
      successMsg: "คำขอของคุณได้รับการส่งต่ออย่างปลอดภัยแล้ว"
    }
  }[lang];

  const [reason, setReason] = useState('');
  const [detailedReason, setDetailedReason] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isDataPurgeAgreed, setIsDataPurgeAgreed] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const alreadyRequested =
    user?.lifecycleStatus === 'WITHDRAWAL_REQUESTED' || Boolean((user as any)?.withdrawalRequestedAt);

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
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b'; 
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

  const handleSubmit = async () => {
    if (!user) return;
    if (!reason || !isAgreed || !isDataPurgeAgreed || !hasSigned) return;

    setIsSubmitting(true);
    try {
      if (!canvasRef.current) throw new Error('Signature canvas missing');
      const canvas = canvasRef.current;
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) throw new Error('Failed to create signature image');

      const signatureStoragePath = `users/${user.id}/withdrawal/signatures/${Date.now()}.png`;
      await uploadBytes(storageRef(firebaseStorage, signatureStoragePath), blob);

      await updateDoc(doc(firestoreDb, 'users', user.id), {
        lifecycleStatus: 'WITHDRAWAL_REQUESTED',
        withdrawalRequestedAt: serverTimestamp(),
        withdrawalReason: reason,
        withdrawalDetail: detailedReason,
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(firestoreDb, 'users', user.id, 'documents', 'withdrawal:signature'),
        {
          label: 'WITHDRAWAL SIGNATURE',
          fileName: `withdrawal_signature_${user.id}.png`,
          storagePath: signatureStoragePath,
          policyTitle: t.title,
          acknowledgementText: t.authTitle,
          signedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setIsSubmitted(true);
    } catch {
      alert(lang === 'EN' ? 'Failed to submit withdrawal request.' : 'ไม่สามารถส่งคำขอถอนตัวได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted || alreadyRequested) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 bg-slate-50">
        <div className="bg-white rounded-[3rem] p-16 shadow-2xl border border-slate-100 max-w-2xl text-center">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-xl border border-emerald-100">
            <ShieldCheck size={48} />
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">{t.successTitle}</h2>
          <p className="text-slate-500 text-lg leading-relaxed mb-10">{t.successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div><h1 className="text-4xl font-black text-slate-900 tracking-tight">{t.title}</h1><p className="text-slate-500 text-sm font-medium pt-2">{t.subtitle}</p></div>
          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
             <ShieldAlert className="text-rose-500" size={20} />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.confidential}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 overflow-y-auto scrollbar-hide pb-20">
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-amber-900 rounded-[2.5rem] p-10 text-white shadow-2xl">
              <div className="flex items-center gap-4 mb-8"><div className="w-12 h-12 bg-amber-400 text-slate-900 rounded-xl flex items-center justify-center"><AlertTriangle size={24} /></div><h3 className="text-2xl font-bold">{t.noticeTitle}</h3></div>
              <p className="text-amber-100 text-sm mb-6">{t.warning}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/10 p-5 rounded-2xl"><h4 className="text-[10px] font-black text-amber-50 uppercase mb-1">{t.rule1}</h4><p className="text-[11px] text-amber-50/80">{t.rule1Desc}</p></div>
                <div className="bg-white/10 p-5 rounded-2xl"><h4 className="text-[10px] font-black text-amber-50 uppercase mb-1">{t.rule2}</h4><p className="text-[11px] text-amber-50/80">{t.rule2Desc}</p></div>
              </div>
            </section>
            <section className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <h3 className="text-xl font-black mb-10">{t.detailsHeader}</h3>
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{t.reasonLabel}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700" value={reason} onChange={e => setReason(e.target.value)}>
                    <option value="">{t.reasonSelect}</option>
                    <option value="Personal">{t.reason1}</option>
                    <option value="Academic">{t.reason2}</option>
                    <option value="Health">{t.reason3}</option>
                    <option value="Offer">{t.reason4}</option>
                    <option value="Other">{t.reasonOther}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">{t.contextLabel}</label>
                  <textarea className="w-full min-h-[180px] bg-slate-50 border border-slate-200 rounded-[2rem] px-6 py-5 text-sm" placeholder={t.contextPlaceholder} value={detailedReason} onChange={e => setDetailedReason(e.target.value)} />
                </div>
              </div>
            </section>
          </div>
          <div className="lg:col-span-5 h-fit space-y-8">
            <section className="bg-white rounded-[3rem] p-10 border border-slate-100 flex flex-col items-center">
              <div className="w-full text-left mb-10"><h3 className="text-2xl font-black text-slate-900 tracking-tight">{t.authTitle}</h3><p className="text-[11px] font-black text-slate-400 mt-1 uppercase">{t.authSub}</p></div>
              <div className="w-full space-y-4 mb-10">
                <div onClick={() => setIsAgreed(!isAgreed)} className={`p-6 rounded-[1.5rem] border flex gap-4 cursor-pointer ${isAgreed ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center ${isAgreed ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-slate-300'}`}>{isAgreed && <Check size={16} strokeWidth={4} />}</div>
                  <p className="text-[12px] font-bold italic">{t.agree1}</p>
                </div>
                <div onClick={() => setIsDataPurgeAgreed(!isDataPurgeAgreed)} className={`p-6 rounded-[1.5rem] border flex gap-4 cursor-pointer ${isDataPurgeAgreed ? 'bg-rose-50/30 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center ${isDataPurgeAgreed ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-300'}`}>{isDataPurgeAgreed && <Check size={16} strokeWidth={4} />}</div>
                  <p className="text-[12px] font-bold italic">{t.agree2}</p>
                </div>
              </div>
              <div className="w-full mb-10">
                <div className="aspect-[5/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] relative">
                  <canvas ref={canvasRef} width={600} height={480} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  {!hasSigned && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20"><PenTool size={48} className="text-slate-400 mb-4" /><span className="text-sm font-black text-slate-400 uppercase">{t.signHint}</span></div>}
                  {hasSigned && <button onClick={clearSignature} className="absolute top-6 right-6 p-3 bg-white/80 rounded-xl text-slate-400 hover:text-rose-500"><Eraser size={24} /></button>}
                </div>
              </div>
              <button onClick={handleSubmit} disabled={!user || isSubmitting || !reason || !isAgreed || !isDataPurgeAgreed || !hasSigned} className="w-full py-5 bg-slate-900 text-white rounded-full font-black text-lg hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-3">{isSubmitting ? (lang === 'EN' ? 'Submitting...' : 'กำลังส่ง...') : t.submitBtn}</button>
            </section>
            <div className="p-8 bg-slate-100 rounded-[2.5rem] flex gap-5"><Lock size={20} className="text-slate-400 shrink-0" /><p className="text-[11px] text-slate-500 font-bold uppercase">{t.recordNote}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalPage;

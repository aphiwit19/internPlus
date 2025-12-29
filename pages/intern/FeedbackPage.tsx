
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Video, 
  MessageSquare,
  Star, 
  Upload, 
  Clock,
  User,
  ShieldCheck,
  Play,
  FileText,
  ExternalLink,
  Heart,
  Zap
} from 'lucide-react';
import { Language, UserProfile } from '@/types';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

interface FeedbackMilestone {
  id: string;
  label: { EN: string; TH: string };
  period: { EN: string; TH: string };
  status: 'pending' | 'submitted' | 'reviewed' | 'locked';
  internReflection?: string;
  internProgramFeedback?: string;
  videoUrl?: string;
  videoStoragePath?: string;
  videoFileName?: string;
  attachments?: Array<{ fileName: string; storagePath: string }>;
  supervisorScore?: number;
  supervisorComments?: string;
  programRating?: number;
  submissionDate?: string;
}

interface FeedbackPageProps {
  lang: Language;
  user?: UserProfile;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ lang, user }) => {
  const { user: authedUser } = useAppContext();
  const t = {
    EN: {
      title: "Feedback Hub",
      subtitle: "Unified 2-way feedback between you and your mentor.",
      milestone_label: "ASSESSMENT PERIOD",
      submitMilestone: "Submit 2-Way Review",
      videoReflect: "Self-Reflection Video",
      uploadVideo: "Upload Summary Vlog",
      maxSize: "Max 50MB • MP4",
      internReflectionLabel: "Part 1: Your Self-Reflection",
      internProgramLabel: "Part 2: Program & Mentorship Feedback",
      placeholderReflect: "What have you achieved since the last milestone?",
      placeholderProgram: "How is your relationship with your mentor?",
      supervisorHeader: "Mentor's Assessment",
      points: "Points / 100",
      mentor: "Supervisor",
      pendingReview: "Review Pending",
      pendingDesc: "Your reflection has been sent. Mentor will review soon.",
      lockedTitle: "Access Restricted",
      lockedDesc: "Submit your reflection to unlock mentor feedback.",
      programRatingLabel: "Rate Mentorship Quality",
      milestoneHeader: "Milestone Details"
    },
    TH: {
      title: "ศูนย์ข้อมูลคำติชม",
      subtitle: "ระบบสื่อสารแบบ 2 ทางระหว่างคุณและที่ปรึกษา",
      milestone_label: "ช่วงเวลาการประเมิน",
      submitMilestone: "ส่งการประเมินแบบ 2 ทาง",
      videoReflect: "วิดีโอสะท้อนผลการเรียนรู้",
      uploadVideo: "อัปโหลดวิดีโอสรุปงาน",
      maxSize: "สูงสุด 50MB • MP4",
      internReflectionLabel: "ส่วนที่ 1: การสะท้อนตัวตนของคุณ",
      internProgramLabel: "ส่วนที่ 2: ความคิดเห็นต่อที่ปรึกษา",
      placeholderReflect: "คุณประสบความสำเร็จอะไรบ้าง?",
      placeholderProgram: "ความสัมพันธ์กับที่ปรึกษาเป็นอย่างไร?",
      supervisorHeader: "การประเมินจากที่ปรึกษา",
      points: "คะแนน / 100",
      mentor: "ที่ปรึกษา",
      pendingReview: "รอการตรวจสอบ",
      pendingDesc: "ส่งการสะท้อนตัวตนแล้ว ที่ปรึกษาจะประเมินเร็วๆ นี้",
      lockedTitle: "การเข้าถึงถูกจำกัด",
      lockedDesc: "ส่งสรุปผลงานของคุณก่อนเพื่อดูคำติชม",
      programRatingLabel: "ให้คะแนนคุณภาพการดูแลงาน",
      milestoneHeader: "รายละเอียดช่วงการประเมิน"
    }
  }[lang];

  const BASE_MILESTONES: FeedbackMilestone[] = useMemo(
    () => [
      {
        id: '1w',
        label: { EN: 'Week 1', TH: 'สัปดาห์ที่ 1' },
        period: { EN: 'Onboarding & Foundations', TH: 'การรับเข้าทำงานและพื้นฐาน' },
        status: 'pending',
      },
      {
        id: '1m',
        label: { EN: 'Month 1', TH: 'เดือนที่ 1' },
        period: { EN: 'Skill Deep-Dive', TH: 'การเจาะลึกทักษะ' },
        status: 'pending',
      },
      {
        id: '2m',
        label: { EN: 'Month 2', TH: 'เดือนที่ 2' },
        period: { EN: 'System Integration', TH: 'การรวมระบบ' },
        status: 'pending',
      },
      {
        id: '3m',
        label: { EN: 'Month 3', TH: 'เดือนที่ 3' },
        period: { EN: 'Advanced Prototyping', TH: 'การทำต้นแบบขั้นสูง' },
        status: 'pending',
      },
      {
        id: '4m',
        label: { EN: 'Month 4', TH: 'เดือนที่ 4' },
        period: { EN: 'User Research', TH: 'การวิจัยผู้ใช้' },
        status: 'pending',
      },
      {
        id: '5m',
        label: { EN: 'Month 5', TH: 'เดือนที่ 5' },
        period: { EN: 'Design Handoff', TH: 'การส่งมอบงานดีไซน์' },
        status: 'pending',
      },
      {
        id: '6m',
        label: { EN: 'Month 6', TH: 'เดือนที่ 6' },
        period: { EN: 'Final Capstone', TH: 'โปรเจกต์จบการศึกษา' },
        status: 'pending',
      },
      {
        id: 'exit',
        label: { EN: 'Exit Interview', TH: 'สัมภาษณ์แจ้งออก' },
        period: { EN: 'Final Wrap-up', TH: 'บทสรุปส่งท้าย' },
        status: 'pending',
      },
    ],
    [],
  );

  const [milestones, setMilestones] = useState<FeedbackMilestone[]>(BASE_MILESTONES);
  const [activeId, setActiveId] = useState('1m');
  const [tempProgramRating, setTempProgramRating] = useState(0);
  const [tempReflection, setTempReflection] = useState('');
  const [tempProgramFeedback, setTempProgramFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentsInputRef = useRef<HTMLInputElement>(null);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const active = milestones.find((m) => m.id === activeId) || milestones[0];

  const effectiveUser = authedUser ?? user ?? null;

  useEffect(() => {
    if (!effectiveUser) return;

    const unsubs = BASE_MILESTONES.map((m) => {
      const ref = doc(firestoreDb, 'users', effectiveUser.id, 'feedbackMilestones', m.id);
      return onSnapshot(ref, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Partial<FeedbackMilestone>;
        setMilestones((prev) =>
          prev.map((x) =>
            x.id !== m.id
              ? x
              : {
                  ...x,
                  status: (data.status as FeedbackMilestone['status']) ?? x.status,
                  internReflection: typeof data.internReflection === 'string' ? data.internReflection : x.internReflection,
                  internProgramFeedback:
                    typeof data.internProgramFeedback === 'string' ? data.internProgramFeedback : x.internProgramFeedback,
                  programRating: typeof data.programRating === 'number' ? data.programRating : x.programRating,
                  supervisorScore: typeof data.supervisorScore === 'number' ? data.supervisorScore : x.supervisorScore,
                  supervisorComments: typeof data.supervisorComments === 'string' ? data.supervisorComments : x.supervisorComments,
                  submissionDate: typeof data.submissionDate === 'string' ? data.submissionDate : x.submissionDate,
                  videoStoragePath: typeof data.videoStoragePath === 'string' ? data.videoStoragePath : x.videoStoragePath,
                  videoFileName: typeof data.videoFileName === 'string' ? data.videoFileName : x.videoFileName,
                  attachments: Array.isArray(data.attachments) ? (data.attachments as any) : x.attachments,
                },
          ),
        );
      });
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [BASE_MILESTONES, effectiveUser]);

  useEffect(() => {
    if (!active) return;
    setTempProgramRating(active.programRating ?? 0);
    setTempReflection(active.internReflection ?? '');
    setTempProgramFeedback(active.internProgramFeedback ?? '');
    setPendingVideo(null);
    setPendingAttachments([]);
    setSubmitError(null);
  }, [activeId]);

  const openStoragePath = async (path: string) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, path));
    window.open(url, '_blank');
  };

  const handleSubmit = async () => {
    if (!effectiveUser) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const milestoneId = activeId;
      const ref = doc(firestoreDb, 'users', effectiveUser.id, 'feedbackMilestones', milestoneId);

      let nextVideoStoragePath: string | undefined;
      let nextVideoFileName: string | undefined;
      if (pendingVideo) {
        const p = `users/${effectiveUser.id}/feedbackMilestones/${milestoneId}/video/${Date.now()}_${pendingVideo.name}`;
        await uploadBytes(storageRef(firebaseStorage, p), pendingVideo);
        nextVideoStoragePath = p;
        nextVideoFileName = pendingVideo.name;
      }

      let nextAttachments: Array<{ fileName: string; storagePath: string }> = Array.isArray(active.attachments)
        ? [...active.attachments]
        : [];
      if (pendingAttachments.length > 0) {
        for (const f of pendingAttachments) {
          const p = `users/${effectiveUser.id}/feedbackMilestones/${milestoneId}/attachments/${Date.now()}_${f.name}`;
          await uploadBytes(storageRef(firebaseStorage, p), f);
          nextAttachments = [...nextAttachments, { fileName: f.name, storagePath: p }];
        }
      }

      const today = new Date();
      const submissionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await setDoc(
        ref,
        {
          id: milestoneId,
          status: 'submitted',
          internReflection: tempReflection,
          internProgramFeedback: tempProgramFeedback,
          programRating: tempProgramRating,
          submissionDate,
          attachments: nextAttachments,
          ...(nextVideoStoragePath ? { videoStoragePath: nextVideoStoragePath } : {}),
          ...(nextVideoFileName ? { videoFileName: nextVideoFileName } : {}),
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (videoInputRef.current) videoInputRef.current.value = '';
      if (attachmentsInputRef.current) attachmentsInputRef.current.value = '';
      setPendingVideo(null);
      setPendingAttachments([]);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setSubmitError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Submit failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F8FAFC] overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 scrollbar-hide pb-32">
        <div className="max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-12">
            <div className="space-y-3">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">{t.title}</h1>
              <p className="text-slate-500 text-base font-medium">{t.subtitle}</p>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-2">{t.milestone_label}</span>
              <div className="flex bg-white p-1.5 rounded-[1.75rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-x-auto scrollbar-hide max-w-full">
                {milestones.map((m) => (
                  <button 
                    key={m.id} 
                    onClick={() => setActiveId(m.id)} 
                    className={`px-6 py-3.5 rounded-[1.25rem] text-xs font-black transition-all duration-300 flex-shrink-0 ${
                      activeId === m.id ? 'bg-slate-900 text-white shadow-2xl scale-105' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m.label[lang]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-10">
              <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -ml-32 -mt-32 opacity-40"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                      <Zap size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{active.period[lang]}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t.milestoneHeader}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleSubmit()}
                    className="px-10 py-4 bg-blue-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isSubmitting || !effectiveUser}
                  >
                    {isSubmitting ? (lang === 'TH' ? 'กำลังส่ง...' : 'Submitting...') : t.submitMilestone}
                  </button>
                </div>

                {submitError && (
                  <div className="mb-8 bg-rose-50 border border-rose-100 text-rose-700 rounded-[2rem] px-6 py-4 text-sm font-bold relative z-10">
                    {submitError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                   <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Video size={14}/> {t.videoReflect}</h4>
                      {active.videoStoragePath ? (
                        <div
                          onClick={() => void openStoragePath(active.videoStoragePath!)}
                          className="relative aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden group/v cursor-pointer"
                        >
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 group-hover/v:bg-slate-900/20 transition-all">
                            <Play size={40} className="text-white fill-white" />
                          </div>
                          <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-white/70 text-[10px] font-black uppercase tracking-widest">
                            <span className="truncate">{active.videoFileName || 'Video'}</span>
                            <span className="flex items-center gap-2">
                              <ExternalLink size={14} /> OPEN
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => videoInputRef.current?.click()}
                          className="aspect-video rounded-[2.5rem] border-4 border-dashed border-slate-100 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-200 transition-all"
                        >
                          <input
                            type="file"
                            accept="video/*"
                            ref={videoInputRef}
                            className="hidden"
                            onChange={(e) => setPendingVideo(e.target.files?.[0] ?? null)}
                          />
                          <Video size={32} className="text-slate-300 mb-2" />
                          <p className="text-[10px] font-black text-slate-400 uppercase">{pendingVideo ? pendingVideo.name : t.uploadVideo}</p>
                        </div>
                      )}
                   </div>
                   <div className="space-y-6">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Heart size={14}/> {t.programRatingLabel}</h4>
                      <div className="flex gap-4">
                         {[1,2,3,4,5].map(star => (
                           <button 
                            key={star} 
                            onClick={() => setTempProgramRating(star)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                              tempProgramRating >= star 
                                ? 'bg-amber-500 text-white shadow-lg' 
                                : 'bg-slate-50 text-slate-300 border border-slate-100'
                            }`}
                           >
                             <Star size={20} fill={tempProgramRating >= star ? 'currentColor' : 'none'} />
                           </button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="mb-12">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><FileText size={14}/> {lang === 'TH' ? 'แนบไฟล์' : 'Attachments'}</h4>
                  <div className="mt-4 flex items-center gap-4 flex-wrap">
                    <button
                      onClick={() => attachmentsInputRef.current?.click()}
                      className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <Upload size={16} /> {lang === 'TH' ? 'เลือกไฟล์' : 'Choose Files'}
                    </button>
                    <input
                      ref={attachmentsInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => setPendingAttachments(Array.from(e.target.files ?? []))}
                    />
                    {pendingAttachments.length > 0 && (
                      <div className="text-[11px] font-black text-slate-500">
                        {pendingAttachments.length} {lang === 'TH' ? 'ไฟล์ที่เลือก' : 'files selected'}
                      </div>
                    )}
                  </div>

                  {Array.isArray(active.attachments) && active.attachments.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {active.attachments.map((a, idx) => (
                        <button
                          key={`${a.storagePath}-${idx}`}
                          onClick={() => void openStoragePath(a.storagePath)}
                          className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between gap-4 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 flex-shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">ATTACHMENT</p>
                              <p className="text-[12px] font-black truncate text-slate-800">{a.fileName}</p>
                            </div>
                          </div>
                          <div className="text-blue-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                            <ExternalLink size={14} /> OPEN
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-10">
                   <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><User size={14}/> {t.internReflectionLabel}</h4>
                      <textarea
                        className="w-full bg-white border border-slate-200 rounded-2xl p-6 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 min-h-[120px]"
                        placeholder={t.placeholderReflect}
                        value={tempReflection}
                        onChange={(e) => setTempReflection(e.target.value)}
                      />
                   </div>
                   <div className="p-8 bg-blue-50/30 rounded-[2rem] border border-blue-100/50">
                      <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><MessageSquare size={14}/> {t.internProgramLabel}</h4>
                      <textarea
                        className="w-full bg-white border border-blue-200 rounded-2xl p-6 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 min-h-[120px]"
                        placeholder={t.placeholderProgram}
                        value={tempProgramFeedback}
                        onChange={(e) => setTempProgramFeedback(e.target.value)}
                      />
                   </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <div className="bg-[#0B0F19] rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col h-fit">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-bold tracking-tight">{t.supervisorHeader}</h3>
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                      <Star size={20} className="text-amber-400 fill-amber-400" />
                    </div>
                  </div>

                  {active.status === 'reviewed' ? (
                    <div className="space-y-10 animate-in fade-in duration-700">
                      <div className="flex items-end gap-3">
                        <span className="text-6xl font-black tracking-tighter">{active.supervisorScore}</span>
                        <span className="text-blue-400 font-black text-[9px] uppercase tracking-[0.2em] mb-1.5">{t.points}</span>
                      </div>
                      <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 italic text-indigo-100 text-base leading-relaxed font-medium">
                        "{active.supervisorComments}"
                      </div>
                    </div>
                  ) : active.status === 'submitted' ? (
                    <div className="py-20 flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 animate-pulse"><Clock size={40} className="text-blue-400" /></div>
                      <h4 className="text-xl font-bold mb-2">{t.pendingReview}</h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-[240px]">{t.pendingDesc}</p>
                    </div>
                  ) : (
                    <div className="py-20 flex flex-col items-center text-center opacity-40">
                      <ShieldCheck size={48} className="mb-6 text-slate-600" />
                      <h4 className="text-xl font-bold mb-2">{t.lockedTitle}</h4>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-[240px]">{t.lockedDesc}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;


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
  Zap,
  BarChart3,
  StickyNote
} from 'lucide-react';
import { Language, PerformanceMetrics, UserProfile } from '@/types';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

const DEFAULT_PERFORMANCE: PerformanceMetrics = {
  technical: 0,
  communication: 0,
  punctuality: 0,
  initiative: 0,
  overallRating: 0,
};

const clampScore = (v: number) => {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const computeOverall = (p: Pick<PerformanceMetrics, 'technical' | 'communication' | 'punctuality' | 'initiative'>) => {
  const avg = (p.technical + p.communication + p.punctuality + p.initiative) / 4;
  return clampScore(avg);
};

interface FeedbackMilestone {
  id: string;
  label: { EN: string; TH: string };
  period: { EN: string; TH: string };
  status: 'pending' | 'submitted' | 'reviewed' | 'locked';
  internReflection?: string;
  internProgramFeedback?: string;
  selfPerformance?: Partial<PerformanceMetrics>;
  selfSummary?: string;
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
      selfEvalHeader: "Self Evaluation",
      selfEvalSubtitle: "Score yourself and submit a summary for admin review.",
      selfEvalScoreSheet: "Score Sheet",
      selfEvalSummary: "Executive Summary",
      selfEvalPlaceholder: "Write a self-summary for admin review...",
      supervisorHeader: "Mentor's Assessment",
      points: "Points / 100",
      mentor: "Supervisor",
      pendingReview: "Review Pending",
      pendingDesc: "Your reflection has been sent. Mentor will review soon.",
      lockedTitle: "Access Restricted",
      lockedDesc: "Submit your reflection to unlock mentor feedback.",
      programRatingLabel: "Rate Mentorship Quality",
      milestoneHeader: "Milestone Details",
      week: "Week",
      month: "Month",
      submittedTag: "SUBMITTED",
      pendingTag: "NOT SUBMITTED"
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
      selfEvalHeader: "ประเมินตนเอง",
      selfEvalSubtitle: "ให้คะแนนตัวเองและส่งบทสรุปให้แอดมินตรวจสอบ",
      selfEvalScoreSheet: "แบบประเมินคะแนน",
      selfEvalSummary: "บทสรุปสำหรับผู้บริหาร",
      selfEvalPlaceholder: "เขียนสรุปการประเมินตนเองเพื่อส่งให้แอดมิน...",
      supervisorHeader: "การประเมินจากที่ปรึกษา",
      points: "คะแนน / 100",
      mentor: "ที่ปรึกษา",
      pendingReview: "รอการตรวจสอบ",
      pendingDesc: "ส่งการสะท้อนตัวตนแล้ว ที่ปรึกษาจะประเมินเร็วๆ นี้",
      lockedTitle: "การเข้าถึงถูกจำกัด",
      lockedDesc: "ส่งสรุปผลงานของคุณก่อนเพื่อดูคำติชม",
      programRatingLabel: "ให้คะแนนคุณภาพการดูแลงาน",
      milestoneHeader: "รายละเอียดช่วงการประเมิน",
      week: "สัปดาห์",
      month: "เดือน",
      submittedTag: "ส่งแล้ว",
      pendingTag: "ยังไม่ส่ง"
    }
  }[lang];

  const isFinalized = (status?: FeedbackMilestone['status']) => status === 'submitted' || status === 'reviewed';
  const buildWeekMilestones = () => {
    const arr: FeedbackMilestone[] = [];
    for (let i = 1; i <= 4; i += 1) {
      arr.push({
        id: `week-${i}`,
        label: { EN: `Week ${i}`, TH: `สัปดาห์ที่ ${i}` },
        period: { EN: `Week ${i}`, TH: `สัปดาห์ที่ ${i}` },
        status: 'pending',
      });
    }
    return arr;
  };

  const [activeTrack, setActiveTrack] = useState<'week' | 'month'>('week');
  const [activeId, setActiveId] = useState('week-1');
  const [milestones, setMilestones] = useState<FeedbackMilestone[]>(buildWeekMilestones());
  const [tempProgramRating, setTempProgramRating] = useState(0);
  const [tempReflection, setTempReflection] = useState('');
  const [tempProgramFeedback, setTempProgramFeedback] = useState('');
  const [tempSelfPerformance, setTempSelfPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [tempSelfSummary, setTempSelfSummary] = useState('');
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

    const colRef = collection(firestoreDb, 'users', effectiveUser.id, 'feedbackMilestones');
    return onSnapshot(colRef, (snap) => {
      const savedById = new Map<string, Partial<FeedbackMilestone>>();
      snap.docs.forEach((d) => {
        savedById.set(d.id, d.data() as Partial<FeedbackMilestone>);
      });

      const weekBase = buildWeekMilestones();
      let maxMonth = 1;

      for (const id of savedById.keys()) {
        const m = /^month-(\d+)$/.exec(id);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxMonth) maxMonth = n;
      }
      const monthCount = Math.max(1, maxMonth + 1);
      const monthBase: FeedbackMilestone[] = [];
      for (let i = 1; i <= monthCount; i += 1) {
        monthBase.push({
          id: `month-${i}`,
          label: { EN: `Month ${i}`, TH: `เดือนที่ ${i}` },
          period: { EN: `Month ${i}`, TH: `เดือนที่ ${i}` },
          status: 'pending',
        });
      }

      const nextAll = [...weekBase, ...monthBase].map((x) => {
        const data = savedById.get(x.id) ?? null;
        if (!data) return x;

        const rawSelf = (data as any)?.selfPerformance ?? null;
        const normalizedSelfPerformance: PerformanceMetrics | undefined = rawSelf
          ? {
              technical: typeof rawSelf?.technical === 'number' ? rawSelf.technical : DEFAULT_PERFORMANCE.technical,
              communication: typeof rawSelf?.communication === 'number' ? rawSelf.communication : DEFAULT_PERFORMANCE.communication,
              punctuality: typeof rawSelf?.punctuality === 'number' ? rawSelf.punctuality : DEFAULT_PERFORMANCE.punctuality,
              initiative: typeof rawSelf?.initiative === 'number' ? rawSelf.initiative : DEFAULT_PERFORMANCE.initiative,
              overallRating: typeof rawSelf?.overallRating === 'number' ? rawSelf.overallRating : DEFAULT_PERFORMANCE.overallRating,
            }
          : undefined;

        return {
          ...x,
          status: (data.status as FeedbackMilestone['status']) ?? x.status,
          internReflection: typeof data.internReflection === 'string' ? data.internReflection : x.internReflection,
          internProgramFeedback:
            typeof data.internProgramFeedback === 'string' ? data.internProgramFeedback : x.internProgramFeedback,
          selfPerformance: normalizedSelfPerformance ?? x.selfPerformance,
          selfSummary: typeof (data as any).selfSummary === 'string' ? (data as any).selfSummary : x.selfSummary,
          programRating: typeof data.programRating === 'number' ? data.programRating : x.programRating,
          supervisorScore: typeof data.supervisorScore === 'number' ? data.supervisorScore : x.supervisorScore,
          supervisorComments: typeof data.supervisorComments === 'string' ? data.supervisorComments : x.supervisorComments,
          submissionDate: typeof data.submissionDate === 'string' ? data.submissionDate : x.submissionDate,
          videoStoragePath: typeof data.videoStoragePath === 'string' ? data.videoStoragePath : x.videoStoragePath,
          videoFileName: typeof data.videoFileName === 'string' ? data.videoFileName : x.videoFileName,
          attachments: Array.isArray(data.attachments) ? (data.attachments as any) : x.attachments,
        };
      });

      setMilestones(nextAll);

      setActiveId((prev) => {
        const exists = nextAll.some((x) => x.id === prev);
        if (exists) return prev;

        const weekList = nextAll.filter((x) => x.id.startsWith('week-'));
        const monthList = nextAll.filter((x) => x.id.startsWith('month-'));
        const pickNext = (list: FeedbackMilestone[]) => {
          const next = list.find((x) => !isFinalized(x.status));
          return next?.id ?? list[list.length - 1]?.id;
        };

        if (activeTrack === 'month') return pickNext(monthList);
        return pickNext(weekList);
      });
    });
  }, [activeTrack, effectiveUser]);

  useEffect(() => {
    if (!active) return;
    setTempProgramRating(active.programRating ?? 0);
    setTempReflection(active.internReflection ?? '');
    setTempProgramFeedback(active.internProgramFeedback ?? '');
    const rawSelf = active.selfPerformance ?? null;
    const normalizedSelfPerformance: PerformanceMetrics = {
      technical: typeof rawSelf?.technical === 'number' ? rawSelf.technical : DEFAULT_PERFORMANCE.technical,
      communication: typeof rawSelf?.communication === 'number' ? rawSelf.communication : DEFAULT_PERFORMANCE.communication,
      punctuality: typeof rawSelf?.punctuality === 'number' ? rawSelf.punctuality : DEFAULT_PERFORMANCE.punctuality,
      initiative: typeof rawSelf?.initiative === 'number' ? rawSelf.initiative : DEFAULT_PERFORMANCE.initiative,
      overallRating: typeof rawSelf?.overallRating === 'number' ? rawSelf.overallRating : DEFAULT_PERFORMANCE.overallRating,
    };
    setTempSelfPerformance(normalizedSelfPerformance);
    setTempSelfSummary(active.selfSummary ?? '');
    setPendingVideo(null);
    setPendingAttachments([]);
    setSubmitError(null);
  }, [activeId]);

  const displaySelfPerformance = useMemo(() => {
    const next: PerformanceMetrics = {
      technical: clampScore(tempSelfPerformance.technical),
      communication: clampScore(tempSelfPerformance.communication),
      punctuality: clampScore(tempSelfPerformance.punctuality),
      initiative: clampScore(tempSelfPerformance.initiative),
      overallRating: computeOverall(tempSelfPerformance),
    };
    return next;
  }, [tempSelfPerformance]);

  useEffect(() => {
    const list = milestones.filter((m) => m.id.startsWith(`${activeTrack}-`));
    if (list.length === 0) return;
    const next = list.find((m) => !isFinalized(m.status)) ?? list[list.length - 1];
    if (next && next.id !== activeId) setActiveId(next.id);
  }, [activeId, activeTrack, milestones]);

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

      const nextSelfPerformance: PerformanceMetrics = {
        technical: clampScore(tempSelfPerformance.technical),
        communication: clampScore(tempSelfPerformance.communication),
        punctuality: clampScore(tempSelfPerformance.punctuality),
        initiative: clampScore(tempSelfPerformance.initiative),
        overallRating: computeOverall(tempSelfPerformance),
      };

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
          selfPerformance: nextSelfPerformance,
          selfSummary: tempSelfSummary,
          submissionDate,
          attachments: nextAttachments,
          ...(nextVideoStoragePath ? { videoStoragePath: nextVideoStoragePath } : {}),
          ...(nextVideoFileName ? { videoFileName: nextVideoFileName } : {}),
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setActiveId((prev) => {
        const list = milestones.filter((m) => m.id.startsWith(`${activeTrack}-`));
        const idx = list.findIndex((m) => m.id === prev);
        if (idx < 0) return prev;
        const next = list[idx + 1];
        return next?.id ?? prev;
      });

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
            <div className="flex flex-col gap-3 items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pr-2 text-right">{t.milestone_label}</span>
              <div className="inline-flex w-fit bg-white p-1.5 rounded-[1.75rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <button
                  onClick={() => setActiveTrack('week')}
                  className={`px-6 py-3.5 rounded-[1.25rem] text-xs font-black transition-all duration-300 flex-shrink-0 ${
                    activeTrack === 'week' ? 'bg-slate-900 text-white shadow-2xl scale-105' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.week}
                </button>
                <button
                  onClick={() => setActiveTrack('month')}
                  className={`px-6 py-3.5 rounded-[1.25rem] text-xs font-black transition-all duration-300 flex-shrink-0 ${
                    activeTrack === 'month' ? 'bg-slate-900 text-white shadow-2xl scale-105' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t.month}
                </button>
              </div>
              <div className="flex bg-white p-1.5 rounded-[1.75rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-x-auto scrollbar-hide max-w-full ml-auto">
                {milestones
                  .filter((m) => m.id.startsWith(`${activeTrack}-`))
                  .map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      className={`px-6 py-3.5 rounded-[1.25rem] text-xs font-black transition-all duration-300 flex-shrink-0 ${
                        activeId === m.id ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {m.label[lang]}
                        <span
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            isFinalized(m.status)
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : 'bg-slate-50 text-slate-500 border border-slate-100'
                          }`}
                        >
                          {isFinalized(m.status) ? t.submittedTag : t.pendingTag}
                        </span>
                      </span>
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

            <div className="lg:col-span-12">
              <div className="p-8 md:p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{t.selfEvalHeader}</h3>
                    <p className="text-slate-500 text-xs md:text-sm font-medium mt-2">{t.selfEvalSubtitle}</p>
                  </div>
                  <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
                    <BarChart3 size={22} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6">{t.selfEvalScoreSheet}</div>
                    <div className="space-y-7">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                        <ScoreInput
                          label={lang === 'TH' ? 'ทักษะด้านเทคนิค' : 'TECHNICAL PROFICIENCY'}
                          value={tempSelfPerformance.technical}
                          onChange={(v) => setTempSelfPerformance((p) => ({ ...p, technical: v }))}
                        />
                        <ScoreInput
                          label={lang === 'TH' ? 'การสื่อสารและการทำงานร่วมกัน' : 'TEAM COMMUNICATION'}
                          value={tempSelfPerformance.communication}
                          onChange={(v) => setTempSelfPerformance((p) => ({ ...p, communication: v }))}
                        />
                        <ScoreInput
                          label={lang === 'TH' ? 'ความตรงต่อเวลาและความรับผิดชอบ' : 'PUNCTUALITY & RELIABILITY'}
                          value={tempSelfPerformance.punctuality}
                          onChange={(v) => setTempSelfPerformance((p) => ({ ...p, punctuality: v }))}
                        />
                        <ScoreInput
                          label={lang === 'TH' ? 'ความริเริ่มและการแก้ปัญหา' : 'SELF-INITIATIVE'}
                          value={tempSelfPerformance.initiative}
                          onChange={(v) => setTempSelfPerformance((p) => ({ ...p, initiative: v }))}
                        />
                      </div>

                      <div className="pt-2">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <StickyNote size={18} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.selfEvalSummary}</div>
                            <div className="text-sm font-black text-slate-900">{lang === 'TH' ? 'ข้อความสรุปที่ส่งให้แอดมิน' : 'Summary sent to Admin'}</div>
                          </div>
                        </div>
                        <textarea
                          value={tempSelfSummary}
                          onChange={(e) => setTempSelfSummary(e.target.value)}
                          rows={6}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                          placeholder={t.selfEvalPlaceholder}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-[#3B49DF] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-36 -mt-36 blur-3xl"></div>
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">{t.selfEvalSummary}</div>
                      <div className="flex flex-col items-center justify-center gap-8 flex-1 py-8">
                        <div className="w-44 h-44 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                          <span className="text-7xl font-black tracking-tighter leading-none">{displaySelfPerformance.overallRating}</span>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">
                            {lang === 'TH' ? 'คะแนนเฉลี่ย' : 'AVG SCORE'}
                          </span>
                        </div>
                        <p className="text-base leading-relaxed text-indigo-50 italic font-medium text-center">
                          {tempSelfSummary
                            ? `\"${tempSelfSummary}\"`
                            : `\"${lang === 'TH' ? 'เขียนสรุปการประเมินตนเองเพื่อให้แอดมินตรวจสอบ' : 'Write a self-summary for admin review'}\"`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScoreInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) => {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{label}</div>
        <div className="text-sm font-black text-slate-900">{safeValue}/100</div>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none"
        />
      </div>
    </div>
  );
};

export default FeedbackPage;

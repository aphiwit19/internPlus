import React, { useEffect, useMemo, useState } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  Target, 
  Zap, 
  Star, 
  Award, 
  TrendingUp, 
  ArrowRight,
  Briefcase,
  FileCheck,
  MessageCircle,
  ShieldCheck,
  MessageSquareMore,
  Copy,
  ChevronRight as LucideChevronRight
} from 'lucide-react';
import { UserProfile, Language, PerformanceMetrics } from '@/types';
import { PageId } from '@/pageTypes';

import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/firebase';
import { SubTask } from '@/types';

const DEFAULT_PERFORMANCE: PerformanceMetrics = {
  technical: 0,
  communication: 0,
  punctuality: 0,
  initiative: 0,
  overallRating: 0,
};

interface InternDashboardProps {
  user: UserProfile;
  onNavigate: (page: PageId) => void;
  lang: Language;
}

const InternDashboard: React.FC<InternDashboardProps> = ({ user, onNavigate, lang }) => {
  const [assignedProjects, setAssignedProjects] = useState<Array<{ id: string; title?: string; description?: string; tasks?: SubTask[] }>>([]);
  const [personalProjects, setPersonalProjects] = useState<Array<{ id: string; title?: string; description?: string; tasks?: SubTask[] }>>([]);
  const [attendanceStats, setAttendanceStats] = useState<{ totalDays: number; presentDays: number }>({ totalDays: 0, presentDays: 0 });
  const [mentorProfile, setMentorProfile] = useState<{ name?: string; avatar?: string; position?: string; lineId?: string } | null>(null);
  const [selfPerformance, setSelfPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [selfSummary, setSelfSummary] = useState('');
  const [supervisorPerformance, setSupervisorPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [supervisorSummary, setSupervisorSummary] = useState('');
  const [supervisorScore, setSupervisorScore] = useState<number | null>(null);

  useEffect(() => {
    const assignedRef = collection(firestoreDb, 'users', user.id, 'assignmentProjects');
    const unsubAssigned = onSnapshot(
      assignedRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setAssignedProjects(list);
      },
      () => {
        setAssignedProjects([]);
      },
    );

    const personalRef = collection(firestoreDb, 'users', user.id, 'personalProjects');
    const unsubPersonal = onSnapshot(
      personalRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setPersonalProjects(list);
      },
      () => {
        setPersonalProjects([]);
      },
    );

    return () => {
      unsubAssigned();
      unsubPersonal();
    };
  }, [user.id]);

  useEffect(() => {
    const ref = doc(firestoreDb, 'users', user.id);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          selfPerformance?: Partial<PerformanceMetrics>;
          selfSummary?: string;
          supervisorPerformance?: Partial<PerformanceMetrics>;
          supervisorSummary?: string;
        };
        const raw = data.selfPerformance ?? null;
        setSelfPerformance({
          technical: typeof raw?.technical === 'number' ? raw.technical : DEFAULT_PERFORMANCE.technical,
          communication: typeof raw?.communication === 'number' ? raw.communication : DEFAULT_PERFORMANCE.communication,
          punctuality: typeof raw?.punctuality === 'number' ? raw.punctuality : DEFAULT_PERFORMANCE.punctuality,
          initiative: typeof raw?.initiative === 'number' ? raw.initiative : DEFAULT_PERFORMANCE.initiative,
          overallRating: typeof raw?.overallRating === 'number' ? raw.overallRating : DEFAULT_PERFORMANCE.overallRating,
        });
        setSelfSummary(typeof data.selfSummary === 'string' ? data.selfSummary : '');

        const rawSup = data.supervisorPerformance ?? null;
        setSupervisorPerformance({
          technical: typeof rawSup?.technical === 'number' ? rawSup.technical : DEFAULT_PERFORMANCE.technical,
          communication: typeof rawSup?.communication === 'number' ? rawSup.communication : DEFAULT_PERFORMANCE.communication,
          punctuality: typeof rawSup?.punctuality === 'number' ? rawSup.punctuality : DEFAULT_PERFORMANCE.punctuality,
          initiative: typeof rawSup?.initiative === 'number' ? rawSup.initiative : DEFAULT_PERFORMANCE.initiative,
          overallRating: typeof rawSup?.overallRating === 'number' ? rawSup.overallRating : DEFAULT_PERFORMANCE.overallRating,
        });
        setSupervisorSummary(typeof data.supervisorSummary === 'string' ? data.supervisorSummary : '');
      },
      () => {
        setSelfPerformance(DEFAULT_PERFORMANCE);
        setSelfSummary('');
        setSupervisorPerformance(DEFAULT_PERFORMANCE);
        setSupervisorSummary('');
      },
    );
  }, [user.id]);

  useEffect(() => {
    const colRef = collection(firestoreDb, 'users', user.id, 'feedbackMilestones');
    return onSnapshot(
      colRef,
      (snap) => {
        const candidates = snap.docs
          .map((d) => {
            const raw = d.data() as any;
            const score = typeof raw?.supervisorScore === 'number' ? raw.supervisorScore : null;
            const reviewedAtMs = typeof raw?.supervisorReviewedAt?.toDate === 'function' ? raw.supervisorReviewedAt.toDate().getTime() : 0;
            return { score, reviewedAtMs, id: d.id };
          })
          .filter((x) => typeof x.score === 'number');

        if (candidates.length === 0) {
          setSupervisorScore(null);
          return;
        }
        candidates.sort((a, b) => (b.reviewedAtMs || 0) - (a.reviewedAtMs || 0) || String(b.id).localeCompare(String(a.id)));
        setSupervisorScore(candidates[0]?.score ?? null);
      },
      () => {
        setSupervisorScore(null);
      },
    );
  }, [user.id]);

  useEffect(() => {
    if (!user.supervisorId) {
      setMentorProfile(null);
      return;
    }
    const ref = doc(firestoreDb, 'users', user.supervisorId);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setMentorProfile(null);
          return;
        }
        const data = snap.data() as any;
        setMentorProfile({
          name: data?.name,
          avatar: data?.avatar,
          position: data?.position,
          lineId: data?.lineId,
        });
      },
      () => {
        setMentorProfile(null);
      },
    );
  }, [user.supervisorId]);

  useEffect(() => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const attendanceRef = collection(firestoreDb, 'users', user.id, 'attendance');
    const q = query(
      attendanceRef,
      where('date', '>=', toDateKey(monthStart)),
      where('date', '<=', toDateKey(monthEnd)),
    );
    return onSnapshot(
      q,
      (snap) => {
        let total = 0;
        let present = 0;
        snap.forEach((d) => {
          total += 1;
          const raw = d.data() as any;
          if (raw?.clockInAt) present += 1;
        });
        setAttendanceStats({ totalDays: total, presentDays: present });
      },
      () => {
        setAttendanceStats({ totalDays: 0, presentDays: 0 });
      },
    );
  }, [user.id]);

  const allProjects = useMemo(() => [...assignedProjects, ...personalProjects], [assignedProjects, personalProjects]);

  const parsePeriodDates = (period?: string) => {
    if (!period) return null;
    const isoMatches = period.match(/\d{4}-\d{2}-\d{2}/g);
    if (isoMatches && isoMatches.length >= 2) {
      const start = new Date(`${isoMatches[0]}T00:00:00.000Z`);
      const end = new Date(`${isoMatches[1]}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) return { start, end };
    }

    const dmyMatches = period.match(/\d{2}\/\d{2}\/\d{4}/g);
    if (dmyMatches && dmyMatches.length >= 2) {
      const toIso = (dmy: string) => {
        const [dd, mm, yyyy] = dmy.split('/');
        if (!dd || !mm || !yyyy) return null;
        return `${yyyy}-${mm}-${dd}`;
      };
      const startIso = toIso(dmyMatches[0]);
      const endIso = toIso(dmyMatches[1]);
      if (!startIso || !endIso) return null;
      const start = new Date(`${startIso}T00:00:00.000Z`);
      const end = new Date(`${endIso}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) return { start, end };
    }

    return null;
  };

  const daysBetweenCeil = (from: Date, to: Date) => {
    const ms = to.getTime() - from.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  const taskStats = useMemo(() => {
    let total = 0;
    let done = 0;
    let inProgress = 0;
    for (const p of allProjects) {
      const tasks = Array.isArray(p.tasks) ? p.tasks : [];
      for (const t of tasks) {
        total += 1;
        if (t.status === 'DONE') done += 1;
        if (t.status === 'IN_PROGRESS' || t.status === 'DELAYED' || t.status === 'REVISION') inProgress += 1;
      }
    }
    return { total, done, inProgress };
  }, [allProjects]);

  const completionPercent = useMemo(() => {
    if (taskStats.total === 0) return null;
    return Math.round((taskStats.done / taskStats.total) * 100);
  }, [taskStats.done, taskStats.total]);

  const attendancePercent = useMemo(() => {
    if (attendanceStats.totalDays === 0) return null;
    return Math.round((attendanceStats.presentDays / attendanceStats.totalDays) * 100);
  }, [attendanceStats.presentDays, attendanceStats.totalDays]);

  const nextTask = useMemo(() => {
    const now = new Date().getTime();
    const candidates: Array<{ projectTitle: string; projectDesc: string; taskTitle: string; plannedEndMs: number }> = [];
    for (const p of allProjects) {
      const tasks = Array.isArray(p.tasks) ? p.tasks : [];
      for (const t of tasks) {
        if (t.status === 'DONE') continue;
        const endMs = new Date(t.plannedEnd).getTime();
        if (Number.isNaN(endMs)) continue;
        if (endMs < now) continue;
        candidates.push({
          projectTitle: typeof p.title === 'string' ? p.title : 'Untitled Project',
          projectDesc: typeof p.description === 'string' ? p.description : '',
          taskTitle: t.title,
          plannedEndMs: endMs,
        });
      }
    }
    candidates.sort((a, b) => a.plannedEndMs - b.plannedEndMs);
    return candidates[0] ?? null;
  }, [allProjects]);

  const internMonthLabel = useMemo(() => {
    const parsed = parsePeriodDates(user.internPeriod);
    if (!parsed) return null;
    const now = new Date();
    const start = parsed.start;
    const months = (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()) + 1;
    const safe = Math.max(1, months);
    if (lang === 'TH') return `เดือนที่ ${safe}`;
    const suffix = (n: number) => {
      const mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
      const mod10 = n % 10;
      if (mod10 === 1) return `${n}st`;
      if (mod10 === 2) return `${n}nd`;
      if (mod10 === 3) return `${n}rd`;
      return `${n}th`;
    };
    return `${suffix(safe)} month`;
  }, [lang, user.internPeriod]);

  const daysLeftValue = useMemo(() => {
    const now = new Date();
    const parsed = parsePeriodDates(user.internPeriod);
    if (parsed) {
      const d = daysBetweenCeil(now, parsed.end);
      if (Number.isFinite(d)) return String(Math.max(0, d));
    }
    return '-';
  }, [user.internPeriod]);

  const dueLabel = useMemo(() => {
    if (!nextTask?.plannedEndMs) return '-';
    const d = daysBetweenCeil(new Date(), new Date(nextTask.plannedEndMs));
    if (!Number.isFinite(d)) return '-';
    const safe = Math.max(0, d);
    if (lang === 'TH') return `ครบกำหนดใน ${safe} วัน`;
    return `Due in ${safe} days`;
  }, [lang, nextTask?.plannedEndMs]);

  const overallRating = useMemo(() => {
    if (typeof supervisorPerformance.overallRating === 'number' && supervisorPerformance.overallRating > 0) {
      const scaled = supervisorPerformance.overallRating / 20;
      return Math.max(0, Math.min(5, Math.round(scaled * 100) / 100));
    }
    if (typeof supervisorScore === 'number') {
      const scaled = supervisorScore / 20;
      return Math.max(0, Math.min(5, Math.round(scaled * 100) / 100));
    }
    return null;
  }, [supervisorPerformance.overallRating, supervisorScore]);

  const performance = useMemo(() => {
    return {
      technical: supervisorPerformance.technical,
      communication: supervisorPerformance.communication,
      punctuality: supervisorPerformance.punctuality,
      initiative: supervisorPerformance.initiative,
      overallRating: supervisorPerformance.overallRating,
    };
  }, [
    supervisorPerformance.communication,
    supervisorPerformance.initiative,
    supervisorPerformance.overallRating,
    supervisorPerformance.punctuality,
    supervisorPerformance.technical,
  ]);

  const summaryMessage = useMemo(() => {
    const c = typeof completionPercent === 'number' ? completionPercent : null;
    const a = typeof attendancePercent === 'number' ? attendancePercent : null;
    if (lang === 'TH') {
      if (c !== null && a !== null) {
        if (c >= 80 && a >= 90) return 'ผลงานและการเข้างานดีมาก รักษามาตรฐานนี้ต่อเนื่อง';
        if (c >= 60 && a >= 80) return 'กำลังทำได้ดี แนะนำให้เร่งปิดงานให้มากขึ้นเพื่อเพิ่มความคืบหน้า';
        return 'แนะนำให้โฟกัสการเข้างานและปิดงานตามแผนเพื่อเพิ่มผลลัพธ์';
      }
      if (c !== null) return 'แนะนำให้เร่งปิดงานตามแผนเพื่อเพิ่มความคืบหน้า';
      if (a !== null) return 'รักษาการเข้างานให้สม่ำเสมอเพื่อสะสมผลงาน';
      return 'เริ่มต้นอัปเดตงานใน Assignment เพื่อให้ระบบสรุปผลได้';
    }
    if (c !== null && a !== null) {
      if (c >= 80 && a >= 90) return 'Strong progress and consistency. Keep the momentum.';
      if (c >= 60 && a >= 80) return 'Good trajectory. Focus on closing tasks to boost completion.';
      return 'Focus on attendance consistency and meeting task deadlines.';
    }
    if (c !== null) return 'Focus on closing tasks to improve completion.';
    if (a !== null) return 'Stay consistent with attendance to build momentum.';
    return 'Start updating tasks in Assignment to see your dashboard insights.';
  }, [attendancePercent, completionPercent, lang]);

  const t = {
    EN: {
      welcome: "Welcome back",
      personal: "Personal Dashboard",
      period: "Internship Period",
      currentMonth: "4th month",
      as: "as a",
      completion: "Completion",
      rating: "Rating",
      daysLeft: "Days Left",
      attendance: "Attendance",
      analysis: "Performance Analysis",
      updated: "Updated Weekly",
      technical: "Technical Execution",
      collaboration: "Team Collaboration",
      punctuality: "Deadline Punctuality",
      solving: "Problem Solving",
      growth: "Growth Projection",
      selfEval: "Self Evaluation",
      viewSelfEval: "Open Self Evaluation",
      assignment: "Current Assignment",
      due: "Due in 5 days",
      planner: "Open Planner",
      summary: "Executive Summary",
      avgGrade: "AVG GRADE",
      tasksVerified: "Tasks Verified",
      achievements: "Achievements",
      ontime: "On-time Ratio",
      mentor: "Your Primary Mentor",
      comm: "Mentor Communication",
      policy: "Request Policy Sync",
      next: "Next Milestone",
      roadmap: "View Roadmap"
    },
    TH: {
      welcome: "ยินดีต้อนรับกลับมา",
      personal: "แดชบอร์ดส่วนตัว",
      period: "ระยะเวลาการฝึกงาน",
      currentMonth: "เดือนที่ 4",
      as: "ในตำแหน่ง",
      completion: "ความคืบหน้า",
      rating: "คะแนนเฉลี่ย",
      daysLeft: "วันที่เหลือ",
      attendance: "การเข้างาน",
      analysis: "การวิเคราะห์ผลงาน",
      updated: "อัปเดตรายสัปดาห์",
      technical: "ทักษะด้านเทคนิค",
      collaboration: "การทำงานร่วมกัน",
      punctuality: "ความตรงต่อเวลา",
      solving: "การแก้ปัญหา",
      growth: "การคาดการณ์การเติบโต",
      selfEval: "ประเมินตนเอง",
      viewSelfEval: "เปิดหน้าประเมินตนเอง",
      assignment: "งานที่ได้รับมอบหมาย",
      due: "ครบกำหนดใน 5 วัน",
      planner: "เปิดเครื่องมือวางแผน",
      summary: "สรุปผลงาน",
      avgGrade: "เกรดเฉลี่ย",
      tasksVerified: "งานที่ตรวจสอบแล้ว",
      achievements: "ความสำเร็จ",
      ontime: "อัตราตรงเวลา",
      mentor: "ที่ปรึกษาหลักของคุณ",
      comm: "การติดต่อที่ปรึกษา",
      policy: "ขอซิงค์นโยบาย",
      next: "เป้าหมายถัดไป",
      roadmap: "ดูแผนผังการทำงาน"
    }
  }[lang];

  const stats = [
    { label: t.completion, value: completionPercent === null ? '-' : `${completionPercent}%`, icon: <Target className="text-blue-600" />, color: 'blue' },
    { label: t.rating, value: overallRating === null ? '-' : overallRating.toFixed(2), icon: <Star className="text-amber-500" />, color: 'amber' },
    { label: t.daysLeft, value: daysLeftValue, icon: <Calendar className="text-indigo-600" />, color: 'indigo' },
    { label: t.attendance, value: attendancePercent === null ? '-' : `${attendancePercent}%`, icon: <Clock className="text-emerald-600" />, color: 'emerald' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[#F8FAFC] p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full overflow-y-auto pb-20 px-2 scrollbar-hide">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
              internPlus <ArrowRight size={10} strokeWidth={3} /> {t.personal}
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
              {t.welcome}, <span className="text-blue-600">{user.name.split(' ')[0]}!</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium pt-2">
              {lang === 'EN' ? `You are currently in your ` : `คุณอยู่ในช่วง `}
              <span className="font-bold text-slate-900">{internMonthLabel ?? t.currentMonth}</span> 
              {lang === 'EN' ? ` as a ${user.position}.` : ` ในตำแหน่ง ${user.position}`}
            </p>
          </div>
          <div className="bg-white px-6 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.period}</p>
              <p className="text-xs font-black text-slate-900">{user.internPeriod}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-5 hover:border-blue-200 transition-all group">
              <div className={`w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                {stat.icon}
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">{stat.value}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-12">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <BarChart3 className="text-blue-600" size={24} /> {t.analysis}
                </h3>
                <div className="flex items-center gap-3">
                  {(mentorProfile?.name || user.supervisorName) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200">
                      <img
                        src={mentorProfile?.avatar ?? user.avatar}
                        className="w-6 h-6 rounded-lg object-cover"
                        alt=""
                      />
                      <div className="text-[10px] font-black uppercase tracking-widest">
                        {lang === 'TH' ? 'Supervisor' : 'Supervisor'}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 truncate max-w-[140px]">
                        {mentorProfile?.name ?? user.supervisorName}
                      </div>
                    </div>
                  )}
                  <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-100">{t.updated}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <PerformanceBar label={t.technical} score={performance.technical} color="blue" />
                <PerformanceBar label={t.collaboration} score={performance.communication} color="indigo" />
                <PerformanceBar label={t.punctuality} score={performance.punctuality} color="emerald" />
                <PerformanceBar label={t.solving} score={performance.initiative} color="rose" />
              </div>
              <div className="mt-10 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.selfEval}</div>
                    <div className="text-sm font-black text-slate-900">{lang === 'TH' ? 'สรุปจากหน้า Self Evaluation' : 'Preview from Self Evaluation'}</div>
                  </div>
                  <button
                    onClick={() => onNavigate('self-evaluation')}
                    className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    {t.viewSelfEval}
                  </button>
                </div>
                <div className="mt-4 text-xs text-slate-500 font-medium italic leading-relaxed">
                  {selfSummary ? `"${selfSummary}"` : (lang === 'TH' ? 'ยังไม่มีข้อความสรุปจาก Self Evaluation' : 'No self-summary yet')}
                </div>
              </div>
              <div className="mt-12 pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.growth}</p>
                      <p className="text-xs text-slate-400 font-medium italic">
                        {lang === 'EN' ? `"On track for senior intern certification by next month."` : `"มีแนวโน้มได้รับใบรับรองระดับอาวุโสในเดือนหน้า"`}
                      </p>
                    </div>
                 </div>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-0 group-hover:opacity-60 transition-opacity"></div>
               <div className="flex items-center justify-between mb-8 relative z-10">
                 <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                   <Briefcase className="text-indigo-600" size={24} /> {t.assignment}
                 </h3>
                 <span className="text-xs font-bold text-slate-400">{dueLabel}</span>
               </div>
               <div className="p-8 bg-slate-50/50 border border-slate-100 rounded-3xl relative z-10">
                 <h4 className="text-lg font-black text-slate-900 mb-2">{nextTask?.taskTitle ?? '-'}</h4>
                 <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                   {nextTask?.projectTitle ?? '-'}
                 </p>
                 <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                    <div className="flex -space-x-3">
                       <img
                         src={user.avatar}
                         className="w-10 h-10 rounded-xl border-4 border-white object-cover"
                         alt=""
                       />
                    </div>
                    <button 
                      onClick={() => onNavigate('assignment')}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                    >
                      {t.planner} <ArrowRight size={14} />
                    </button>
                 </div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-[#3B49DF] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <h4 className="text-xl font-black mb-10 tracking-tight relative z-10">{t.summary}</h4>
              <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
                <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-6xl font-black tracking-tighter leading-none">{supervisorPerformance.overallRating}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">
                    {lang === 'TH' ? 'คะแนนเฉลี่ย' : 'AVG SCORE'}
                  </span>
                </div>
                <p className="text-lg leading-relaxed text-indigo-50 italic font-medium text-center">
                  {(supervisorSummary || selfSummary)
                    ? `\"${supervisorSummary || selfSummary}\"`
                    : `\"${lang === 'TH' ? 'ยังไม่มีข้อความสรุปจาก Supervisor' : 'No supervisor summary yet'}\"`}
                </p>
              </div>

              {(mentorProfile?.name || user.supervisorName) && (
                <div className="mt-10 pt-8 border-t border-white/15 relative z-10">
                  <div className="flex items-center gap-4">
                    <img
                      src={mentorProfile?.avatar ?? user.avatar}
                      className="w-12 h-12 rounded-2xl object-cover ring-4 ring-white/10"
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100/70">{lang === 'TH' ? 'Supervisor' : 'Supervisor'}</div>
                      <div className="text-sm font-black text-white truncate">{mentorProfile?.name ?? user.supervisorName}</div>
                      <div className="text-[11px] font-bold text-indigo-100/80 truncate">{mentorProfile?.position ?? ''}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">{t.mentor}</h4>
               <div className="flex items-center gap-4 mb-8">
                  <img src={mentorProfile?.avatar ?? user.avatar} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-slate-50 shadow-sm" alt="" />
                  <div>
                    <h5 className="text-sm font-black text-slate-900">{mentorProfile?.name ?? user.supervisorName ?? '-'}</h5>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">{mentorProfile?.position ?? '-'}</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 group hover:bg-slate-100 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t.comm}</p>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#00B900] rounded-lg flex items-center justify-center text-white"><MessageSquareMore size={18} fill="currentColor"/></div>
                          <span className="text-sm font-black text-slate-800 tracking-tight">{mentorProfile?.lineId ?? '-'}</span>
                       </div>
                       <button
                         onClick={() => {
                           const id = mentorProfile?.lineId;
                           if (id) void navigator.clipboard.writeText(id);
                         }}
                         className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                         title="Copy LINE ID"
                       >
                         <Copy size={16} />
                       </button>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                    <ShieldCheck size={16} /> {t.policy}
                  </button>
               </div>
            </div>

            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform scale-150 -mr-10 -mt-10">
                  <div className="w-32 h-32 rounded-full border-[12px] border-white/40 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-[8px] border-white/30 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/20"></div>
                    </div>
                  </div>
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{t.next}</p>
               <h4 className="text-xl font-bold mb-8 pr-10 leading-tight">
                {lang === 'EN' ? "Quarterly Program Review Phase" : "ช่วงการประเมินโปรแกรมรายไตรมาส"}
               </h4>
               <button 
                onClick={() => onNavigate('onboarding')}
                className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 shadow-2xl"
               >
                 {t.roadmap}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PerformanceBar = ({ label, score, color }: { label: string, score: number, color: string }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-end">
      <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</h5>
      <span className={`text-lg font-black text-${color}-600 tracking-tighter leading-none`}>{score}<span className="text-[10px] font-bold text-slate-400 ml-1">/100</span></span>
    </div>
    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
      <div className={`h-full bg-${color}-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(var(--tw-color-${color}-500-rgb),0.3)]`} style={{ width: `${score}%` }}></div>
    </div>
  </div>
);

const SummaryItem = ({ icon, label, count }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
    <div className="flex items-center gap-3">
       <div className="text-blue-400">{icon}</div>
       <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-sm font-black text-white">{count}</span>
  </div>
);

export default InternDashboard;

import React, { useMemo, useState, useEffect, useRef } from 'react';

import { 

  Users, 

  Clock, 

  CheckCircle2, 

  AlertCircle, 

  ChevronRight, 

  Search, 

  Filter, 

  ArrowLeft,

  LayoutDashboard,

  FileText,

  TrendingUp,

  Star,

  Award,

  Check, 

  X,

  User,

  ExternalLink,

  Download,

  Paperclip,

  Eye,

  UserPlus,

  BarChart3,

  Calendar,

  Zap,

  LayoutGrid,

  List,

  MessageCircle,

  Briefcase,

  Target,

  MessageSquareMore,

  Copy,

  Plus,

  ArrowUpRight,

  ShieldCheck,

  MoreVertical,

  ChevronLeft,

  Heart,

  Files,

  CreditCard,

  GraduationCap,

  Layout as LayoutIcon,

  CircleAlert,

  StickyNote,

  Play,

  FolderOpen,

  FileCode,

  FileImage,

  FileSpreadsheet,

  Grid,

  MoreHorizontal,

  RotateCcw,

  UserCheck,

  CalendarDays,

  UserX,

  PlaneTakeoff,

  History,

  Building2,

  ChevronDown,

  Home

} from 'lucide-react';

import { 
  arrayUnion, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  limit, 
  onSnapshot, 
  orderBy, 
  query, 
  serverTimestamp, 
  setDoc, 
  updateDoc, 
  where 
} from 'firebase/firestore';

import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { useTranslation } from 'react-i18next';

import { UserProfile, PerformanceMetrics, Language, SubTask, TaskAttachment } from '@/types';

import { PageId } from '@/pageTypes';

import InternListSection from '@/pages/supervisor/components/InternListSection';

import InternDeepDiveLayout, { SupervisorDeepDiveTab } from '@/pages/supervisor/components/InternDeepDiveLayout';

import AttendanceTab from '@/pages/supervisor/components/AttendanceTab';

import FeedbackTab, { FeedbackItem } from '@/pages/supervisor/components/FeedbackTab';

import TasksTab from '@/pages/supervisor/components/TasksTab';

import DocumentsTab from '@/pages/supervisor/components/DocumentsTab';

import AssignmentsTab from '@/pages/admin/components/AssignmentsTab';

import { firestoreDb, firebaseStorage } from '@/firebase';



interface InternDetail {

  id: string;

  name: string;

  avatar: string;

  position: string;

  internPeriod: string;

  supervisorId?: string;

  supervisorName?: string;

  progress: number;

  status: 'Active' | 'Inactive';

  attendance: string;

  department: string;

  email: string;

  tasks: SubTask[];

  feedback: FeedbackItem[];

  performance: PerformanceMetrics;

  supervisorPerformance: PerformanceMetrics;

  supervisorSummary: string;

  attendanceLog: {

    id: string;

    date: string;

    clockIn: string;

    clockOut: string;

    mode: 'WFO' | 'WFH';

    status: 'PRESENT' | 'LATE';

    duration: string;

  }[];

}



type FeedbackMilestoneDoc = {

  status?: string;

  internReflection?: string;

  internProgramFeedback?: string;

  videoStoragePath?: string;

  videoFileName?: string;

  attachments?: Array<{ fileName: string; storagePath: string }>;

  supervisorScore?: number;

  supervisorComments?: string;

  supervisorPerformance?: Partial<PerformanceMetrics>;

  supervisorSummary?: string;

  supervisorReviewedAt?: any;

  programRating?: number;

  submissionDate?: string;

  selfPerformance?: Partial<PerformanceMetrics>;

  selfSummary?: string;

};



 const DEFAULT_PERFORMANCE: PerformanceMetrics = {

  technical: 0,

  communication: 0,

  punctuality: 0,

  initiative: 0,

  overallRating: 0,

 };



interface SupervisorDashboardProps {

  user: UserProfile;

  onNavigate: (page: PageId) => void;

  currentTab: string;

}



type ProjectKind = 'assigned' | 'personal';



type PendingAssignmentNext =

  | { kind: 'handoff'; colName: 'assignmentProjects' | 'personalProjects'; projectId: string }

  | { kind: 'task'; colName: 'assignmentProjects' | 'personalProjects'; projectId: string; taskId: string };



type HandoffAssetItem = {

  key: string;

  label: string;

  date?: string;

  projectTitle: string;

  status?: string;

  open: { type: 'storage'; storagePath: string } | { type: 'url'; url: string };

};



type HandoffProjectGroup = {

  projectTitle: string;

  date?: string;

  status?: string;

  items: HandoffAssetItem[];

};



const SUP_MANAGE_INTERNS_NAV_KEY = 'sup_manage_interns_nav';



const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ user, onNavigate, currentTab }) => {

  const { t } = useTranslation();

  const [interns, setInterns] = useState<InternDetail[]>([]);

  const [allInterns, setAllInterns] = useState<InternDetail[]>([]);

  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [activeTab, setActiveTab] = useState<SupervisorDeepDiveTab>(() => (currentTab === 'manage-interns' ? 'assets' : 'overview'));

  const [tabVisitTrigger, setTabVisitTrigger] = useState(0);

  const [activeFeedbackId, setActiveFeedbackId] = useState('week-1');

  const [attendanceViewMode, setAttendanceViewMode] = useState<'LOG' | 'CALENDAR'>('LOG');



  const [selectedInternAttendanceLog, setSelectedInternAttendanceLog] = useState<InternDetail['attendanceLog']>([]);



  const [filterDate, setFilterDate] = useState<string>('');

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');

  const [filterWorkMode, setFilterWorkMode] = useState<'ALL' | 'WFO' | 'WFH'>('ALL');

  const [pendingFilterDate, setPendingFilterDate] = useState<string>('');

  const [pendingFilterStatus, setPendingFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');

  const [pendingFilterWorkMode, setPendingFilterWorkMode] = useState<'ALL' | 'WFO' | 'WFH'>('ALL');



  const [editPerformance, setEditPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);

  const [editSummary, setEditSummary] = useState('');

  const [editOverallComments, setEditOverallComments] = useState('');

  const [editWorkPerformanceComments, setEditWorkPerformanceComments] = useState('');

  const [editMentorshipQualityRating, setEditMentorshipQualityRating] = useState<number>(0);

  const [editSupervisorProgramSatisfaction, setEditSupervisorProgramSatisfaction] = useState<number>(0);

  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);

  const [saveEvaluationError, setSaveEvaluationError] = useState<string | null>(null);

  

  // Modals

  const [isAssigningIntern, setIsAssigningIntern] = useState(false);

  const [isAssigningTask, setIsAssigningTask] = useState(false);

  const [assignSearch, setAssignSearch] = useState('');



  const [feedbackByIntern, setFeedbackByIntern] = useState<Record<string, FeedbackItem[]>>({});

  const [awayToday, setAwayToday] = useState<Array<{ id: string; internName: string; type?: string }>>([]);

  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);

  const [pendingCertificateCount, setPendingCertificateCount] = useState<number>(0);

  const [pendingUniversityEvaluationCount, setPendingUniversityEvaluationCount] = useState<number>(0);

  const [pendingTimeCorrections, setPendingTimeCorrections] = useState<
    Array<{
      id: string;
      internId: string;
      internName: string;
      date: string;
      reason: string;
      requestedClockIn?: string;
      requestedClockOut?: string;
      attachments: Array<{ fileName: string; storagePath: string }>
    }>
  >([]);

  type TimeCorrectionItem = (typeof pendingTimeCorrections)[number];

  const [decisionCorrection, setDecisionCorrection] = useState<(typeof pendingTimeCorrections)[number] | null>(null);
  const [decisionMode, setDecisionMode] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  const [isTimeCorrectionsOpen, setIsTimeCorrectionsOpen] = useState(false);
  const [timeCorrectionsPage, setTimeCorrectionsPage] = useState(1);



  const [pendingActionPage, setPendingActionPage] = useState(1);



  const [handoffPendingByIntern, setHandoffPendingByIntern] = useState<Record<

    string,

    { count: number; next: PendingAssignmentNext | null }

  >>({});



  const feedbackInternIdsKey = useMemo(() => interns.map((i) => i.id).filter(Boolean).join('|'), [interns]);



  const selectedIntern = interns.find(i => i.id === selectedInternId);

  const activeFeedback = selectedIntern?.feedback.find(f => f.id === activeFeedbackId);



  useEffect(() => {

    if (currentTab !== 'manage-interns') return;

    

    // Track when supervisor enters manage-interns page to clear all badges

    const now = Date.now();

    localStorage.setItem('lastManageInternsPageVisit', String(now));

    

    try {

      const raw = sessionStorage.getItem(SUP_MANAGE_INTERNS_NAV_KEY);

      if (!raw) return;

      const parsed = JSON.parse(raw) as { internId?: string; activeTab?: SupervisorDeepDiveTab };

      sessionStorage.removeItem(SUP_MANAGE_INTERNS_NAV_KEY);

      if (parsed?.internId) setSelectedInternId(parsed.internId);

      if (parsed?.activeTab) setActiveTab(parsed.activeTab === 'overview' ? 'assets' : parsed.activeTab);

    } catch {

      // ignore

    }

  }, [currentTab]);



  useEffect(() => {

    if (activeTab !== 'attendance') return;

    setFilterDate('');

    setFilterStatus('ALL');

    setFilterWorkMode('ALL');

    setPendingFilterDate('');

    setPendingFilterStatus('ALL');

    setPendingFilterWorkMode('ALL');

  }, [activeTab, selectedInternId]);



  const filteredAttendanceLogs = useMemo(() => {

    return selectedInternAttendanceLog.filter((r) => {

      if (filterDate && r.date !== filterDate) return false;

      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;

      if (filterWorkMode !== 'ALL' && r.mode !== filterWorkMode) return false;

      return true;

    });

  }, [filterDate, filterStatus, filterWorkMode, selectedInternAttendanceLog]);



  const avgPerformanceValue = useMemo(() => {

    const scores = interns

      .map((i) => (typeof i.supervisorPerformance?.overallRating === 'number' ? i.supervisorPerformance.overallRating : 0))

      .filter((x) => Number.isFinite(x) && x > 0);

    if (scores.length === 0) return null;

    const avg100 = scores.reduce((a, b) => a + b, 0) / scores.length;

    const avg5 = avg100 / 20;

    return Math.max(0, Math.min(5, Math.round(avg5 * 100) / 100));

  }, [interns]);

  const toLocalDateFromKey = (dateKey: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const [y, m, d] = dateKey.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const TIME_CORRECTIONS_PAGE_SIZE = 5;
  const timeCorrectionsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(pendingTimeCorrections.length / TIME_CORRECTIONS_PAGE_SIZE)),
    [pendingTimeCorrections.length],
  );

  useEffect(() => {
    if (timeCorrectionsPage > timeCorrectionsTotalPages) setTimeCorrectionsPage(timeCorrectionsTotalPages);
  }, [timeCorrectionsPage, timeCorrectionsTotalPages]);

  useEffect(() => {
    setTimeCorrectionsPage(1);
  }, [pendingTimeCorrections.length, isTimeCorrectionsOpen]);

  const pagedTimeCorrections = useMemo(() => {
    const start = (timeCorrectionsPage - 1) * TIME_CORRECTIONS_PAGE_SIZE;
    return pendingTimeCorrections.slice(start, start + TIME_CORRECTIONS_PAGE_SIZE);
  }, [pendingTimeCorrections, timeCorrectionsPage]);

  const parseHHMM = (value: string): { h: number; m: number } | null => {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
    if (h < 0 || h > 23) return null;
    if (mm < 0 || mm > 59) return null;
    return { h, m: mm };
  };

  const buildTimestampForDate = (dateKey: string, hhmm: string): Date | null => {
    const base = toLocalDateFromKey(dateKey);
    const t = parseHHMM(hhmm);
    if (!base || !t) return null;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), t.h, t.m, 0, 0);
  };

  const handleOpenDecision = (req: (typeof pendingTimeCorrections)[number], mode: 'APPROVE' | 'REJECT') => {
    setDecisionCorrection(req);
    setDecisionMode(mode);
    setDecisionNote('');
  };

  const handleConfirmDecision = async () => {
    if (!decisionCorrection || !decisionMode) return;
    if (isSavingDecision) return;

    if (decisionMode === 'APPROVE') {
      if (!decisionCorrection.requestedClockIn || !decisionCorrection.requestedClockOut) return;
      const clockInAt = buildTimestampForDate(decisionCorrection.date, decisionCorrection.requestedClockIn);
      const clockOutAt = buildTimestampForDate(decisionCorrection.date, decisionCorrection.requestedClockOut);
      if (!clockInAt || !clockOutAt) return;
      if (clockOutAt.getTime() <= clockInAt.getTime()) return;
      try {
        setIsSavingDecision(true);
        await updateDoc(doc(firestoreDb, 'timeCorrections', decisionCorrection.id), {
          status: 'APPROVED',
          approvedBy: user.id,
          approvedAt: serverTimestamp(),
          ...(decisionNote.trim() ? { supervisorDecisionNote: decisionNote.trim() } : {}),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(firestoreDb, 'users', decisionCorrection.internId, 'attendance', decisionCorrection.date), {
          clockInAt,
          clockOutAt,
          updatedAt: serverTimestamp(),
        });
        setDecisionCorrection(null);
        setDecisionMode(null);
        setDecisionNote('');
      } catch {
        // ignore
      } finally {
        setIsSavingDecision(false);
      }
      return;
    }

    try {
      setIsSavingDecision(true);
      await updateDoc(doc(firestoreDb, 'timeCorrections', decisionCorrection.id), {
        status: 'REJECTED',
        rejectedBy: user.id,
        rejectedAt: serverTimestamp(),
        ...(decisionNote.trim() ? { supervisorDecisionNote: decisionNote.trim() } : {}),
        updatedAt: serverTimestamp(),
      });
      setDecisionCorrection(null);
      setDecisionMode(null);
      setDecisionNote('');
    } catch {
      // ignore
    } finally {
      setIsSavingDecision(false);
    }
  };



  const pendingByIntern = useMemo(() => {

    const list: Array<{

      internId: string;

      internName: string;

      internAvatar: string;

      count: number;

      next: PendingAssignmentNext | null;

    }> = [];



    for (const intern of interns) {

      const meta = handoffPendingByIntern[intern.id];

      const count = meta?.count ?? 0;

      if (count <= 0) continue;

      list.push({

        internId: intern.id,

        internName: intern.name,

        internAvatar: intern.avatar,

        count,

        next: meta?.next ?? null,

      });

    }



    list.sort((a, b) => b.count - a.count);

    return list;

  }, [handoffPendingByIntern, interns]);



  const totalPendingCount = useMemo(() => {

    return pendingByIntern.reduce((acc, x) => acc + x.count, 0);

  }, [pendingByIntern]);



  const PENDING_ACTION_VISIBLE_COUNT = 4;



  const pendingActionPageCount = useMemo(() => {

    const count = Math.ceil(pendingByIntern.length / PENDING_ACTION_VISIBLE_COUNT);

    return count > 0 ? count : 1;

  }, [pendingByIntern.length]);

  useEffect(() => {
    const assignedIds = interns.map((x) => x.id).filter(Boolean);
    if (assignedIds.length === 0) {
      setPendingTimeCorrections([]);
      return () => void 0;
    }

    const chunkArray = <T,>(items: T[], size: number): T[][] => {
      if (size <= 0) return [items];
      const out: T[][] = [];
      for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
      return out;
    };

    const ref = collection(firestoreDb, 'timeCorrections');
    const idChunks = chunkArray(assignedIds, 10);
    const byChunkKey = new Map<string, TimeCorrectionItem[]>();

    const unsubs = idChunks.map((chunk) => {
      const chunkKey = chunk.join('|');
      const q = query(ref, where('status', '==', 'PENDING'), where('internId', 'in', chunk));
      return onSnapshot(
        q,
        (snap) => {
          const items: TimeCorrectionItem[] = [];
          snap.forEach((d) => {
            const raw = d.data() as any;
            const internId = typeof raw?.internId === 'string' ? raw.internId : '';
            const internName = typeof raw?.internName === 'string' ? raw.internName : 'Unknown';
            const date = typeof raw?.date === 'string' ? raw.date : '';
            const reason = typeof raw?.reason === 'string' ? raw.reason : '';
            const requestedClockIn = typeof raw?.requestedClockIn === 'string' ? raw.requestedClockIn : undefined;
            const requestedClockOut = typeof raw?.requestedClockOut === 'string' ? raw.requestedClockOut : undefined;
            const attachments = Array.isArray(raw?.attachments)
              ? (raw.attachments as any[]).flatMap((a) => {
                  const fileName = typeof a?.fileName === 'string' ? a.fileName : '';
                  const storagePath = typeof a?.storagePath === 'string' ? a.storagePath : '';
                  if (!fileName || !storagePath) return [];
                  return [{ fileName, storagePath }];
                })
              : [];
            if (!internId || !date) return;
            items.push({ id: d.id, internId, internName, date, reason, requestedClockIn, requestedClockOut, attachments });
          });
          byChunkKey.set(chunkKey, items);
          const merged = Array.from(byChunkKey.values()).flat();
          merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          setPendingTimeCorrections(merged);
        },
        () => {
          byChunkKey.set(chunkKey, []);
          const merged = Array.from(byChunkKey.values()).flat();
          merged.sort((a, b) => String(b.date).localeCompare(String(a.date)));
          setPendingTimeCorrections(merged);
        },
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [interns]);



  useEffect(() => {

    setPendingActionPage((prev) => {

      if (prev < 1) return 1;

      if (prev > pendingActionPageCount) return pendingActionPageCount;

      return prev;

    });

  }, [pendingActionPageCount]);



  useEffect(() => {

    setPendingActionPage(1);

  }, [pendingByIntern.length]);



  const displayedPendingByIntern = useMemo(() => {

    const start = (pendingActionPage - 1) * PENDING_ACTION_VISIBLE_COUNT;

    return pendingByIntern.slice(start, start + PENDING_ACTION_VISIBLE_COUNT);

  }, [pendingActionPage, pendingByIntern]);



  const handleOpenPendingAssetsForIntern = async (internId: string, next: PendingAssignmentNext | null) => {

    if (next) {

      try {

        if (next.kind === 'handoff') {

          await updateDoc(doc(firestoreDb, 'users', internId, next.colName, next.projectId), {

            'handoffLatest.status': 'REVIEWED',

            'handoffLatest.reviewedAt': serverTimestamp(),

            updatedAt: serverTimestamp(),

          });

        } else {

          const ref = doc(firestoreDb, 'users', internId, next.colName, next.projectId);

          const snap = await getDoc(ref);

          const data = snap.exists() ? (snap.data() as any) : null;

          const tasks = Array.isArray(data?.tasks) ? (data.tasks as SubTask[]) : [];

          const nextTasks = tasks.map((t) =>

            String((t as any)?.id ?? '') === next.taskId ? ({ ...t, reviewStatus: 'REVIEWED' } as SubTask) : t,

          );

          await updateDoc(ref, { tasks: nextTasks, updatedAt: serverTimestamp() });

        }

      } catch {

        // If we can't mark reviewed, still allow navigation.

      }

    }



    try {

      sessionStorage.setItem(

        SUP_MANAGE_INTERNS_NAV_KEY,

        JSON.stringify({ internId, activeTab: 'assignments' as SupervisorDeepDiveTab }),

      );

    } catch {

      // ignore

    }



    onNavigate('manage-interns');

  };



  const formatTime = (value: unknown): string | null => {

    if (!value) return null;

    const maybe = value as { toDate?: () => Date };

    if (typeof maybe?.toDate !== 'function') return null;

    const d = maybe.toDate();

    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  };



  const computeStatus = (clockInAt: unknown): 'PRESENT' | 'LATE' => {

    const maybe = clockInAt as { toDate?: () => Date };

    if (typeof maybe?.toDate !== 'function') return 'PRESENT';

    const d = maybe.toDate();

    const minutes = d.getHours() * 60 + d.getMinutes();

    const lateAfterMinutes = 9 * 60;

    return minutes > lateAfterMinutes ? 'LATE' : 'PRESENT';

  };



  const computeDuration = (clockInAt: unknown, clockOutAt: unknown): string | null => {

    const a = clockInAt as { toDate?: () => Date };

    const b = clockOutAt as { toDate?: () => Date };

    if (typeof a?.toDate !== 'function' || typeof b?.toDate !== 'function') return null;

    const start = a.toDate().getTime();

    const end = b.toDate().getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;

    const totalMinutes = Math.floor((end - start) / (1000 * 60));

    const h = Math.floor(totalMinutes / 60);

    const m = totalMinutes % 60;

    return `${h}h ${String(m).padStart(2, '0')}m`;

  };



  const feedbackHasData = (f: FeedbackItem) => {

    return Boolean(

      f.internReflection?.trim() ||

        f.internProgramFeedback?.trim() ||

        f.videoStoragePath ||

        (Array.isArray(f.attachments) && f.attachments.length > 0) ||

        typeof f.supervisorScore === 'number' ||

        (f.supervisorComments ?? '').trim() ||

        f.programRating > 0 ||

        (f.status && f.status !== 'pending'),

    );

  };



  const attachmentLabel = (a: TaskAttachment) => (typeof a === 'string' ? a : a.fileName);



  const [handoffAssets, setHandoffAssets] = useState<HandoffAssetItem[]>([]);

  const [handoffLoadError, setHandoffLoadError] = useState<string | null>(null);

  const [handoffIsLoading, setHandoffIsLoading] = useState(false);

  const [handoffHasLoaded, setHandoffHasLoaded] = useState(false);



  const [handoffProjectOpen, setHandoffProjectOpen] = useState<HandoffProjectGroup | null>(null);



  const handleOpenStoragePath = async (path: string) => {

    const url = await getDownloadURL(storageRef(firebaseStorage, path));

    window.open(url, '_blank');

  };



  const handleOpenUrl = (url: string) => {

    window.open(url, '_blank');

  };



  const handoffProjects = useMemo(() => {

    const map = new Map<string, HandoffProjectGroup>();



    for (const a of handoffAssets) {

      const key = a.projectTitle;

      const existing = map.get(key);

      if (!existing) {

        map.set(key, { projectTitle: a.projectTitle, date: a.date, status: a.status, items: [a] });

      } else {

        existing.items.push(a);

        if (!existing.date && a.date) existing.date = a.date;

        if (!existing.status && a.status) existing.status = a.status;

      }

    }



    const list = Array.from(map.values());

    list.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

    return list;

  }, [handoffAssets]);



  useEffect(() => {

    if (!selectedInternId) {

      setSelectedInternAttendanceLog([]);

      return;

    }

    if (activeTab !== 'attendance') return;



    const attendanceRef = collection(firestoreDb, 'users', selectedInternId, 'attendance');

    const q = query(attendanceRef, orderBy('date', 'desc'), limit(120));



    return onSnapshot(

      q,

      (snap) => {

        const logs = snap.docs

          .map((d) => {

            const raw = d.data() as any;

            const date = typeof raw?.date === 'string' ? raw.date : d.id;

            const mode: 'WFO' | 'WFH' = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';

            const clockInAt = raw?.clockInAt;

            const clockOutAt = raw?.clockOutAt;

            const clockIn = formatTime(clockInAt);

            if (!clockIn) return null;

            const clockOut = formatTime(clockOutAt) ?? '--';

            const status = computeStatus(clockInAt);

            const duration = clockOutAt ? computeDuration(clockInAt, clockOutAt) : null;

            return {

              id: d.id,

              date,

              clockIn,

              clockOut,

              mode,

              status,

              duration: duration ?? '--',

            };

          })

          .filter((x): x is NonNullable<typeof x> => Boolean(x));



        setSelectedInternAttendanceLog(logs);

      },

      () => {

        setSelectedInternAttendanceLog([]);

      },

    );

  }, [activeTab, selectedInternId]);



  useEffect(() => {

    if (!selectedInternId) {

      setHandoffAssets([]);

      setHandoffLoadError(null);

      setHandoffIsLoading(false);

      setHandoffHasLoaded(false);

      return;

    }

    if (activeTab !== 'assets') return;



    const assignedRef = collection(firestoreDb, 'users', selectedInternId, 'assignmentProjects');

    const personalRef = collection(firestoreDb, 'users', selectedInternId, 'personalProjects');



    let cancelled = false;

    let gotAssigned = false;

    let gotPersonal = false;

    let assignedItems: HandoffAssetItem[] = [];

    let personalItems: HandoffAssetItem[] = [];



    const pushMerged = () => {

      if (cancelled) return;

      if (!gotAssigned || !gotPersonal) return;

      setHandoffAssets([...assignedItems, ...personalItems]);

      setHandoffIsLoading(false);

      setHandoffHasLoaded(true);

    };



    const onErr = (err: unknown) => {

      const e = err as { code?: string; message?: string };

      setHandoffLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load handoff assets.'}`);

      setHandoffIsLoading(false);

      setHandoffHasLoaded(true);

    };



    setHandoffIsLoading(true);

    setHandoffLoadError(null);

    setHandoffHasLoaded(false);



    const mapSnap = (snap: any, kind: ProjectKind): HandoffAssetItem[] => {

      const items: HandoffAssetItem[] = [];

      for (const d of snap.docs) {

        const data = d.data() as {

          title?: string;

          handoffLatest?: {

            version?: number;

            status?: string;

            submittedAt?: any;

            files?: Array<{ fileName: string; storagePath: string }>;

            videos?: Array<{ type: 'upload'; title?: string; fileName: string; storagePath: string }>;

            links?: string[];

          };

        };



        const hl = data.handoffLatest;

        if (!hl) continue;



        const title = data.title ?? '-';

        const version = typeof hl.version === 'number' ? hl.version : undefined;

        const status = typeof hl.status === 'string' ? hl.status : undefined;

        const date = hl?.submittedAt?.toDate ? String(hl.submittedAt.toDate().toISOString().split('T')[0]) : undefined;

        const projectTitle = `${title}${version ? ` (v${version})` : ''}`;



        if (Array.isArray(hl.files)) {

          for (const f of hl.files) {

            if (!f?.storagePath) continue;

            items.push({

              key: `handoffLatest:${kind}:${d.id}:${f.storagePath}`,

              label: f.fileName ?? 'Document',

              date,

              projectTitle,

              status,

              open: { type: 'storage', storagePath: f.storagePath },

            });

          }

        }



        if (Array.isArray(hl.videos)) {

          for (const v of hl.videos) {

            if (!v?.storagePath) continue;

            items.push({

              key: `handoffLatest:${kind}:${d.id}:${v.storagePath}`,

              label: v.fileName ?? v.title ?? 'Video',

              date,

              projectTitle,

              status,

              open: { type: 'storage', storagePath: v.storagePath },

            });

          }

        }



        if (Array.isArray(hl.links)) {

          for (const url of hl.links) {

            if (!url) continue;

            items.push({

              key: `handoffLatest:${kind}:${d.id}:link:${url}`,

              label: 'Link',

              date,

              projectTitle,

              status,

              open: { type: 'url', url },

            });

          }

        }

      }

      return items;

    };



    const unsubAssigned = onSnapshot(

      assignedRef,

      (snap) => {

        gotAssigned = true;

        assignedItems = mapSnap(snap, 'assigned');

        pushMerged();

      },

      onErr,

    );



    const unsubPersonal = onSnapshot(

      personalRef,

      (snap) => {

        gotPersonal = true;

        personalItems = mapSnap(snap, 'personal');

        pushMerged();

      },

      onErr,

    );



    return () => {

      cancelled = true;

      unsubAssigned();

      unsubPersonal();

    };

  }, [activeTab, selectedInternId]);



  const mapUserToInternDetail = useMemo(() => {

    return (id: string, data: any): InternDetail => {

      const rawSupPerf = (data?.supervisorPerformance ?? null) as Partial<PerformanceMetrics> | null;

      const normalizedSupPerf: PerformanceMetrics = {

        technical: typeof rawSupPerf?.technical === 'number' ? rawSupPerf.technical : DEFAULT_PERFORMANCE.technical,

        communication: typeof rawSupPerf?.communication === 'number' ? rawSupPerf.communication : DEFAULT_PERFORMANCE.communication,

        punctuality: typeof rawSupPerf?.punctuality === 'number' ? rawSupPerf.punctuality : DEFAULT_PERFORMANCE.punctuality,

        initiative: typeof rawSupPerf?.initiative === 'number' ? rawSupPerf.initiative : DEFAULT_PERFORMANCE.initiative,

        overallRating: typeof rawSupPerf?.overallRating === 'number' ? rawSupPerf.overallRating : DEFAULT_PERFORMANCE.overallRating,

      };



      // Map lifecycleStatus to display status - same logic as Admin version

      let status: 'Active' | 'Inactive' = 'Active';

      console.log('🔍 Supervisor Debug - Intern Data:', id, data.lifecycleStatus);

      

      if (data.lifecycleStatus === 'WITHDRAWN' || 

          data.lifecycleStatus === 'COMPLETED') {

        status = 'Inactive'; // Use Inactive for withdrawn/completed interns

      } else if (data.lifecycleStatus === 'WITHDRAWAL_REQUESTED' || 

                 data.lifecycleStatus === 'OFFBOARDING_REQUESTED') {

        status = 'Active'; // Still active until processed

      } else {

        status = 'Active';

      }



      return {

        id,

        name: data?.name || 'Unknown',

        avatar: data?.avatar || `https://picsum.photos/seed/${encodeURIComponent(id)}/100/100`,

        position: data?.position || 'Intern',

        internPeriod: data?.internPeriod || 'TBD',

        supervisorId: typeof data?.supervisorId === 'string' ? data.supervisorId : undefined,

        supervisorName: typeof data?.supervisorName === 'string' ? data.supervisorName : undefined,

        progress: 0,

        status,

        attendance: '—',

        department: data?.department || 'Unknown',

        email: data?.email || '-',

        tasks: [],

        feedback: [],

        performance: DEFAULT_PERFORMANCE,

        supervisorPerformance: normalizedSupPerf,

        supervisorSummary: typeof data?.supervisorSummary === 'string' ? data.supervisorSummary : '',

        attendanceLog: [],

      };

    };

  }, []);



  useEffect(() => {

    if (!selectedIntern) return;

    const active = selectedIntern.feedback?.find((f) => f.id === activeFeedbackId) ?? null;

    const rawSupPerf = (active as any)?.supervisorPerformance ?? null;

    const normalized: PerformanceMetrics = rawSupPerf

      ? {

          technical: typeof rawSupPerf?.technical === 'number' ? rawSupPerf.technical : DEFAULT_PERFORMANCE.technical,

          communication: typeof rawSupPerf?.communication === 'number' ? rawSupPerf.communication : DEFAULT_PERFORMANCE.communication,

          punctuality: typeof rawSupPerf?.punctuality === 'number' ? rawSupPerf.punctuality : DEFAULT_PERFORMANCE.punctuality,

          initiative: typeof rawSupPerf?.initiative === 'number' ? rawSupPerf.initiative : DEFAULT_PERFORMANCE.initiative,

          overallRating: typeof rawSupPerf?.overallRating === 'number' ? rawSupPerf.overallRating : DEFAULT_PERFORMANCE.overallRating,

        }

      : DEFAULT_PERFORMANCE;

    setEditPerformance(normalized);

    const overall =

      typeof (active as any)?.supervisorOverallComments === 'string'

        ? (active as any).supervisorOverallComments

        : typeof (active as any)?.supervisorSummary === 'string'

          ? (active as any).supervisorSummary

          : '';

    const workPerf = typeof (active as any)?.supervisorWorkPerformanceComments === 'string' ? (active as any).supervisorWorkPerformanceComments : '';



    const mentorshipRatingRaw = (active as any)?.supervisorMentorshipQualityRating;

    const mentorshipRating = typeof mentorshipRatingRaw === 'number' ? mentorshipRatingRaw : 0;



    const supProgRaw = (active as any)?.supervisorProgramSatisfactionRating;

    const supProg = typeof supProgRaw === 'number' ? supProgRaw : 0;



    setEditOverallComments(overall);

    setEditWorkPerformanceComments(workPerf);

    setEditMentorshipQualityRating(mentorshipRating);

    setEditSupervisorProgramSatisfaction(supProg);



    // Legacy field still used in some UI; keep it in sync with Overall comments.

    setEditSummary(overall);

    setSaveEvaluationError(null);

  }, [activeFeedbackId, selectedInternId, selectedIntern]);



  const clampScore = (v: number) => {

    if (Number.isNaN(v)) return 0;

    return Math.max(0, Math.min(100, Math.round(v)));

  };



  const computeOverall = (p: Pick<PerformanceMetrics, 'technical' | 'communication' | 'punctuality' | 'initiative'>) => {

    const avg = (p.technical + p.communication + p.punctuality + p.initiative) / 4;

    return clampScore(avg);

  };



  const handleSaveEvaluation = async () => {

    if (!selectedInternId) return;

    if (!activeFeedbackId) return;

    setIsSavingEvaluation(true);

    setSaveEvaluationError(null);

    try {

      const nextPerf: PerformanceMetrics = {

        ...editPerformance,

        overallRating: computeOverall(editPerformance),

      };



      // Store evaluation per milestone (week/month) and mark as reviewed

      await updateDoc(doc(firestoreDb, 'users', selectedInternId, 'feedbackMilestones', activeFeedbackId), {

        status: 'reviewed',

        supervisorPerformance: nextPerf,

        supervisorOverallComments: editOverallComments,

        supervisorWorkPerformanceComments: editWorkPerformanceComments,

        supervisorMentorshipQualityRating: Math.max(0, Math.min(5, Number(editMentorshipQualityRating) || 0)),

        supervisorProgramSatisfactionRating: Math.max(0, Math.min(5, Number(editSupervisorProgramSatisfaction) || 0)),

        // Backward compat

        supervisorSummary: editOverallComments,

        supervisorReviewedAt: serverTimestamp(),

        // Keep backwards-compat fields for existing intern UI

        supervisorScore: nextPerf.overallRating,

        supervisorComments: editOverallComments,

      });

    } catch (err: unknown) {

      const e = err as { code?: string; message?: string };

      setSaveEvaluationError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to save evaluation'}`);

    } finally {

      setIsSavingEvaluation(false);

    }

  };



  const displayPerformance = useMemo(() => {

    if (!selectedIntern) return DEFAULT_PERFORMANCE;

    if (activeTab !== 'overview') return selectedIntern.supervisorPerformance;



    const next: PerformanceMetrics = {

      technical: clampScore(editPerformance.technical),

      communication: clampScore(editPerformance.communication),

      punctuality: clampScore(editPerformance.punctuality),

      initiative: clampScore(editPerformance.initiative),

      overallRating: computeOverall(editPerformance),

    };



    return next;

  }, [activeTab, editPerformance, selectedIntern]);



  const displaySummary = useMemo(() => {

    if (!selectedIntern) return '';

    if (activeTab !== 'overview') return selectedIntern.supervisorSummary;

    return editSummary;

  }, [activeTab, editSummary, selectedIntern]);



  useEffect(() => {

    const assignedQ = query(collection(firestoreDb, 'users'), where('supervisorId', '==', user.id));

    const unsubAssigned = onSnapshot(assignedQ, (snap) => {

      setInterns(snap.docs.map((d) => mapUserToInternDetail(d.id, d.data())));

      setAllInterns(snap.docs.map((d) => mapUserToInternDetail(d.id, d.data())));

    });

    return () => {

      unsubAssigned();

    };

  }, [mapUserToInternDetail, user.id]);



  useEffect(() => {

    const internIds = interns.map((i) => i.id).filter(Boolean);

    if (internIds.length === 0) return;



    const unsubs: Array<() => void> = [];



    for (const internId of internIds) {

      const assignedRef = collection(firestoreDb, 'users', internId, 'assignmentProjects');

      const personalRef = collection(firestoreDb, 'users', internId, 'personalProjects');



      let assignedCount = 0;

      let personalCount = 0;

      let assignedNext: PendingAssignmentNext | null = null;

      let personalNext: PendingAssignmentNext | null = null;



      const recomputePending = () => {

        const count = assignedCount + personalCount;

        const next = assignedNext ?? personalNext;

        setHandoffPendingByIntern((prev) => ({

          ...prev,

          [internId]: { count, next },

        }));

      };



      const mapPending = (

        snap: any,

        colName: 'assignmentProjects' | 'personalProjects',

      ): { count: number; next: PendingAssignmentNext | null } => {

        const items: Array<{ kind: 'handoff' | 'task'; projectId: string; taskId?: string; ts: string }> = [];



        for (const d of snap.docs) {

          const data = d.data() as any;



          const handoffStatus = String(data?.handoffLatest?.status ?? '');

          if (handoffStatus === 'SUBMITTED') {

            const iso = data?.handoffLatest?.submittedAt?.toDate

              ? String(data.handoffLatest.submittedAt.toDate().toISOString())

              : '';

            items.push({ kind: 'handoff', projectId: d.id, ts: iso });

          }



          const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

          for (const t of tasks) {

            if (String(t?.reviewStatus ?? '') !== 'SUBMITTED') continue;

            const iso = typeof t?.actualEnd === 'string' ? t.actualEnd : '';

            items.push({ kind: 'task', projectId: d.id, taskId: String(t?.id ?? ''), ts: iso });

          }

        }



        const count = items.length;

        items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

        const first = items[0];

        if (!first) return { count: 0, next: null };



        if (first.kind === 'handoff') {

          return { count, next: { kind: 'handoff', colName, projectId: first.projectId } };

        }



        return {

          count,

          next: {

            kind: 'task',

            colName,

            projectId: first.projectId,

            taskId: first.taskId || '',

          },

        };

      };



      const unsubAssigned = onSnapshot(

        assignedRef,

        (snap) => {

          const res = mapPending(snap, 'assignmentProjects');

          assignedCount = res.count;

          assignedNext = res.next;

          recomputePending();

        },

        () => {

          assignedCount = 0;

          assignedNext = null;

          recomputePending();

        },

      );



      const unsubPersonal = onSnapshot(

        personalRef,

        (snap) => {

          const res = mapPending(snap, 'personalProjects');

          personalCount = res.count;

          personalNext = res.next;

          recomputePending();

        },

        () => {

          personalCount = 0;

          personalNext = null;

          recomputePending();

        },

      );



      unsubs.push(unsubAssigned, unsubPersonal);

    }



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [interns]);



  useEffect(() => {

    const leaveRef = collection(firestoreDb, 'leaveRequests');

    const q = query(leaveRef, where('supervisorId', '==', user.id), where('status', '==', 'PENDING'));

    return onSnapshot(

      q,

      (snap) => {

        setPendingLeaveCount(snap.size);

      },

      () => {

        setPendingLeaveCount(0);

      },

    );

  }, [user.id]);



  useEffect(() => {

    const ref = collection(firestoreDb, 'certificateRequests');

    const q = query(ref, where('supervisorId', '==', user.id), where('status', '==', 'REQUESTED'));

    return onSnapshot(

      q,

      (snap) => {

        setPendingCertificateCount(snap.size);

      },

      () => {

        setPendingCertificateCount(0);

      },

    );

  }, [user.id]);



  useEffect(() => {

    const ref = collection(firestoreDb, 'universityEvaluations');

    const q = query(ref, where('supervisorId', '==', user.id), where('submissionStatus', '==', 'SUBMITTED'));

    return onSnapshot(

      q,

      (snap) => {

        setPendingUniversityEvaluationCount(snap.size);

      },

      () => {

        setPendingUniversityEvaluationCount(0);

      },

    );

  }, [user.id]);



  useEffect(() => {

    const leaveRef = collection(firestoreDb, 'leaveRequests');

    const q = query(leaveRef, where('supervisorId', '==', user.id));

    return onSnapshot(

      q,

      (snap) => {

        const todayIso = new Date().toISOString().split('T')[0];

        const list = snap.docs

          .map((d) => {

            const raw = d.data() as any;

            return {

              id: d.id,

              internName: String(raw?.internName ?? ''),

              startDate: String(raw?.startDate ?? ''),

              endDate: String(raw?.endDate ?? ''),

              status: String(raw?.status ?? ''),

              type: String(raw?.type ?? ''),

            };

          })

          .filter((x) => x.internName && x.startDate && x.endDate)

          .filter((x) => x.status === 'APPROVED')

          .filter((x) => x.startDate <= todayIso && todayIso <= x.endDate)

          .slice(0, 5)

          .map((x) => ({ id: x.id, internName: x.internName, type: x.type }));

        setAwayToday(list);

      },

      () => {

        setAwayToday([]);

      },

    );

  }, [user.id]);



  useEffect(() => {

    const unsubs: Array<() => void> = [];



    const internIds = feedbackInternIdsKey ? feedbackInternIdsKey.split('|').filter(Boolean) : [];



    for (const internId of internIds) {

      const colRef = collection(firestoreDb, 'users', internId, 'feedbackMilestones');

      const unsub = onSnapshot(colRef, (snap) => {

        const savedById = new Map<string, FeedbackMilestoneDoc>();

        snap.docs.forEach((d) => {

          savedById.set(d.id, d.data() as FeedbackMilestoneDoc);

        });



        let maxMonth = 1;

        for (const id of savedById.keys()) {

          const m = /^month-(\d+)$/.exec(id);

          if (!m) continue;

          const n = Number(m[1]);

          if (Number.isFinite(n) && n > maxMonth) maxMonth = n;

        }

        const monthCount = Math.max(1, maxMonth + 1);



        const base: FeedbackItem[] = [];

        for (let i = 1; i <= 4; i += 1) {

          const id = `week-${i}`;

          base.push({ id, label: `Week ${i}`, period: `Week ${i}`, status: 'pending', programRating: 0 });

        }

        for (let i = 1; i <= monthCount; i += 1) {

          const id = `month-${i}`;

          base.push({ id, label: `Month ${i}`, period: `Month ${i}`, status: 'pending', programRating: 0 });

        }



        const items: FeedbackItem[] = base.map((b) => {

          const data = savedById.get(b.id) ?? null;

          if (!data) return b;



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



          const rawSup = (data as any)?.supervisorPerformance ?? null;

          const normalizedSupPerformance: PerformanceMetrics | undefined = rawSup

            ? {

                technical: typeof rawSup?.technical === 'number' ? rawSup.technical : DEFAULT_PERFORMANCE.technical,

                communication: typeof rawSup?.communication === 'number' ? rawSup.communication : DEFAULT_PERFORMANCE.communication,

                punctuality: typeof rawSup?.punctuality === 'number' ? rawSup.punctuality : DEFAULT_PERFORMANCE.punctuality,

                initiative: typeof rawSup?.initiative === 'number' ? rawSup.initiative : DEFAULT_PERFORMANCE.initiative,

                overallRating: typeof rawSup?.overallRating === 'number' ? rawSup.overallRating : DEFAULT_PERFORMANCE.overallRating,

              }

            : undefined;



          const supervisorReviewedAt = (data as any)?.supervisorReviewedAt;

          const supervisorReviewedDate =

            typeof supervisorReviewedAt?.toDate === 'function'

              ? String(supervisorReviewedAt.toDate().toISOString().split('T')[0])

              : undefined;



          return {

            ...b,

            status: typeof data.status === 'string' ? data.status : b.status,

            internReflection: typeof data.internReflection === 'string' ? data.internReflection : b.internReflection,

            internProgramFeedback: typeof data.internProgramFeedback === 'string' ? data.internProgramFeedback : b.internProgramFeedback,

            videoStoragePath: typeof data.videoStoragePath === 'string' ? data.videoStoragePath : b.videoStoragePath,

            videoFileName: typeof data.videoFileName === 'string' ? data.videoFileName : b.videoFileName,

            attachments: Array.isArray(data.attachments) ? data.attachments : [],

            supervisorScore: typeof data.supervisorScore === 'number' ? data.supervisorScore : b.supervisorScore,

            supervisorComments: typeof data.supervisorComments === 'string' ? data.supervisorComments : b.supervisorComments,

            supervisorPerformance: normalizedSupPerformance,

            supervisorOverallComments:

              typeof (data as any)?.supervisorOverallComments === 'string'

                ? (data as any).supervisorOverallComments

                : typeof (data as any)?.supervisorSummary === 'string'

                  ? (data as any).supervisorSummary

                  : (b as any).supervisorOverallComments,

            supervisorWorkPerformanceComments:

              typeof (data as any)?.supervisorWorkPerformanceComments === 'string'

                ? (data as any).supervisorWorkPerformanceComments

                : (b as any).supervisorWorkPerformanceComments,

            supervisorMentorshipQualityRating:

              typeof (data as any)?.supervisorMentorshipQualityRating === 'number'

                ? (data as any).supervisorMentorshipQualityRating

                : (b as any).supervisorMentorshipQualityRating,

            supervisorProgramSatisfactionRating:

              typeof (data as any)?.supervisorProgramSatisfactionRating === 'number'

                ? (data as any).supervisorProgramSatisfactionRating

                : (b as any).supervisorProgramSatisfactionRating,

            supervisorSummary: typeof (data as any)?.supervisorSummary === 'string' ? (data as any).supervisorSummary : b.supervisorSummary,

            supervisorReviewedDate,

            programRating: typeof data.programRating === 'number' ? data.programRating : b.programRating,

            selfPerformance: normalizedSelfPerformance,

            selfSummary: typeof (data as any).selfSummary === 'string' ? (data as any).selfSummary : b.selfSummary,

            submissionDate: typeof data.submissionDate === 'string' ? data.submissionDate : b.submissionDate,

          };

        });



        setFeedbackByIntern((prev) => ({ ...prev, [internId]: items }));

        setInterns((prev) => prev.map((x) => (x.id === internId ? { ...x, feedback: items } : x)));

      });

      unsubs.push(unsub);

    }



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [feedbackInternIdsKey]);



  useEffect(() => {

    if (!selectedInternId) return;

    if (activeTab !== 'feedback') return;

    if (!selectedIntern?.feedback || selectedIntern.feedback.length === 0) return;



    const exists = selectedIntern.feedback.some((f) => f.id === activeFeedbackId);

    if (exists && activeFeedbackId !== 'week-1') return;



    const list = selectedIntern.feedback;



    const submittedCandidates = list

      .filter((f) => String((f as any)?.status ?? '') === 'submitted')

      .map((f) => ({ f, ts: typeof (f as any)?.submissionDate === 'string' ? String((f as any).submissionDate) : '' }))

      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)) || String(b.f.id).localeCompare(String(a.f.id)));



    const preferred = submittedCandidates[0]?.f ?? list.find(feedbackHasData) ?? list[0];

    if (preferred && preferred.id !== activeFeedbackId) setActiveFeedbackId(preferred.id);

  }, [activeTab, activeFeedbackId, selectedInternId, selectedIntern?.feedback]);



  useEffect(() => {

    if (currentTab !== 'dashboard') return;

    setSelectedInternId(null);

    setActiveTab('overview');

  }, [currentTab]);



  const filteredInterns = useMemo(() => {

    if (!user) return [];

    

    // For supervisor, only show interns assigned to this supervisor

    return interns.filter(i => 

      i.supervisorId === user.id || 

      i.supervisorName === user.name ||

      (user.assignedInterns && user.assignedInterns.includes(i.id))

    ).filter(i => 

      i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 

      i.position.toLowerCase().includes(searchQuery.toLowerCase())

    );

  }, [interns, searchQuery, user]);



  const manageInternListItems = useMemo(() => {

    return filteredInterns.map((intern) => {

      const list = Array.isArray(intern.feedback) ? intern.feedback : [];



      const candidates = list

        .filter((x) => (typeof x?.selfPerformance?.overallRating === 'number' && x.selfPerformance.overallRating > 0) || x?.selfSummary)

        .map((x) => {

          const ts = typeof x.submissionDate === 'string' ? x.submissionDate : '';

          return { x, ts };

        });



      candidates.sort((a, b) => String(b.ts).localeCompare(String(a.ts)) || String(b.x.id).localeCompare(String(a.x.id)));

      const latest = candidates[0]?.x ?? null;



      // Calculate notification count for this intern

      let notificationCount = 0;

      

      // Check when manage-interns page was last visited

      const lastPageVisit = localStorage.getItem('lastManageInternsPageVisit');

      const lastPageVisitTimestamp = lastPageVisit ? parseInt(lastPageVisit, 10) : 0;

      

      // Count unreviewed feedback submitted after last page visit

      const unreviewedFeedback = intern.feedback?.filter(f => {

        const status = (f as any)?.status;

        const hasReview = (f as any)?.supervisorReviewedAt;

        const submissionDate = (f as any)?.submissionDate;

        if (status !== 'submitted' || hasReview) return false;

        if (!submissionDate) return true; // If no date, show notification

        const timestamp = new Date(submissionDate).getTime();

        return timestamp > lastPageVisitTimestamp;

      }).length || 0;

      notificationCount += unreviewedFeedback;

      

      // Count in-progress or delayed tasks updated after last page visit

      const pendingTasks = intern.tasks?.filter(t => {

        if (t.status !== 'IN_PROGRESS' && t.status !== 'DELAYED') return false;

        const updatedAt = (t as any)?.updatedAt;

        if (!updatedAt) return true; // If no date, show notification

        const timestamp = new Date(updatedAt).getTime();

        return timestamp > lastPageVisitTimestamp;

      }).length || 0;

      notificationCount += pendingTasks;



      return {

        id: intern.id,

        name: intern.name,

        avatar: intern.avatar,

        position: intern.position,

        progress: intern.progress,

        attendance: intern.attendance,

        status: intern.status,

        performance: { overallRating: intern.supervisorPerformance?.overallRating ?? 0 },

        selfEvaluation:

          latest && typeof latest.selfPerformance?.overallRating === 'number'

            ? {

                overallRating: latest.selfPerformance.overallRating,

                period: latest.label,

                summary: latest.selfSummary,

                submissionDate: latest.submissionDate,

              }

            : undefined,

        hasNotifications: notificationCount > 0,

        notificationCount: notificationCount,

      };

    });

  }, [filteredInterns]);



  const handleUpdateTaskStatus = (taskId: string, status: 'DONE' | 'REVISION') => {

    if (!selectedInternId) return;

    setInterns(prev => prev.map(intern => {

      if (intern.id !== selectedInternId) return intern;

      return {

        ...intern,

        tasks: intern.tasks.map(t => t.id === taskId ? { ...t, status } : t)

      };

    }));

  };



  const assignableInterns = useMemo(() => {

    const q = assignSearch.trim().toLowerCase();

    const base = allInterns;

    if (!q) return base;

    return base.filter((i) => i.name.toLowerCase().includes(q) || i.position.toLowerCase().includes(q));

  }, [interns, assignSearch]);



  const handleAssignIntern = async (internId: string) => {

    // In supervisor mode, do not allow re-assigning interns.

    return;

    const internRef = doc(firestoreDb, 'users', internId);

    const supervisorRef = doc(firestoreDb, 'users', user.id);

    await updateDoc(internRef, {

      supervisorId: user.id,

      supervisorName: user.name,

    });

    await updateDoc(supervisorRef, {

      assignedInterns: arrayUnion(internId),

    });



    setIsAssigningIntern(false);

    setAssignSearch('');

    setSelectedInternId(internId);

    setActiveTab(currentTab === 'manage-interns' ? 'assets' : 'overview');

  };



  const renderDeepDive = () => {

    if (!selectedIntern) return null;



    // Calculate notification counts for each tab

    const getLastVisit = (tabName: string) => {

      const key = `lastInternTab_${selectedInternId}_${tabName}`;

      const stored = localStorage.getItem(key);

      return stored ? parseInt(stored, 10) : 0;

    };



    // Assets: count projects with submitted tasks (work assets)

    const lastAssetsVisit = getLastVisit('assets');

    console.log('🔍 Assets Debug:', {

      internId: selectedInternId,

      lastAssetsVisit,

      totalTasks: selectedIntern.tasks?.length,

      tasks: selectedIntern.tasks?.map(t => ({

        id: t.id,

        reviewStatus: t.reviewStatus,

        actualEnd: t.actualEnd,

        status: t.status

      }))

    });

    const assetsNotificationCount = selectedIntern.tasks?.filter(t => {

      if (t.reviewStatus !== 'SUBMITTED') return false;

      const actualEnd = t.actualEnd;

      if (!actualEnd) return false;

      const timestamp = new Date(actualEnd).getTime();

      return timestamp > lastAssetsVisit;

    }).length || 0;

    console.log('✅ Assets notification count:', assetsNotificationCount);



    // Assignments: count in-progress or delayed tasks

    const assignmentsNotificationCount = selectedIntern.tasks?.filter(t => 

      t.status === 'IN_PROGRESS' || t.status === 'DELAYED'

    ).length || 0;



    // Attendance: count recent attendance logs (simplified - always 0 as attendance is continuous)

    const attendanceNotificationCount = 0;



    // Feedback: count submitted feedback milestones that haven't been reviewed

    const lastFeedbackVisit = getLastVisit('feedback');

    const feedbackNotificationCount = selectedIntern.feedback?.filter(f => {

      const status = (f as any)?.status;

      const hasReview = (f as any)?.supervisorReviewedAt;

      const submissionDate = (f as any)?.submissionDate;

      if (status !== 'submitted' || hasReview) return false;

      if (!submissionDate) return true; // If no date, show notification

      const timestamp = new Date(submissionDate).getTime();

      return timestamp > lastFeedbackVisit;

    }).length || 0;



    // Documents: count feedback milestones with attachments that haven't been reviewed

    const lastDocumentsVisit = getLastVisit('documents');

    console.log('🔍 Documents Debug:', {

      internId: selectedInternId,

      lastDocumentsVisit,

      totalFeedback: selectedIntern.feedback?.length,

      feedback: selectedIntern.feedback?.map(f => ({

        id: (f as any)?.id,

        status: (f as any)?.status,

        attachments: (f as any)?.attachments?.length || 0,

        submissionDate: (f as any)?.submissionDate,

        supervisorReviewedAt: (f as any)?.supervisorReviewedAt

      }))

    });

    const documentsNotificationCount = selectedIntern.feedback?.filter(f => {

      const attachments = (f as any)?.attachments;

      const submissionDate = (f as any)?.submissionDate;

      if (!attachments || attachments.length === 0) return false;

      if (!submissionDate) return false;

      const timestamp = new Date(submissionDate).getTime();

      const hasReview = (f as any)?.supervisorReviewedAt;

      return timestamp > lastDocumentsVisit && !hasReview;

    }).length || 0;

    console.log('✅ Documents notification count:', documentsNotificationCount);



    return (

      <InternDeepDiveLayout

        intern={{

          name: selectedIntern.name,

          avatar: selectedIntern.avatar,

          position: selectedIntern.position,

          internPeriod: selectedIntern.internPeriod,

        }}

        activeTab={activeTab}

        onTabChange={(tab) => {

          setActiveTab(tab);

          // Update last visit timestamp when tab changes

          const key = `lastInternTab_${selectedInternId}_${tab}`;

          localStorage.setItem(key, String(Date.now()));

          // Trigger re-render to update notification counts

          setTabVisitTrigger(prev => prev + 1);

        }}

        showAssignmentsTab

        onBack={() => {

          setSelectedInternId(null);

          setActiveTab(currentTab === 'manage-interns' ? 'assets' : 'overview');

        }}

        assetsNotificationCount={assetsNotificationCount}

        assignmentsNotificationCount={assignmentsNotificationCount}

        attendanceNotificationCount={attendanceNotificationCount}

        feedbackNotificationCount={feedbackNotificationCount}

        documentsNotificationCount={documentsNotificationCount}

      >

            {activeTab === 'overview' && (

              <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">

                  <div className="xl:col-span-7 bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">

                    <div className="flex items-center justify-between mb-16">

                        <div className="flex items-center gap-4">

                          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">

                            <BarChart3 size={24} />

                          </div>

                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('supervisor_dashboard.evaluation.performance_analysis')}</h3>

                        </div>

                        <button className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4338CA] transition-all shadow-xl shadow-indigo-100">

                          <StickyNote size={16} /> {t('supervisor_dashboard.evaluation.download_full_audit')}

                        </button>

                    </div>

                    <div className="space-y-10">

                        <ProgressRow label={String(t('supervisor_dashboard.evaluation.technical_proficiency'))} score={displayPerformance.technical} color="bg-blue-600" />

                        <ProgressRow label={String(t('supervisor_dashboard.evaluation.team_communication'))} score={displayPerformance.communication} color="bg-indigo-600" />

                        <ProgressRow label={String(t('supervisor_dashboard.evaluation.punctuality_reliability'))} score={displayPerformance.punctuality} color="bg-emerald-500" />

                        <ProgressRow label={String(t('supervisor_dashboard.evaluation.self_initiative'))} score={displayPerformance.initiative} color="bg-rose-500" />

                    </div>



                    <div className="mt-12 pt-10 border-t border-slate-100 space-y-6">

                      {saveEvaluationError && (

                        <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">

                          {saveEvaluationError}

                        </div>

                      )}



                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <ScoreInput

                          label={String(t('supervisor_dashboard.evaluation.technical_proficiency'))}

                          value={editPerformance.technical}

                          onChange={(v) => setEditPerformance((p) => ({ ...p, technical: v }))}

                        />

                        <ScoreInput

                          label={String(t('supervisor_dashboard.evaluation.team_communication'))}

                          value={editPerformance.communication}

                          onChange={(v) => setEditPerformance((p) => ({ ...p, communication: v }))}

                        />

                        <ScoreInput

                          label={String(t('supervisor_dashboard.evaluation.punctuality_reliability'))}

                          value={editPerformance.punctuality}

                          onChange={(v) => setEditPerformance((p) => ({ ...p, punctuality: v }))}

                        />

                        <ScoreInput

                          label={String(t('supervisor_dashboard.evaluation.self_initiative'))}

                          value={editPerformance.initiative}

                          onChange={(v) => setEditPerformance((p) => ({ ...p, initiative: v }))}

                        />

                      </div>



                      <div>

                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{t('supervisor_dashboard.evaluation.executive_summary')}</div>

                        <textarea

                          value={editSummary}

                          onChange={(e) => setEditSummary(e.target.value)}

                          rows={5}

                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"

                          placeholder={t('supervisor_dashboard.evaluation.summary_placeholder')}

                        />

                      </div>



                      <div className="flex items-center justify-end gap-3">

                        <button

                          onClick={() => {

                            if (!selectedIntern) return;

                            setEditPerformance(selectedIntern.supervisorPerformance);

                            setEditSummary(selectedIntern.supervisorSummary ?? '');

                            setSaveEvaluationError(null);

                          }}

                          className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"

                          disabled={isSavingEvaluation}

                        >

                          {t('supervisor_dashboard.evaluation.reset')}

                        </button>

                        <button

                          onClick={() => void handleSaveEvaluation()}

                          className="px-8 py-3 rounded-2xl bg-[#111827] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"

                          disabled={isSavingEvaluation}

                        >

                          {isSavingEvaluation ? t('supervisor_dashboard.evaluation.saving') : t('supervisor_dashboard.evaluation.save_evaluation')}

                        </button>

                      </div>

                    </div>

                  </div>

                  <div className="xl:col-span-5 bg-[#3B49DF] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col">

                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

                    <h3 className="text-xl font-black mb-12 tracking-tight relative z-10">{t('supervisor_dashboard.overview.executive_summary')}</h3>

                    <div className="flex flex-col items-center gap-10 flex-1 relative z-10">

                        <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">

                          <span className="text-6xl font-black tracking-tighter leading-none">{displayPerformance.overallRating}</span>

                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">{t('supervisor_dashboard.evaluation.avg_score')}</span>

                        </div>

                        <p className="text-lg leading-relaxed text-indigo-50 italic font-medium text-center">

                          {displaySummary ? `"${displaySummary}"` : t('supervisor_dashboard.evaluation.summary_placeholder_display')}

                        </p>

                    </div>

                  </div>

                </div>

              </div>

            )}



            {handoffProjectOpen && (

              <>

                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setHandoffProjectOpen(null)} />

                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">

                  <div className="w-full max-w-5xl bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">

                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">

                      <div>

                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('supervisor_dashboard.assets.project_handoff')}</div>

                        <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{handoffProjectOpen.projectTitle}</div>

                      </div>

                      <button

                        type="button"

                        onClick={() => setHandoffProjectOpen(null)}

                        className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"

                      >

                        ✕

                      </button>

                    </div>

                    <div className="p-8">

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                        {handoffProjectOpen.items.map((a) => (

                          <AssetCard

                            key={a.key}

                            fileName={a.label}

                            date={a.date}

                            taskTitle={handoffProjectOpen.projectTitle}

                            status={a.status}

                            onOpen={() =>

                              a.open.type === 'storage' ? void handleOpenStoragePath(a.open.storagePath) : handleOpenUrl(a.open.url)

                            }

                          />

                        ))}

                      </div>

                    </div>

                  </div>

                </div>

              </>

            )}



            {activeTab === 'assets' && (

              <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500 h-full flex flex-col">

                <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm flex-1 flex flex-col min-h-[600px]">

                  <div className="flex items-center justify-between mb-10 flex-shrink-0 px-2">

                    <div className="flex items-center gap-4">

                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">

                        <FolderOpen size={24} />

                      </div>

                      <div>

                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('supervisor_dashboard.assets.title')}</h3>

                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('supervisor_dashboard.assets.subtitle')}</p>

                      </div>

                    </div>

                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide px-2">

                    {handoffLoadError && (

                      <div className="mb-6 p-6 bg-rose-50 border border-rose-100 rounded-[2rem]">

                        <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{t('supervisor_dashboard.assets.load_error')}</div>

                        <div className="mt-2 text-sm font-bold text-rose-700 break-words">{handoffLoadError}</div>

                      </div>

                    )}



                    {handoffIsLoading && handoffAssets.length === 0 && !handoffLoadError && (

                      <div className="py-16 text-center">

                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]">{t('supervisor_dashboard.assets.loading')}</div>

                      </div>

                    )}



                    {handoffHasLoaded && !handoffIsLoading && handoffAssets.length === 0 && !handoffLoadError && (

                      <div className="py-16 text-center">

                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]">{t('supervisor_dashboard.assets.no_submissions_title')}</div>

                        <div className="mt-3 text-sm font-bold text-slate-500">{t('supervisor_dashboard.assets.no_submissions_subtitle')}</div>

                      </div>

                    )}



                    {handoffAssets.length > 0 && (

                      <div className="mb-10">

                        <div className="px-2">

                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('supervisor_dashboard.assets.project_handoff')}</h4>

                          <p className="mt-1 text-[10px] font-black text-slate-300 uppercase tracking-widest">{t('supervisor_dashboard.assets.latest_submissions')}</p>

                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                          {handoffProjects.map((p) => {

                            const docCount = p.items.filter((x) => x.open.type === 'storage').length;

                            const linkCount = p.items.filter((x) => x.open.type === 'url').length;

                            return (

                              <AssetCard

                                key={p.projectTitle}

                                fileName={p.projectTitle}

                                date={p.date}

                                taskTitle={`${docCount} files, ${linkCount} links`}

                                status={p.status}

                                onOpen={() => setHandoffProjectOpen(p)}

                              />

                            );

                          })}

                        </div>

                      </div>

                    )}



                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                      {selectedIntern.tasks.map(task => (

                        <React.Fragment key={task.id}>

                          {task.attachments.map((file, idx) => (

                            <AssetCard

                              key={`${task.id}-${idx}`}

                              fileName={attachmentLabel(file)}

                              date={task.date}

                              taskTitle={task.title}

                              status={task.status}

                              onOpen={

                                typeof file === 'string'

                                  ? undefined

                                  : () => void handleOpenStoragePath((file as any).storagePath)

                              }

                            />

                          ))}

                        </React.Fragment>

                      ))}

                    </div>

                  </div>

                </div>

              </div>

            )}



            {activeTab === 'tasks' && (

              <TasksTab

                tasks={selectedIntern.tasks}

                onNewAssignment={() => setIsAssigningTask(true)}

                onUpdateTaskStatus={handleUpdateTaskStatus}

              />

            )}



            {activeTab === 'assignments' && selectedInternId && <AssignmentsTab internId={selectedInternId} />}



            {activeTab === 'attendance' && (

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-6 duration-500">

                <div className="lg:col-span-4 xl:col-span-3 space-y-6">

                  <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">

                    <h3 className="text-lg font-bold text-slate-900 mb-8">{t('supervisor_dashboard.attendance_filter.title')}</h3>

                    <div className="space-y-6">

                      <div>

                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t('supervisor_dashboard.attendance_filter.date_range')}</label>

                        <div className="flex flex-col gap-3">

                          <input

                            type="date"

                            value={pendingFilterDate}

                            onChange={(e) => setPendingFilterDate(e.target.value)}

                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none"

                          />

                        </div>

                      </div>



                      <div>

                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t('supervisor_dashboard.attendance_filter.status_filter')}</label>

                        <div className="relative">

                          <select

                            value={pendingFilterStatus}

                            onChange={(e) => setPendingFilterStatus(e.target.value as 'ALL' | 'PRESENT' | 'LATE')}

                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"

                          >

                            <option value="ALL">{t('supervisor_dashboard.attendance_filter.all_status')}</option>

                            <option value="PRESENT">{t('supervisor_dashboard.attendance_filter.present')}</option>

                            <option value="LATE">{t('supervisor_dashboard.attendance_filter.late')}</option>

                          </select>

                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                        </div>

                      </div>



                      <div>

                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t('supervisor_dashboard.attendance_filter.work_mode')}</label>

                        <div className="relative">

                          <select

                            value={pendingFilterWorkMode}

                            onChange={(e) => setPendingFilterWorkMode(e.target.value as 'ALL' | 'WFO' | 'WFH')}

                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"

                          >

                            <option value="ALL">{t('supervisor_dashboard.attendance_filter.all_mode')}</option>

                            <option value="WFO">WFO</option>

                            <option value="WFH">WFH</option>

                          </select>

                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                        </div>

                      </div>



                      <button

                        onClick={() => {

                          setFilterDate(pendingFilterDate);

                          setFilterStatus(pendingFilterStatus);

                          setFilterWorkMode(pendingFilterWorkMode);

                        }}

                        className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-3.5 rounded-2xl text-xs font-bold border border-blue-100/50"

                      >

                        <Filter size={16} /> {t('supervisor_dashboard.attendance_filter.apply_filter')}

                      </button>

                    </div>

                  </div>

                </div>



                <div className="lg:col-span-8 xl:col-span-9">

                  <AttendanceTab

                    key={`${selectedInternId ?? ''}|${filterDate}|${filterStatus}|${filterWorkMode}`}

                    logs={filteredAttendanceLogs}

                    viewMode={attendanceViewMode}

                    onViewModeChange={setAttendanceViewMode}

                  />

                </div>

              </div>

            )}



            {activeTab === 'feedback' && (

              <FeedbackTab

                feedback={selectedIntern.feedback}

                activeFeedbackId={activeFeedbackId}

                onSelectFeedback={setActiveFeedbackId}

                activeFeedback={activeFeedback}

                onOpenStoragePath={handleOpenStoragePath}

                editPerformance={editPerformance}

                onEditPerformanceChange={setEditPerformance}

                editOverallComments={editOverallComments}

                onEditOverallCommentsChange={setEditOverallComments}

                editWorkPerformanceComments={editWorkPerformanceComments}

                onEditWorkPerformanceCommentsChange={setEditWorkPerformanceComments}

                editMentorshipQualityRating={editMentorshipQualityRating}

                onEditMentorshipQualityRatingChange={setEditMentorshipQualityRating}

                editSupervisorProgramSatisfaction={editSupervisorProgramSatisfaction}

                onEditSupervisorProgramSatisfactionChange={setEditSupervisorProgramSatisfaction}

                onResetPerformance={() => {

                  if (!selectedIntern) return;

                  setEditPerformance(selectedIntern.supervisorPerformance);

                  setEditOverallComments(selectedIntern.supervisorSummary ?? '');

                  setEditWorkPerformanceComments('');

                  setEditMentorshipQualityRating(0);

                  setEditSupervisorProgramSatisfaction(0);

                  setEditSummary(selectedIntern.supervisorSummary ?? '');

                  setSaveEvaluationError(null);

                }}

                onSavePerformance={() => void handleSaveEvaluation()}

                isSavingPerformance={isSavingEvaluation}

                savePerformanceError={saveEvaluationError}

              />

            )}



            {activeTab === 'documents' && <DocumentsTab internId={selectedInternId} />}

          </InternDeepDiveLayout>

        );

      };



      const renderDashboard = () => {

        return (

          <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-hide animate-in fade-in duration-500">

            <div className="max-w-7xl mx-auto w-full">

              {currentTab === 'dashboard' ? (

                <>

                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">

                    <div>

                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-3">INTERNPLUS <span className="mx-1 text-slate-200">/</span> TEAM INTELLIGENCE</p>

                      <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{t('supervisor_dashboard.dashboard.team_overview')}</h1>

                      <p className="text-slate-400 text-sm font-medium mt-4 italic">{t('supervisor_dashboard.dashboard.team_overview_subtitle')}</p>

                    </div>

                    <button 

                      onClick={() => onNavigate('manage-interns')}

                      className="flex items-center gap-3 px-10 py-4 bg-[#0B0F19] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"

                    >

                      <Users size={18} strokeWidth={2.5}/> {t('supervisor_dashboard.dashboard.manage_full_roster')}

                    </button>

                  </div>



                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">

                    <StatBox

                      icon={<Clock className="text-amber-500" size={24} />}

                      label={String(t('supervisor_dashboard.dashboard.pending_leave'))}

                      value={String(pendingLeaveCount)}

                    />

                    <StatBox

                      icon={<Award className="text-emerald-500" size={24} />}

                      label={String(t('supervisor_dashboard.dashboard.pending_certificates'))}

                      value={String(pendingCertificateCount)}

                    />

                    <StatBox

                      icon={<GraduationCap className="text-indigo-600" size={24} />}

                      label={String(t('supervisor_dashboard.dashboard.pending_university'))}

                      value={String(pendingUniversityEvaluationCount)}

                    />

                  </div>



                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    <div className="lg:col-span-8 bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">

                       <div className="flex items-center justify-between mb-12">

                          <div className="flex items-center gap-4">

                             <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">

                                <CircleAlert size={26} />

                             </div>

                             <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t('supervisor_dashboard.dashboard.pending_action_items')}</h3>

                          </div>

                          <div className="flex items-center gap-4">

                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">

                              {totalPendingCount > PENDING_ACTION_VISIBLE_COUNT ? `<${totalPendingCount}>` : `${totalPendingCount}`}

                            </span>

                          </div>

                       </div>



                       <div className="space-y-4 max-h-[560px] overflow-y-auto pr-2">

                          {pendingByIntern.length === 0 ? (

                            <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">

                              <CheckCircle2 size={32} className="text-slate-200 mb-3" />

                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">{t('supervisor_dashboard.dashboard.no_items_requiring_review')}</p>

                            </div>

                          ) : (

                            displayedPendingByIntern.map((item) => (

                              <div key={item.internId} className="p-6 bg-[#F8FAFC]/60 border border-slate-100 rounded-[2.25rem] flex items-center justify-between group hover:border-blue-200 hover:bg-white hover:shadow-xl transition-all">

                                 <div className="flex items-center gap-5 min-w-0">

                                    <img src={item.internAvatar} className="w-16 h-16 rounded-[1.5rem] object-cover ring-4 ring-white shadow-sm" alt="" />

                                    <div className="min-w-0">

                                      <div className="flex items-center gap-3 min-w-0">

                                        <h4 className="text-lg font-black text-slate-900 leading-tight truncate">{item.internName}</h4>

                                        <div className="px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest flex-shrink-0">

                                          {item.count}

                                        </div>

                                      </div>

                                      <div className="flex items-center gap-2 mt-1">

                                         <FileText size={14} className="text-amber-50" />

                                         <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">

                                           {t('supervisor_dashboard.dashboard.assignment_submissions_pending')}

                                         </span>

                                      </div>

                                    </div>

                                 </div>

                                 <div className="flex items-center gap-6">

                                    <button

                                      onClick={() => void handleOpenPendingAssetsForIntern(item.internId, item.next)}

                                      className="flex items-center gap-2 px-8 py-3 bg-[#EBF3FF] text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"

                                    >

                                      <Eye size={16} strokeWidth={3}/> {t('supervisor_dashboard.dashboard.review')}

                                    </button>

                                    <ChevronRight size={24} className="text-slate-200 group-hover:text-blue-500 transition-colors" />

                                 </div>

                              </div>

                            ))

                          )}

                       </div>



                       {pendingActionPageCount > 1 && (

                         <div className="pt-6 flex justify-center">

                           <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">

                             <button

                               type="button"

                               onClick={() => setPendingActionPage((p) => Math.max(1, p - 1))}

                               disabled={pendingActionPage <= 1}

                               className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"

                             >

                               <ChevronLeft size={18} />

                             </button>



                             {Array.from({ length: pendingActionPageCount }, (_, i) => i + 1).map((p) => (

                               <button

                                 key={p}

                                 type="button"

                                 onClick={() => setPendingActionPage(p)}

                                 className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${

                                   p === pendingActionPage

                                     ? 'bg-slate-900 text-white border-slate-900'

                                     : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'

                                 }`}

                               >

                                 {p}

                               </button>

                             ))}



                             <button

                               type="button"

                               onClick={() => setPendingActionPage((p) => Math.min(pendingActionPageCount, p + 1))}

                               disabled={pendingActionPage >= pendingActionPageCount}

                               className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"

                             >

                               <ChevronRight size={18} />

                             </button>

                           </div>

                         </div>

                       )}

                    </div>



                    <div className="lg:col-span-4 space-y-8">

                       <button
                         type="button"
                         onClick={() => setIsTimeCorrectionsOpen(true)}
                         className="w-full text-left bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm hover:border-rose-200 hover:shadow-xl transition-all"
                       >

                          <div className="flex items-center justify-between mb-8">

                            <div className="flex items-start gap-3">

                              {pendingTimeCorrections.length > 0 ? (
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 mt-1">
                                  <CircleAlert size={18} />
                                </div>
                              ) : null}

                              <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TIME CORRECTIONS</div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight mt-2">Pending requests</h3>
                              </div>

                            </div>

                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pendingTimeCorrections.length}</div>

                          </div>

                          {pendingTimeCorrections.length === 0 ? (

                            <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed text-center">

                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pending requests</p>

                            </div>

                          ) : (
                            <div className="space-y-3">
                              {pendingTimeCorrections.slice(0, 5).map((req) => (
                                <div key={req.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-[11px] font-black text-slate-900 truncate">{req.internName}</div>
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{req.date}</div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-200 flex-shrink-0" />
                                  </div>
                                  {(req.requestedClockIn || req.requestedClockOut) ? (
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time</div>
                                      <div className="text-[10px] font-black text-slate-700">
                                        {req.requestedClockIn || '--'} — {req.requestedClockOut || '--'}
                                      </div>
                                    </div>
                                  ) : null}
                                  {req.reason ? (
                                    <div className="mt-2 text-[10px] font-bold text-slate-500 line-clamp-2 break-words">{req.reason}</div>
                                  ) : null}
                                </div>
                              ))}
                              {pendingTimeCorrections.length > 5 ? (
                                <div className="pt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Click to view all
                                </div>
                              ) : null}
                            </div>
                          )}

                       </button>

                       <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm">

                          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">{t('supervisor_dashboard.dashboard.total_interns')}</h3>

                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{t('supervisor_dashboard.dashboard.assigned_to_you')}</p>



                          <div className="flex items-center justify-between">

                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">

                              <Users size={28} />

                            </div>

                            <div className="text-right">

                              <div className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{interns.length}</div>

                              <div className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('supervisor_dashboard.dashboard.active_list')}</div>

                            </div>

                          </div>

                       </div>



                       <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm">

                          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">{t('supervisor_dashboard.dashboard.team_presence')}</h3>

                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{t('supervisor_dashboard.dashboard.who_is_away')}</p>

                          

                          <div className="space-y-6">

                            {awayToday.length === 0 ? (

                              <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">

                                 <PlaneTakeoff size={32} className="text-slate-200 mb-3" />

                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">{t('supervisor_dashboard.dashboard.no_one_away')}</p>

                              </div>

                            ) : (

                              awayToday.map((x) => (

                                <div key={x.id} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100">

                                  <div className="flex items-center gap-4">

                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">

                                      <UserX size={20} />

                                    </div>

                                    <div>

                                      <p className="text-sm font-black text-slate-900 leading-none">{x.internName}</p>

                                      <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-1">{x.type || t('supervisor_dashboard.dashboard.leave')}</p>

                                    </div>

                                  </div>

                                </div>

                              ))

                            )}

                          </div>

                       </div>

                    </div>

                  </div>

                </>

              ) : (

                <>

                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">

                    <div>

                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-3">INTERNPLUS <span className="mx-1 text-slate-200">/</span> TEAM INTELLIGENCE</p>

                      <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{t('supervisor_dashboard.dashboard.my_interns')}</h1>

                      <p className="text-slate-400 text-sm font-medium mt-4 italic">{t('supervisor_dashboard.dashboard.my_interns_subtitle')}</p>

                    </div>

                  </div>

                  <InternListSection

                    interns={manageInternListItems}

                    searchQuery={searchQuery}

                    statusFilter={statusFilter}

                    onSearchQueryChange={setSearchQuery}

                    onStatusFilterChange={setStatusFilter}

                    onOpenAssignIntern={() => setIsAssigningIntern(true)}

                    showAssignButton={false}

                    showHeader={false}

                    onSelectIntern={(internId) => {

                      setSelectedInternId(internId);

                      // Mark this intern as viewed to clear notification badge

                      const key = `lastInternViewed_${internId}`;

                      localStorage.setItem(key, String(Date.now()));

                    }}

                  />

                </>

              )}

            </div>

          </div>

        );

      };



  return (

    <div className="h-full w-full bg-slate-50 overflow-hidden flex flex-col">

      {isTimeCorrectionsOpen ? (
        <>
          <div
            className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsTimeCorrectionsOpen(false)}
          />
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-[2.75rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TIME CORRECTIONS</div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-2">Pending requests</h3>
                </div>
                <button
                  onClick={() => setIsTimeCorrectionsOpen(false)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-4">
                {pendingTimeCorrections.length === 0 ? (
                  <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pending requests</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {pagedTimeCorrections.map((req) => (
                        <div key={req.id} className="p-6 bg-slate-50/50 rounded-[2.25rem] border border-slate-100">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-base font-black text-slate-900 truncate">{req.internName}</div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{req.date}</div>
                              {(req.requestedClockIn || req.requestedClockOut) ? (
                                <div className="mt-3 flex items-center gap-4">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-in</div>
                                    <div className="text-[13px] font-black text-emerald-700">{req.requestedClockIn || '--'}</div>
                                  </div>
                                  <div className="text-slate-200 font-black">→</div>
                                  <div className="flex flex-col gap-1">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-out</div>
                                    <div className="text-[13px] font-black text-rose-600">{req.requestedClockOut || '--'}</div>
                                  </div>
                                </div>
                              ) : null}
                              {req.reason ? (
                                <div className="mt-3 text-[11px] font-bold text-slate-700 whitespace-pre-wrap break-words">{req.reason}</div>
                              ) : null}
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black uppercase tracking-widest">
                                PENDING
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDecision(req, 'REJECT')}
                                  className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDecision(req, 'APPROVE')}
                                  disabled={!req.requestedClockIn || !req.requestedClockOut}
                                  className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-60 disabled:hover:bg-emerald-50 disabled:hover:text-emerald-700"
                                >
                                  Approve
                                </button>
                              </div>
                            </div>
                          </div>

                          {req.attachments.length > 0 ? (
                            <div className="mt-5 pt-5 border-t border-slate-100">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attachments</div>
                              <div className="mt-3 space-y-2">
                                {req.attachments.map((a) => (
                                  <button
                                    key={a.storagePath}
                                    type="button"
                                    className="w-full text-left text-[11px] font-black text-blue-600 hover:underline break-words"
                                    onClick={async () => {
                                      try {
                                        const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                  >
                                    {a.fileName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    {timeCorrectionsTotalPages > 1 ? (
                      <div className="pt-2 flex justify-center">
                        <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                          {Array.from({ length: timeCorrectionsTotalPages }, (_, idx) => idx + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTimeCorrectionsPage(p)}
                              className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                                p === timeCorrectionsPage
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                              }`}
                              aria-current={p === timeCorrectionsPage ? 'page' : undefined}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {decisionCorrection && decisionMode ? (
        <>
          <div
            className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm"
            onClick={() => (isSavingDecision ? void 0 : (setDecisionCorrection(null), setDecisionMode(null)))}
          />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {decisionMode === 'APPROVE' ? 'Approve time correction' : 'Reject time correction'}
                  </h3>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    {decisionCorrection.internName} • {decisionCorrection.date}
                  </div>
                </div>
                <button
                  onClick={() => (isSavingDecision ? void 0 : (setDecisionCorrection(null), setDecisionMode(null)))}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                  disabled={isSavingDecision}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-8 space-y-5">
                {decisionMode === 'APPROVE' ? (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem]">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested</div>
                    <div className="mt-2 text-sm font-black text-slate-900">
                      {(decisionCorrection.requestedClockIn || '--') + ' — ' + (decisionCorrection.requestedClockOut || '--')}
                    </div>
                    {!decisionCorrection.requestedClockIn || !decisionCorrection.requestedClockOut ? (
                      <div className="mt-2 text-[11px] font-bold text-rose-600">Clock-in and Clock-out are required to approve.</div>
                    ) : null}
                  </div>
                ) : null}

                <label className="space-y-2 block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note (optional)</div>
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[120px]"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => (isSavingDecision ? void 0 : (setDecisionCorrection(null), setDecisionMode(null)))}
                    disabled={isSavingDecision}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleConfirmDecision()}
                    disabled={
                      isSavingDecision ||
                      (decisionMode === 'APPROVE' && (!decisionCorrection.requestedClockIn || !decisionCorrection.requestedClockOut))
                    }
                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-60 ${
                      decisionMode === 'APPROVE'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20'
                        : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/20'
                    }`}
                  >
                    {decisionMode === 'APPROVE' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {selectedInternId ? renderDeepDive() : renderDashboard()}



      {isAssigningIntern && (

        <>

          <div

            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"

            onClick={() => setIsAssigningIntern(false)}

          />

          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">

            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">

              <div className="p-8 border-b border-slate-100 flex items-center justify-between">

                <div>

                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('supervisor_dashboard.assign_modal.title')}</h3>

                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('supervisor_dashboard.assign_modal.subtitle')}</p>

                </div>

                <button

                  onClick={() => setIsAssigningIntern(false)}

                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"

                >

                  <X size={18} />

                </button>

              </div>



              <div className="p-8">

                <div className="relative mb-6">

                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />

                  <input

                    type="text"

                    placeholder={t('supervisor_dashboard.modals.assign_intern_search_placeholder')}

                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"

                    value={assignSearch}

                    onChange={(e) => setAssignSearch(e.target.value)}

                  />

                </div>



                <div className="max-h-[55vh] overflow-y-auto scrollbar-hide space-y-3">

                  {assignableInterns.map((intern) => (

                    <button

                      key={intern.id}

                      onClick={() => void handleAssignIntern(intern.id)}

                      className="w-full p-5 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between gap-6 hover:shadow-xl hover:border-blue-100 transition-all"

                    >

                      <div className="flex items-center gap-4 min-w-0">

                        <img src={intern.avatar} alt={intern.name} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-50" />

                        <div className="min-w-0 text-left">

                          <div className="text-sm font-black text-slate-900 truncate">{intern.name}</div>

                          <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate mt-1">{intern.position}</div>

                        </div>

                      </div>

                      <ChevronRight size={18} className="text-slate-200" />

                    </button>

                  ))}



                  {assignableInterns.length === 0 && (

                    <div className="py-14 text-center">

                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t('supervisor_dashboard.assign_modal.no_interns_found')}</p>

                    </div>

                  )}

                </div>

              </div>

            </div>

          </div>

        </>

      )}

    </div>

  );

};



const StatBox = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (

  <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex items-center gap-8 hover:shadow-xl hover:border-blue-100 transition-all group">

    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">

      {icon}

    </div>

    <div>

      <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-1">{value}</h3>

      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">{label}</p>

    </div>

  </div>

);



const ProgressRow = ({ label, score, color }: { label: string; score: number; color: string }) => (

  <div className="space-y-4">

    <div className="flex justify-between items-end">

      <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">{label}</h5>

      <span className="text-2xl font-black text-slate-900 tracking-tighter">

        <span className="text-blue-600">{score}</span>

        <span className="text-slate-200 font-bold ml-1 text-base">/100</span>

      </span>

    </div>

    <div className="h-3.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 shadow-inner">

       <div className={`h-full ${color} rounded-full transition-all duration-1000 shadow-lg`} style={{ width: `${score}%` }}></div>

    </div>

  </div>

);



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



const AssetCard: React.FC<{ fileName: string; date?: string; taskTitle?: string; status?: string; onOpen?: () => void }> = ({ fileName, date, taskTitle, status, onOpen }) => {

  const getIcon = () => {

    if (fileName.endsWith('.fig')) return <FileCode size={24} className="text-indigo-50" />;

    if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) return <FileImage size={24} className="text-amber-50" />;

    if (fileName.endsWith('.xlsx')) return <FileSpreadsheet size={24} className="text-emerald-50" />;

    return <FileText size={24} className="text-blue-50" />;

  };



  return (

    <div

      className="bg-slate-50/50 border border-slate-100 p-5 rounded-[2rem] group hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer"

      onClick={onOpen}

      role={onOpen ? 'button' : undefined}

    >

       <div className="flex justify-between items-start mb-6">

          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">

            {getIcon()}

          </div>

          <button className="text-slate-300 hover:text-slate-600"><MoreHorizontal size={18}/></button>

       </div>

       <div className="overflow-hidden mb-6">

          <p className="text-sm font-black text-slate-800 truncate leading-none mb-1.5">{fileName}</p>

          <div className="flex items-center gap-2">

             {date && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{date}</span>}

             {status && (

               <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${

                 status === 'DONE' ? 'bg-emerald-50 text-emerald-600' : 

                 status === 'REVISION' ? 'bg-amber-50 text-amber-600' :

                 'bg-blue-50 text-blue-600'

               }`}>

                 {status}

               </span>

             )}

          </div>

       </div>

       {taskTitle && (

         <div className="pt-4 border-t border-slate-100 flex items-center justify-between">

            <span className="text-[8px] font-bold text-slate-300 uppercase truncate max-w-[120px]">{taskTitle}</span>

            <button className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">

               <Download size={14}/>

            </button>

         </div>

       )}

    </div>

  );

};



export default SupervisorDashboard;


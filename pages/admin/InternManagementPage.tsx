import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BarChart3,
  ChevronDown,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  Filter,
  MessageSquareMore,
  MoreHorizontal,
  Star,
  StickyNote,
} from 'lucide-react';

import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { useNavigate } from 'react-router-dom';



import { PerformanceMetrics, SubTask, TaskAttachment } from '@/types';

import { firestoreDb, firebaseStorage } from '@/firebase';

import { pageIdToPath } from '@/app/routeUtils';

import { normalizeAvatarUrl } from '@/app/avatar';



import InternListSection from '@/pages/supervisor/components/InternListSection';

import InternDeepDiveLayout, { SupervisorDeepDiveTab } from '@/pages/supervisor/components/InternDeepDiveLayout';

import AttendanceTab, { AttendanceViewMode } from '@/pages/supervisor/components/AttendanceTab';

import FeedbackTab, { FeedbackItem } from '@/pages/supervisor/components/FeedbackTab';

import TasksTab from '@/pages/supervisor/components/TasksTab';

import DocumentsTab from '@/pages/supervisor/components/DocumentsTab';

import AssignmentsTab from '@/pages/admin/components/AssignmentsTab';



type HandoffMeta = { handoffCount: number; latestHandoffTsMs: number };



interface AdminInternDetail {

  id: string;

  name: string;

  avatar: string;

  position: string;

  internPeriod: string;

  progress: number;

  status: 'Active' | 'Inactive';

  attendance: string;

  department: string;

  email: string;

  tasks: SubTask[];

  feedback: FeedbackItem[];

  performance: PerformanceMetrics;

  adminSummary: string;

  selfPerformance: PerformanceMetrics;

  selfSummary: string;

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



type ProjectKind = 'assigned' | 'personal';



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



type FeedbackMilestoneDoc = {

  status?: string;

  internReflection?: string;

  internProgramFeedback?: string;

  videoStoragePath?: string;

  videoFileName?: string;

  attachments?: Array<{ fileName: string; storagePath: string }>;

  supervisorScore?: number;

  supervisorComments?: string;

  programRating?: number;

  submissionDate?: string;



  selfPerformance?: Partial<PerformanceMetrics>;

  selfSummary?: string;

  supervisorPerformance?: Partial<PerformanceMetrics>;

  supervisorSummary?: string;

  supervisorOverallComments?: string;

  supervisorWorkPerformanceComments?: string;

  supervisorMentorshipQualityRating?: number;

  supervisorProgramSatisfactionRating?: number;

  supervisorReviewedDate?: string;

  submittedAtMs?: number;

  updatedAtMs?: number;

};



const DEFAULT_PERFORMANCE: PerformanceMetrics = {

  technical: 0,

  communication: 0,

  punctuality: 0,

  initiative: 0,

  overallRating: 0,

};



const InternManagementPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const isTh = (i18n.language ?? '').toLowerCase().startsWith('th');

  const navigate = useNavigate();

  const [interns, setInterns] = useState<AdminInternDetail[]>([]);

  const [internsLoadError, setInternsLoadError] = useState<string | null>(null);

  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<SupervisorDeepDiveTab>('assets');

  const [tabVisitTrigger, setTabVisitTrigger] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');

  const [activeFeedbackId, setActiveFeedbackId] = useState('week-1');

  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('LOG');

  const [selectedInternAttendanceLog, setSelectedInternAttendanceLog] = useState<AdminInternDetail['attendanceLog']>([]);



  const [filterDate, setFilterDate] = useState<string>('');

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');

  const [filterWorkMode, setFilterWorkMode] = useState<'ALL' | 'WFO' | 'WFH'>('ALL');

  const [pendingFilterDate, setPendingFilterDate] = useState<string>('');

  const [pendingFilterStatus, setPendingFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');

  const [pendingFilterWorkMode, setPendingFilterWorkMode] = useState<'ALL' | 'WFO' | 'WFH'>('ALL');



  const [activeEvalSource, setActiveEvalSource] = useState<'SELF' | 'SUPERVISOR'>('SELF');



  const [handoffAssets, setHandoffAssets] = useState<HandoffAssetItem[]>([]);

  const [handoffLoadError, setHandoffLoadError] = useState<string | null>(null);

  const [handoffIsLoading, setHandoffIsLoading] = useState(false);

  const [handoffHasLoaded, setHandoffHasLoaded] = useState(false);



  const [handoffProjectOpen, setHandoffProjectOpen] = useState<HandoffProjectGroup | null>(null);



  const [feedbackByIntern, setFeedbackByIntern] = useState<Record<string, FeedbackItem[]>>({});

  const [handoffMetaByIntern, setHandoffMetaByIntern] = useState<Record<string, HandoffMeta>>({});



  const selectedIntern = interns.find((i) => i.id === selectedInternId);

  const parseDateToMs = (value?: string): number | null => {
    if (!value) return null;
    const d = new Date(value);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const feedbackItemTsMs = (f: FeedbackItem): number => {
    const direct = typeof f.submittedAtMs === 'number' ? f.submittedAtMs : typeof f.updatedAtMs === 'number' ? f.updatedAtMs : undefined;
    if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) return direct;

    const fromSubmission = parseDateToMs(f.submissionDate);
    if (typeof fromSubmission === 'number') return fromSubmission;

    const fromReviewed = parseDateToMs(f.supervisorReviewedDate);
    if (typeof fromReviewed === 'number') return fromReviewed;

    return 0;
  };

  const feedbackMonthKey = (f: FeedbackItem): string => {
    const ms = feedbackItemTsMs(f);
    if (!ms) return 'unknown';
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const activeFeedback = selectedIntern?.feedback.find((f) => f.id === activeFeedbackId);



  const handleUpdateTaskStatus = (taskId: string, status: 'DONE' | 'REVISION') => {

    if (!selectedInternId) return;

    setInterns((prev) =>

      prev.map((intern) => {

        if (intern.id !== selectedInternId) return intern;

        return {

          ...intern,

          tasks: (intern.tasks ?? []).map((t) => (t.id === taskId ? { ...t, status } : t)),

        };

      }),

    );

  };



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



  useEffect(() => {

    const q = query(collection(firestoreDb, 'users'), where('roles', 'array-contains', 'INTERN'));

    return onSnapshot(

      q,

      (snap) => {

        setInternsLoadError(null);

        const list = snap.docs.flatMap((d) => {

        const data = d.data() as {

          name?: string;

          avatar?: string;

          position?: string;

          internPeriod?: string;

          department?: string;

          email?: string;

          lifecycleStatus?: string;

          hasLoggedIn?: boolean;

          performance?: Partial<PerformanceMetrics>;

          adminSummary?: string;

          selfPerformance?: Partial<PerformanceMetrics>;

          selfSummary?: string;

          supervisorPerformance?: Partial<PerformanceMetrics>;

          supervisorSummary?: string;

          offboardingRequestedAt?: any;

          withdrawalRequestedAt?: any;

        };



        if (data.hasLoggedIn === false) return [];



        // Check retention period - hide interns completed > 1 month ago

        const shouldHideDueToRetention = (() => {

          if (data.lifecycleStatus === 'WITHDRAWN' || data.lifecycleStatus === 'COMPLETED') {

            const offboardDate = (data.offboardingRequestedAt as any)?.toDate?.() || 

                                (data.withdrawalRequestedAt as any)?.toDate?.();

            if (offboardDate) {

              const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

              return offboardDate.getTime() < oneMonthAgo;

            }

          }

          return false;

        })();



        // Hide intern if retention period exceeded

        if (shouldHideDueToRetention) {

          return [];

        }





        // Map lifecycleStatus to display status

        let status: AdminInternDetail['status'] = 'Active';

        console.log('🔍 Debug - Intern Data:', d.id, data.lifecycleStatus);

        

        if (data.lifecycleStatus === 'WITHDRAWN' || 

            data.lifecycleStatus === 'COMPLETED') {

          status = 'Inactive';

        } else {

          status = 'Active';

        }



        const rawPerf = data.performance ?? null;

        const normalizedPerf: PerformanceMetrics = {

          technical: typeof rawPerf?.technical === 'number' ? rawPerf.technical : DEFAULT_PERFORMANCE.technical,

          communication: typeof rawPerf?.communication === 'number' ? rawPerf.communication : DEFAULT_PERFORMANCE.communication,

          punctuality: typeof rawPerf?.punctuality === 'number' ? rawPerf.punctuality : DEFAULT_PERFORMANCE.punctuality,

          initiative: typeof rawPerf?.initiative === 'number' ? rawPerf.initiative : DEFAULT_PERFORMANCE.initiative,

          overallRating: typeof rawPerf?.overallRating === 'number' ? rawPerf.overallRating : DEFAULT_PERFORMANCE.overallRating,

        };



        const rawSelf = data.selfPerformance ?? null;

        const normalizedSelf: PerformanceMetrics = {

          technical: typeof rawSelf?.technical === 'number' ? rawSelf.technical : DEFAULT_PERFORMANCE.technical,

          communication: typeof rawSelf?.communication === 'number' ? rawSelf.communication : DEFAULT_PERFORMANCE.communication,

          punctuality: typeof rawSelf?.punctuality === 'number' ? rawSelf.punctuality : DEFAULT_PERFORMANCE.punctuality,

          initiative: typeof rawSelf?.initiative === 'number' ? rawSelf.initiative : DEFAULT_PERFORMANCE.initiative,

          overallRating: typeof rawSelf?.overallRating === 'number' ? rawSelf.overallRating : DEFAULT_PERFORMANCE.overallRating,

        };



        const rawSup = data.supervisorPerformance ?? null;

        const normalizedSup: PerformanceMetrics = {

          technical: typeof rawSup?.technical === 'number' ? rawSup.technical : DEFAULT_PERFORMANCE.technical,

          communication: typeof rawSup?.communication === 'number' ? rawSup.communication : DEFAULT_PERFORMANCE.communication,

          punctuality: typeof rawSup?.punctuality === 'number' ? rawSup.punctuality : DEFAULT_PERFORMANCE.punctuality,

          initiative: typeof rawSup?.initiative === 'number' ? rawSup.initiative : DEFAULT_PERFORMANCE.initiative,

          overallRating: typeof rawSup?.overallRating === 'number' ? rawSup.overallRating : DEFAULT_PERFORMANCE.overallRating,

        };



        return {

          id: d.id,

          name: data.name || 'Unknown',

          avatar: normalizeAvatarUrl(data.avatar),

          position: data.position || 'Intern',

          internPeriod: data.internPeriod || 'TBD',

          department: data.department || 'Unknown',

          email: data.email || '-',

          progress: 0,

          status,

          attendance: '—',

          performance: normalizedPerf,

          adminSummary: typeof data.adminSummary === 'string' ? data.adminSummary : '',

          selfPerformance: normalizedSelf,

          selfSummary: typeof data.selfSummary === 'string' ? data.selfSummary : '',

          supervisorPerformance: normalizedSup,

          supervisorSummary: typeof data.supervisorSummary === 'string' ? data.supervisorSummary : '',

          tasks: [],

          feedback: [],

          attendanceLog: [],

        } satisfies AdminInternDetail;

      });

      setInterns(list);

      },

      (err) => {

        const e = err as { code?: string; message?: string };

        setInterns([]);

        setInternsLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load interns'}`);

      },

    );

  }, []);



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

      (err) => {

        console.warn('attendance listener failed', err);

        setSelectedInternAttendanceLog([]);

      },

    );

  }, [activeTab, selectedInternId]);



  useEffect(() => {

    const unsubs: Array<() => void> = [];



    for (const intern of interns) {

      const colRef = collection(firestoreDb, 'users', intern.id, 'feedbackMilestones');

      const unsub = onSnapshot(

        colRef,

        (snap) => {

          const items: FeedbackItem[] = snap.docs.map((d) => {

          const data = d.data() as FeedbackMilestoneDoc;

          const label = d.id;



          const rawSelf = data.selfPerformance ?? null;

          const normalizedSelf: PerformanceMetrics | undefined = rawSelf

            ? {

                technical: typeof rawSelf?.technical === 'number' ? rawSelf.technical : DEFAULT_PERFORMANCE.technical,

                communication: typeof rawSelf?.communication === 'number' ? rawSelf.communication : DEFAULT_PERFORMANCE.communication,

                punctuality: typeof rawSelf?.punctuality === 'number' ? rawSelf.punctuality : DEFAULT_PERFORMANCE.punctuality,

                initiative: typeof rawSelf?.initiative === 'number' ? rawSelf.initiative : DEFAULT_PERFORMANCE.initiative,

                overallRating: typeof rawSelf?.overallRating === 'number' ? rawSelf.overallRating : DEFAULT_PERFORMANCE.overallRating,

              }

            : undefined;



          const rawSup = data.supervisorPerformance ?? null;

          const normalizedSup: PerformanceMetrics | undefined = rawSup

            ? {

                technical: typeof rawSup?.technical === 'number' ? rawSup.technical : DEFAULT_PERFORMANCE.technical,

                communication: typeof rawSup?.communication === 'number' ? rawSup.communication : DEFAULT_PERFORMANCE.communication,

                punctuality: typeof rawSup?.punctuality === 'number' ? rawSup.punctuality : DEFAULT_PERFORMANCE.punctuality,

                initiative: typeof rawSup?.initiative === 'number' ? rawSup.initiative : DEFAULT_PERFORMANCE.initiative,

                overallRating: typeof rawSup?.overallRating === 'number' ? rawSup.overallRating : DEFAULT_PERFORMANCE.overallRating,

              }

            : undefined;



          return {

            id: d.id,

            label,

            period: label,

            status: data.status ?? 'pending',

            internReflection: data.internReflection,

            internProgramFeedback: data.internProgramFeedback,

            videoStoragePath: data.videoStoragePath,

            videoFileName: data.videoFileName,

            attachments: Array.isArray(data.attachments) ? data.attachments : [],

            supervisorScore: data.supervisorScore,

            supervisorComments: data.supervisorComments,

            programRating: typeof data.programRating === 'number' ? data.programRating : 0,



            submissionDate: typeof data.submissionDate === 'string' ? data.submissionDate : undefined,

            supervisorReviewedDate: typeof data.supervisorReviewedDate === 'string' ? data.supervisorReviewedDate : undefined,

            submittedAtMs: typeof data.submittedAtMs === 'number' ? data.submittedAtMs : undefined,

            updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : undefined,



            selfPerformance: normalizedSelf,

            selfSummary: typeof data.selfSummary === 'string' ? data.selfSummary : undefined,



            supervisorPerformance: normalizedSup,

            supervisorSummary: typeof data.supervisorSummary === 'string' ? data.supervisorSummary : undefined,

            supervisorOverallComments:

              typeof data.supervisorOverallComments === 'string'

                ? data.supervisorOverallComments

                : typeof data.supervisorSummary === 'string'

                  ? data.supervisorSummary

                  : undefined,

            supervisorWorkPerformanceComments:

              typeof data.supervisorWorkPerformanceComments === 'string' ? data.supervisorWorkPerformanceComments : undefined,

            supervisorMentorshipQualityRating:

              typeof data.supervisorMentorshipQualityRating === 'number' ? data.supervisorMentorshipQualityRating : undefined,

            supervisorProgramSatisfactionRating:

              typeof data.supervisorProgramSatisfactionRating === 'number' ? data.supervisorProgramSatisfactionRating : undefined,

          };

        });



          const sorted = [...items].sort((a, b) => {
            const ta = feedbackItemTsMs(a);
            const tb = feedbackItemTsMs(b);
            if (tb !== ta) return tb - ta;
            return String(b.id).localeCompare(String(a.id));
          });

          setFeedbackByIntern((prev) => ({ ...prev, [intern.id]: sorted }));

          setInterns((prev) => prev.map((x) => (x.id === intern.id ? { ...x, feedback: sorted } : x)));

        },

        (err) => {

          console.warn('feedbackMilestones listener failed', intern.id, err);

        },

      );

      unsubs.push(unsub);

    }



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [interns]);





  const handleOpenStoragePath = async (path: string) => {

    const popup = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const url = await getDownloadURL(storageRef(firebaseStorage, path));
      if (popup && !popup.closed) {
        popup.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      if (popup && !popup.closed) popup.close();
    }

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

        // keep latest date/status if present

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

      const merged = [...assignedItems, ...personalItems];

      setHandoffAssets(merged);

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



  const displayPerformance = useMemo(() => {

    if (!selectedIntern) return DEFAULT_PERFORMANCE;

    return activeEvalSource === 'SELF' ? selectedIntern.selfPerformance : selectedIntern.supervisorPerformance;

  }, [activeEvalSource, selectedIntern]);



  const displaySummary = useMemo(() => {

    if (!selectedIntern) return '';

    return activeEvalSource === 'SELF' ? selectedIntern.selfSummary : selectedIntern.supervisorSummary;

  }, [activeEvalSource, selectedIntern]);



  const [statusFilter, setStatusFilter] = useState<string>('all');



  const filteredInterns = useMemo(() => {

    const q = searchQuery.toLowerCase();

    return interns.filter((i) => {

      const matchesSearch = i.name.toLowerCase().includes(q) || i.position.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;

      return matchesSearch && matchesStatus;

    });

  }, [interns, searchQuery, statusFilter]);



  useEffect(() => {

    const list = interns.map((i) => i.id).filter(Boolean);

    if (list.length === 0) return;



    const unsubs: Array<() => void> = [];



    for (const internId of list) {

      const assignedRef = collection(firestoreDb, 'users', internId, 'assignmentProjects');

      const personalRef = collection(firestoreDb, 'users', internId, 'personalProjects');



      let assignedMeta: HandoffMeta = { handoffCount: 0, latestHandoffTsMs: 0 };

      let personalMeta: HandoffMeta = { handoffCount: 0, latestHandoffTsMs: 0 };



      const recompute = () => {

        setHandoffMetaByIntern((prev) => ({

          ...prev,

          [internId]: {

            handoffCount: (assignedMeta.handoffCount ?? 0) + (personalMeta.handoffCount ?? 0),

            latestHandoffTsMs: Math.max(assignedMeta.latestHandoffTsMs ?? 0, personalMeta.latestHandoffTsMs ?? 0),

          },

        }));

      };



      const computeMeta = (snap: any): HandoffMeta => {

        let handoffCount = 0;

        let latestHandoffTsMs = 0;

        for (const d of snap.docs) {

          const data = d.data() as any;

          const status = String(data?.handoffLatest?.status ?? '');

          if (status !== 'SUBMITTED') continue;



          handoffCount += 1;

          const submittedAt = data?.handoffLatest?.submittedAt as any;

          const tsMs = typeof submittedAt?.toDate === 'function' ? Number(submittedAt.toDate().getTime()) : 0;

          if (Number.isFinite(tsMs) && tsMs > latestHandoffTsMs) latestHandoffTsMs = tsMs;

        }

        return { handoffCount, latestHandoffTsMs };

      };



      const unsubAssigned = onSnapshot(

        assignedRef,

        (snap) => {

          assignedMeta = computeMeta(snap);

          recompute();

        },

        () => {

          assignedMeta = { handoffCount: 0, latestHandoffTsMs: 0 };

          recompute();

        },

      );



      const unsubPersonal = onSnapshot(

        personalRef,

        (snap) => {

          personalMeta = computeMeta(snap);

          recompute();

        },

        () => {

          personalMeta = { handoffCount: 0, latestHandoffTsMs: 0 };

          recompute();

        },

      );



      unsubs.push(unsubAssigned, unsubPersonal);

    }



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [interns]);



  const internListItems = useMemo(() => {

    return filteredInterns.map((intern) => {

      const lastViewedKey = `lastAdminInternViewed_${intern.id}`;

      const storedLastViewed = localStorage.getItem(lastViewedKey);

      const lastViewedTimestamp = storedLastViewed ? parseInt(storedLastViewed, 10) : 0;



      const meta = handoffMetaByIntern[intern.id];

      const handoffCount = meta?.handoffCount ?? 0;

      const latestHandoffTsMs = meta?.latestHandoffTsMs ?? 0;



      const notificationCount = handoffCount > 0 && latestHandoffTsMs > lastViewedTimestamp ? handoffCount : 0;



      return {

        id: intern.id,

        name: intern.name,

        avatar: intern.avatar,

        position: intern.position,

        progress: intern.progress,

        attendance: intern.attendance,

        status: intern.status,

        performance: { overallRating: intern.performance?.overallRating ?? 0 },

        hasNotifications: notificationCount > 0,

        notificationCount,

      };

    });

  }, [filteredInterns, handoffMetaByIntern, tabVisitTrigger]);


  const renderDeepDive = () => {

    if (!selectedInternId) return null;

    if (!selectedIntern) return null;

    const attachmentLabel = (a: TaskAttachment) => (typeof a === 'string' ? a : a.fileName);


    const showTabs = selectedInternId && activeTab === 'overview';



    const taskItems = selectedIntern.tasks.map((t) => ({

      id: t.id,

      title: t.title,

      status: t.status,

      date: t.date,

      attachments: t.attachments,

    }));



    const getLastVisit = (tabName: string) => {

      const key = `lastAdminInternTab_${selectedInternId}_${tabName}`;

      const stored = localStorage.getItem(key);

      return stored ? parseInt(stored, 10) : 0;

    };



    const lastAssetsVisit = getLastVisit('assets');

    const meta = selectedInternId ? handoffMetaByIntern[selectedInternId] : undefined;

    const assetsNotificationCount =

      meta && (meta.handoffCount ?? 0) > 0 && (meta.latestHandoffTsMs ?? 0) > lastAssetsVisit ? (meta.handoffCount ?? 0) : 0;



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

          const key = `lastAdminInternTab_${selectedInternId}_${tab}`;

          localStorage.setItem(key, String(Date.now()));

          setTabVisitTrigger((prev) => prev + 1);

        }}

        showAssignmentsTab

        onBack={() => {

          setSelectedInternId(null);

          setActiveTab('assets');

        }}

        assetsNotificationCount={assetsNotificationCount}

      >

        {activeTab === 'overview' && (

          <FeedbackTab

            feedback={selectedIntern.feedback}

            activeFeedbackId={activeFeedbackId}

            onSelectFeedback={setActiveFeedbackId}

            activeFeedback={activeFeedback}

            onOpenStoragePath={handleOpenStoragePath}

            readOnly

            hideWhenNoData

          />

        )}



        {handoffProjectOpen && (

          <>

            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setHandoffProjectOpen(null)} />

            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">

              <div className="w-full max-w-5xl bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">

                <div className="p-8 border-b border-slate-100 flex items-center justify-between">

                  <div>

                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('admin_intern_management.project_handoff')}</div>

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

                <div>

                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('admin_intern_management.work_assets_vault')}</h3>

                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{tr('admin_intern_management.all_files_subtitle')}</p>

                </div>

              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide px-2">

                {handoffLoadError && (

                  <div className="mb-6 p-6 bg-rose-50 border border-rose-100 rounded-[2rem]">

                    <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest">{tr('admin_intern_management.load_error')}</div>

                    <div className="mt-2 text-sm font-bold text-rose-700 break-words">{handoffLoadError}</div>

                  </div>

                )}



                {handoffIsLoading && handoffAssets.length === 0 && !handoffLoadError && (

                  <div className="py-16 text-center">

                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]">{tr('admin_intern_management.loading')}</div>

                  </div>

                )}



                {handoffHasLoaded && !handoffIsLoading && handoffAssets.length === 0 && !handoffLoadError && (

                  <div className="py-16 text-center">

                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]">{tr('admin_intern_management.no_handoff_title')}</div>

                    <div className="mt-3 text-sm font-bold text-slate-500">{tr('admin_intern_management.no_handoff_desc')}</div>

                  </div>

                )}



                {handoffAssets.length > 0 && (

                  <div className="mb-10">

                    <div className="px-2">

                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('admin_intern_management.project_handoff')}</h4>

                      <p className="mt-1 text-[10px] font-black text-slate-300 uppercase tracking-widest">{tr('admin_intern_management.latest_submissions')}</p>

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

                            taskTitle={tr('admin_intern_management.files_links', { files: docCount, links: linkCount })}

                            status={p.status}

                            onOpen={() => setHandoffProjectOpen(p)}

                          />

                        );

                      })}

                    </div>

                  </div>

                )}



                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                  {selectedIntern.tasks.map((task) => (

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

            tasks={taskItems}

            onNewAssignment={() => setActiveTab('assignments')}

            onUpdateTaskStatus={handleUpdateTaskStatus}

          />

        )}



        {activeTab === 'assignments' && <AssignmentsTab internId={selectedInternId} />}



        {activeTab === 'attendance' && (

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-6 duration-500">

            <div className="lg:col-span-4 xl:col-span-3 space-y-6">

              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">

                <h3 className="text-lg font-bold text-slate-900 mb-8">{tr('admin_intern_management.time_report_filter')}</h3>

                <div className="space-y-6">

                  <div>

                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('admin_intern_management.date_range')}</label>

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

                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('admin_intern_management.status_filter')}</label>

                    <div className="relative">

                      <select

                        value={pendingFilterStatus}

                        onChange={(e) => setPendingFilterStatus(e.target.value as 'ALL' | 'PRESENT' | 'LATE')}

                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"

                      >

                        <option value="ALL">{tr('admin_intern_management.all_status')}</option>

                        <option value="PRESENT">PRESENT</option>

                        <option value="LATE">LATE</option>

                      </select>

                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />

                    </div>

                  </div>



                  <div>

                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('admin_intern_management.work_mode')}</label>

                    <div className="relative">

                      <select

                        value={pendingFilterWorkMode}

                        onChange={(e) => setPendingFilterWorkMode(e.target.value as 'ALL' | 'WFO' | 'WFH')}

                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"

                      >

                        <option value="ALL">{tr('admin_intern_management.all_mode')}</option>

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

                    <Filter size={16} /> {tr('admin_intern_management.apply_filter')}

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

          <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
            <div className="space-y-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-4">
                {tr('supervisor_dashboard.feedback.select_assessment_period')}
              </div>
              <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit overflow-x-auto scrollbar-hide max-w-full">
                {selectedIntern.feedback.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFeedbackId(f.id)}
                    className={`px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex-shrink-0 ${
                      activeFeedbackId === f.id ? 'bg-[#0B0F19] text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white rounded-[3.5rem] p-10 sm:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Self Evaluation (Intern)' : 'Self Evaluation (Intern)'}</div>
                    <div className="text-2xl font-black text-slate-900 mt-2 truncate">{activeFeedback?.period ?? ''}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {activeFeedback?.submissionDate ?? (isTh ? 'ยังไม่ส่ง' : 'Not submitted')}
                      </div>
                      {activeFeedback?.status === 'reviewed' && (
                        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          {isTh ? 'ตรวจแล้ว' : 'Reviewed'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-stretch gap-3 flex-shrink-0">
                    <div className="px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'คะแนนตัวเอง' : 'Self score'}</div>
                      <div className="mt-2 flex items-end gap-2">
                        <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                          {typeof activeFeedback?.selfPerformance?.overallRating === 'number' ? activeFeedback.selfPerformance.overallRating : 0}
                        </div>
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest pb-1">/100</div>
                      </div>
                    </div>
                    <div className="px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Program' : 'Program'}</div>
                      <div className="mt-2 flex items-end gap-2">
                        <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                          {typeof activeFeedback?.programRating === 'number' ? activeFeedback.programRating : 0}
                        </div>
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest pb-1">/5</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="bg-slate-50/60 border border-slate-100 rounded-[2.75rem] p-8">
                    <div className="flex items-center gap-4 mb-7">
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-blue-600">
                        <BarChart3 size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'ประเมินตัวเอง' : 'Self performance'}</div>
                        <div className="text-base font-black text-slate-900 truncate">{isTh ? 'คะแนนตามหมวด' : 'Category scores'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(
                        [
                          { key: 'TECHNICAL', val: activeFeedback?.selfPerformance?.technical ?? 0, color: 'bg-blue-600' },
                          { key: 'COMMUNICATION', val: activeFeedback?.selfPerformance?.communication ?? 0, color: 'bg-indigo-600' },
                          { key: 'PUNCTUALITY', val: activeFeedback?.selfPerformance?.punctuality ?? 0, color: 'bg-emerald-500' },
                          { key: 'INITIATIVE', val: activeFeedback?.selfPerformance?.initiative ?? 0, color: 'bg-rose-500' },
                        ] as const
                      ).map((m) => (
                        <div key={m.key} className="bg-white border border-slate-100 rounded-[2rem] p-6">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.key}</div>
                            <div className="text-sm font-black text-slate-900">{Number(m.val) || 0}/25</div>
                          </div>
                          <div className="mt-4 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${m.color}`} style={{ width: `${Math.max(0, Math.min(100, ((Number(m.val) || 0) / 25) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#3B49DF] rounded-[2.75rem] p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-36 -mt-36 blur-3xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-[1.5rem] flex items-center justify-center">
                          <StickyNote size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">{isTh ? 'สรุปตัวเอง' : 'Self summary'}</div>
                          <div className="text-lg font-black tracking-tight">{isTh ? 'โน้ตจาก intern' : 'Intern note'}</div>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-indigo-50 italic font-medium whitespace-pre-wrap break-words">{(activeFeedback?.selfSummary ?? '').trim() ? `"${activeFeedback?.selfSummary}"` : `"${isTh ? '—' : '—'}"`}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-700">
                          <MessageSquareMore size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Reflection' : 'Reflection'}</div>
                          <div className="text-base font-black text-slate-900">{isTh ? 'สิ่งที่ได้เรียนรู้' : 'Learning reflection'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.internReflection ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-700">
                          <Star size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Feedback ต่อโปรแกรม' : 'Program feedback'}</div>
                          <div className="text-base font-black text-slate-900">{isTh ? 'ข้อเสนอแนะ' : 'Suggestions'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.internProgramFeedback ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>

                    {(activeFeedback?.videoStoragePath || activeFeedback?.videoUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeFeedback?.videoStoragePath) {
                            handleOpenStoragePath(activeFeedback.videoStoragePath);
                            return;
                          }
                          if (activeFeedback?.videoUrl) window.open(activeFeedback.videoUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.25rem] text-left hover:bg-white hover:border-blue-200 transition-all"
                      >
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'วิดีโอ' : 'Video'}</div>
                        <div className="mt-2 text-sm font-black text-slate-900 truncate">{activeFeedback?.videoFileName ?? (isTh ? 'เปิดวิดีโอ' : 'Open video')}</div>
                        <div className="mt-1 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{isTh ? 'คลิกเพื่อเปิด' : 'Click to open'}</div>
                      </button>
                    )}

                    {Array.isArray(activeFeedback?.attachments) && activeFeedback?.attachments.length > 0 && (
                      <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'ไฟล์แนบ' : 'Attachments'}</div>
                        <div className="mt-5 space-y-2">
                          {activeFeedback.attachments.map((a, idx) => (
                            <button
                              key={`${a.storagePath}-${idx}`}
                              type="button"
                              onClick={() => handleOpenStoragePath(a.storagePath)}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left hover:bg-white hover:border-blue-200 transition-all"
                            >
                              <div className="text-sm font-black text-slate-900 truncate">{a.fileName}</div>
                              <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{isTh ? 'คลิกเพื่อเปิด' : 'Click to open'}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[3.5rem] p-10 sm:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Self Evaluation (Supervisor)' : 'Self Evaluation (Supervisor)'}</div>
                    <div className="text-2xl font-black text-slate-900 mt-2 truncate">{activeFeedback?.period ?? ''}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {activeFeedback?.supervisorReviewedDate ?? (isTh ? 'ยังไม่ประเมิน' : 'Not reviewed')}
                      </div>
                      {typeof activeFeedback?.supervisorMentorshipQualityRating === 'number' && (
                        <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-700">
                          {isTh ? 'Mentorship' : 'Mentorship'}: {activeFeedback.supervisorMentorshipQualityRating}/5
                        </div>
                      )}
                      {typeof activeFeedback?.supervisorProgramSatisfactionRating === 'number' && (
                        <div className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                          {isTh ? 'Satisfaction' : 'Satisfaction'}: {activeFeedback.supervisorProgramSatisfactionRating}/5
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-stretch gap-3 flex-shrink-0">
                    <div className="px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'คะแนนหัวหน้า' : 'Supervisor score'}</div>
                      <div className="mt-2 text-4xl font-black tracking-tighter text-slate-900 leading-none">
                        {typeof activeFeedback?.supervisorScore === 'number' ? activeFeedback.supervisorScore : '—'}
                      </div>
                    </div>
                    <div className="px-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Overall' : 'Overall'}</div>
                      <div className="mt-2 flex items-end gap-2">
                        <div className="text-4xl font-black tracking-tighter text-slate-900 leading-none">
                          {typeof activeFeedback?.supervisorPerformance?.overallRating === 'number' ? activeFeedback.supervisorPerformance.overallRating : 0}
                        </div>
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest pb-1">/100</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="bg-slate-50/60 border border-slate-100 rounded-[2.75rem] p-8">
                    <div className="flex items-center gap-4 mb-7">
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-blue-600">
                        <BarChart3 size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'ประเมินโดยหัวหน้า' : 'Supervisor performance'}</div>
                        <div className="text-base font-black text-slate-900 truncate">{isTh ? 'คะแนนตามหมวด' : 'Category scores'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {(
                        [
                          { key: 'TECHNICAL', val: activeFeedback?.supervisorPerformance?.technical ?? 0, color: 'bg-blue-600' },
                          { key: 'COMMUNICATION', val: activeFeedback?.supervisorPerformance?.communication ?? 0, color: 'bg-indigo-600' },
                          { key: 'PUNCTUALITY', val: activeFeedback?.supervisorPerformance?.punctuality ?? 0, color: 'bg-emerald-500' },
                          { key: 'INITIATIVE', val: activeFeedback?.supervisorPerformance?.initiative ?? 0, color: 'bg-rose-500' },
                        ] as const
                      ).map((m) => (
                        <div key={m.key} className="bg-white border border-slate-100 rounded-[2rem] p-6">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.key}</div>
                            <div className="text-sm font-black text-slate-900">{Number(m.val) || 0}/25</div>
                          </div>
                          <div className="mt-4 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${m.color}`} style={{ width: `${Math.max(0, Math.min(100, ((Number(m.val) || 0) / 25) * 100))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-700">
                          <MessageSquareMore size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'ความคิดเห็นหัวหน้างาน' : 'Supervisor comments'}</div>
                          <div className="text-base font-black text-slate-900">{isTh ? 'ข้อเสนอแนะ' : 'Feedback'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.supervisorComments ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-700">
                          <StickyNote size={20} />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'สรุปหัวหน้างาน' : 'Supervisor summary'}</div>
                          <div className="text-base font-black text-slate-900">{isTh ? 'สรุปภาพรวม' : 'Summary'}</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.supervisorSummary ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Overall Comments' : 'Overall comments'}</div>
                      <div className="mt-4 text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.supervisorOverallComments ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[2.75rem] p-8 shadow-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isTh ? 'Work Performance' : 'Work performance'}</div>
                      <div className="mt-4 text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{(activeFeedback?.supervisorWorkPerformanceComments ?? '').trim() || (isTh ? '—' : '—')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        )}



        {activeTab === 'documents' && <DocumentsTab internId={selectedInternId} />}

      </InternDeepDiveLayout>

    );

  };



  return (

    <div className="h-full w-full bg-slate-50 overflow-hidden flex flex-col">

      {selectedInternId ? (

        renderDeepDive()

      ) : (

        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-hide animate-in fade-in duration-500">

          <div className="max-w-7xl mx-auto w-full">

            <InternListSection

              interns={internListItems}

              searchQuery={searchQuery}

              statusFilter={statusFilter}

              onSearchQueryChange={setSearchQuery}

              onStatusFilterChange={setStatusFilter}

              onOpenAssignIntern={() => navigate(pageIdToPath('HR_ADMIN', 'invitations'))}

              onSelectIntern={(internId) => {

                setSelectedInternId(internId);

                setActiveTab('assets');

                const key = `lastAdminInternViewed_${internId}`;

                localStorage.setItem(key, String(Date.now()));

                setTabVisitTrigger((prev) => prev + 1);

              }}

            />

          </div>

        </div>

      )}

    </div>

  );

};



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



const AssetCard: React.FC<{ fileName: string; date?: string; taskTitle?: string; status?: string; onOpen?: () => void }> = ({

  fileName,

  date,

  taskTitle,

  status,

  onOpen,

}) => {

  const getIcon = () => {

    if (fileName.endsWith('.fig')) return <FileCode size={24} className="text-indigo-50" />;

    if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {

      return <FileImage size={24} className="text-amber-50" />;

    }

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

        <button className="text-slate-300 hover:text-slate-600">

          <MoreHorizontal size={18} />

        </button>

      </div>

      <div className="overflow-hidden mb-6">

        <p className="text-sm font-black text-slate-800 truncate leading-none mb-1.5">{fileName}</p>

        <div className="flex items-center gap-2">

          {date && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{date}</span>}

          {status && (

            <span

              className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${

                status === 'DONE'

                  ? 'bg-emerald-50 text-emerald-600'

                  : status === 'REVISION'

                    ? 'bg-amber-50 text-amber-600'

                    : 'bg-blue-50 text-blue-600'

              }`}

            >

              {status}

            </span>

          )}

        </div>

      </div>

      {taskTitle && (

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">

          <span className="text-[8px] font-bold text-slate-300 uppercase truncate max-w-[120px]">{taskTitle}</span>

        </div>

      )}

    </div>

  );

};



export default InternManagementPage;


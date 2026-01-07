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
  Home
} from 'lucide-react';
import { arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { UserProfile, PerformanceMetrics, Language, SubTask } from '@/types';
import { PageId } from '@/pageTypes';
import InternListSection from '@/pages/supervisor/components/InternListSection';
import InternDeepDiveLayout, { SupervisorDeepDiveTab } from '@/pages/supervisor/components/InternDeepDiveLayout';
import AttendanceTab from '@/pages/supervisor/components/AttendanceTab';
import FeedbackTab, { FeedbackItem } from '@/pages/supervisor/components/FeedbackTab';
import TasksTab from '@/pages/supervisor/components/TasksTab';
import DocumentsTab from '@/pages/supervisor/components/DocumentsTab';
import { firestoreDb, firebaseStorage } from '@/firebase';

interface InternDetail {
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
  programRating?: number;
  submissionDate?: string;
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

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ user, onNavigate, currentTab }) => {
  const [interns, setInterns] = useState<InternDetail[]>([]);
  const [allInterns, setAllInterns] = useState<InternDetail[]>([]);
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<SupervisorDeepDiveTab>('overview');
  const [activeFeedbackId, setActiveFeedbackId] = useState('1m');
  const [tempScore, setTempScore] = useState(0);
  const [tempComment, setTempComment] = useState('');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'LOG' | 'CALENDAR'>('LOG');

  const [editPerformance, setEditPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [editSummary, setEditSummary] = useState('');
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [saveEvaluationError, setSaveEvaluationError] = useState<string | null>(null);
  
  // Modals
  const [isAssigningIntern, setIsAssigningIntern] = useState(false);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const [feedbackByIntern, setFeedbackByIntern] = useState<Record<string, FeedbackItem[]>>({});

  const selectedIntern = interns.find(i => i.id === selectedInternId);
  const activeFeedback = selectedIntern?.feedback.find(f => f.id === activeFeedbackId);

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
    setEditPerformance(selectedIntern.supervisorPerformance);
    setEditSummary(selectedIntern.supervisorSummary ?? '');
    setSaveEvaluationError(null);
  }, [selectedInternId, selectedIntern]);

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
    setIsSavingEvaluation(true);
    setSaveEvaluationError(null);
    try {
      const nextPerf: PerformanceMetrics = {
        technical: clampScore(editPerformance.technical),
        communication: clampScore(editPerformance.communication),
        punctuality: clampScore(editPerformance.punctuality),
        initiative: clampScore(editPerformance.initiative),
        overallRating: computeOverall(editPerformance),
      };

      await updateDoc(doc(firestoreDb, 'users', selectedInternId), {
        supervisorPerformance: nextPerf,
        supervisorSummary: editSummary,
        supervisorEvaluatedAt: serverTimestamp(),
      });

      setInterns((prev) =>
        prev.map((intern) =>
          intern.id === selectedInternId
            ? {
                ...intern,
                supervisorPerformance: nextPerf,
                supervisorSummary: editSummary,
              }
            : intern,
        ),
      );
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
    const allQ = query(collection(firestoreDb, 'users'), where('roles', 'array-contains', 'INTERN'));
    const unsubAll = onSnapshot(allQ, (snap) => {
      setAllInterns(snap.docs.map((d) => mapUserToInternDetail(d.id, d.data())));
    });

    const assignedQ = query(collection(firestoreDb, 'users'), where('supervisorId', '==', user.id));
    const unsubAssigned = onSnapshot(assignedQ, (snap) => {
      setInterns(snap.docs.map((d) => mapUserToInternDetail(d.id, d.data())));
    });

    return () => {
      unsubAll();
      unsubAssigned();
    };
  }, [mapUserToInternDetail, user.id]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    for (const intern of interns) {
      const colRef = collection(firestoreDb, 'users', intern.id, 'feedbackMilestones');
      const unsub = onSnapshot(colRef, (snap) => {
        const items: FeedbackItem[] = snap.docs.map((d) => {
          const data = d.data() as FeedbackMilestoneDoc;
          const label = d.id;
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
          };
        });

        setFeedbackByIntern((prev) => ({ ...prev, [intern.id]: items }));
        setInterns((prev) => prev.map((x) => (x.id === intern.id ? { ...x, feedback: items } : x)));
      });
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [interns]);

  const handleOpenStoragePath = async (path: string) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, path));
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (activeFeedback) {
      setTempScore(activeFeedback.supervisorScore || 0);
      setTempComment(activeFeedback.supervisorComments || '');
    }
  }, [activeFeedbackId, selectedInternId]);

  useEffect(() => {
    if (!selectedInternId) return;
    if (activeTab !== 'feedback') return;
    if (!selectedIntern?.feedback || selectedIntern.feedback.length === 0) return;

    const exists = selectedIntern.feedback.some((f) => f.id === activeFeedbackId);
    if (exists && activeFeedbackId !== '1m') return;

    const preferred = selectedIntern.feedback.find(feedbackHasData) ?? selectedIntern.feedback[0];
    if (preferred && preferred.id !== activeFeedbackId) setActiveFeedbackId(preferred.id);
  }, [activeTab, activeFeedbackId, selectedInternId, selectedIntern?.feedback]);

  useEffect(() => {
    setSelectedInternId(null);
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

  const handleSaveFeedback = async () => {
    if (!selectedInternId || !activeFeedbackId) return;

    const nextScore = Number.isFinite(tempScore) ? tempScore : 0;
    const nextComment = typeof tempComment === 'string' ? tempComment : '';

    setInterns((prev) =>
      prev.map((intern) => {
        if (intern.id !== selectedInternId) return intern;

        return {
          ...intern,
          feedback: intern.feedback.map((f) => {
            if (f.id !== activeFeedbackId) return f;
            return {
              ...f,
              status: 'reviewed',
              supervisorScore: nextScore,
              supervisorComments: nextComment,
            };
          }),
        };
      }),
    );

    try {
      await setDoc(
        doc(firestoreDb, 'users', selectedInternId, 'feedbackMilestones', activeFeedbackId),
        {
          status: 'reviewed',
          supervisorScore: nextScore,
          supervisorComments: nextComment,
          supervisorReviewedAt: serverTimestamp(),
        },
        { merge: true },
      );

      alert('Feedback assessment deployed successfully.');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('Failed to save mentor evaluation', e);
      alert(`Failed to save mentor evaluation: ${e?.code ?? 'unknown'} ${e?.message ?? ''}`);
    }
  };

  const assignableInterns = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    const base = allInterns;
    if (!q) return base;
    return base.filter((i) => i.name.toLowerCase().includes(q) || i.position.toLowerCase().includes(q));
  }, [allInterns, assignSearch]);

  const handleAssignIntern = async (internId: string) => {
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
    setActiveTab('overview');
  };

  const renderDeepDive = () => {
    if (!selectedIntern) return null;

    return (
      <InternDeepDiveLayout
        intern={{
          name: selectedIntern.name,
          avatar: selectedIntern.avatar,
          position: selectedIntern.position,
          internPeriod: selectedIntern.internPeriod,
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => {
          setSelectedInternId(null);
          setActiveTab('overview');
        }}
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
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analysis</h3>
                        </div>
                        <button className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4338CA] transition-all shadow-xl shadow-indigo-100">
                          <StickyNote size={16} /> DOWNLOAD FULL AUDIT
                        </button>
                    </div>
                    <div className="space-y-10">
                        <ProgressRow label="TECHNICAL PROFICIENCY" score={displayPerformance.technical} color="bg-blue-600" />
                        <ProgressRow label="TEAM COMMUNICATION" score={displayPerformance.communication} color="bg-indigo-600" />
                        <ProgressRow label="PUNCTUALITY & RELIABILITY" score={displayPerformance.punctuality} color="bg-emerald-500" />
                        <ProgressRow label="SELF-INITIATIVE" score={displayPerformance.initiative} color="bg-rose-500" />
                    </div>

                    <div className="mt-12 pt-10 border-t border-slate-100 space-y-6">
                      {saveEvaluationError && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
                          {saveEvaluationError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ScoreInput
                          label="TECHNICAL PROFICIENCY"
                          value={editPerformance.technical}
                          onChange={(v) => setEditPerformance((p) => ({ ...p, technical: v }))}
                        />
                        <ScoreInput
                          label="TEAM COMMUNICATION"
                          value={editPerformance.communication}
                          onChange={(v) => setEditPerformance((p) => ({ ...p, communication: v }))}
                        />
                        <ScoreInput
                          label="PUNCTUALITY & RELIABILITY"
                          value={editPerformance.punctuality}
                          onChange={(v) => setEditPerformance((p) => ({ ...p, punctuality: v }))}
                        />
                        <ScoreInput
                          label="SELF-INITIATIVE"
                          value={editPerformance.initiative}
                          onChange={(v) => setEditPerformance((p) => ({ ...p, initiative: v }))}
                        />
                      </div>

                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">EXECUTIVE SUMMARY</div>
                        <textarea
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                          rows={5}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                          placeholder="Write a summary for supervisor review..."
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
                          Reset
                        </button>
                        <button
                          onClick={() => void handleSaveEvaluation()}
                          className="px-8 py-3 rounded-2xl bg-[#111827] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
                          disabled={isSavingEvaluation}
                        >
                          {isSavingEvaluation ? 'Saving...' : 'Save Evaluation'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="xl:col-span-5 bg-[#3B49DF] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <h3 className="text-xl font-black mb-12 tracking-tight relative z-10">Executive Summary</h3>
                    <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
                        <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                          <span className="text-6xl font-black tracking-tighter leading-none">{displayPerformance.overallRating}</span>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">AVG SCORE</span>
                        </div>
                        <p className="text-lg leading-relaxed text-indigo-50 italic font-medium text-center">
                          {displaySummary ? `"${displaySummary}"` : '"Summary placeholder for supervisor review."'}
                        </p>
                    </div>
                  </div>
                </div>
              </div>
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
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Work Assets Vault</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ALL FILES ACROSS ACTIVE & COMPLETED TASKS</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {selectedIntern.tasks.map(task => (
                        <React.Fragment key={task.id}>
                          {task.attachments.map((file, idx) => (
                            <AssetCard key={`${task.id}-${idx}`} fileName={file} date={task.date} taskTitle={task.title} status={task.status} />
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

            {activeTab === 'attendance' && (
              <AttendanceTab
                logs={selectedIntern.attendanceLog}
                viewMode={attendanceViewMode}
                onViewModeChange={setAttendanceViewMode}
              />
            )}

            {activeTab === 'feedback' && (
              <FeedbackTab
                feedback={selectedIntern.feedback}
                activeFeedbackId={activeFeedbackId}
                onSelectFeedback={setActiveFeedbackId}
                activeFeedback={activeFeedback}
                tempScore={tempScore}
                onTempScoreChange={setTempScore}
                tempComment={tempComment}
                onTempCommentChange={setTempComment}
                onSave={handleSaveFeedback}
                onOpenStoragePath={handleOpenStoragePath}
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
                      <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Team Overview</h1>
                      <p className="text-slate-400 text-sm font-medium mt-4 italic">Performance data for the <span className="text-blue-600 font-bold not-italic">Product</span> division.</p>
                    </div>
                    <button 
                      onClick={() => onNavigate('manage-interns')}
                      className="flex items-center gap-3 px-10 py-4 bg-[#0B0F19] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
                    >
                      <Users size={18} strokeWidth={2.5}/> MANAGE FULL ROSTER
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                    <StatBox icon={<Users className="text-blue-600" size={24} />} label="TOTAL INTERNS" value={interns.length.toString().padStart(2, '0')} />
                    <StatBox icon={<Star className="text-amber-500" fill="currentColor" size={24} />} label="AVG PERFORMANCE" value="4.52" />
                    <StatBox icon={<Clock className="text-emerald-500" size={24} />} label="PUNCTUALITY SCORE" value="98%" />
                    <StatBox icon={<CheckCircle2 className="text-indigo-600" size={24} />} label="TASKS APPROVED" value="12" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-8 bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
                       <div className="flex items-center justify-between mb-12">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                                <CircleAlert size={26} />
                             </div>
                             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pending Action Items</h3>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3 ITEMS REQUIRING REVIEW</span>
                       </div>

                       <div className="space-y-4">
                          {interns.filter(i => i.status === 'Review Needed').map(intern => (
                            <div key={intern.id} className="p-6 bg-[#F8FAFC]/60 border border-slate-100 rounded-[2.25rem] flex items-center justify-between group hover:border-blue-200 hover:bg-white hover:shadow-xl transition-all">
                               <div className="flex items-center gap-5">
                                  <img src={intern.avatar} className="w-16 h-16 rounded-[1.5rem] object-cover ring-4 ring-white shadow-sm" alt="" />
                                  <div>
                                    <h4 className="text-lg font-black text-slate-900 leading-tight">{intern.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                       <FileText size={14} className="text-amber-50" />
                                       <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">TASK SUBMISSION PENDING REVIEW</span>
                                    </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-6">
                                  <button onClick={() => { setSelectedInternId(intern.id); setIsAssigningTask(true); }} className="flex items-center gap-2 px-8 py-3 bg-[#EBF3FF] text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                     <Plus size={16} strokeWidth={3}/> Assign Task
                                  </button>
                                  <ChevronRight size={24} className="text-slate-200 group-hover:text-blue-500 transition-colors" />
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                       <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm">
                          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Team Presence</h3>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">WHO IS AWAY TODAY</p>
                          
                          <div className="space-y-6">
                             <div className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                                      <UserX size={20} />
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-slate-900 leading-none">James Wilson</p>
                                      <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-1">SICK LEAVE (UNPAID)</p>
                                   </div>
                                </div>
                             </div>
                             <div className="p-8 bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center text-center">
                                <PlaneTakeoff size={32} className="text-slate-200 mb-3" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">NO UPCOMING LEAVES <br /> SCHEDULED FOR THIS WEEK</p>
                             </div>
                          </div>
                       </div>

                       <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm">
                          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Team Sentiment</h3>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-12">Morale and feedback levels.</p>
                          <div className="flex flex-col items-center">
                             <div className="relative mb-12 flex items-center justify-center">
                                <div className="w-44 h-44 rounded-full border-[18px] border-slate-50 flex items-center justify-center">
                                   <span className="text-5xl font-black text-blue-600 tracking-tighter">88%</span>
                                </div>
                                <div className="absolute inset-0 border-[18px] border-blue-600 rounded-full border-t-transparent border-l-transparent -rotate-45"></div>
                             </div>
                             <p className="text-sm text-slate-500 font-medium italic text-center max-w-[200px] leading-relaxed">
                               "The team currently shows high engagement."
                             </p>
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
                      <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">My Interns</h1>
                      <p className="text-slate-400 text-sm font-medium mt-4 italic">Manage and monitor your assigned interns' performance.</p>
                    </div>
                  </div>
                  <InternListSection
                    interns={filteredInterns}
                    searchQuery={searchQuery}
                    statusFilter={statusFilter}
                    onSearchQueryChange={setSearchQuery}
                    onStatusFilterChange={setStatusFilter}
                    onOpenAssignIntern={() => setIsAssigningIntern(true)}
                    showAssignButton={false}
                    onSelectIntern={setSelectedInternId}
                  />
                </>
              )}
            </div>
          </div>
        );
      };

  return (
    <div className="h-full w-full bg-slate-50 overflow-hidden flex flex-col">
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
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Assign Intern</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">SELECT AN INTERN TO MONITOR</p>
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
                    placeholder="Search interns..."
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
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No interns found</p>
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

const AssetCard: React.FC<{ fileName: string; date?: string; taskTitle?: string; status?: string }> = ({ fileName, date, taskTitle, status }) => {
  const getIcon = () => {
    if (fileName.endsWith('.fig')) return <FileCode size={24} className="text-indigo-50" />;
    if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) return <FileImage size={24} className="text-amber-50" />;
    if (fileName.endsWith('.xlsx')) return <FileSpreadsheet size={24} className="text-emerald-50" />;
    return <FileText size={24} className="text-blue-50" />;
  };

  return (
    <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-[2rem] group hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer">
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

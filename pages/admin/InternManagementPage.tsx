import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileCode, FileImage, FileSpreadsheet, FileText, MoreHorizontal, StickyNote } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';

import { PerformanceMetrics, SubTask } from '@/types';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { pageIdToPath } from '@/app/routeUtils';

import InternListSection from '@/pages/supervisor/components/InternListSection';
import InternDeepDiveLayout, { SupervisorDeepDiveTab } from '@/pages/supervisor/components/InternDeepDiveLayout';
import AttendanceTab, { AttendanceViewMode } from '@/pages/supervisor/components/AttendanceTab';
import FeedbackTab, { FeedbackItem } from '@/pages/supervisor/components/FeedbackTab';
import TasksTab from '@/pages/supervisor/components/TasksTab';
import DocumentsTab from '@/pages/supervisor/components/DocumentsTab';

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

const InternManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [interns, setInterns] = useState<AdminInternDetail[]>([]);
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SupervisorDeepDiveTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFeedbackId, setActiveFeedbackId] = useState('1m');
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('LOG');

  const [activeEvalSource, setActiveEvalSource] = useState<'SELF' | 'SUPERVISOR'>('SELF');

  const [feedbackByIntern, setFeedbackByIntern] = useState<Record<string, FeedbackItem[]>>({});

  const selectedIntern = interns.find((i) => i.id === selectedInternId);
  const activeFeedback = selectedIntern?.feedback.find((f) => f.id === activeFeedbackId);

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
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as {
          name?: string;
          avatar?: string;
          position?: string;
          internPeriod?: string;
          department?: string;
          email?: string;
          lifecycleStatus?: string;
          performance?: Partial<PerformanceMetrics>;
          adminSummary?: string;
          selfPerformance?: Partial<PerformanceMetrics>;
          selfSummary?: string;
          supervisorPerformance?: Partial<PerformanceMetrics>;
          supervisorSummary?: string;
        };

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
          avatar: data.avatar || `https://picsum.photos/seed/${encodeURIComponent(d.id)}/100/100`,
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
    });
  }, []);

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
    if (!selectedInternId) return;
    if (activeTab !== 'feedback') return;
    if (!selectedIntern?.feedback || selectedIntern.feedback.length === 0) return;

    const exists = selectedIntern.feedback.some((f) => f.id === activeFeedbackId);
    if (exists && activeFeedbackId !== '1m') return;

    const preferred = selectedIntern.feedback.find(feedbackHasData) ?? selectedIntern.feedback[0];
    if (preferred && preferred.id !== activeFeedbackId) setActiveFeedbackId(preferred.id);
  }, [activeTab, activeFeedbackId, selectedInternId, selectedIntern?.feedback]);

  const renderDeepDive = () => {
    if (!selectedIntern) return null;

    const showTabs = selectedInternId && activeTab === 'overview';

    const taskItems = selectedIntern.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      date: t.date,
      attachments: t.attachments,
    }));

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
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analysis</h3>
                      {showTabs && (
                        <div className="mt-3 inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                          <button
                            onClick={() => setActiveEvalSource('SELF')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              activeEvalSource === 'SELF'
                                ? 'bg-white text-blue-600 shadow-md'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Intern
                          </button>
                          <button
                            onClick={() => setActiveEvalSource('SUPERVISOR')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              activeEvalSource === 'SUPERVISOR'
                                ? 'bg-white text-indigo-600 shadow-md'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            Supervisor
                          </button>
                        </div>
                      )}
                    </div>
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
                    {displaySummary ? `"${displaySummary}"` : '"No summary submitted."'}
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
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Work Assets Vault</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ALL FILES ACROSS ACTIVE & COMPLETED TASKS</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide px-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {selectedIntern.tasks.map((task) => (
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
            tasks={taskItems}
            onNewAssignment={() => alert('New Assignment (admin) - TODO')}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTab logs={selectedIntern.attendanceLog} viewMode={attendanceViewMode} onViewModeChange={setAttendanceViewMode} />
        )}

        {activeTab === 'feedback' && (
          <FeedbackTab
            feedback={selectedIntern.feedback}
            activeFeedbackId={activeFeedbackId}
            onSelectFeedback={setActiveFeedbackId}
            activeFeedback={activeFeedback}
            onOpenStoragePath={handleOpenStoragePath}
          />
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
              interns={filteredInterns}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onSearchQueryChange={setSearchQuery}
              onStatusFilterChange={setStatusFilter}
              onOpenAssignIntern={() => navigate(pageIdToPath('HR_ADMIN', 'invitations'))}
              onSelectIntern={(internId) => {
                setSelectedInternId(internId);
                setActiveTab('overview');
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

const AssetCard: React.FC<{ fileName: string; date?: string; taskTitle?: string; status?: string }> = ({
  fileName,
  date,
  taskTitle,
  status,
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
    <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-[2rem] group hover:bg-white hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer">
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

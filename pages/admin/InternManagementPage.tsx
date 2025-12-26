import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileCode, FileImage, FileSpreadsheet, FileText, MoreHorizontal, StickyNote } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

import { PerformanceMetrics, SubTask } from '@/types';
import { firestoreDb } from '@/firebase';
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
  status: 'Active' | 'Review Needed' | 'On Break';
  attendance: string;
  department: string;
  email: string;
  tasks: SubTask[];
  feedback: FeedbackItem[];
  performance: PerformanceMetrics;
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
  const [tempScore, setTempScore] = useState(0);
  const [tempComment, setTempComment] = useState('');
  const [attendanceViewMode, setAttendanceViewMode] = useState<AttendanceViewMode>('LOG');

  const selectedIntern = interns.find((i) => i.id === selectedInternId);
  const activeFeedback = selectedIntern?.feedback.find((f) => f.id === activeFeedbackId);

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
          status: 'Active',
          attendance: '—',
          performance: DEFAULT_PERFORMANCE,
          tasks: [],
          feedback: [],
          attendanceLog: [],
        } satisfies AdminInternDetail;
      });
      setInterns(list);
    });
  }, []);

  useEffect(() => {
    if (activeFeedback) {
      setTempScore(activeFeedback.supervisorScore || 0);
      setTempComment(activeFeedback.supervisorComments || '');
    }
  }, [activeFeedback, activeFeedbackId, selectedInternId]);

  const filteredInterns = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return interns.filter(
      (i) => i.name.toLowerCase().includes(q) || i.position.toLowerCase().includes(q),
    );
  }, [interns, searchQuery]);

  const handleUpdateTaskStatus = (taskId: string, status: 'DONE' | 'REVISION') => {
    if (!selectedInternId) return;
    setInterns((prev) =>
      prev.map((intern) => {
        if (intern.id !== selectedInternId) return intern;
        return {
          ...intern,
          tasks: intern.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        };
      }),
    );
  };

  const handleSaveFeedback = () => {
    if (!selectedInternId || !activeFeedbackId) return;
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
              supervisorScore: tempScore,
              supervisorComments: tempComment,
            };
          }),
        };
      }),
    );
    alert('Feedback assessment deployed successfully.');
  };

  const renderDeepDive = () => {
    if (!selectedIntern) return null;

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
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Performance Analysis</h3>
                  </div>
                  <button className="flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#4338CA] transition-all shadow-xl shadow-indigo-100">
                    <StickyNote size={16} /> DOWNLOAD FULL AUDIT
                  </button>
                </div>
                <div className="space-y-10">
                  <ProgressRow label="TECHNICAL PROFICIENCY" score={selectedIntern.performance.technical} color="bg-blue-600" />
                  <ProgressRow label="TEAM COMMUNICATION" score={selectedIntern.performance.communication} color="bg-indigo-600" />
                  <ProgressRow label="PUNCTUALITY & RELIABILITY" score={selectedIntern.performance.punctuality} color="bg-emerald-500" />
                  <ProgressRow label="SELF-INITIATIVE" score={selectedIntern.performance.initiative} color="bg-rose-500" />
                </div>
              </div>
              <div className="xl:col-span-5 bg-[#3B49DF] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <h3 className="text-xl font-black mb-12 tracking-tight relative z-10">Executive Summary</h3>
                <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
                  <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                    <span className="text-6xl font-black tracking-tighter leading-none">{selectedIntern.performance.overallRating}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">AVG SCORE</span>
                  </div>
                  <p className="text-lg leading-relaxed text-indigo-50 italic font-medium text-center">
                    "Summary placeholder for admin review."
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
            onUpdateTaskStatus={handleUpdateTaskStatus}
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
            tempScore={tempScore}
            onTempScoreChange={setTempScore}
            tempComment={tempComment}
            onTempCommentChange={setTempComment}
            onSave={handleSaveFeedback}
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
              onSearchQueryChange={setSearchQuery}
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

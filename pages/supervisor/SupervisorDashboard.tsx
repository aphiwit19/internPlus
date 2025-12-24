import React, { useState, useEffect, useRef } from 'react';
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
import { UserProfile, PerformanceMetrics, Language, SubTask } from '@/types';
import InternListSection from '@/roles/supervisor/components/InternListSection';
import InternDeepDiveLayout, { SupervisorDeepDiveTab } from '@/roles/supervisor/components/InternDeepDiveLayout';
import AttendanceTab from '@/roles/supervisor/components/AttendanceTab';
import FeedbackTab from '@/roles/supervisor/components/FeedbackTab';
import TasksTab from '@/roles/supervisor/components/TasksTab';

interface InternDetail {
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
  feedback: any[];
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

const INITIAL_INTERNS: InternDetail[] = [
  { 
    id: 'u-1', 
    name: 'Alex Rivera', 
    position: 'Junior UI/UX Designer', 
    internPeriod: 'JAN 2024 - JUN 2024',
    progress: 65, 
    status: 'Review Needed', 
    attendance: 'Clocked In', 
    department: 'Design',
    email: 'alex.r@internplus.io',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
    performance: { technical: 88, communication: 92, punctuality: 85, initiative: 95, overallRating: 4.5 },
    tasks: [
      { 
        id: 't-1', 
        title: 'User Flow Mapping', 
        type: 'SINGLE',
        status: 'DONE', 
        date: '2024-11-18',
        timeRange: '09:00 - 12:30',
        attachments: ['Auth_Flows_v1.pdf', 'Edge_Cases.png'],
        plannedStart: '2024-11-18T09:00:00Z',
        plannedEnd: '2024-11-18T12:30:00Z',
        timeLogs: [],
        isSessionActive: false
      },
      {
        id: 't-2',
        title: 'Component Library Audit',
        type: 'CONTINUE',
        status: 'IN_PROGRESS', 
        date: '2024-11-15',
        timeRange: '13:00 - 17:00',
        attachments: ['Audit_Initial.xlsx', 'Component_Specs.fig'],
        plannedStart: '2024-11-15T13:00:00Z',
        plannedEnd: '2024-11-15T17:00:00Z',
        timeLogs: [],
        isSessionActive: false
      }
    ],
    feedback: [
      { id: '1w', label: 'Week 1', period: 'Onboarding & Foundations', status: 'reviewed', internReflection: "The first week was great.", internProgramFeedback: "Documentation was clear.", videoUrl: "v1.mp4", supervisorScore: 92, programRating: 5, supervisorComments: "Exceptional adaptability." },
      { id: '1m', label: 'Month 1', period: 'Skill Deep-Dive', status: 'submitted', internReflection: "Completed user authentication module.", internProgramFeedback: "Need more 1-on-1 time.", videoUrl: "v2.mp4", supervisorScore: 0, programRating: 4, supervisorComments: "" },
      { id: 'exit', label: 'Exit Interview', period: 'Final Program Wrap-up', status: 'pending', internReflection: "", internProgramFeedback: "", supervisorScore: 0, programRating: 0, supervisorComments: "" }
    ],
    attendanceLog: [
      { id: 'a1', date: '2024-11-20', clockIn: '08:45', clockOut: '18:15', mode: 'WFO', status: 'PRESENT', duration: '9h 30m' },
      { id: 'a2', date: '2024-11-19', clockIn: '09:15', clockOut: '18:00', mode: 'WFH', status: 'LATE', duration: '8h 45m' },
      { id: 'a3', date: '2024-11-18', clockIn: '08:55', clockOut: '17:30', mode: 'WFO', status: 'PRESENT', duration: '8h 35m' },
      { id: 'a4', date: '2024-11-15', clockIn: '08:50', clockOut: '18:00', mode: 'WFO', status: 'PRESENT', duration: '9h 10m' },
      { id: 'a5', date: '2024-11-14', clockIn: '08:58', clockOut: '18:05', mode: 'WFO', status: 'PRESENT', duration: '9h 07m' },
      { id: 'a6', date: '2024-11-13', clockIn: '09:10', clockOut: '18:00', mode: 'WFH', status: 'LATE', duration: '8h 50m' },
    ]
  },
  { 
    id: 'i-2', 
    name: 'James Wilson', 
    position: 'Backend Developer Intern', 
    internPeriod: 'FEB 2024 - JUL 2024',
    progress: 42, 
    status: 'Active', 
    attendance: 'Clocked Out', 
    department: 'DevOps',
    email: 'james.w@internplus.io',
    avatar: 'https://picsum.photos/seed/james/100/100',
    performance: { technical: 95, communication: 75, punctuality: 98, initiative: 80, overallRating: 4.2 },
    tasks: [],
    feedback: [],
    attendanceLog: []
  },
];

interface SupervisorDashboardProps {
  user: UserProfile;
  onNavigate: (page: string) => void;
  currentTab: string;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ user, onNavigate, currentTab }) => {
  const [interns, setInterns] = useState<InternDetail[]>(INITIAL_INTERNS);
  const [selectedInternId, setSelectedInternId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SupervisorDeepDiveTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFeedbackId, setActiveFeedbackId] = useState('1m');
  const [tempScore, setTempScore] = useState(0);
  const [tempComment, setTempComment] = useState('');
  const [attendanceViewMode, setAttendanceViewMode] = useState<'LOG' | 'CALENDAR'>('LOG');
  
  // Modals
  const [isAssigningIntern, setIsAssigningIntern] = useState(false);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const selectedIntern = interns.find(i => i.id === selectedInternId);
  const activeFeedback = selectedIntern?.feedback.find(f => f.id === activeFeedbackId);

  useEffect(() => {
    if (activeFeedback) {
      setTempScore(activeFeedback.supervisorScore || 0);
      setTempComment(activeFeedback.supervisorComments || '');
    }
  }, [activeFeedbackId, selectedInternId]);

  useEffect(() => {
    setSelectedInternId(null);
  }, [currentTab]);

  const filteredInterns = interns.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleSaveFeedback = () => {
    if (!selectedInternId || !activeFeedbackId) return;
    setInterns(prev => prev.map(intern => {
      if (intern.id !== selectedInternId) return intern;
      return {
        ...intern,
        feedback: intern.feedback.map(f => {
          if (f.id !== activeFeedbackId) return f;
          return {
            ...f,
            status: 'reviewed',
            supervisorScore: tempScore,
            supervisorComments: tempComment
          };
        })
      };
    }));
    alert('Feedback assessment deployed successfully.');
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
                          "Exhibits advanced understanding of design systems. Consistently delivers pixel-perfect layouts ahead of schedule."
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-12 relative z-10">
                        <button className="py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">ADD NOTE</button>
                        <button className="py-4 bg-white text-[#3B49DF] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl shadow-black/10">SAVE SUMMARY</button>
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
              />
            )}
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
              <InternListSection
                interns={filteredInterns}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onOpenAssignIntern={() => setIsAssigningIntern(true)}
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

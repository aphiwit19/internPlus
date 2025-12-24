import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  Award, 
  CreditCard, 
  Search, 
  ChevronRight, 
  Filter, 
  FileCheck, 
  Clock, 
  ArrowUpRight, 
  Building2, 
  Home, 
  X, 
  PenTool, 
  Eraser, 
  Stamp,
  Plus,
  Sparkles,
  CalendarCheck,
  Banknote,
  Users,
  UserPlus,
  UserCheck,
  MoreVertical,
  Briefcase,
  UserX,
  Info,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';

import { AdminTab } from './components/AdminDashboardTabs';
import AllowancesTab from './components/AllowancesTab';
import AttendanceTab from './components/AttendanceTab';
import AbsencesTab from './components/AbsencesTab';
import CertificatesTab from './components/CertificatesTab';
import RosterTab from './components/RosterTab';
import { AllowanceClaim, CertRequest, InternRecord, Mentor } from './adminDashboardTypes';

const MOCK_MENTORS: Mentor[] = [
  { id: 'm-1', name: 'Sarah Connor', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop', dept: 'Design' },
  { id: 'm-2', name: 'Marcus Miller', avatar: 'https://picsum.photos/seed/marcus/100/100', dept: 'Engineering' },
  { id: 'm-3', name: 'Emma Watson', avatar: 'https://picsum.photos/seed/emma/100/100', dept: 'Product' },
];

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('roster');

  // Modal States
  const [signingCert, setSigningCert] = useState<CertRequest | null>(null);
  const [assigningIntern, setAssigningIntern] = useState<InternRecord | null>(null);
  
  // Signature States
  const [hasSigned, setHasSigned] = useState(false);
  const [isStampApplied, setIsStampApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock Data
  const [certRequests, setCertRequests] = useState<CertRequest[]>([
    { id: 'cr-1', internName: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', type: 'Completion', date: 'Nov 18, 2024', status: 'ISSUED' },
    { id: 'cr-2', internName: 'James Wilson', avatar: 'https://picsum.photos/seed/james/100/100', type: 'Recommendation', date: 'Nov 17, 2024', status: 'PENDING' },
  ]);

  const [allowanceClaims, setAllowanceClaims] = useState<AllowanceClaim[]>([
    { id: 'ac-1', internName: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', amount: 1250, period: 'Oct 2024', breakdown: { wfo: 10, wfh: 5, leaves: 1 }, status: 'PENDING' },
    { id: 'ac-3', internName: 'Sophia Chen', avatar: 'https://picsum.photos/seed/sophia/100/100', amount: 1500, period: 'Oct 2024', breakdown: { wfo: 15, wfh: 0, leaves: 0 }, status: 'PAID', paymentDate: 'Nov 01, 2024' },
  ]);

  const [internRoster, setInternRoster] = useState<InternRecord[]>([
    { id: 'u-1', name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', position: 'Junior UI/UX Designer', dept: 'Design', status: 'Active', supervisor: MOCK_MENTORS[0] },
    { id: 'u-2', name: 'James Wilson', avatar: 'https://picsum.photos/seed/james/100/100', position: 'Backend Developer Intern', dept: 'Engineering', status: 'Active', supervisor: MOCK_MENTORS[1] },
    { id: 'u-3', name: 'Sophia Chen', avatar: 'https://picsum.photos/seed/sophia/100/100', position: 'Product Manager Intern', dept: 'Product', status: 'Active', supervisor: null },
    { id: 'u-4', name: 'Marcus Aurelius', avatar: 'https://picsum.photos/seed/marcus/100/100', position: 'Data Analyst Trainee', dept: 'Engineering', status: 'Onboarding', supervisor: null },
  ]);

  const handleAssignMentor = (mentor: Mentor) => {
    if (!assigningIntern) return;
    setInternRoster(prev => prev.map(intern => 
      intern.id === assigningIntern.id ? { ...intern, supervisor: mentor } : intern
    ));
    setAssigningIntern(null);
  };

  const handleAuthorizeAllowance = (id: string) => {
    setAllowanceClaims(prev => prev.map(a => a.id === id ? { ...a, status: 'APPROVED' } : a));
  };

  const handleProcessPayment = (id: string) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    setAllowanceClaims(prev => prev.map(a => a.id === id ? { ...a, status: 'PAID', paymentDate: today } : a));
  };

  // --- SIGNING LOGIC ---
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
    ctx.strokeStyle = '#0f172a'; 
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

  const handleFinalApprove = () => {
    if (!signingCert || !hasSigned || !isStampApplied) return;
    setIsProcessing(true);
    setTimeout(() => {
      setCertRequests(prev => prev.map(c => c.id === signingCert.id ? { ...c, status: 'ISSUED' } : c));
      setIsProcessing(false);
      setSigningCert(null);
      setHasSigned(false);
      setIsStampApplied(false);
    }, 2000);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        
        {/* Global Admin Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">HR Command Center</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">Global oversight for roster, absences, and payouts.</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
             <TabBtn active={activeTab === 'roster'} onClick={() => setActiveTab('roster')} icon={<Users size={16}/>} label="Roster" />
             <TabBtn active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={16}/>} label="Attendance" />
             <TabBtn active={activeTab === 'absences'} onClick={() => setActiveTab('absences')} icon={<UserX size={16}/>} label="Absences" />
             <TabBtn active={activeTab === 'certificates'} onClick={() => setActiveTab('certificates')} icon={<Award size={16}/>} label="Certs" />
             <TabBtn active={activeTab === 'allowances'} onClick={() => setActiveTab('allowances')} icon={<CreditCard size={16}/>} label="Payouts" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          
          {/* TAB: INTERN ROSTER */}
         {activeTab === 'roster' && (
           <RosterTab
             internRoster={internRoster}
             onAssignSupervisor={(intern) => setAssigningIntern(intern)}
           />
         )}

          {/* TAB: GLOBAL ATTENDANCE (NEW) */}
         {activeTab === 'attendance' && <AttendanceTab />}

          {/* TAB: ABSENCE MONITOR */}
         {activeTab === 'absences' && <AbsencesTab />}

          {/* TAB: CERTIFICATE REQUESTS */}
         {activeTab === 'certificates' && (
           <CertificatesTab
             certRequests={certRequests}
             onSelectForSigning={(req) => setSigningCert(req)}
           />
         )}

          {/* TAB: ALLOWANCE PAYOUTS */}
         {activeTab === 'allowances' && (
           <AllowancesTab
             allowanceClaims={allowanceClaims}
             onAuthorize={handleAuthorizeAllowance}
             onProcessPayment={handleProcessPayment}
           />
         )}

        </div>
      </div>

      {/* --- MODAL: ASSIGN SUPERVISOR --- */}
      {assigningIntern && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Select Primary Mentor</h3>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Assigning mentor for {assigningIntern.name}</p>
                </div>
                <button onClick={() => setAssigningIntern(null)} className="text-slate-300 hover:text-slate-900"><X size={28}/></button>
              </div>

              <div className="space-y-3">
                 {MOCK_MENTORS.map(mentor => (
                   <button 
                     key={mentor.id}
                     onClick={() => handleAssignMentor(mentor)}
                     className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-blue-600 hover:bg-blue-50/30 transition-all group"
                   >
                      <div className="flex items-center gap-4">
                        <img src={mentor.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm" alt=""/>
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-900 group-hover:text-blue-600">{mentor.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mentor.dept} Team Lead</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ChevronRight size={18}/>
                      </div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL: APPROVE & SIGN --- */}
      {signingCert && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 relative">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-100">
                      <Award size={32} />
                   </div>
                   <div>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Final Authorization</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Document Certification for {signingCert.internName}</p>
                   </div>
                </div>
                <button onClick={() => { setSigningCert(null); setIsStampApplied(false); setHasSigned(false); }} className="p-4 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={32} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 p-10 overflow-y-auto scrollbar-hide">
                 <div className="space-y-6">
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Official Signature</h4>
                       <div className="aspect-[4/3] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] relative overflow-hidden group">
                          <canvas ref={canvasRef} width={600} height={450} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                          {!hasSigned && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
                              <PenTool size={48} className="text-slate-400 mb-4" />
                              <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Sign by hand</span>
                            </div>
                          )}
                          {hasSigned && (
                            <button onClick={clearSignature} className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-md rounded-xl text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                              <Eraser size={24} />
                            </button>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-10">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Protocol</h4>
                       <div 
                         onClick={() => setIsStampApplied(!isStampApplied)}
                         className={`p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-500 ${
                           isStampApplied ? 'bg-emerald-50 border-emerald-500 text-emerald-600 scale-[1.02] shadow-xl' : 'bg-slate-50 border-slate-200 text-slate-300 hover:border-blue-300'
                         }`}
                       >
                          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-transform duration-700 ${isStampApplied ? 'rotate-12 border-emerald-500' : 'border-slate-200'}`}>
                             <Stamp size={48} fill={isStampApplied ? 'currentColor' : 'none'} />
                          </div>
                       </div>
                    </div>
                    <button onClick={handleFinalApprove} disabled={!hasSigned || !isStampApplied || isProcessing} className="w-full py-6 bg-[#111827] text-white rounded-full font-black text-lg tracking-tight hover:bg-blue-600 transition-all shadow-2xl disabled:opacity-30 flex items-center justify-center gap-3">
                       {isProcessing ? <><Clock className="animate-spin" size={24} /> GENERATING...</> : <><FileCheck size={24} /> ISSUE CERTIFICATE</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
    {icon} {label}
  </button>
);

export default AdminDashboard;


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

type AdminTab = 'certificates' | 'allowances' | 'roster' | 'absences' | 'attendance';

interface CertRequest {
  id: string;
  internName: string;
  avatar: string;
  type: 'Completion' | 'Recommendation';
  date: string;
  status: 'PENDING' | 'ISSUED';
}

interface AllowanceClaim {
  id: string;
  internName: string;
  avatar: string;
  amount: number;
  period: string;
  breakdown: { wfo: number; wfh: number; leaves: number };
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paymentDate?: string;
}

interface InternRecord {
  id: string;
  name: string;
  avatar: string;
  position: string;
  dept: string;
  status: 'Active' | 'Onboarding' | 'Completed';
  supervisor: {
    name: string;
    avatar: string;
    id: string;
  } | null;
}

interface Mentor {
  id: string;
  name: string;
  avatar: string;
  dept: string;
}

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
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-10">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Program Roster</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Active: {internRoster.filter(i => i.status === 'Active').length}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-slate-50">
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">Intern Identity</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Department</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Supervisor</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Program Status</th>
                          <th className="pb-6 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {internRoster.map(intern => (
                          <tr key={intern.id} className="group hover:bg-slate-50/50 transition-all">
                            <td className="py-6 pl-4">
                              <div className="flex items-center gap-4">
                                <img src={intern.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100" alt="" />
                                <div>
                                  <p className="text-sm font-black text-slate-900 leading-none mb-1">{intern.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{intern.position}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-6">
                               <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{intern.dept}</span>
                            </td>
                            <td className="py-6">
                               {intern.supervisor ? (
                                 <div className="flex items-center gap-3">
                                   <img src={intern.supervisor.avatar} className="w-8 h-8 rounded-lg object-cover" alt=""/>
                                   <span className="text-xs font-bold text-slate-700">{intern.supervisor.name}</span>
                                 </div>
                               ) : (
                                 <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><X size={12}/> Unassigned</span>
                               )}
                            </td>
                            <td className="py-6">
                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-colors ${
                                 intern.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                 intern.status === 'Onboarding' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                 'bg-slate-50 text-slate-400 border-slate-100'
                               }`}>{intern.status}</span>
                            </td>
                            <td className="py-6 text-right pr-4">
                               <button onClick={() => setAssigningIntern(intern)} className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-95" title="Re-assign Mentor">
                                 <UserPlus size={18} />
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </section>
            </div>
          )}

          {/* TAB: GLOBAL ATTENDANCE (NEW) */}
          {activeTab === 'attendance' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Program Attendance Audit</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verification of daily work sessions</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                       <thead>
                         <tr className="text-left border-b border-slate-50">
                           <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">Intern</th>
                           <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Latest Date</th>
                           <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock In</th>
                           <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock Out</th>
                           <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Mode</th>
                           <th className="pb-6 text-right pr-4 text-[10px] font-black text-slate-400 uppercase">Status</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                         {/* Mock Global Log */}
                         {[
                           { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', date: '2024-11-20', in: '08:45', out: '18:15', mode: 'WFO', status: 'PRESENT' },
                           { name: 'James Wilson', avatar: 'https://picsum.photos/seed/james/100/100', date: '2024-11-19', in: '09:05', out: '18:00', mode: 'WFO', status: 'PRESENT' },
                           { name: 'Sophia Chen', avatar: 'https://picsum.photos/seed/sophia/100/100', date: '2024-11-20', in: '09:25', out: '--', mode: 'WFH', status: 'PRESENT' }
                         ].map((log, idx) => (
                           <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                              <td className="py-6 pl-4">
                                 <div className="flex items-center gap-4">
                                    <img src={log.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                                    <span className="text-sm font-black text-slate-900">{log.name}</span>
                                 </div>
                              </td>
                              <td className="py-6 text-sm font-bold text-slate-600">{log.date}</td>
                              <td className="py-6 text-sm font-bold text-slate-600">{log.in}</td>
                              <td className="py-6 text-sm font-bold text-slate-600">{log.out}</td>
                              <td className="py-6">
                                 <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[9px] font-black uppercase ${log.mode === 'WFO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {log.mode === 'WFO' ? <Building2 size={12}/> : <Home size={12}/>} {log.mode}
                                 </div>
                              </td>
                              <td className="py-6 text-right pr-4">
                                 <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-50 text-emerald-600">{log.status}</span>
                              </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
               </section>
            </div>
          )}

          {/* TAB: ABSENCE MONITOR */}
          {activeTab === 'absences' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-12">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Absence & Leave Audit</h3>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cross-reference for unpaid leave payroll adjustments</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] flex items-center justify-between group hover:shadow-xl transition-all">
                        <div className="flex items-center gap-6">
                           <div className="relative">
                              <img src="https://picsum.photos/seed/james/100/100" className="w-16 h-16 rounded-[1.25rem] object-cover ring-4 ring-white" alt="" />
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full border-2 border-white flex items-center justify-center">
                                 <UserX size={12} strokeWidth={3} />
                              </div>
                           </div>
                           <div>
                              <h4 className="text-xl font-black text-slate-900">James Wilson</h4>
                              <div className="flex items-center gap-2 mt-2">
                                 <span className="bg-rose-100 text-rose-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">SICK LEAVE</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">NOV 10, 2024</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-10">
                           <div className="text-center">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">STIPEND IMPACT</p>
                              <p className="text-lg font-black text-rose-600">-100 THB</p>
                           </div>
                           <div className="bg-white px-6 py-3 rounded-2xl border border-rose-100 flex items-center gap-3">
                              <CheckCircle2 size={20} className="text-emerald-500" />
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">LOGGED FOR PAYROLL</span>
                           </div>
                        </div>
                     </div>
                  </div>
               </section>
            </div>
          )}

          {/* TAB: CERTIFICATE REQUESTS */}
          {activeTab === 'certificates' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-12">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Certificate Issuance Queue</h3>
                  </div>
                  <div className="space-y-6">
                    {certRequests.map(req => (
                      <div key={req.id} className={`p-8 rounded-[2.5rem] border flex items-center justify-between transition-all ${req.status === 'ISSUED' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 shadow-md hover:border-blue-200 group'}`}>
                        <div className="flex items-center gap-6">
                          <img src={req.avatar} className="w-16 h-16 rounded-[1.25rem] object-cover ring-4 ring-slate-50" alt="" />
                          <div>
                            <h4 className="text-xl font-black text-slate-900 leading-none">{req.internName}</h4>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Requested {req.date}</p>
                          </div>
                        </div>
                        <div className="flex-1 flex justify-center">
                           <div className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${req.type === 'Completion' ? 'bg-[#F0F7FF] text-[#0066FF] border-[#D0E7FF]' : 'bg-[#F0F4FF] text-[#4F46E5] border-[#E0E7FF]'}`}>
                             {req.type} Document
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {req.status === 'PENDING' ? (
                            <button onClick={() => setSigningCert(req)} className="px-8 py-4 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl">
                              <ShieldCheck size={18}/> APPROVE & SIGN
                            </button>
                          ) : (
                            <div className="flex items-center gap-3 text-emerald-600 font-black text-xs uppercase tracking-widest bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100">
                              <FileCheck size={20}/> DOCUMENT ISSUED
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          {/* TAB: ALLOWANCE PAYOUTS */}
          {activeTab === 'allowances' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Allowance Disbursement</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-slate-50">
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Intern Identity</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Mix</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Amount</th>
                          <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          <th className="pb-6 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {allowanceClaims.map(claim => (
                          <tr key={claim.id} className="group hover:bg-slate-50/50 transition-all">
                            <td className="py-6 pl-4">
                              <div className="flex items-center gap-4">
                                <img src={claim.avatar} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                <span className="text-sm font-black text-slate-900">{claim.internName}</span>
                              </div>
                            </td>
                            <td className="py-6">
                               <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black" title="Office Days"><Building2 size={10}/> {claim.breakdown.wfo}</div>
                                  <div className="flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[9px] font-black" title="Remote Days"><Home size={10}/> {claim.breakdown.wfh}</div>
                                  {claim.breakdown.leaves > 0 && (
                                    <div className="flex items-center gap-1 bg-rose-50 text-rose-500 px-2 py-1 rounded-lg text-[9px] font-black" title="Unpaid Leave Days"><UserX size={10}/> {claim.breakdown.leaves}</div>
                                  )}
                               </div>
                            </td>
                            <td className="py-6">
                               <span className="text-sm font-black text-slate-900">{claim.amount.toLocaleString()} THB</span>
                            </td>
                            <td className="py-6">
                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${
                                 claim.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                 claim.status === 'APPROVED' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                               }`}>{claim.status}</span>
                            </td>
                            <td className="py-6 text-right pr-4">
                               {claim.status === 'PENDING' ? (
                                 <button onClick={() => handleAuthorizeAllowance(claim.id)} className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto">
                                   <ShieldCheck size={14} /> Authorize
                                 </button>
                               ) : claim.status === 'APPROVED' ? (
                                 <button onClick={() => handleProcessPayment(claim.id)} className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto">
                                   <Banknote size={14} /> Process Payout
                                 </button>
                               ) : (
                                 <div className="flex justify-end pr-2"><ArrowUpRight size={18} className="text-slate-300"/></div>
                               )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
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

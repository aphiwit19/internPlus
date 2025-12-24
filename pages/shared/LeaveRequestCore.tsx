
import React, { useState } from 'react';
import { 
  CalendarDays, 
  Plus, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Info,
  Calendar,
  Filter,
  Check,
  X,
  TrendingDown,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { Language, UserRole, LeaveRequest, LeaveType } from '@/types';

interface LeaveRequestCoreProps {
  lang: Language;
  role: UserRole;
  headerTitle?: string;
  headerSubtitle?: string;
  protocolTitle?: string;
  protocolSubtitle?: string;
}

const LeaveRequestCore: React.FC<LeaveRequestCoreProps> = ({
  lang,
  role,
  headerTitle,
  headerSubtitle,
  protocolTitle,
  protocolSubtitle,
}) => {
  const isIntern = role === 'INTERN';

  const t = {
    EN: {
      title: "Leave Management",
      subtitle: "Request time off and track your remaining leave balance.",
      requestTitle: "Request Leave",
      requestSub: "Fill in details for your absence request.",
      quotaTitle: "Leave Quota",
      quotaSub: "Your remaining leave balance for this cohort.",
      historyTitle: "Incoming Requests",
      historySub: "REVIEW AND ACTION PENDING LEAVES.",
      leaveType: "Leave Type",
      startDate: "Start Date",
      endDate: "End Date",
      reason: "Reason for Absence",
      submit: "Submit Request",
      pending: "PENDING",
      approved: "APPROVED",
      rejected: "REJECTED",
      sick: "Sick Leave",
      personal: "Personal Leave",
      business: "Business Leave",
      vacation: "Vacation",
      total: "Total",
      used: "Used",
      left: "Left",
      days: "Days",
      approve: "APPROVE",
      reject: "REJECT",
      impactTitle: "Allowance Impact",
      impactDesc: "Approved leave will be deducted from your stipend (-100 THB/Day).",
      totalDeduction: "Potential Deduction"
    },
    TH: {
      title: "การจัดการการลางาน",
      subtitle: "ส่งคำขอลาและติดตามยอดคงเหลือวันลาของคุณ",
      requestTitle: "ขอลา",
      requestSub: "ระบุรายละเอียดสำหรับการแจ้งลาของคุณ",
      quotaTitle: "โควตาการลา",
      quotaSub: "ยอดคงเหลือวันลาสำหรับโปรแกรมปัจจุบัน",
      historyTitle: "คำขอที่รอดำเนินการ",
      historySub: "ตรวจสอบและจัดการรายการลาที่ค้างอยู่",
      leaveType: "ประเภทการลา",
      startDate: "วันที่เริ่ม",
      endDate: "วันที่สิ้นสุด",
      reason: "เหตุผลการลา",
      submit: "ส่งคำขอ",
      pending: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ไม่อนุมัติ",
      sick: "ลาป่วย",
      personal: "ลากิจ",
      business: "ลาเพื่อธุรกิจ",
      vacation: "ลาพักร้อน",
      total: "ทั้งหมด",
      used: "ใช้ไป",
      left: "คงเหลือ",
      days: "วัน",
      approve: "อนุมัติ",
      reject: "ปฏิเสธ",
      impactTitle: "ผลกระทบต่อเบี้ยเลี้ยง",
      impactDesc: "การลาที่ได้รับอนุมัติจะถูกหักออกจากเบี้ยเลี้ยง (-100 บาท/วัน)",
      totalDeduction: "ยอดรวมที่ถูกหัก"
    }
  }[lang];

  const QUOTA_DATA = [
    { type: 'SICK', label: t.sick, total: 30, used: 2, color: 'emerald' },
    { type: 'PERSONAL', label: t.personal, total: 6, used: 1, color: 'amber' },
    { type: 'BUSINESS', label: t.business, total: 3, used: 0, color: 'blue' },
  ];

  const [requests, setRequests] = useState<LeaveRequest[]>([
    { id: '1', internName: 'Alex Rivera', internAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', internPosition: 'Junior UI/UX Designer', type: 'SICK', startDate: '2024-11-10', endDate: '2024-11-10', reason: 'Flu', status: 'APPROVED', requestedAt: '2024-11-09' },
    { id: '2', internName: 'James Wilson', internAvatar: 'https://picsum.photos/seed/james/100/100', internPosition: 'Backend Developer Intern', type: 'PERSONAL', startDate: '2024-11-25', endDate: '2024-11-26', reason: 'Family business', status: 'PENDING', requestedAt: '2024-11-20' },
  ]);

  const [newRequest, setNewRequest] = useState<Partial<LeaveRequest>>({
    type: 'SICK',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const handleSubmit = () => {
    if (!newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      alert("Please fill all fields.");
      return;
    }
    const request: LeaveRequest = {
      id: Math.random().toString(36).substr(2, 9),
      internName: 'Alex Rivera',
      internAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
      internPosition: 'Junior UI/UX Designer',
      type: newRequest.type as LeaveType,
      startDate: newRequest.startDate,
      endDate: newRequest.endDate,
      reason: newRequest.reason,
      status: 'PENDING',
      requestedAt: new Date().toISOString().split('T')[0]
    };
    setRequests([request, ...requests]);
    setNewRequest({ type: 'SICK', startDate: '', endDate: '', reason: '' });
  };

  const handleUpdateStatus = (id: string, status: 'APPROVED' | 'REJECTED') => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const totalUsedDays = requests.filter(r => r.status === 'APPROVED').length;
  const potentialDeduction = totalUsedDays * 100;

  const resolvedHeaderTitle = headerTitle ?? (isIntern ? t.title : 'Approval Center');
  const resolvedHeaderSubtitle = headerSubtitle ?? (isIntern ? t.subtitle : 'Monitor and manage intern absences across your assigned group.');
  const resolvedProtocolTitle = protocolTitle ?? 'Supervisor Protocol';
  const resolvedProtocolSubtitle = protocolSubtitle ?? (
    "All leave requests should be evaluated based on the intern's remaining quota and project deadlines. \n\nApproved leave is strictly \"Without Pay\" per company policy."
  );

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden p-6 md:p-10 lg:p-14">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col h-full">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{resolvedHeaderTitle}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{resolvedHeaderSubtitle}</p>
          </div>
          
          {isIntern && (
            <div className="flex bg-white px-6 py-4 rounded-[2rem] border border-slate-200 shadow-sm items-center gap-6 animate-in slide-in-from-right-4">
              <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                  <TrendingDown size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.totalDeduction}</p>
                   <p className="text-sm font-black text-rose-600">-{potentialDeduction} THB</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <p className="text-sm font-black text-slate-900">Unpaid Leave Policy Active</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            <div className="lg:col-span-8 space-y-10">
              {isIntern && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
                  {QUOTA_DATA.map((item) => (
                    <div key={item.type} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-default relative overflow-hidden">
                      <div className="flex justify-between items-start mb-6 relative z-10">
                        <span className={`text-[10px] font-black uppercase tracking-widest bg-${item.color}-50 text-${item.color}-600 px-3 py-1 rounded-lg border border-${item.color}-100`}>
                          {item.label}
                        </span>
                        <Clock size={18} className="text-slate-200" />
                      </div>
                      <div className="space-y-1 relative z-10">
                        <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                          {item.total - item.used}
                          <span className="text-sm font-bold text-slate-300 ml-1 uppercase">{t.days} {t.left}</span>
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.used} {item.used} OF {item.total} {t.days}</p>
                      </div>
                      <div className="mt-6 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 relative z-10">
                        <div 
                          className={`h-full bg-${item.color}-500 rounded-full transition-all duration-1000`} 
                          style={{ width: `${(item.used / item.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* REQUEST LIST / INCOMING REQUESTS (DESIGN SYNC) */}
              <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{t.historyTitle}</h3>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">{t.historySub}</p>
                  </div>
                  <button className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:text-blue-600 transition-all border border-slate-100 shadow-sm">
                    <Filter size={20}/>
                  </button>
                </div>

                <div className="space-y-6">
                  {requests.map((req) => (
                    <div key={req.id} className="p-8 bg-white border border-[#F1F5F9] rounded-[3rem] flex flex-col md:flex-row md:items-center justify-between gap-8 transition-all hover:shadow-2xl hover:border-blue-50 group">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all flex-shrink-0 ${
                          req.status === 'APPROVED' ? 'bg-[#ECFDF5] text-[#10B981]' :
                          req.status === 'REJECTED' ? 'bg-[#FEF2F2] text-[#EF4444]' :
                          'bg-[#EFF6FF] text-[#3B82F6]'
                        }`}>
                          {req.status === 'APPROVED' ? <CheckCircle2 size={32}/> : req.status === 'REJECTED' ? <XCircle size={32}/> : <Clock size={32}/>}
                        </div>

                        <div>
                          <div className="flex items-start gap-4 mb-2">
                             <img src={req.internAvatar} alt={req.internName} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100 shadow-sm" />
                             <div>
                                <div className="flex items-center gap-3">
                                   <h4 className="text-2xl font-black text-slate-900 leading-none">{req.internName}</h4>
                                   <span className="text-[11px] text-slate-300 font-bold uppercase tracking-tight">{req.requestedAt}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                   <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.1em]">{t[req.type.toLowerCase() as keyof typeof t.EN]}</p>
                                   <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{req.internPosition}</p>
                                </div>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-3 mt-5">
                             <div className="flex items-center gap-2 text-slate-400">
                                <CalendarDays size={16} className="text-slate-300" />
                                <p className="text-[13px] font-black tracking-tight">{req.startDate} — {req.endDate}</p>
                             </div>
                             {req.status === 'APPROVED' && (
                               <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest px-3 py-1 bg-rose-50 rounded-lg border border-rose-100">LEAVE WITHOUT PAY</span>
                             )}
                          </div>
                          <p className="text-sm text-slate-400 font-bold italic opacity-60 leading-none ml-1">"{req.reason}"</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        {req.status === 'PENDING' && !isIntern ? (
                          <div className="flex gap-4">
                            <button 
                              onClick={() => handleUpdateStatus(req.id, 'APPROVED')} 
                              className="px-8 py-4 bg-[#10B981] text-white rounded-[1.5rem] text-[13px] font-black uppercase tracking-widest hover:bg-[#059669] shadow-2xl shadow-emerald-500/30 flex items-center gap-3 transition-all active:scale-95"
                            >
                              <Check size={18} strokeWidth={3}/> {t.approve}
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(req.id, 'REJECTED')} 
                              className="px-8 py-4 bg-[#F43F5E] text-white rounded-[1.5rem] text-[13px] font-black uppercase tracking-widest hover:bg-[#E11D48] shadow-2xl shadow-rose-500/30 flex items-center gap-3 transition-all active:scale-95"
                            >
                              <X size={18} strokeWidth={3}/> {t.reject}
                            </button>
                          </div>
                        ) : (
                          <div className={`px-12 py-4 rounded-[1.5rem] text-[13px] font-black uppercase tracking-[0.2em] border transition-all ${
                            req.status === 'APPROVED' ? 'bg-[#F0FDF4] text-[#10B981] border-[#DCFCE7]' :
                            req.status === 'REJECTED' ? 'bg-[#FFF1F2] text-[#F43F5E] border-[#FFE4E6]' :
                            'bg-[#F0F9FF] text-[#3B82F6] border-[#E0F2FE]'
                          }`}>
                            {t[req.status.toLowerCase() as keyof typeof t.EN]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && (
                    <div className="py-24 text-center flex flex-col items-center">
                       <History size={48} className="text-slate-100 mb-6" />
                       <p className="text-slate-300 font-black uppercase tracking-[0.3em]">Clear Inbox. No requests found.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              {isIntern ? (
                <section className="bg-[#0B0F19] rounded-[3.5rem] p-10 md:p-12 text-white shadow-2xl relative overflow-hidden h-fit sticky top-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-black mb-2 tracking-tight">{t.requestTitle}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{t.requestSub}</p>

                    <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl mb-12 flex items-start gap-4 animate-pulse">
                       <AlertCircle size={24} className="text-rose-500 shrink-0" />
                       <div>
                          <h5 className="text-[11px] font-black text-rose-400 uppercase tracking-widest mb-1">{t.impactTitle}</h5>
                          <p className="text-[11px] text-slate-400 leading-relaxed font-bold italic opacity-80">{t.impactDesc}</p>
                       </div>
                    </div>

                    <div className="space-y-10">
                      <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t.leaveType}</label>
                        <div className="grid grid-cols-2 gap-3">
                           {['SICK', 'PERSONAL', 'BUSINESS', 'VACATION'].map(type => (
                             <button 
                               key={type}
                               onClick={() => setNewRequest({...newRequest, type: type as LeaveType})}
                               className={`px-4 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all text-center border-2 ${newRequest.type === type ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-500/30 scale-[1.02]' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:border-white/10'}`}
                             >
                               {t[type.toLowerCase() as keyof typeof t.EN]}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t.startDate}</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                            value={newRequest.startDate}
                            onChange={e => setNewRequest({...newRequest, startDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t.endDate}</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                            value={newRequest.endDate}
                            onChange={e => setNewRequest({...newRequest, endDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t.reason}</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm font-bold text-white leading-relaxed outline-none focus:ring-8 focus:ring-blue-500/10 transition-all h-36 resize-none"
                          placeholder="e.g. Seeking rest due to mild flu..."
                          value={newRequest.reason}
                          onChange={e => setNewRequest({...newRequest, reason: e.target.value})}
                        />
                      </div>

                      <button 
                        onClick={handleSubmit}
                        className="w-full py-6 bg-[#2563EB] text-white rounded-full font-black text-[15px] uppercase tracking-[0.15em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4"
                      >
                        {t.submit} <ArrowRight size={20} strokeWidth={3}/>
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm sticky top-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner border border-blue-50">
                    <Info size={40} />
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{resolvedProtocolTitle}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed font-bold italic mb-10 opacity-70" style={{ whiteSpace: 'pre-line' }}>
                    {resolvedProtocolSubtitle}
                  </p>
                  <div className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center gap-5 group hover:bg-blue-600 transition-all duration-500">
                     <Clock className="text-blue-500 group-hover:text-white" size={24} />
                     <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 group-hover:text-blue-200 uppercase tracking-widest">Global Attendance</p>
                        <p className="text-xl font-black text-slate-900 group-hover:text-white">96.8% AVG</p>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestCore;

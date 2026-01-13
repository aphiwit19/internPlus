import React, { useEffect, useMemo, useState } from 'react';
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
  X
} from 'lucide-react';
import { Language, UserRole, LeaveRequest, LeaveType } from '@/types';

import { useAppContext } from '@/app/AppContext';
import { createLeaveRepository } from '@/app/leaveRepository';

import { doc, getDoc } from 'firebase/firestore';

import { firestoreDb } from '@/firebase';

interface LeaveRequestCoreProps {
  lang: Language;
  role: UserRole;
  headerTitle?: string;
  headerSubtitle?: string;
  protocolTitle?: string;
  protocolSubtitle?: string;
  sidePanel?: React.ReactNode | null;
}

const LeaveRequestCore: React.FC<LeaveRequestCoreProps> = ({
  lang,
  role,
  headerTitle,
  headerSubtitle,
  protocolTitle,
  protocolSubtitle,
  sidePanel,
}) => {
  const isIntern = role === 'INTERN';
  const { user } = useAppContext();
  const leaveRepo = useMemo(() => createLeaveRepository(), []);

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
      all: "All",
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
      overallLeave: "Overall Leave",
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
      all: "ทั้งหมด",
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
      overallLeave: "การลา (รวม)",
      approve: "อนุมัติ",
      reject: "ปฏิเสธ",
      impactTitle: "ผลกระทบต่อเบี้ยเลี้ยง",
      impactDesc: "การลาที่ได้รับอนุมัติจะถูกหักออกจากเบี้ยเลี้ยง (-100 บาท/วัน)",
      totalDeduction: "ยอดรวมที่ถูกหัก"
    }
  }[lang];

  const [totalLeaveQuotaDays, setTotalLeaveQuotaDays] = useState<number>(39);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const [newRequest, setNewRequest] = useState<Partial<LeaveRequest>>({
    type: 'SICK',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);
    setFormError(null);
    setIsLoading(true);

    leaveRepo
      .list({ role, user })
      .then((list) => {
        if (cancelled) return;
        setRequests(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load leave requests.');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leaveRepo, role, user]);

  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(firestoreDb, 'config', 'systemSettings');
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as { totalLeaveQuotaDays?: unknown };
        const value = Number(data.totalLeaveQuotaDays);
        if (Number.isFinite(value) && value > 0) {
          setTotalLeaveQuotaDays(value);
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  const handleSubmit = async () => {
    setFormError(null);
    setErrorMessage(null);

    if (!user) {
      setFormError(lang === 'TH' ? 'กรุณาเข้าสู่ระบบก่อนส่งคำขอ' : 'Please login before submitting a request.');
      return;
    }

    if (!newRequest.type || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      setFormError(lang === 'TH' ? 'กรุณากรอกข้อมูลให้ครบทุกช่อง' : 'Please fill all fields.');
      return;
    }

    if (newRequest.startDate > newRequest.endDate) {
      setFormError(lang === 'TH' ? 'วันที่เริ่มต้องไม่มากกว่าวันที่สิ้นสุด' : 'Start date must be before or equal to end date.');
      return;
    }

    try {
      setIsLoading(true);
      const created = await leaveRepo.createForUser(user, {
        type: newRequest.type as LeaveType,
        startDate: newRequest.startDate,
        endDate: newRequest.endDate,
        reason: newRequest.reason,
      });
      setRequests((prev) => [created, ...prev]);
      setNewRequest({ type: 'SICK', startDate: '', endDate: '', reason: '' });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit leave request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setErrorMessage(null);
    try {
      const approver = user?.name ?? 'System';
      const updated = await leaveRepo.updateStatus(id, status, approver);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update request status.');
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setIsLoading(true);
    leaveRepo
      .list({ role, user })
      .then((list) => setRequests(list))
      .catch((err: unknown) => setErrorMessage(err instanceof Error ? err.message : 'Failed to load leave requests.'))
      .finally(() => setIsLoading(false));
  };

  const approvedLeaveDays = useMemo(() => {
    const toUtcMidnight = (value: string) => {
      const d = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    };

    const diffInclusiveDays = (start: string, end: string) => {
      const s = toUtcMidnight(start);
      const e = toUtcMidnight(end);
      if (!s || !e) return 0;
      const ms = e.getTime() - s.getTime();
      const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
      return days > 0 ? days : 0;
    };

    const base = isIntern && user
      ? requests.filter((r) => r.status === 'APPROVED' && r.internId === user.id)
      : requests.filter((r) => r.status === 'APPROVED');

    return base.reduce((sum, r) => sum + diffInclusiveDays(r.startDate, r.endDate), 0);
  }, [isIntern, requests, user]);

  const overallLeaveUsed = approvedLeaveDays;
  const overallLeaveLeft = Math.max(0, totalLeaveQuotaDays - overallLeaveUsed);

  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveType | 'ALL'>('ALL');
  const filteredRequests = useMemo(() => {
    if (leaveTypeFilter === 'ALL') return requests;
    return requests.filter((r) => r.type === leaveTypeFilter);
  }, [leaveTypeFilter, requests]);

  const leaveTypeLabel = (type: LeaveType) => {
    const key = type.toLowerCase() as keyof typeof t;
    const value = t[key];
    return typeof value === 'string' ? value : String(type);
  };

  const resolvedHeaderTitle = headerTitle ?? (isIntern ? t.title : 'Approval Center');
  const resolvedHeaderSubtitle = headerSubtitle ?? (isIntern ? t.subtitle : 'Monitor and manage intern absences across your assigned group.');
  const resolvedProtocolTitle = protocolTitle ?? 'Supervisor Protocol';
  const resolvedProtocolSubtitle = protocolSubtitle ?? (
    "All leave requests should be evaluated based on the intern's remaining quota and project deadlines. \n\nApproved leave is strictly \"Without Pay\" per company policy."
  );

  const showSidePanel = isIntern || sidePanel !== null;
  const resolvedSidePanel = sidePanel === undefined ? undefined : sidePanel;

  return (
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden p-6 md:p-10 lg:p-14">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col h-full">
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{resolvedHeaderTitle}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{resolvedHeaderSubtitle}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            <div className={`${showSidePanel ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-10`}>
              {isIntern && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-default relative overflow-hidden md:col-span-3">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border bg-indigo-50 text-indigo-600 border-indigo-100">
                        {t.overallLeave}
                      </span>
                      <Clock size={18} className="text-slate-200" />
                    </div>
                    <div className="space-y-1 relative z-10">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                        {overallLeaveLeft}
                        <span className="text-sm font-bold text-slate-300 ml-1 uppercase">{t.days} {t.left}</span>
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.used} {overallLeaveUsed} OF {totalLeaveQuotaDays} {t.days}</p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.total}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{totalLeaveQuotaDays} <span className="text-xs font-bold text-slate-400">{t.days}</span></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.used}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{overallLeaveUsed} <span className="text-xs font-bold text-slate-400">{t.days}</span></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.left}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{overallLeaveLeft} <span className="text-xs font-bold text-slate-400">{t.days}</span></div>
                      </div>
                    </div>

                    <div className="mt-6 h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 relative z-10">
                      <div
                        className="h-full rounded-full transition-all duration-1000 bg-indigo-500"
                        style={{ width: `${totalLeaveQuotaDays > 0 ? (overallLeaveUsed / totalLeaveQuotaDays) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* REQUEST LIST / INCOMING REQUESTS (DESIGN SYNC) */}
              <section className="bg-white rounded-[3.5rem] p-10 md:p-14 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{t.historyTitle}</h3>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">{t.historySub}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 shadow-sm">
                      <Filter size={20} />
                    </div>
                    <select
                      value={leaveTypeFilter}
                      onChange={(e) => setLeaveTypeFilter(e.target.value as LeaveType | 'ALL')}
                      className="h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-[12px] font-black text-slate-700 uppercase tracking-widest outline-none"
                    >
                      <option value="ALL">{t.all}</option>
                      <option value="SICK">{t.sick}</option>
                      <option value="PERSONAL">{t.personal}</option>
                      <option value="BUSINESS">{t.business}</option>
                      <option value="VACATION">{t.vacation}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  {isLoading && (
                    <div className="p-10 bg-slate-50 border border-slate-100 rounded-[3rem]">
                      <div className="h-5 w-52 bg-slate-200 rounded-full mb-6 animate-pulse"></div>
                      <div className="space-y-4">
                        <div className="h-20 bg-white rounded-[2rem] border border-slate-100 animate-pulse"></div>
                        <div className="h-20 bg-white rounded-[2rem] border border-slate-100 animate-pulse"></div>
                      </div>
                    </div>
                  )}

                  {!isLoading && errorMessage && (
                    <div className="p-10 bg-rose-50 border border-rose-100 rounded-[3rem] flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-black text-rose-600">{errorMessage}</p>
                        <p className="text-xs font-bold text-rose-500/80 mt-2">Please try again.</p>
                      </div>
                      <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isLoading && !errorMessage && (
                    <>
                      {filteredRequests.map((req) => (
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
                                       <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.1em]">{leaveTypeLabel(req.type)}</p>
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

                      {filteredRequests.length === 0 && (
                        <div className="py-24 text-center flex flex-col items-center">
                           <History size={48} className="text-slate-100 mb-6" />
                           <p className="text-slate-300 font-black uppercase tracking-[0.3em]">Clear Inbox. No requests found.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </div>

            {showSidePanel && (
              <div className="lg:col-span-4">
                {isIntern ? (
                  <section className="bg-[#0B0F19] rounded-[3.5rem] p-10 md:p-12 text-white shadow-2xl relative overflow-hidden h-fit sticky top-10">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-black mb-2 tracking-tight">{t.requestTitle}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{t.requestSub}</p>

                    {!!formError && (
                      <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-xs font-bold">
                        {formError}
                      </div>
                    )}

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
                        disabled={isLoading}
                        className="w-full py-6 bg-[#2563EB] text-white rounded-full font-black text-[15px] uppercase tracking-[0.15em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4"
                      >
                        {t.submit} <ArrowRight size={20} strokeWidth={3}/>
                      </button>
                    </div>
                  </div>
                  </section>
                ) : resolvedSidePanel === undefined ? (
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
                ) : (
                  <div className="sticky top-10 h-fit">
                    {resolvedSidePanel}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestCore;

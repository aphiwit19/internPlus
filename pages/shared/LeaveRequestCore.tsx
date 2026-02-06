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
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language, UserRole, LeaveRequest, LeaveType } from '@/types';
import { useTranslation } from 'react-i18next';

import { useAppContext } from '@/app/AppContext';
import { createLeaveRepository } from '@/app/leaveRepository';

import { doc, getDoc } from 'firebase/firestore';

import { firestoreDb } from '@/firebase';

interface LeaveRequestCoreProps {
  lang: Language;
  role: UserRole;
  headerTitle?: string;
  headerSubtitle?: string;
  topNav?: React.ReactNode;
  protocolTitle?: string;
  protocolSubtitle?: string;
  sidePanel?: React.ReactNode | null;
  pendingLeaveCount?: number;
}

const LeaveRequestCore: React.FC<LeaveRequestCoreProps> = ({
  lang: _lang,
  role,
  headerTitle,
  headerSubtitle,
  topNav,
  protocolTitle,
  protocolSubtitle,
  sidePanel,
}) => {
  const { t } = useTranslation();
  const isIntern = role === 'INTERN';
  const { user } = useAppContext();
  const leaveRepo = useMemo(() => createLeaveRepository(), []);
  const [lastVisit] = useState<number>(() => {
    const stored = localStorage.getItem('lastLeavePageVisit');
    return stored ? parseInt(stored, 10) : 0;
  });

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
        setErrorMessage(err instanceof Error ? err.message : t('leave.errors.load_failed'));
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
      setFormError(t('leave.form.login_required'));
      return;
    }

    if (!newRequest.type || !newRequest.startDate || !newRequest.endDate || !newRequest.reason) {
      setFormError(t('leave.form.fill_all_fields'));
      return;
    }

    if (newRequest.startDate > newRequest.endDate) {
      setFormError(t('leave.form.start_before_end'));
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
      setErrorMessage(err instanceof Error ? err.message : t('leave.errors.submit_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setErrorMessage(null);
    try {
      const approver = user?.name ?? t('common.system');
      const updated = await leaveRepo.updateStatus(id, status, approver);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t('leave.errors.update_failed'));
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setIsLoading(true);
    leaveRepo
      .list({ role, user })
      .then((list) => setRequests(list))
      .catch((err: unknown) => setErrorMessage(err instanceof Error ? err.message : t('leave.errors.load_failed')))
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
  const REQUESTS_PER_PAGE = isIntern ? 3 : role === 'SUPERVISOR' ? 3 : role === 'HR_ADMIN' ? 3 : 10;
  const [requestsPage, setRequestsPage] = useState(1);
  const filteredRequests = useMemo(() => {
    const filtered = leaveTypeFilter === 'ALL' ? requests : requests.filter((r) => r.type === leaveTypeFilter);
    
    return filtered.sort((a, b) => {
      const getTimestamp = (req: LeaveRequest) => {
        if (req.approvedAt) {
          return new Date(req.approvedAt + 'T00:00:00').getTime();
        }
        if (req.requestedAt) {
          return new Date(req.requestedAt + 'T00:00:00').getTime();
        }
        return 0;
      };
      
      return getTimestamp(b) - getTimestamp(a);
    });
  }, [leaveTypeFilter, requests]);

  const requestsPageCount = useMemo(() => {
    const count = Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE);
    return count > 0 ? count : 1;
  }, [REQUESTS_PER_PAGE, filteredRequests.length]);

  useEffect(() => {
    setRequestsPage((prev) => {
      if (prev < 1) return 1;
      if (prev > requestsPageCount) return requestsPageCount;
      return prev;
    });
  }, [requestsPageCount]);

  useEffect(() => {
    setRequestsPage(1);
  }, [leaveTypeFilter]);

  const pagedRequests = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PER_PAGE;
    return filteredRequests.slice(start, start + REQUESTS_PER_PAGE);
  }, [REQUESTS_PER_PAGE, filteredRequests, requestsPage]);

  const leaveTypeLabel = (type: LeaveType) => {
    if (type === 'SICK') return t('leave.type_sick');
    if (type === 'PERSONAL') return t('leave.type_personal');
    if (type === 'BUSINESS') return t('leave.type_business');
    return t('leave.type_vacation');
  };

  const statusLabel = (status: LeaveRequest['status']) => {
    if (status === 'APPROVED') return t('leave.status_approved');
    if (status === 'REJECTED') return t('leave.status_rejected');
    return t('leave.status_pending');
  };

  const resolvedHeaderTitle = headerTitle ?? (isIntern ? t('leave.title') : t('leave.approval_center_title'));
  const resolvedHeaderSubtitle = headerSubtitle ?? (isIntern ? t('leave.subtitle') : t('leave.approval_center_subtitle'));
  const resolvedProtocolTitle = protocolTitle ?? t('leave.protocol_title');
  const resolvedProtocolSubtitle = protocolSubtitle ?? t('leave.protocol_subtitle');

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

          {topNav}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            <div className={`${showSidePanel ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-10`}>
              {isIntern && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-default relative overflow-hidden md:col-span-3">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border bg-indigo-50 text-indigo-600 border-indigo-100">
                        {t('leave.overall_leave')}
                      </span>
                      <Clock size={18} className="text-slate-200" />
                    </div>
                    <div className="space-y-1 relative z-10">
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
                        {overallLeaveLeft}
                        <span className="text-sm font-bold text-slate-300 ml-1 uppercase">{t('leave.days')} {t('leave.left')}</span>
                      </h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('leave.used')} {overallLeaveUsed} OF {totalLeaveQuotaDays} {t('leave.days')}</p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('leave.total')}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{totalLeaveQuotaDays} <span className="text-xs font-bold text-slate-400">{t('leave.days')}</span></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('leave.used')}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{overallLeaveUsed} <span className="text-xs font-bold text-slate-400">{t('leave.days')}</span></div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('leave.left')}</div>
                        <div className="text-lg font-black text-slate-900 mt-1">{overallLeaveLeft} <span className="text-xs font-bold text-slate-400">{t('leave.days')}</span></div>
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
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{t('leave.history_title')}</h3>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1">{t('leave.history_subtitle')}</p>
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
                      <option value="ALL">{t('leave.filter_all')}</option>
                      <option value="SICK">{t('leave.type_sick')}</option>
                      <option value="PERSONAL">{t('leave.type_personal')}</option>
                      <option value="BUSINESS">{t('leave.type_business')}</option>
                      <option value="VACATION">{t('leave.type_vacation')}</option>
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
                        <p className="text-xs font-bold text-rose-500/80 mt-2">{t('leave.please_try_again')}</p>
                      </div>
                      <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all"
                      >
                        {t('leave.retry')}
                      </button>
                    </div>
                  )}

                  {!isLoading && !errorMessage && (
                    <>
                      {pagedRequests.map((req) => {
                        const isNew = req.status === 'APPROVED' && req.approvedAt && new Date(req.approvedAt).getTime() > lastVisit;
                        return (
                        <div key={req.id} className={`p-8 bg-white border rounded-[3rem] flex flex-col md:flex-row md:items-center justify-between gap-8 transition-all hover:shadow-2xl group relative ${
                          isNew ? 'border-red-300 ring-2 ring-red-100' : 'border-[#F1F5F9] hover:border-blue-50'
                        }`}>
                          {isNew && (
                            <div className="absolute -top-3 -right-3 z-10">
                              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg animate-pulse">
                                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                                {t('leave.new_badge')}
                              </span>
                            </div>
                          )}
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
                                   <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest px-3 py-1 bg-rose-50 rounded-lg border border-rose-100">{t('leave.without_pay_badge')}</span>
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
                                  <Check size={18} strokeWidth={3}/> {t('leave.approve')}
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(req.id, 'REJECTED')} 
                                  className="px-8 py-4 bg-[#F43F5E] text-white rounded-[1.5rem] text-[13px] font-black uppercase tracking-widest hover:bg-[#E11D48] shadow-2xl shadow-rose-500/30 flex items-center gap-3 transition-all active:scale-95"
                                >
                                  <X size={18} strokeWidth={3}/> {t('leave.reject')}
                                </button>
                              </div>
                            ) : (
                              <div className={`px-12 py-4 rounded-[1.5rem] text-[13px] font-black uppercase tracking-[0.2em] border transition-all ${
                                req.status === 'APPROVED' ? 'bg-[#F0FDF4] text-[#10B981] border-[#DCFCE7]' :
                                req.status === 'REJECTED' ? 'bg-[#FFF1F2] text-[#F43F5E] border-[#FFE4E6]' :
                                'bg-[#F0F9FF] text-[#3B82F6] border-[#E0F2FE]'
                              }`}>
                                {statusLabel(req.status)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      })}

                      {requestsPageCount > 1 ? (
                        <div className="pt-2 flex justify-center">
                          <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setRequestsPage((p) => Math.max(1, p - 1))}
                              disabled={requestsPage <= 1}
                              className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                              aria-label={t('leave.prev_page_aria')}
                            >
                              <ChevronLeft size={18} />
                            </button>

                            {Array.from({ length: requestsPageCount }, (_, idx) => idx + 1).map((page) => {
                              const isActive = page === requestsPage;
                              return (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => setRequestsPage(page)}
                                  className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                                    isActive
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                                  }`}
                                  aria-current={isActive ? 'page' : undefined}
                                >
                                  {page}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() => setRequestsPage((p) => Math.min(requestsPageCount, p + 1))}
                              disabled={requestsPage >= requestsPageCount}
                              className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                              aria-label={t('leave.next_page_aria')}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {filteredRequests.length === 0 && (
                        <div className="py-24 text-center flex flex-col items-center">
                           <History size={48} className="text-slate-100 mb-6" />
                           <p className="text-slate-300 font-black uppercase tracking-[0.3em]">{t('leave.empty_inbox')}</p>
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
                    <h3 className="text-3xl font-black mb-2 tracking-tight">{t('leave.request_title')}</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">{t('leave.request_subtitle')}</p>

                    {!!formError && (
                      <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-xs font-bold">
                        {formError}
                      </div>
                    )}

                    <div className="space-y-10">
                      <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t('leave.leave_type')}</label>
                        <div className="grid grid-cols-2 gap-3">
                           {['SICK', 'PERSONAL', 'BUSINESS', 'VACATION'].map(type => (
                             <button 
                               key={type}
                               onClick={() => setNewRequest({...newRequest, type: type as LeaveType})}
                               className={`px-4 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all text-center border-2 ${newRequest.type === type ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-500/30 scale-[1.02]' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:border-white/10'}`}
                             >
                               {leaveTypeLabel(type as LeaveType)}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t('leave.start_date')}</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                            value={newRequest.startDate}
                            onChange={e => setNewRequest({...newRequest, startDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t('leave.end_date')}</label>
                          <input 
                            type="date" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                            value={newRequest.endDate}
                            onChange={e => setNewRequest({...newRequest, endDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">{t('leave.reason_for_absence')}</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-8 text-sm font-bold text-white leading-relaxed outline-none focus:ring-8 focus:ring-blue-500/10 transition-all h-36 resize-none"
                          placeholder={t('leave.reason_placeholder')}
                          value={newRequest.reason}
                          onChange={e => setNewRequest({...newRequest, reason: e.target.value})}
                        />
                      </div>

                      <button 
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full py-6 bg-[#2563EB] text-white rounded-full font-black text-[15px] uppercase tracking-[0.15em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4"
                      >
                        {t('leave.submit_request')} <ArrowRight size={20} strokeWidth={3}/>
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
                          <p className="text-[10px] font-black text-slate-400 group-hover:text-blue-200 uppercase tracking-widest">{t('leave.side_panel.global_attendance')}</p>
                          <p className="text-xl font-black text-slate-900 group-hover:text-white">{t('leave.side_panel.global_attendance_avg')}</p>
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

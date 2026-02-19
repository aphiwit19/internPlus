import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight, Clock, UserX } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { Language, UserProfile } from '@/types';
import { firestoreDb } from '@/firebase';

type AppointmentMode = 'ONLINE' | 'COMPANY';

type AppointmentRequest = {
  date?: string;
  time?: string;
  status?: 'DRAFT' | 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'DONE';
  mode?: AppointmentMode;
  note?: string;
  supervisorNote?: string;
};

type UniversityEvaluationDoc = {
  internId: string;
  internName: string;
  supervisorId: string | null;
  appointmentRequest?: AppointmentRequest;
};

type ActivityEvent = {
  id: string;
  day: string;
  month: { EN: string; TH: string };
  title: { EN: string; TH: string };
  time: string;
  type: 'LEAVE' | 'APPOINTMENT';
  internName?: string;
  status?: string;
};

type LeaveRequestDoc = {
  internName?: string;
  supervisorId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
};

interface SupervisorActivitiesPageProps {
  lang: Language;
  user: UserProfile;
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const SupervisorActivitiesPage: React.FC<SupervisorActivitiesPageProps> = ({ lang, user }) => {
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const trLng = (lng: 'en' | 'th', key: string, options?: any) => String(t(key, { ...(options ?? {}), lng }));
  const uiLang: Language = (i18n.resolvedLanguage ?? i18n.language) === 'th' ? 'TH' : 'EN';

  const monthLabel = (d: Date): { EN: string; TH: string } => {
    const m = d.getUTCMonth();
    const en = String(t('intern_activities.months.short', { lng: 'en' } as any)).split('|')[m] ?? '';
    const th = String(t('intern_activities.months.short', { lng: 'th' } as any)).split('|')[m] ?? '';
    return { EN: en, TH: th };
  };

  const [viewMode, setViewMode] = useState<'LEAVE' | 'APPOINTMENT'>('APPOINTMENT');

  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isMonthFilterEnabled, setIsMonthFilterEnabled] = useState(false);

  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'APPROVED' | 'REJECTED'
  >('ALL');

  useEffect(() => {
    setStatusFilter('ALL');
  }, [viewMode]);

  const [apptActivities, setApptActivities] = useState<ActivityEvent[]>([]);
  const [leaveActivities, setLeaveActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'universityEvaluations'), where('supervisorId', '==', user.id));
    return onSnapshot(q, (snap) => {
      const out: ActivityEvent[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as UniversityEvaluationDoc;
        const ar = data.appointmentRequest;
        if (!ar?.date) return;

        const dateKey = String(ar.date);
        const date = parseIsoDateKey(dateKey);
        if (!date) return;

        const mode = (ar.mode ?? 'ONLINE') as AppointmentMode;
        const modeLabelText =
          mode === 'COMPANY'
            ? {
                EN: trLng('en', 'supervisor_activities.appointment.mode_company'),
                TH: trLng('th', 'supervisor_activities.appointment.mode_company'),
              }
            : {
                EN: trLng('en', 'supervisor_activities.appointment.mode_online'),
                TH: trLng('th', 'supervisor_activities.appointment.mode_online'),
              };

        out.push({
          id: `appt:${d.id}:${String(ar.time ?? '')}:${dateKey}`,
          day: String(date.getUTCDate()).padStart(2, '0'),
          month: monthLabel(date),
          title: {
            EN: `${trLng('en', 'supervisor_activities.appointment.title')} (${modeLabelText.EN})`,
            TH: `${trLng('th', 'supervisor_activities.appointment.title')} (${modeLabelText.TH})`,
          },
          time: ar.time ? String(ar.time) : tr('supervisor_activities.time.unknown'),
          type: 'APPOINTMENT',
          internName: data.internName,
          status: typeof ar.status === 'string' ? ar.status : undefined,
        });
      });

      out.sort((a, b) => a.id.localeCompare(b.id));
      setApptActivities(out);
    });
  }, [i18n.language, user.id]);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'leaveRequests'), where('supervisorId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const out: ActivityEvent[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as LeaveRequestDoc;
          const rawStatus = typeof data.status === 'string' ? data.status : '';
          const normStatus = rawStatus.toUpperCase();
          // Only show leave activities after supervisor action (approve/reject)
          if (normStatus !== 'APPROVED' && normStatus !== 'REJECTED') return;
          const start = typeof data.startDate === 'string' ? data.startDate : null;
          if (!start) return;
          const date = parseIsoDateKey(start);
          if (!date) return;
          const end = typeof data.endDate === 'string' ? data.endDate : start;
          const leaveType = String(data.type ?? 'LEAVE');
          const title = {
            EN: trLng('en', 'supervisor_activities.leave.title', { type: leaveType } as any),
            TH: trLng('th', 'supervisor_activities.leave.title', { type: leaveType } as any),
          };

          out.push({
            id: `leave:${d.id}:${start}`,
            day: String(date.getUTCDate()).padStart(2, '0'),
            month: monthLabel(date),
            title,
            time: start === end ? start : `${start} - ${end}`,
            type: 'LEAVE',
            internName: typeof data.internName === 'string' ? data.internName : undefined,
            status: rawStatus || undefined,
          });
        });
        out.sort((a, b) => a.id.localeCompare(b.id));
        setLeaveActivities(out);
      },
      () => setLeaveActivities([]),
    );
  }, [i18n.language, user.id]);

  const filteredApptActivities = useMemo(() => {
    if (viewMode !== 'APPOINTMENT') return [];
    if (statusFilter === 'ALL') return apptActivities;
    return apptActivities.filter((ev) => String(ev.status ?? 'REQUESTED').toUpperCase() === statusFilter);
  }, [apptActivities, statusFilter, viewMode]);

  const filteredLeaveActivities = useMemo(() => {
    if (viewMode !== 'LEAVE') return [];
    if (statusFilter === 'ALL') return leaveActivities;
    return leaveActivities.filter((ev) => String(ev.status ?? '').toUpperCase() === statusFilter);
  }, [leaveActivities, statusFilter, viewMode]);

  const appointmentStatusLabel = (s: string) => {
    const norm = s.toUpperCase();
    if (norm === 'CONFIRMED') return tr('supervisor_activities.status.confirmed');
    if (norm === 'CANCELLED') return tr('supervisor_activities.status.cancelled');
    return tr('supervisor_activities.status.requested');
  };

  const groupedActivities = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: ActivityEvent[] }> = [];

    const extractDateKey = (ev: ActivityEvent): string | null => {
      const parts = ev.id.split(':');
      const dateKey = parts[parts.length - 1] ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
      return null;
    };

    const toSortKey = (ev: ActivityEvent) => {
      const dk = extractDateKey(ev);
      if (dk) {
        const d = new Date(`${dk}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) return d.getTime();
      }
      const idx = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(ev.month.EN);
      const year = new Date().getFullYear();
      const month = idx >= 0 ? idx : new Date().getMonth();
      const day = Number(ev.day);
      const fallback = new Date(Date.UTC(year, month, day));
      return fallback.getTime();
    };

    const merged = [...filteredApptActivities, ...filteredLeaveActivities]
      .map((ev) => ({ ev, key: toSortKey(ev) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.ev);

    const filtered = merged;

    const activeMonthKey = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
    const filteredBySelectedDate = selectedDateKey ? filtered.filter((ev) => extractDateKey(ev) === selectedDateKey) : filtered;
    const filteredByMonth = !selectedDateKey && isMonthFilterEnabled
      ? filteredBySelectedDate.filter((ev) => {
          const dk = extractDateKey(ev);
          if (!dk) return false;
          return dk.slice(0, 7) === activeMonthKey;
        })
      : filteredBySelectedDate;

    filteredByMonth.forEach((ev) => {
      const label = `${ev.day} ${ev.month[lang]}`;
      const last = groups[groups.length - 1];
      if (!last || last.dateLabel !== label) groups.push({ dateLabel: label, items: [ev] });
      else last.items.push(ev);
    });

    return groups;
  }, [calendarDate, filteredApptActivities, filteredLeaveActivities, isMonthFilterEnabled, lang, selectedDateKey]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const calendarTitle = useMemo(() => {
    const locale = lang === 'TH' ? 'th-TH' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarDate);
  }, [calendarDate, lang]);

  const markerMap = useMemo(() => {
    const setFor = (events: ActivityEvent[]) => {
      const s = new Set<string>();
      events.forEach((ev) => {
        const parts = ev.id.split(':');
        const dateKey = parts[parts.length - 1] ?? '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) s.add(dateKey);
      });
      return s;
    };

    return {
      appt: viewMode === 'APPOINTMENT' ? setFor(filteredApptActivities) : new Set<string>(),
      leave: viewMode === 'LEAVE' ? setFor(filteredLeaveActivities) : new Set<string>(),
    };
  }, [filteredApptActivities, filteredLeaveActivities, viewMode]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50/50 overflow-hidden relative p-6 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto w-full overflow-y-auto scrollbar-hide pb-20">
        <div className="mb-12">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{tr('supervisor_activities.title')}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">{tr('supervisor_activities.subtitle')}</p>
        </div>

        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex bg-white border border-slate-100/60 rounded-[1.5rem] p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('LEAVE')}
                className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'LEAVE' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {uiLang === 'TH' ? 'คำขอลา' : 'Leave Requests'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('APPOINTMENT')}
                className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'APPOINTMENT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {uiLang === 'TH' ? 'คำขอนัดหมาย' : 'Appointment Requests'}
              </button>
            </div>

            <div className="bg-white border border-slate-100/60 rounded-[1.5rem] p-1.5 shadow-sm">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-[1.25rem] border border-transparent focus:outline-none"
              >
                <option value="ALL">{tr('supervisor_activities.status.all')}</option>
                {viewMode === 'APPOINTMENT' ? (
                  <>
                    <option value="REQUESTED">{tr('supervisor_activities.status.requested')}</option>
                    <option value="CONFIRMED">{tr('supervisor_activities.status.confirmed')}</option>
                    <option value="CANCELLED">{tr('supervisor_activities.status.cancelled')}</option>
                  </>
                ) : (
                  <>
                    <option value="APPROVED">{tr('leave.status_approved')}</option>
                    <option value="REJECTED">{tr('leave.status_rejected')}</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-4">
            {groupedActivities.length === 0 ? (
              <div className="bg-white rounded-[1.5rem] p-10 border border-slate-100/60 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-800">{tr('supervisor_activities.empty.title')}</div>
                    <div className="text-xs font-bold text-slate-400 mt-1">{tr('supervisor_activities.empty.subtitle')}</div>
                  </div>
                </div>
              </div>
            ) : (
              groupedActivities.map((group) => (
                <div key={group.dateLabel} className="space-y-3">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] px-2">{group.dateLabel}</div>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-[1.5rem] p-6 border shadow-sm flex items-center group hover:shadow-md transition-all cursor-pointer ${
                        item.type === 'APPOINTMENT'
                          ? 'border-blue-100 bg-blue-50/10'
                          : 'border-rose-100 bg-rose-50/10'
                      }`}
                    >
                      <div
                        className={`flex flex-col items-center justify-center min-w-[80px] border-r pr-8 mr-8 ${
                          item.type === 'APPOINTMENT' ? 'border-blue-100' : 'border-slate-100'
                        }`}
                      >
                        <span
                          className={`text-2xl font-black leading-none ${
                            item.type === 'APPOINTMENT' ? 'text-blue-600' : 'text-rose-600'
                          }`}
                        >
                          {item.day}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{item.month[uiLang]}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays size={14} className="text-blue-500" />
                          <h3
                            className={`text-[15px] font-bold leading-tight group-hover:text-blue-600 transition-colors ${
                              item.type === 'APPOINTMENT' ? 'text-blue-700' : 'text-slate-800'
                            }`}
                          >
                            {item.title[uiLang]}
                          </h3>
                        </div>
                        {item.internName ? (
                          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider truncate">{item.internName}</div>
                        ) : null}
                        <div className="text-slate-400 text-[11px] font-black mt-1 uppercase tracking-wider flex items-center gap-2">
                          <Clock size={14} />
                          {item.time}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {item.type === 'APPOINTMENT' ? (
                          <>
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border bg-blue-50 text-blue-600 border-blue-200">
                              {tr('supervisor_activities.appointment.badge')}
                            </span>
                            {(() => {
                              const s = String(item.status ?? 'REQUESTED').toUpperCase();
                              const isConfirmed = s === 'CONFIRMED';
                              const isCancelled = s === 'CANCELLED';
                              const klass = isCancelled
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isConfirmed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200';
                              return (
                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${klass}`}>
                                  {appointmentStatusLabel(s)}
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <>
                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border bg-rose-50 text-rose-600 border-rose-200 flex items-center gap-2">
                              <UserX size={12} /> {tr('supervisor_activities.leave.badge')}
                            </span>
                            {(() => {
                              const s = String(item.status ?? '').toUpperCase();
                              if (s !== 'APPROVED' && s !== 'REJECTED') return null;
                              const isApproved = s === 'APPROVED';
                              return (
                                <span
                                  className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                                    isApproved
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {isApproved ? tr('leave.status_approved') : tr('leave.status_rejected')}
                                </span>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100/60 sticky top-4">
              <h3 className="text-lg font-black text-slate-800 mb-8">{tr('supervisor_activities.calendar.title')}</h3>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">{calendarTitle}</h4>
                  <div className="flex gap-1 items-center">
                    <button
                      type="button"
                      onClick={() => setIsMonthFilterEnabled((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        isMonthFilterEnabled
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                      }`}
                      title={tr('supervisor_activities.tooltips.filter_by_month')}
                    >
                      {tr('supervisor_activities.labels.month')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={tr('supervisor_activities.tooltips.previous_month')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={tr('supervisor_activities.tooltips.next_month')}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center">
                  {tr('supervisor_activities.days.short').split('|').map((d, i) => (
                    <div key={`${d}-${i}`} className="text-[10px] font-black text-slate-300 py-2">
                      {d}
                    </div>
                  ))}
                  {blanks.map((i) => (
                    <div key={`b-${i}`} />
                  ))}
                  {calendarDays.map((day) => {
                    const today = new Date();
                    const isToday = day === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();

                    const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasAppt = markerMap.appt.has(dateKey);
                    const hasLeave = markerMap.leave.has(dateKey);
                    const isSelected = selectedDateKey === dateKey;

                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDateKey((prev) => (prev === dateKey ? null : dateKey))}
                        className={`relative aspect-square flex items-center justify-center text-xs font-black rounded-xl cursor-pointer transition-all ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                            : isSelected
                              ? 'bg-slate-900 text-white ring-2 ring-slate-900/20'
                              : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {day}
                        {!isToday && (hasAppt || hasLeave) && (
                          <div className="absolute bottom-1.5 flex items-center gap-1">
                            {hasAppt && <div className="w-1 h-1 bg-blue-400 rounded-full"></div>}
                            {hasLeave && <div className="w-1 h-1 bg-rose-400 rounded-full"></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <CalendarIcon size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{tr('supervisor_activities.sync.title')}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">{tr('supervisor_activities.sync.description')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorActivitiesPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight, Clock, UserX } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

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

function monthLabel(d: Date): { EN: string; TH: string } {
  const m = d.getUTCMonth();
  const en = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m] ?? '';
  const th = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m] ?? '';
  return { EN: en, TH: th };
}

function parseIsoDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const SupervisorActivitiesPage: React.FC<SupervisorActivitiesPageProps> = ({ lang, user }) => {
  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Activities & Timeline',
          subtitle: 'Overview of appointment requests from your interns.',
          viewAll: 'All',
          viewAppt: 'Appointments',
          statusAll: 'All status',
          statusRequested: 'Requested',
          statusConfirmed: 'Confirmed',
          statusRescheduled: 'Rescheduled',
          statusCancelled: 'Cancelled',
          calendar: 'Calendar Overview',
          days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
          empty: 'No activities yet.',
          apptTitle: 'Appointment Request',
          apptOnline: 'Online',
          apptCompany: 'Company',
          syncTitle: 'Live Ecosystem Sync',
          syncDesc: 'Appointment requests are automatically mirrored here.',
        },
        TH: {
          title: 'กิจกรรมและลำดับเวลา',
          subtitle: 'ภาพรวมการขอเข้าพบจากนักศึกษาที่คุณดูแล',
          viewAll: 'ทั้งหมด',
          viewAppt: 'ขอเข้าพบ',
          statusAll: 'ทุกสถานะ',
          statusRequested: 'ขอเข้าพบแล้ว',
          statusConfirmed: 'ยืนยันแล้ว',
          statusRescheduled: 'เลื่อนนัด',
          statusCancelled: 'ยกเลิก',
          calendar: 'ภาพรวมปฏิทิน',
          days: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
          empty: 'ยังไม่มีกิจกรรม',
          apptTitle: 'ขอเข้าพบ',
          apptOnline: 'ออนไลน์',
          apptCompany: 'บริษัท',
          syncTitle: 'ซิงค์ข้อมูลระบบแล้ว',
          syncDesc: 'นัดหมายขอเข้าพบจะแสดงที่นี่โดยอัตโนมัติ',
        },
      }[lang]),
    [lang],
  );

  const [viewMode, setViewMode] = useState<'ALL' | 'APPOINTMENT'>('ALL');

  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isMonthFilterEnabled, setIsMonthFilterEnabled] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED'>('ALL');

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
        const modeLabelText = mode === 'COMPANY' ? { EN: t.apptCompany, TH: t.apptCompany } : { EN: t.apptOnline, TH: t.apptOnline };

        out.push({
          id: `appt:${d.id}:${String(ar.time ?? '')}:${dateKey}`,
          day: String(date.getUTCDate()).padStart(2, '0'),
          month: monthLabel(date),
          title: {
            EN: `${t.apptTitle} (${modeLabelText.EN})`,
            TH: `${t.apptTitle} (${modeLabelText.TH})`,
          },
          time: ar.time ? String(ar.time) : '—',
          type: 'APPOINTMENT',
          internName: data.internName,
          status: typeof ar.status === 'string' ? ar.status : undefined,
        });
      });

      out.sort((a, b) => a.id.localeCompare(b.id));
      setApptActivities(out);
    });
  }, [t.apptCompany, t.apptOnline, t.apptTitle, user.id]);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'leaveRequests'), where('supervisorId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const out: ActivityEvent[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as LeaveRequestDoc;
          const start = typeof data.startDate === 'string' ? data.startDate : null;
          if (!start) return;
          const date = parseIsoDateKey(start);
          if (!date) return;
          const end = typeof data.endDate === 'string' ? data.endDate : start;
          const leaveType = String(data.type ?? 'LEAVE');
          const title =
            lang === 'TH'
              ? `ลา (${leaveType})`
              : `Leave (${leaveType})`;

          out.push({
            id: `leave:${d.id}:${start}`,
            day: String(date.getUTCDate()).padStart(2, '0'),
            month: monthLabel(date),
            title: { EN: title, TH: title },
            time: start === end ? start : `${start} - ${end}`,
            type: 'LEAVE',
            internName: typeof data.internName === 'string' ? data.internName : undefined,
            status: typeof data.status === 'string' ? data.status : undefined,
          });
        });
        out.sort((a, b) => a.id.localeCompare(b.id));
        setLeaveActivities(out);
      },
      () => setLeaveActivities([]),
    );
  }, [lang, user.id]);

  const filteredApptActivities = useMemo(() => {
    if (statusFilter === 'ALL') return apptActivities;
    return apptActivities.filter((ev) => String(ev.status ?? 'REQUESTED') === statusFilter);
  }, [apptActivities, statusFilter]);

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

    const merged = [...filteredApptActivities, ...leaveActivities]
      .map((ev) => ({ ev, key: toSortKey(ev) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.ev);

    const filtered = merged.filter((ev) => {
      if (viewMode === 'ALL') return true;
      if (viewMode === 'APPOINTMENT') return ev.type === 'APPOINTMENT';
      return true;
    });

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
  }, [calendarDate, filteredApptActivities, isMonthFilterEnabled, lang, selectedDateKey, viewMode]);

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

    const showAppt = viewMode === 'ALL' || viewMode === 'APPOINTMENT';
    return {
      appt: showAppt ? setFor(filteredApptActivities) : new Set<string>(),
      leave: viewMode === 'ALL' ? setFor(leaveActivities) : new Set<string>(),
    };
  }, [filteredApptActivities, leaveActivities, viewMode]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50/50 overflow-hidden relative p-6 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto w-full overflow-y-auto scrollbar-hide pb-20">
        <div className="mb-12">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">{t.subtitle}</p>
        </div>

        <div className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex bg-white border border-slate-100/60 rounded-[1.5rem] p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('ALL')}
                className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.viewAll}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('APPOINTMENT')}
                className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'APPOINTMENT' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.viewAppt}
              </button>
            </div>

            <div className="bg-white border border-slate-100/60 rounded-[1.5rem] p-1.5 shadow-sm">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-white text-slate-700 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-[1.25rem] border border-transparent focus:outline-none"
              >
                <option value="ALL">{t.statusAll}</option>
                <option value="REQUESTED">{t.statusRequested}</option>
                <option value="CONFIRMED">{t.statusConfirmed}</option>
                <option value="RESCHEDULED">{t.statusRescheduled}</option>
                <option value="CANCELLED">{t.statusCancelled}</option>
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
                    <div className="text-sm font-black text-slate-800">{lang === 'TH' ? 'ยังไม่มีกิจกรรม' : 'No activities yet'}</div>
                    <div className="text-xs font-bold text-slate-400 mt-1">{t.empty}</div>
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
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{item.month[lang]}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays size={14} className="text-blue-500" />
                          <h3
                            className={`text-[15px] font-bold leading-tight group-hover:text-blue-600 transition-colors ${
                              item.type === 'APPOINTMENT' ? 'text-blue-700' : 'text-slate-800'
                            }`}
                          >
                            {item.title[lang]}
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
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border bg-blue-50 text-blue-600 border-blue-200">
                            APPOINTMENT
                          </span>
                        ) : (
                          <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border bg-rose-50 text-rose-600 border-rose-200 flex items-center gap-2">
                            <UserX size={12} /> LEAVE
                          </span>
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
              <h3 className="text-lg font-black text-slate-800 mb-8">{t.calendar}</h3>
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
                      title={lang === 'TH' ? 'กรองกิจกรรมตามเดือนที่เลือก' : 'Filter activities by this month'}
                    >
                      {lang === 'TH' ? 'เดือน' : 'Month'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={lang === 'TH' ? 'เดือนก่อนหน้า' : 'Previous month'}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={lang === 'TH' ? 'เดือนถัดไป' : 'Next month'}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center">
                  {t.days.map((d) => (
                    <div key={d} className="text-[10px] font-black text-slate-300 py-2">
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
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{t.syncTitle}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">{t.syncDesc}</p>
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

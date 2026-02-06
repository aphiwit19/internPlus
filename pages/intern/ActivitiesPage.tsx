import React, { useEffect, useMemo, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MoreHorizontal,
  Plus,
  Circle,
  CalendarX,
  PlaneTakeoff,
  UserX
} from 'lucide-react';
import { Language } from '@/types';
import { useTranslation } from 'react-i18next';

import { useAppContext } from '@/app/AppContext';
import { createLeaveRepository } from '@/app/leaveRepository';

import { collection, doc, onSnapshot } from 'firebase/firestore';
import { firestoreDb } from '@/firebase';

interface ActivityEvent {
  id: string;
  day: string;
  month: { EN: string; TH: string };
  title: { EN: string; TH: string };
  time: string;
  type: 'LEARNING' | 'MEETING' | 'DEADLINE' | 'TASK' | 'LEAVE' | 'EVALUATION';
  internName?: string;
}

type UniversityEvaluationLink = {
  id: string;
  label: string;
  url: string;
  createdAt?: unknown;
};

type UniversityEvaluationFile = {
  id: string;
  label: string;
  category?: 'Sending' | 'Evaluation' | 'Requirement' | 'Other';
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
};

type UniversityEvaluationDoc = {
  links?: UniversityEvaluationLink[];
  files?: UniversityEvaluationFile[];
};

interface ActivitiesPageProps {
  lang: Language;
}

const ActivitiesPage: React.FC<ActivitiesPageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const leaveRepo = useMemo(() => createLeaveRepository(), []);
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const trLng = (lng: 'en' | 'th', key: string, options?: any) => String(t(key, { ...(options ?? {}), lng }));
  const uiLang: Language = (i18n.resolvedLanguage ?? i18n.language) === 'th' ? 'TH' : 'EN';

  const [viewMode, setViewMode] = useState<'ALL' | 'LEAVE' | 'TASK'>('ALL');

  const [calendarDate, setCalendarDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isMonthFilterEnabled, setIsMonthFilterEnabled] = useState(false);

  const [leaveActivities, setLeaveActivities] = useState<ActivityEvent[]>([]);
  const [taskActivities, setTaskActivities] = useState<ActivityEvent[]>([]);
  const [evaluationActivities, setEvaluationActivities] = useState<ActivityEvent[]>([]);

  const monthLabel = (d: Date) => {
    const m = d.getUTCMonth();
    const en = String(t('intern_activities.months.short', { lng: 'en' } as any)).split('|')[m] ?? '';
    const th = String(t('intern_activities.months.short', { lng: 'th' } as any)).split('|')[m] ?? '';
    return { EN: en, TH: th };
  };

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLeaveActivities([]);
      return;
    }

    leaveRepo
      .list({ role: 'INTERN', user })
      .then((list) => {
        if (cancelled) return;

        const approved = list.filter((r) => r.status === 'APPROVED');
        const toDate = (iso: string) => {
          const d = new Date(`${iso}T00:00:00.000Z`);
          return Number.isNaN(d.getTime()) ? null : d;
        };

        const daysInclusive = (startIso: string, endIso: string) => {
          const s = toDate(startIso);
          const e = toDate(endIso);
          if (!s || !e) return [] as Date[];
          const dates: Date[] = [];
          const cur = new Date(s.getTime());
          while (cur.getTime() <= e.getTime()) {
            dates.push(new Date(cur.getTime()));
            cur.setUTCDate(cur.getUTCDate() + 1);
          }
          return dates;
        };

        const typeTitle = (type: string) => {
          if (type === 'SICK') return { EN: trLng('en', 'intern_activities.leave_types.sick'), TH: trLng('th', 'intern_activities.leave_types.sick') };
          if (type === 'PERSONAL') return { EN: trLng('en', 'intern_activities.leave_types.personal'), TH: trLng('th', 'intern_activities.leave_types.personal') };
          if (type === 'BUSINESS') return { EN: trLng('en', 'intern_activities.leave_types.business'), TH: trLng('th', 'intern_activities.leave_types.business') };
          if (type === 'VACATION') return { EN: trLng('en', 'intern_activities.leave_types.vacation'), TH: trLng('th', 'intern_activities.leave_types.vacation') };
          return { EN: trLng('en', 'intern_activities.leave_types.generic'), TH: trLng('th', 'intern_activities.leave_types.generic') };
        };

        const events: ActivityEvent[] = [];
        approved.forEach((r) => {
          const dates = daysInclusive(r.startDate, r.endDate);
          dates.forEach((d) => {
            const day = String(d.getUTCDate()).padStart(2, '0');
            events.push({
              id: `leave:${r.id}:${d.toISOString().slice(0, 10)}`,
              day,
              month: monthLabel(d),
              title: typeTitle(r.type),
              time: tr('intern_activities.time.full_day'),
              type: 'LEAVE',
            });
          });
        });

        events.sort((a, b) => a.id.localeCompare(b.id));
        setLeaveActivities(events);
      })
      .catch(() => {
        if (cancelled) return;
        setLeaveActivities([]);
      });

    return () => {
      cancelled = true;
    };
  }, [leaveRepo, user]);

  useEffect(() => {
    if (!user) {
      setTaskActivities([]);
      return;
    }

    const toDateKey = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const buildTaskEvents = (projects: any[], kind: 'assigned' | 'personal') => {
      const out: ActivityEvent[] = [];
      projects.forEach((p: any) => {
        const pid = String(p?.id ?? '');
        const pTitle = typeof p?.title === 'string' ? p.title : '';
        const tasks = Array.isArray(p?.tasks) ? p.tasks : [];
        tasks.forEach((t: any) => {
          const tid = String(t?.id ?? '');
          const title = typeof t?.title === 'string' ? t.title : '';
          const ps = typeof t?.plannedStart === 'string' ? t.plannedStart : '';
          const pe = typeof t?.plannedEnd === 'string' ? t.plannedEnd : '';
          const start = ps ? new Date(ps) : null;
          if (!start || Number.isNaN(start.getTime())) return;

          const day = String(start.getUTCDate()).padStart(2, '0');
          const month = monthLabel(start);
          const end = pe ? new Date(pe) : null;
          const time = end && !Number.isNaN(end.getTime())
            ? `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const dateKey = toDateKey(start);
          const projectPrefix = pTitle ? ` (${pTitle})` : '';
          out.push({
            id: `task:${kind}:${pid}:${tid}:${dateKey}`,
            day,
            month,
            title: {
              EN: trLng('en', 'intern_activities.event_titles.task', { title: `${title}${projectPrefix}` } as any),
              TH: trLng('th', 'intern_activities.event_titles.task', { title: `${title}${projectPrefix}` } as any),
            },
            time,
            type: 'TASK',
          });
        });
      });
      return out;
    };

    let assignedProjects: any[] = [];
    let personalProjects: any[] = [];

    const assignedRef = collection(firestoreDb, 'users', user.id, 'assignmentProjects');
    const personalRef = collection(firestoreDb, 'users', user.id, 'personalProjects');

    const rebuild = () => {
      const events = [...buildTaskEvents(assignedProjects, 'assigned'), ...buildTaskEvents(personalProjects, 'personal')];
      events.sort((a, b) => a.id.localeCompare(b.id));
      setTaskActivities(events);
    };

    const unsubAssigned = onSnapshot(assignedRef, (snap) => {
      assignedProjects = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      rebuild();
    });

    const unsubPersonal = onSnapshot(personalRef, (snap) => {
      personalProjects = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      rebuild();
    });

    return () => {
      unsubAssigned();
      unsubPersonal();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setEvaluationActivities([]);
      return;
    }

    const parseCreatedAt = (value: unknown): Date | null => {
      if (!value) return null;
      if (typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (typeof value === 'string') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      const maybeTs = value as { toDate?: () => Date };
      if (typeof maybeTs?.toDate === 'function') {
        const d = maybeTs.toDate();
        return d && !Number.isNaN(d.getTime()) ? d : null;
      }
      return null;
    };

    const toDateKey = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const ref = doc(firestoreDb, 'universityEvaluations', user.id);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setEvaluationActivities([]);
        return;
      }

      const data = snap.data() as UniversityEvaluationDoc;
      const links = Array.isArray(data.links) ? data.links : [];
      const files = Array.isArray(data.files) ? data.files : [];

      const events: ActivityEvent[] = [];

      links.forEach((l) => {
        const created = parseCreatedAt(l.createdAt) ?? null;
        const d = created ?? new Date();
        const day = String(d.getUTCDate()).padStart(2, '0');
        const dateKey = toDateKey(d);
        events.push({
          id: `evaluation:link:${l.id}:${dateKey}`,
          day,
          month: monthLabel(d),
          title: {
            EN: trLng('en', 'intern_activities.event_titles.evaluation_link', { label: l.label } as any),
            TH: trLng('th', 'intern_activities.event_titles.evaluation_link', { label: l.label } as any),
          },
          time: created ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('intern_activities.time.unknown'),
          type: 'TASK',
        });
      });

      files.forEach((f) => {
        const created = parseCreatedAt(f.createdAt) ?? null;
        const d = created ?? new Date();
        const day = String(d.getUTCDate()).padStart(2, '0');
        const dateKey = toDateKey(d);
        const cat = f.category ? ` (${f.category})` : '';
        events.push({
          id: `evaluation:file:${f.id}:${dateKey}`,
          day,
          month: monthLabel(d),
          title: {
            EN: trLng('en', 'intern_activities.event_titles.university_doc', { category: cat, label: f.label } as any),
            TH: trLng('th', 'intern_activities.event_titles.university_doc', { category: cat, label: f.label } as any),
          },
          time: created ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('intern_activities.time.unknown'),
          type: 'TASK',
        });
      });

      events.sort((a, b) => a.id.localeCompare(b.id));
      setEvaluationActivities(events);
    });
  }, [user]);

  const groupedActivities = useMemo(() => {
    const groups: Array<{ dateLabel: string; items: ActivityEvent[] }> = [];
    const monthName = (m: string) => m;
    const labelFor = (ev: ActivityEvent) => {
      const month = monthName(ev.month[uiLang]);
      return `${ev.day} ${month}`;
    };

    const extractDateKey = (ev: ActivityEvent): string | null => {
      const parts = ev.id.split(':');
      const dateKey = parts[parts.length - 1] ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
      return null;
    };

    const activeMonthKey = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;

    const toSortKey = (ev: ActivityEvent) => {
      const parts = ev.id.split(':');
      const dateKey = parts[parts.length - 1] ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        const d = new Date(`${dateKey}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) return d.getTime();
      }
      const idx = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(ev.month.EN);
      const year = new Date().getFullYear();
      const month = idx >= 0 ? idx : new Date().getMonth();
      const day = Number(ev.day);
      const fallback = new Date(Date.UTC(year, month, day));
      return fallback.getTime();
    };

    const merged = [...leaveActivities, ...taskActivities, ...evaluationActivities]
      .map((ev) => ({ ev, key: toSortKey(ev) }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.ev);

    const filtered = merged.filter((ev) => {
      if (viewMode === 'ALL') return true;
      if (viewMode === 'LEAVE') return ev.type === 'LEAVE';
      if (viewMode === 'TASK') return ev.type === 'TASK';
      return true;
    });

    const filteredBySelectedDate = selectedDateKey
      ? filtered.filter((ev) => extractDateKey(ev) === selectedDateKey)
      : filtered;

    const filteredByMonth = !selectedDateKey && isMonthFilterEnabled
      ? filteredBySelectedDate.filter((ev) => {
          const dk = extractDateKey(ev);
          if (!dk) return false;
          return dk.slice(0, 7) === activeMonthKey;
        })
      : filteredBySelectedDate;

    filteredByMonth.forEach((ev) => {
      const label = labelFor(ev);
      const last = groups[groups.length - 1];
      if (!last || last.dateLabel !== label) {
        groups.push({ dateLabel: label, items: [ev] });
      } else {
        last.items.push(ev);
      }
    });
    return groups;
  }, [uiLang, leaveActivities, taskActivities, evaluationActivities, viewMode, selectedDateKey, isMonthFilterEnabled, calendarDate]);

  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const calendarTitle = useMemo(() => {
    const locale = uiLang === 'TH' ? 'th-TH' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarDate);
  }, [calendarDate, uiLang]);

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

    const showLeaves = viewMode === 'ALL' || viewMode === 'LEAVE';
    const showTasks = viewMode === 'ALL' || viewMode === 'TASK';
    return {
      leave: showLeaves ? setFor(leaveActivities) : new Set<string>(),
      task: showTasks ? setFor([...taskActivities, ...evaluationActivities]) : new Set<string>(),
    };
  }, [leaveActivities, taskActivities, evaluationActivities, viewMode]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50/50 overflow-hidden relative p-6 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto w-full overflow-y-auto scrollbar-hide pb-20">
        <div className="mb-12">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{tr('intern_activities.title')}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">{tr('intern_activities.subtitle')}</p>
        </div>

        <div className="mb-10">
          <div className="inline-flex bg-white border border-slate-100/60 rounded-[1.5rem] p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('ALL')}
              className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tr('intern_activities.filters.all')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LEAVE')}
              className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'LEAVE' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tr('intern_activities.filters.leave')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TASK')}
              className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'TASK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tr('intern_activities.filters.activities')}
            </button>
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
                    <div className="text-sm font-black text-slate-800">{tr('intern_activities.empty.title')}</div>
                    <div className="text-xs font-bold text-slate-400 mt-1">{tr('intern_activities.empty.subtitle')}</div>
                  </div>
                </div>
              </div>
            ) : (
              groupedActivities.map((group) => (
                <div key={group.dateLabel} className="space-y-3">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] px-2">
                    {group.dateLabel}
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} className={`bg-white rounded-[1.5rem] p-6 border shadow-sm flex items-center group hover:shadow-md transition-all cursor-pointer ${item.type === 'LEAVE' ? 'border-rose-100 bg-rose-50/10' : 'border-slate-100/60'}`}>
                      <div className={`flex flex-col items-center justify-center min-w-[80px] border-r pr-8 mr-8 ${item.type === 'LEAVE' ? 'border-rose-100' : 'border-slate-100'}`}>
                        <span className={`text-2xl font-black leading-none ${item.type === 'LEAVE' ? 'text-rose-500' : 'text-slate-800'}`}>{item.day}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{item.month[uiLang]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.type === 'LEAVE' && <UserX size={14} className="text-rose-400" />}
                          <h3 className={`text-[15px] font-bold leading-tight group-hover:text-blue-600 transition-colors ${item.type === 'LEAVE' ? 'text-rose-600' : 'text-slate-800'}`}>
                            {item.title[uiLang]}
                          </h3>
                        </div>
                        <p className="text-slate-400 text-[11px] font-black mt-1 uppercase tracking-wider">{item.time}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                          item.type === 'TASK' ? 'bg-slate-50 text-slate-600 border-slate-100' :
                          item.type === 'LEAVE' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                          'bg-red-50 text-red-500 border-red-100'
                        }`}>{item.type === 'LEAVE' ? tr('intern_activities.labels.absence_log') : item.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100/60 sticky top-4">
              <h3 className="text-lg font-black text-slate-800 mb-8">{tr('intern_activities.calendar.title')}</h3>
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
                      title={tr('intern_activities.tooltips.filter_by_month')}
                    >
                      {tr('intern_activities.labels.month')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={tr('intern_activities.tooltips.previous_month')}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="p-1 text-slate-400 hover:text-slate-900"
                      title={tr('intern_activities.tooltips.next_month')}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center">
                  {(uiLang === 'TH' ? tr('intern_activities.days.th') : tr('intern_activities.days.en')).split('|').map((d, i) => (
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
                    const hasLeave = markerMap.leave.has(dateKey);
                    const hasTask = markerMap.task.has(dateKey);
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
                        {!isToday && (hasTask || hasLeave) && (
                          <div className="absolute bottom-1.5 flex items-center gap-1">
                            {hasTask && <div className="w-1 h-1 bg-blue-400 rounded-full"></div>}
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
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{tr('intern_activities.sync.title')}</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-medium">{tr('intern_activities.sync.description')}</p>
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

export default ActivitiesPage;

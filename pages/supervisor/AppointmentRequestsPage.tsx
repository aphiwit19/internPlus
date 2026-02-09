import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Edit2, Save, Search, X } from 'lucide-react';
import { arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { Language, UserProfile } from '@/types';
import { firestoreDb } from '@/firebase';

import { toast } from 'sonner';

type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED';

type AppointmentMode = 'ONLINE' | 'COMPANY';

type AppointmentRequest = {
  date?: string;
  time?: string;
  status?: AppointmentStatus;
  mode?: AppointmentMode;
  note?: string;
  supervisorNote?: string;
  updatedAt?: unknown;
};

type UniversityEvaluationDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
  supervisorId: string | null;
  appointmentRequest?: AppointmentRequest;
  appointmentHistory?: AppointmentHistoryEntry[];
  updatedAt?: unknown;
};

type InternContact = {
  id: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
};

type AppointmentItem = UniversityEvaluationDoc & { id: string };

type AppointmentHistoryEntry = {
  id: string;
  actor: 'INTERN' | 'SUPERVISOR';
  date?: string;
  time?: string;
  status?: string;
  mode?: string;
  note?: string;
  supervisorNote?: string;
  createdAt?: unknown;
};

type EditDraft = {
  date: string;
  time: string;
  status: AppointmentStatus;
  mode: AppointmentMode;
  supervisorNote: string;
};

interface AppointmentRequestsPageProps {
  lang: Language;
  user: UserProfile;
}

const AppointmentRequestsPage: React.FC<AppointmentRequestsPageProps> = ({ lang: _lang, user }) => {
  const { t } = useTranslation();
  const lng = _lang === 'TH' ? 'th' : 'en';
  const tr = (key: string, options?: any) => String(t(key, { ...(options ?? {}), lng }));

  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [internContacts, setInternContacts] = useState<Record<string, InternContact>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [historyPages, setHistoryPages] = useState<Record<string, number>>({});
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<AppointmentStatus>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [listPage, setListPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const HISTORY_PAGE_SIZE = 3;
  const LIST_PAGE_SIZE = 5;

  const toastInitRef = useRef(false);
  const prevToastMapRef = useRef<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setLoadError(null);
    setIsLoading(true);
    const q = query(collection(firestoreDb, 'universityEvaluations'), where('supervisorId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as UniversityEvaluationDoc) }))
          .filter((x) => Boolean(x.appointmentRequest));

        arr.sort((a, b) => (a.internName || '').localeCompare(b.internName || ''));
        setItems(arr);
        setIsLoading(false);

        const nextMap: Record<string, string> = {};
        arr.forEach((it) => {
          const ar = it.appointmentRequest;
          const key = `${String(ar?.status ?? '')}|${String(ar?.date ?? '')}|${String(ar?.time ?? '')}|${String(ar?.mode ?? '')}|${String(ar?.note ?? '')}`;
          nextMap[it.id] = key;

          if (toastInitRef.current) {
            const prevKey = prevToastMapRef.current[it.id];
            if (prevKey && prevKey !== key) {
              const status = String(ar?.status ?? 'REQUESTED');
              const title = tr('supervisor_appointment_requests.toast.updated_title', { name: it.internName } as any);
              const detail = `${String(ar?.date ?? '--')} ${String(ar?.time ?? '--')} • ${String(ar?.mode ?? 'ONLINE')}`;
              toast(title, { description: `${status}\n${detail}`, duration: 6000 });
            }
            if (!prevKey) {
              const title = tr('supervisor_appointment_requests.toast.new_title', { name: it.internName } as any);
              const detail = `${String(ar?.date ?? '--')} ${String(ar?.time ?? '--')} • ${String(ar?.mode ?? 'ONLINE')}`;
              toast(title, { description: detail, duration: 6000 });
            }
          }
        });

        prevToastMapRef.current = nextMap;
        if (!toastInitRef.current) toastInitRef.current = true;

        setDrafts((prev) => {
          const next: Record<string, EditDraft> = { ...prev };
          for (const it of arr) {
            if (next[it.id]) continue;
            const ar = it.appointmentRequest ?? {};
            next[it.id] = {
              date: String(ar.date ?? ''),
              time: String(ar.time ?? ''),
              status: (ar.status ?? 'REQUESTED') as AppointmentStatus,
              mode: (ar.mode ?? 'ONLINE') as AppointmentMode,
              supervisorNote: String(ar.supervisorNote ?? ''),
            };
          }
          return next;
        });
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load'}`);
        setIsLoading(false);
      },
    );
  }, [user.id, lng]);

  const resetDraftFromItem = (it: AppointmentItem) => {
    const ar = it.appointmentRequest ?? {};
    const currentStatus = (ar.status ?? 'REQUESTED') as AppointmentStatus;
    const defaultStatus: AppointmentStatus = currentStatus === 'REQUESTED' ? 'CONFIRMED' : currentStatus;
    setDrafts((prev) => ({
      ...prev,
      [it.id]: {
        date: String(ar.date ?? ''),
        time: String(ar.time ?? ''),
        status: defaultStatus,
        mode: (ar.mode ?? 'ONLINE') as AppointmentMode,
        supervisorNote: String(ar.supervisorNote ?? ''),
      },
    }));
  };

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('supervisorId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, InternContact> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as Partial<InternContact> & {
            email?: string;
            phone?: string;
            position?: string;
            department?: string;
            hasLoggedIn?: boolean;
          };

          if (data.hasLoggedIn === false) return;
          map[d.id] = {
            id: d.id,
            email: typeof data.email === 'string' ? data.email : undefined,
            phone: typeof data.phone === 'string' ? data.phone : undefined,
            position: typeof data.position === 'string' ? data.position : undefined,
            department: typeof data.department === 'string' ? data.department : undefined,
          };
        });
        setInternContacts(map);
      },
      () => {
        setInternContacts({});
      },
    );
  }, [user.id]);

  const statusLabel = (s: AppointmentStatus) => {
    if (s === 'REQUESTED') return tr('supervisor_appointment_requests.status.requested');
    if (s === 'CONFIRMED') return tr('supervisor_appointment_requests.status.confirmed');
    if (s === 'RESCHEDULED') return tr('supervisor_appointment_requests.status.rescheduled');
    if (s === 'CANCELLED') return tr('supervisor_appointment_requests.status.cancelled');
    return tr('supervisor_appointment_requests.status.requested');
  };

  const modeLabel = (m: AppointmentMode) => {
    if (m === 'COMPANY') return tr('supervisor_appointment_requests.mode.company');
    return tr('supervisor_appointment_requests.mode.online');
  };

  const statusBadgeClass = (s: AppointmentStatus) => {
    if (s === 'CONFIRMED') return 'bg-emerald-100 border-emerald-200';
    if (s === 'REQUESTED') return 'bg-amber-100 border-amber-200';
    if (s === 'RESCHEDULED') return 'bg-violet-100 border-violet-200';
    if (s === 'CANCELLED') return 'bg-rose-100 border-rose-200';
    return 'bg-white border-slate-200';
  };

  const isScheduleChanged = (it: AppointmentItem, d: EditDraft) => {
    const ar = it.appointmentRequest ?? {};
    const prevDate = String(ar.date ?? '');
    const prevTime = String(ar.time ?? '');
    const prevMode = (ar.mode ?? 'ONLINE') as AppointmentMode;
    return d.date !== prevDate || d.time !== prevTime || d.mode !== prevMode;
  };

  const canSave = (id: string) => {
    const d = drafts[id];
    if (!d) return false;
    if (!d.date || !d.time || !d.mode) return false;
    if (d.status === 'REQUESTED') return false;
    if (d.status === 'RESCHEDULED') {
      if (!String(d.supervisorNote ?? '').trim()) return false;
      const it = items.find((x) => x.id === id);
      if (!it) return false;
      return isScheduleChanged(it, d);
    }
    return true;
  };

  const handleSave = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSavingId(id);
    try {
      const ref = doc(firestoreDb, 'universityEvaluations', id);
      await updateDoc(ref, {
        'appointmentRequest.date': d.date,
        'appointmentRequest.time': d.time,
        'appointmentRequest.status': d.status,
        'appointmentRequest.mode': d.mode,
        'appointmentRequest.supervisorNote': d.supervisorNote,
        appointmentHistory: arrayUnion({
          id: String(Date.now()),
          actor: 'SUPERVISOR',
          date: d.date,
          time: d.time,
          status: d.status,
          mode: d.mode,
          supervisorNote: d.supervisorNote,
          createdAt: Date.now(),
        }),
        'appointmentRequest.updatedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setEditingId(null);
      setExpandedId((prev) => (prev === id ? null : prev));
    } finally {
      setSavingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return items.filter((it) => {
      const ar = it.appointmentRequest ?? {};
      const s = (ar.status ?? 'REQUESTED') as AppointmentStatus;
      if (statusFilter.size > 0 && !statusFilter.has(s)) return false;
      if (!q) return true;
      return String(it.internName ?? '').toLowerCase().includes(q);
    });
  }, [items, searchText, statusFilter]);

  useEffect(() => {
    setListPage(1);
  }, [searchText, statusFilter]);

  const listPageCount = useMemo(() => Math.ceil(filteredItems.length / LIST_PAGE_SIZE) || 1, [filteredItems.length]);
  const safeListPage = useMemo(() => Math.max(1, Math.min(listPageCount, listPage)), [listPageCount, listPage]);
  const pagedItems = useMemo(() => {
    const start = (safeListPage - 1) * LIST_PAGE_SIZE;
    return filteredItems.slice(start, start + LIST_PAGE_SIZE);
  }, [filteredItems, safeListPage]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {loadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {loadError}
          </div>
        ) : null}

        <div className="mb-8">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <CalendarDays size={20} />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{tr('supervisor_appointment_requests.title')}</h1>
                </div>
                <p className="text-slate-500 text-sm font-medium">{tr('supervisor_appointment_requests.subtitle')}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={tr('supervisor_appointment_requests.search_placeholder')}
                    className="w-full sm:w-[260px] bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div ref={filterRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((v) => !v)}
                    className="w-full sm:w-[220px] bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      {statusFilter.size === 0
                        ? tr('supervisor_appointment_requests.filter_all')
                        : Array.from(statusFilter).map((s) => statusLabel(s)).join(', ')}
                    </span>
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {filterOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full sm:w-[220px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      {(['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED'] as AppointmentStatus[]).map((s) => {
                        const checked = statusFilter.has(s);
                        return (
                          <label
                            key={s}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setStatusFilter((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s)) next.delete(s);
                                  else next.add(s);
                                  return next;
                                });
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`flex items-center gap-2 text-xs font-bold ${checked ? 'text-slate-900' : 'text-slate-600'}`}>
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                s === 'REQUESTED' ? 'bg-amber-400' : s === 'CONFIRMED' ? 'bg-emerald-400' : s === 'RESCHEDULED' ? 'bg-violet-400' : 'bg-rose-400'
                              }`} />
                              {statusLabel(s)}
                            </span>
                          </label>
                        );
                      })}
                      {statusFilter.size > 0 && (
                        <div className="border-t border-slate-100 mt-1 pt-1 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => setStatusFilter(new Set())}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                          >
                            {tr('supervisor_appointment_requests.filter_all')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="hidden lg:flex items-center px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-700">
                  {filteredItems.length} {tr('supervisor_appointment_requests.results')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {isLoading ? (
            <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_appointment_requests.loading')}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_appointment_requests.empty')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pagedItems.map((it) => {
                const ar = it.appointmentRequest ?? {};
                const currentStatus = (ar.status ?? 'REQUESTED') as AppointmentStatus;
                const currentMode = (ar.mode ?? 'ONLINE') as AppointmentMode;
                const draft = drafts[it.id];
                const contact = internContacts[it.internId] ?? internContacts[it.id] ?? null;
                const isEditing = editingId === it.id;
                const isExpanded = expandedId === it.id || isEditing;

                const displayEmail = contact?.email ?? undefined;
                const displayPhone = contact?.phone ?? undefined;
                const displayPosition = contact?.position ?? it.internPosition ?? undefined;
                const displayDepartment = contact?.department ?? it.internDepartment ?? undefined;

                return (
                  <div key={it.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <img src={it.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                        <div className="min-w-0">
                          <p className="text-lg font-black text-slate-900 truncate">{it.internName}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                            {(displayPosition ?? tr('supervisor_appointment_requests.interns.position_fallback')) +
                              ' • ' +
                              (displayDepartment ?? tr('supervisor_appointment_requests.interns.department_fallback'))}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === it.id ? null : it.id))}
                          className="h-10 w-10 rounded-2xl bg-slate-50 text-slate-700 border border-slate-200 flex items-center justify-center hover:bg-white hover:border-slate-300 transition-all"
                          title={
                            isExpanded
                              ? tr('supervisor_appointment_requests.actions.collapse')
                              : tr('supervisor_appointment_requests.actions.expand')
                          }
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {!isEditing ? (
                          <button
                            type="button"
                            onClick={() => {
                              resetDraftFromItem(it);
                              setEditingId(it.id);
                              setExpandedId(it.id);
                            }}
                            className="h-10 px-5 rounded-2xl bg-blue-600 text-white border border-blue-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                            title={tr('supervisor_appointment_requests.actions.edit')}
                          >
                            <Edit2 size={16} />
                            {tr('supervisor_appointment_requests.actions.edit')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              resetDraftFromItem(it);
                              setEditingId(null);
                            }}
                            className="h-10 px-5 rounded-2xl bg-rose-600 text-white border border-rose-600 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                            title={tr('supervisor_appointment_requests.actions.cancel')}
                          >
                            <X size={18} />
                            {tr('supervisor_appointment_requests.actions.cancel')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div
                        className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest text-slate-900 ${statusBadgeClass(
                          currentStatus,
                        )}`}
                      >
                        {statusLabel(currentStatus)}
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-blue-50 text-slate-900 border border-blue-100 text-[10px] font-black uppercase tracking-widest">
                        {modeLabel(currentMode)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-black text-slate-400">
                        <Clock size={14} />
                        {(ar.date ? String(ar.date) : '--') + ' ' + (ar.time ? String(ar.time) : '--')}
                      </div>
                    </div>

                    {!isExpanded ? null : (
                      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {tr('supervisor_appointment_requests.fields.email')}
                          </div>
                          <div className="text-sm font-black text-slate-900 break-words">{displayEmail ?? '-'}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {tr('supervisor_appointment_requests.fields.phone')}
                          </div>
                          <div className="text-sm font-black text-slate-900">{displayPhone ?? '-'}</div>
                        </div>
                      </div>
                    )}

                    {!isEditing ? null : (
                      <div className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('supervisor_appointment_requests.fields.date')}</label>
                            <input
                              type="date"
                              value={draft?.date ?? ''}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [it.id]: { ...(prev[it.id] ?? { date: '', time: '', status: 'REQUESTED', mode: 'ONLINE', supervisorNote: '' }), date: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('supervisor_appointment_requests.fields.time')}</label>
                            <input
                              type="time"
                              value={draft?.time ?? ''}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [it.id]: { ...(prev[it.id] ?? { date: '', time: '', status: 'REQUESTED', mode: 'ONLINE', supervisorNote: '' }), time: e.target.value },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('supervisor_appointment_requests.fields.mode')}</label>
                            <select
                              value={draft?.mode ?? 'ONLINE'}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [it.id]: { ...(prev[it.id] ?? { date: '', time: '', status: 'REQUESTED', mode: 'ONLINE', supervisorNote: '' }), mode: e.target.value as AppointmentMode },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900"
                            >
                              <option value="ONLINE">{tr('supervisor_appointment_requests.mode.online')}</option>
                              <option value="COMPANY">{tr('supervisor_appointment_requests.mode.company')}</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('supervisor_appointment_requests.fields.status')}</label>
                            <select
                              value={draft?.status ?? 'REQUESTED'}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [it.id]: {
                                    ...(prev[it.id] ?? { date: '', time: '', status: 'REQUESTED', mode: 'ONLINE', supervisorNote: '' }),
                                    status: e.target.value as AppointmentStatus,
                                  },
                                }))
                              }
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900"
                            >
                              <option value="CONFIRMED">{tr('supervisor_appointment_requests.status.confirmed')}</option>
                              <option value="RESCHEDULED">{tr('supervisor_appointment_requests.status.rescheduled')}</option>
                              <option value="CANCELLED">{tr('supervisor_appointment_requests.status.cancelled')}</option>
                            </select>
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => void handleSave(it.id)}
                              disabled={savingId === it.id || !canSave(it.id)}
                              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingId === it.id ? <Clock size={16} className="animate-spin" /> : <Save size={16} />}
                              {savingId === it.id ? tr('supervisor_appointment_requests.actions.saving') : tr('supervisor_appointment_requests.actions.save')}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('supervisor_appointment_requests.fields.supervisor_note')}</label>
                          <textarea
                            value={draft?.supervisorNote ?? ''}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [it.id]: { ...(prev[it.id] ?? { date: '', time: '', status: 'REQUESTED', mode: 'ONLINE', supervisorNote: '' }), supervisorNote: e.target.value },
                              }))
                            }
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 h-[84px] resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {isExpanded && Array.isArray(it.appointmentHistory) && it.appointmentHistory.length > 0 ? (
                      <div className="mt-5 p-5 rounded-[1.5rem] bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{tr('supervisor_appointment_requests.history.title')}</div>
                        {(() => {
                          const page = historyPages[it.id] ?? 1;
                          const all = [...it.appointmentHistory].slice().reverse();
                          const pageCount = Math.ceil(all.length / HISTORY_PAGE_SIZE) || 1;
                          const safePage = Math.max(1, Math.min(pageCount, page));
                          const start = (safePage - 1) * HISTORY_PAGE_SIZE;
                          const displayed = all.slice(start, start + HISTORY_PAGE_SIZE);

                          return (
                            <>
                              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-hide">
                                {displayed.map((h) => {
                                  const hs = (String(h.status ?? 'REQUESTED') as AppointmentStatus) ?? 'REQUESTED';
                                  const hm = (String(h.mode ?? 'ONLINE') as AppointmentMode) ?? 'ONLINE';
                                  const who =
                                    h.actor === 'SUPERVISOR'
                                      ? tr('supervisor_appointment_requests.history.actor.supervisor')
                                      : tr('supervisor_appointment_requests.history.actor.intern');

                                  return (
                                    <div key={h.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="pt-1 flex flex-col items-center">
                                          <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                                          <div className="w-px flex-1 bg-slate-200 mt-2" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <div className="text-sm font-black text-slate-900">{who}</div>
                                              <div
                                                className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest text-slate-900 ${statusBadgeClass(
                                                  hs,
                                                )}`}
                                              >
                                                {statusLabel(hs)}
                                              </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                              <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400" />
                                                <span>{(h.date ? String(h.date) : '--') + ' ' + (h.time ? String(h.time) : '--')}</span>
                                              </div>
                                              <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                                {hm ? modeLabel(hm) : '--'}
                                              </div>
                                            </div>
                                          </div>

                                          {String(h.supervisorNote ?? '').trim() ? (
                                            <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                {t('supervisor_appointment_requests.fields.supervisor_note')}
                                              </div>
                                              <div className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{String(h.supervisorNote)}</div>
                                            </div>
                                          ) : null}

                                          {String(h.note ?? '').trim() ? (
                                            <div className="mt-2 p-3 rounded-2xl bg-white border border-slate-100">
                                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                {t('supervisor_appointment_requests.fields.note')}
                                              </div>
                                              <div className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{String(h.note)}</div>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {pageCount > 1 && (
                                <div className="pt-4 flex justify-center">
                                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryPages((prev) => ({
                                          ...prev,
                                          [it.id]: Math.max(1, (prev[it.id] ?? 1) - 1),
                                        }))
                                      }
                                      disabled={safePage <= 1}
                                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                    >
                                      <ChevronLeft size={18} />
                                    </button>

                                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={() => setHistoryPages((prev) => ({ ...prev, [it.id]: p }))}
                                        className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                                          p === safePage
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                                        }`}
                                      >
                                        {p}
                                      </button>
                                    ))}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryPages((prev) => ({
                                          ...prev,
                                          [it.id]: Math.min(pageCount, (prev[it.id] ?? 1) + 1),
                                        }))
                                      }
                                      disabled={safePage >= pageCount}
                                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                    >
                                      <ChevronRight size={18} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}

                    {typeof ar.note === 'string' && ar.note.trim() ? (
                      <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{tr('supervisor_appointment_requests.fields.note')}</div>
                        <div className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{ar.note}</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {listPageCount > 1 && (
                <div className="pt-2 flex justify-center">
                  <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      disabled={safeListPage <= 1}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {(() => {
                      const pages = Array.from({ length: listPageCount }, (_, i) => i + 1);
                      if (listPageCount <= 5) {
                        return pages.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setListPage(p)}
                            className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                              p === safeListPage
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        ));
                      }

                      const groupStart = Math.floor((safeListPage - 1) / 3) * 3 + 1;
                      const groupEnd = Math.min(listPageCount, groupStart + 2);
                      const groupPages = pages.filter((p) => p >= groupStart && p <= groupEnd);

                      return groupPages.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setListPage(p)}
                          className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                            p === safeListPage
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      ));
                    })()}

                    <button
                      type="button"
                      onClick={() => setListPage((p) => Math.min(listPageCount, p + 1))}
                      disabled={safeListPage >= listPageCount}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentRequestsPage;

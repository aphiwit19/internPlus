
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  Filter, 
  Play, 
  Square, 
  CheckCircle, 
  AlertCircle,
  ChevronDown,
  Info,
  Home,
  Building2
} from 'lucide-react';
import { Language } from '@/types';
import { useAppContext } from '@/app/AppContext';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';
import { useTranslation } from 'react-i18next';

type WorkMode = 'WFH' | 'WFO';

interface AttendanceRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  workMode: WorkMode;
  workDuration?: string;
}

interface AttendancePageProps {
  lang: Language;
}

const AttendancePage: React.FC<AttendancePageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeWorkMode, setActiveWorkMode] = useState<WorkMode>('WFO');
  const [pendingWorkMode, setPendingWorkMode] = useState<WorkMode>('WFO');
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');
  const [filterWorkMode, setFilterWorkMode] = useState<'ALL' | WorkMode>('ALL');
  const [pendingFilterDate, setPendingFilterDate] = useState<string>('');
  const [pendingFilterStatus, setPendingFilterStatus] = useState<'ALL' | 'PRESENT' | 'LATE'>('ALL');
  const [pendingFilterWorkMode, setPendingFilterWorkMode] = useState<'ALL' | WorkMode>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);

  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionClockIn, setCorrectionClockIn] = useState('');
  const [correctionClockOut, setCorrectionClockOut] = useState('');
  const [correctionFiles, setCorrectionFiles] = useState<File[]>([]);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
  interface CorrectionInfo {
    status: CorrectionStatus;
    supervisorDecisionNote?: string;
    requestedClockIn?: string;
    requestedClockOut?: string;
  }
  const [correctionsByDate, setCorrectionsByDate] = useState<Record<string, CorrectionInfo>>({});

  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const coerceToDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const maybeTs = value as { toDate?: () => Date };
    if (typeof maybeTs?.toDate === 'function') {
      const d = maybeTs.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }

    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const maybeObj = value as { seconds?: unknown; nanoseconds?: unknown };
    if (typeof maybeObj?.seconds === 'number') {
      const nanos = typeof maybeObj.nanoseconds === 'number' ? maybeObj.nanoseconds : 0;
      const ms = maybeObj.seconds * 1000 + Math.floor(nanos / 1_000_000);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
  };

  const formatTime = (value: unknown): string | null => {
    const d = coerceToDate(value);
    if (!d) return null;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const computeStatus = (clockInAt: unknown): 'PRESENT' | 'LATE' => {
    const d = coerceToDate(clockInAt);
    if (!d) return 'PRESENT';
    const minutes = d.getHours() * 60 + d.getMinutes();
    const lateAfterMinutes = 9 * 60;
    return minutes > lateAfterMinutes ? 'LATE' : 'PRESENT';
  };

  const computeDuration = (clockInAt: unknown, clockOutAt: unknown): string | undefined => {
    const a = coerceToDate(clockInAt);
    const b = coerceToDate(clockOutAt);
    if (!a || !b) return undefined;
    const start = a.getTime();
    const end = b.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
    const totalMinutes = Math.floor((end - start) / (1000 * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setIsClockedIn(false);
      setClockInTime(null);
      return;
    }

    const attendanceRef = collection(firestoreDb, 'users', user.id, 'attendance');
    const q = query(attendanceRef, orderBy('date', 'desc'), limit(60));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: AttendanceRecord[] = snap.docs
          .map((d) => {
            const raw = d.data() as any;
            const date = typeof raw?.date === 'string' ? raw.date : d.id;
            const mode: WorkMode = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';
            const clockIn = formatTime(raw?.clockInAt) ?? '--';
            const clockOut = formatTime(raw?.clockOutAt);
            const status = raw?.clockInAt ? computeStatus(raw.clockInAt) : 'ABSENT';
            const duration = raw?.clockInAt && raw?.clockOutAt ? computeDuration(raw.clockInAt, raw.clockOutAt) : undefined;
            return {
              id: d.id,
              date,
              clockIn,
              clockOut,
              status,
              workMode: mode,
              workDuration: duration,
            } satisfies AttendanceRecord;
          })
          .filter((it) => Boolean(it.date));

        setHistory(items);

        const todayKey = toLocalDateKey(new Date());
        const today = items.find((r) => r.date === todayKey) ?? null;
        if (today && today.clockIn !== '--' && !today.clockOut) {
          setIsClockedIn(true);
          setClockInTime(today.clockIn);
          setActiveWorkMode(today.workMode);
        } else {
          setIsClockedIn(false);
          setClockInTime(null);
        }
      },
      (err) => {
        setActionError((err as { message?: string })?.message ?? tr('intern_attendance.errors.load_failed'));
        setHistory([]);
      },
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCorrectionsByDate({});
      return;
    }
    const q = query(
      collection(firestoreDb, 'timeCorrections'),
      where('internId', '==', user.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, CorrectionInfo> = {};
      snap.forEach((d) => {
        const raw = d.data() as any;
        const date = typeof raw?.date === 'string' ? raw.date : '';
        const status: CorrectionStatus =
          raw?.status === 'APPROVED' ? 'APPROVED' :
          raw?.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
        if (!date) return;
        const note = typeof raw?.supervisorDecisionNote === 'string' ? raw.supervisorDecisionNote : undefined;
        const requestedClockIn = typeof raw?.requestedClockIn === 'string' ? raw.requestedClockIn : undefined;
        const requestedClockOut = typeof raw?.requestedClockOut === 'string' ? raw.requestedClockOut : undefined;
        map[date] = { status, supervisorDecisionNote: note, requestedClockIn, requestedClockOut };
      });
      setCorrectionsByDate(map);
    }, () => setCorrectionsByDate({}));
    return () => unsub();
  }, [user]);

  const handleClockToggle = async () => {
    if (!user) return;
    setActionError(null);

    const todayKey = toLocalDateKey(new Date());
    const ref = doc(firestoreDb, 'users', user.id, 'attendance', todayKey);

    try {
      if (!isClockedIn) {
        const existing = await getDoc(ref);
        const data = existing.exists() ? (existing.data() as any) : null;
        if (data?.clockInAt && !data?.clockOutAt) {
          setActionError(tr('intern_attendance.errors.already_clocked_in'));
          return;
        }

        await setDoc(
          ref,
          {
            date: todayKey,
            workMode: pendingWorkMode,
            clockInAt: serverTimestamp(),
            clockOutAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        setActiveWorkMode(pendingWorkMode);
      } else {
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          setActionError(tr('intern_attendance.errors.no_record_today'));
          return;
        }
        const data = existing.data() as any;
        if (!data?.clockInAt) {
          setActionError(tr('intern_attendance.errors.no_clock_in_time'));
          return;
        }
        if (data?.clockOutAt) {
          setActionError(tr('intern_attendance.errors.already_clocked_out'));
          return;
        }
        await updateDoc(ref, { clockOutAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? tr('intern_attendance.errors.generic'));
    }
  };

  const filteredHistory = history.filter((r) => {
    if (filterDate && r.date !== filterDate) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterWorkMode !== 'ALL' && r.workMode !== filterWorkMode) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedHistory = filteredHistory.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const daysSince = (dateKey: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const [y, m, d] = dateKey.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const localDay = new Date(y, m - 1, d);
    if (Number.isNaN(localDay.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - localDay.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const canRequestCorrection = (r: AttendanceRecord): boolean => {
    if (!user) return false;
    const hasClockIn = r.clockIn !== '--';
    const hasClockOut = Boolean(r.clockOut);
    if (!hasClockIn && !hasClockOut) return false;
    if (hasClockIn && hasClockOut) return false;
    const ds = daysSince(r.date);
    if (ds == null) return false;
    return ds >= 0;
  };

  const handleOpenCorrection = (r: AttendanceRecord) => {
    if (!canRequestCorrection(r)) return;
    setCorrectionRecord(r);
    setCorrectionReason('');
    setCorrectionClockIn(r.clockIn !== '--' ? r.clockIn : '');
    setCorrectionClockOut(r.clockOut ? r.clockOut : '');
    setCorrectionFiles([]);
  };

  const handleSubmitCorrection = async () => {
    if (!user) return;
    if (!correctionRecord) return;
    if (!canRequestCorrection(correctionRecord)) return;
    const reason = correctionReason.trim();
    if (!reason) return;
    const hasIn = correctionRecord.clockIn !== '--';
    const hasOut = Boolean(correctionRecord.clockOut);

    const requestedClockIn = correctionClockIn.trim();
    const requestedClockOut = correctionClockOut.trim();
    if (!hasIn && !requestedClockIn) return;
    if (!hasOut && !requestedClockOut) return;

    const record = correctionRecord;
    setCorrectionRecord(null);

    let supervisorId: string | undefined = typeof (user as any)?.supervisorId === 'string' ? (user as any).supervisorId : undefined;
    if (!supervisorId) {
      try {
        const userSnap = await getDoc(doc(firestoreDb, 'users', user.id));
        const userData = userSnap.exists() ? (userSnap.data() as any) : null;
        const fromDoc = typeof userData?.supervisorId === 'string' ? userData.supervisorId : undefined;
        supervisorId = fromDoc;
      } catch {
        // ignore
      }
    }

    try {
      setIsSubmittingCorrection(true);
      const id = `${user.id}_${record.date}`;

      const attachments: Array<{ fileName: string; storagePath: string }> = [];
      for (const file of correctionFiles) {
        const safeName = file.name;
        const storagePath = `users/${user.id}/documents/timeCorrections/${record.date}/${Date.now()}_${safeName}`;
        await uploadBytes(storageRef(firebaseStorage, storagePath), file);
        attachments.push({ fileName: safeName, storagePath });
      }

      await setDoc(
        doc(firestoreDb, 'timeCorrections', id),
        {
          internId: user.id,
          internName: (user as any)?.name ?? 'Unknown',
          supervisorId: typeof supervisorId === 'string' ? supervisorId : undefined,
          date: record.date,
          workMode: record.workMode,
          reason,
          ...(requestedClockIn ? { requestedClockIn } : {}),
          ...(requestedClockOut ? { requestedClockOut } : {}),
          ...(attachments.length > 0 ? { attachments } : {}),
          status: 'PENDING',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setCorrectionReason('');
      setCorrectionClockIn('');
      setCorrectionClockOut('');
      setCorrectionFiles([]);
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? 'Failed to submit correction request');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-y-auto overscroll-contain relative p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full">
        {correctionRecord && (
          <>
            <div
              className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm"
              onClick={() => (isSubmittingCorrection ? void 0 : setCorrectionRecord(null))}
            />
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Request Time Correction</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                      {correctionRecord.date}
                    </div>
                  </div>
                  <button
                    onClick={() => (isSubmittingCorrection ? void 0 : setCorrectionRecord(null))}
                    className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                    disabled={isSubmittingCorrection}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-8 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-2 block">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock-in (HH:MM)</div>
                      <input
                        value={correctionClockIn}
                        onChange={(e) => setCorrectionClockIn(e.target.value)}
                        placeholder="08:30"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                      />
                    </label>
                    <label className="space-y-2 block">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clock-out (HH:MM)</div>
                      <input
                        value={correctionClockOut}
                        onChange={(e) => setCorrectionClockOut(e.target.value)}
                        placeholder="17:30"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                      />
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason (required)</div>
                    <textarea
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[120px]"
                    />
                  </label>

                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attach document (optional)</div>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setCorrectionFiles(files);
                      }}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    />
                    {correctionFiles.length > 0 ? (
                      <div className="text-[11px] font-bold text-slate-500 break-words">
                        {correctionFiles.map((f) => f.name).join(', ')}
                      </div>
                    ) : null}
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setCorrectionRecord(null)}
                      disabled={isSubmittingCorrection}
                      className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleSubmitCorrection()}
                      disabled={isSubmittingCorrection || !correctionReason.trim()}
                      className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-60 disabled:hover:bg-blue-600"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 md:mb-12">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{tr('intern_attendance.title')}</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">{tr('intern_attendance.subtitle')}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {!isClockedIn && (
              <div className="flex p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50 h-fit">
                <button onClick={() => setPendingWorkMode('WFO')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${pendingWorkMode === 'WFO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Building2 size={14} /> WFO</button>
                <button onClick={() => setPendingWorkMode('WFH')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${pendingWorkMode === 'WFH' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Home size={14} /> WFH</button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { if (!isClockedIn) void handleClockToggle(); }}
                disabled={isClockedIn}
                className={`flex items-center gap-2 px-7 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl ${
                  !isClockedIn
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Play size={16} fill="currentColor" /> {tr('intern_attendance.actions.clock_in')}
              </button>
              <button
                onClick={() => { if (isClockedIn) void handleClockToggle(); }}
                disabled={!isClockedIn}
                className={`flex items-center gap-2 px-7 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl ${
                  isClockedIn
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Square size={16} fill="currentColor" /> {tr('intern_attendance.actions.clock_out')}
              </button>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-8">{tr('intern_attendance.filters.title')}</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('intern_attendance.filters.date_range')}</label>
                  <div className="flex flex-col gap-3">
                    <input
                      type="date"
                      value={pendingFilterDate}
                      onChange={(e) => setPendingFilterDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('intern_attendance.filters.status_filter')}</label>
                  <div className="relative">
                    <select
                      value={pendingFilterStatus}
                      onChange={(e) => setPendingFilterStatus(e.target.value as 'ALL' | 'PRESENT' | 'LATE')}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"
                    >
                      <option value="ALL">{tr('intern_attendance.filters.all_status')}</option>
                      <option value="PRESENT">{tr('intern_attendance.status.present')}</option>
                      <option value="LATE">{tr('intern_attendance.status.late')}</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{tr('intern_attendance.filters.work_mode')}</label>
                  <div className="relative">
                    <select
                      value={pendingFilterWorkMode}
                      onChange={(e) => setPendingFilterWorkMode(e.target.value as 'ALL' | WorkMode)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"
                    >
                      <option value="ALL">{tr('intern_attendance.filters.all_modes')}</option>
                      <option value="WFO">WFO</option>
                      <option value="WFH">WFH</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFilterDate(pendingFilterDate);
                    setFilterStatus(pendingFilterStatus);
                    setFilterWorkMode(pendingFilterWorkMode);
                    setCurrentPage(1);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 py-3.5 rounded-2xl text-xs font-bold border border-blue-100/50"
                >
                  <Filter size={16} /> {tr('intern_attendance.filters.apply')}
                </button>
              </div>
            </div>

            {isClockedIn && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] p-8 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                    <div>
                      <h4 className="text-xs font-bold uppercase opacity-70">{tr('intern_attendance.session.title')}</h4>
                      <p className="text-sm font-black">{activeWorkMode === 'WFO' ? tr('intern_attendance.session.at_office') : tr('intern_attendance.session.working_home')}</p>
                    </div>
                  </div>
                </div>
                <div className="text-4xl font-black mb-4">{currentTime.toLocaleTimeString()}</div>
                <div className="bg-white/10 p-4 rounded-2xl flex justify-between">
                  <div><p className="text-[9px] uppercase font-bold opacity-60">{tr('intern_attendance.session.started_at')}</p><p className="text-sm font-bold">{clockInTime}</p></div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-bold text-slate-900">{tr('intern_attendance.history.title')}</h3>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tr('intern_attendance.history.last_30_days')}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase pl-4">{tr('intern_attendance.table.date')}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{tr('intern_attendance.table.clock_in')}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{tr('intern_attendance.table.clock_out')}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{tr('intern_attendance.table.mode')}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{tr('intern_attendance.table.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedHistory.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 pl-4 font-bold text-slate-700 text-sm">{record.date}</td>
                      <td className="py-6 text-sm">{record.clockIn}</td>
                      <td className="py-6 text-sm">{record.clockOut || '--'}</td>
                      <td className="py-6">
                        <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-[9px] font-bold">{record.workMode}</div>
                      </td>
                      <td className="py-6">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {record.status === 'PRESENT' ? tr('intern_attendance.status.present') : tr('intern_attendance.status.late')}
                            </span>
                            {correctionsByDate[record.date] ? (
                              <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                                correctionsByDate[record.date].status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : correctionsByDate[record.date].status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-50 text-amber-600'
                              }`}>
                                {correctionsByDate[record.date].status === 'APPROVED' ? '✓ Approved'
                                  : correctionsByDate[record.date].status === 'REJECTED' ? '✕ Rejected'
                                  : '⏳ Pending'}
                              </span>
                            ) : null}
                            {canRequestCorrection(record) && !correctionsByDate[record.date] ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCorrection(record)}
                                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                              >
                                Request correction
                              </button>
                            ) : null}
                          </div>
                          {correctionsByDate[record.date]?.supervisorDecisionNote ? (
                            <div className="text-[10px] font-bold text-slate-500 italic">
                              Note: {correctionsByDate[record.date].supervisorDecisionNote}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                  aria-label={tr('intern_attendance.pagination.previous_page')}
                >
                  {'<'}
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => {
                  const isActive = page === currentPage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-xl border text-[11px] font-black transition-all ${
                        isActive
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[11px] font-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                  aria-label={tr('intern_attendance.pagination.next_page')}
                >
                  {'>'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;

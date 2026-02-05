
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
} from 'firebase/firestore';

import { firestoreDb } from '@/firebase';

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

const AttendancePage: React.FC<AttendancePageProps> = ({ lang }) => {
  const { user } = useAppContext();

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

  const formatTime = (value: unknown): string | null => {
    if (!value) return null;
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe?.toDate !== 'function') return null;
    const d = maybe.toDate();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const computeStatus = (clockInAt: unknown): 'PRESENT' | 'LATE' => {
    const maybe = clockInAt as { toDate?: () => Date };
    if (typeof maybe?.toDate !== 'function') return 'PRESENT';
    const d = maybe.toDate();
    const minutes = d.getHours() * 60 + d.getMinutes();
    const lateAfterMinutes = 9 * 60;
    return minutes > lateAfterMinutes ? 'LATE' : 'PRESENT';
  };

  const computeDuration = (clockInAt: unknown, clockOutAt: unknown): string | undefined => {
    const a = clockInAt as { toDate?: () => Date };
    const b = clockOutAt as { toDate?: () => Date };
    if (typeof a?.toDate !== 'function' || typeof b?.toDate !== 'function') return undefined;
    const start = a.toDate().getTime();
    const end = b.toDate().getTime();
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
        setActionError((err as { message?: string })?.message ?? 'Failed to load attendance.');
        setHistory([]);
      },
    );

    return () => unsub();
  }, [user]);

  const t = {
    EN: {
      title: "Time Attendance",
      subtitle: "Track your working hours and view history.",
      clockInBtn: "Clock In Now",
      clockOutBtn: "Clock Out Now",
      filter: "Time Report Filter",
      dateRange: "Date Range",
      statusFilter: "Status Filter",
      modeFilter: "Work Mode",
      allStatus: "All Status",
      presentStatus: "PRESENT",
      lateStatus: "LATE",
      allMode: "All Mode",
      apply: "Apply Filter",
      session: "Active Session",
      office: "At Office",
      home: "Working Home",
      startedAt: "Started at",
      history: "Attendance History",
      last30: "Last 30 Days",
      dateCol: "Date",
      inCol: "Clock In",
      outCol: "Clock Out",
      modeCol: "Mode",
      statusCol: "Status",
      present: "PRESENT",
      late: "LATE"
    },
    TH: {
      title: "ลงเวลาเข้าออก",
      subtitle: "ติดตามเวลาทำงานและดูประวัติย้อนหลัง",
      clockInBtn: "ลงเวลาเข้างาน",
      clockOutBtn: "ลงเวลาออกงาน",
      filter: "ตัวกรองรายงานเวลา",
      dateRange: "ช่วงวันที่",
      statusFilter: "กรองตามสถานะ",
      modeFilter: "รูปแบบการทำงาน",
      allStatus: "สถานะทั้งหมด",
      presentStatus: "ปกติ",
      lateStatus: "สาย",
      allMode: "ทุกโหมด",
      apply: "ใช้ตัวกรอง",
      session: "ช่วงเวลาทำงานปัจจุบัน",
      office: "ทำงานที่ออฟฟิศ",
      home: "ทำงานจากบ้าน",
      startedAt: "เริ่มเมื่อเวลา",
      history: "ประวัติการลงเวลา",
      last30: "30 วันที่ผ่านมา",
      dateCol: "วันที่",
      inCol: "เวลาเข้า",
      outCol: "เวลาออก",
      modeCol: "รูปแบบ",
      statusCol: "สถานะ",
      present: "ปกติ",
      late: "สาย"
    }
  }[lang];

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
          setActionError(lang === 'TH' ? 'คุณได้ลงเวลาเข้างานแล้ว' : 'You are already clocked in.');
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
          setActionError(lang === 'TH' ? 'ไม่พบรายการลงเวลาในวันนี้' : 'No attendance record found for today.');
          return;
        }
        const data = existing.data() as any;
        if (!data?.clockInAt) {
          setActionError(lang === 'TH' ? 'ไม่พบเวลาเข้างาน' : 'No clock-in time found.');
          return;
        }
        if (data?.clockOutAt) {
          setActionError(lang === 'TH' ? 'คุณได้ลงเวลาออกงานแล้ว' : 'You are already clocked out.');
          return;
        }
        await updateDoc(ref, { clockOutAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? (lang === 'TH' ? 'เกิดข้อผิดพลาด' : 'Something went wrong.'));
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

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-y-auto overscroll-contain relative p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 md:mb-12">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">{t.subtitle}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {!isClockedIn && (
              <div className="flex p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50 h-fit">
                <button onClick={() => setPendingWorkMode('WFO')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${pendingWorkMode === 'WFO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Building2 size={14} /> WFO</button>
                <button onClick={() => setPendingWorkMode('WFH')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${pendingWorkMode === 'WFH' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Home size={14} /> WFH</button>
              </div>
            )}
            <button onClick={handleClockToggle} className={`flex items-center gap-3 px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl ${isClockedIn ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
              {isClockedIn ? <><Square size={18} fill="currentColor" /> {t.clockOutBtn}</> : <><Play size={18} fill="currentColor" /> {t.clockInBtn}</>}
            </button>
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
              <h3 className="text-lg font-bold text-slate-900 mb-8">{t.filter}</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t.dateRange}</label>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t.statusFilter}</label>
                  <div className="relative">
                    <select
                      value={pendingFilterStatus}
                      onChange={(e) => setPendingFilterStatus(e.target.value as 'ALL' | 'PRESENT' | 'LATE')}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"
                    >
                      <option value="ALL">{t.allStatus}</option>
                      <option value="PRESENT">{t.presentStatus}</option>
                      <option value="LATE">{t.lateStatus}</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">{t.modeFilter}</label>
                  <div className="relative">
                    <select
                      value={pendingFilterWorkMode}
                      onChange={(e) => setPendingFilterWorkMode(e.target.value as 'ALL' | WorkMode)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 appearance-none outline-none cursor-pointer"
                    >
                      <option value="ALL">{t.allMode}</option>
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
                  <Filter size={16} /> {t.apply}
                </button>
              </div>
            </div>

            {isClockedIn && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2rem] p-8 text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Clock size={20} /></div>
                    <div>
                      <h4 className="text-xs font-bold uppercase opacity-70">{t.session}</h4>
                      <p className="text-sm font-black">{activeWorkMode === 'WFO' ? t.office : t.home}</p>
                    </div>
                  </div>
                </div>
                <div className="text-4xl font-black mb-4">{currentTime.toLocaleTimeString()}</div>
                <div className="bg-white/10 p-4 rounded-2xl flex justify-between">
                  <div><p className="text-[9px] uppercase font-bold opacity-60">{t.startedAt}</p><p className="text-sm font-bold">{clockInTime}</p></div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-bold text-slate-900">{t.history}</h3>
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.last30}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase pl-4">{t.dateCol}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{t.inCol}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{t.outCol}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{t.modeCol}</th>
                    <th className="pb-6 text-[10px] font-bold text-slate-400 uppercase">{t.statusCol}</th>
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
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${record.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                          {record.status === 'PRESENT' ? t.present : t.late}
                        </span>
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
                  aria-label="Previous page"
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
                  aria-label="Next page"
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

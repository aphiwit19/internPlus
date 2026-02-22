import React, { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Files, History, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';

export type AttendanceViewMode = 'LOG' | 'CALENDAR';

export interface AttendanceLogItem {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  mode: 'WFO' | 'WFH';
  status: 'PRESENT' | 'LATE';
  duration: string;
}

type CorrectionDoc = {
  id: string;
  internId: string;
  internName: string;
  date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedClockIn?: string;
  requestedClockOut?: string;
  supervisorDecisionNote?: string;
  workMode: 'WFH' | 'WFO';
  attachments: Array<{ fileName: string; storagePath: string }>;
};

type ExcelImportDoc = {
  id: string;
  internId: string;
  internName: string;
  fileName: string;
  storagePath: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'FAILED';
  submittedAtMs?: number;
  reviewedAtMs?: number;
  reviewedByName?: string;
  reviewedByRole?: string;
};

const AttendanceCalendar = ({ logs }: { logs: AttendanceLogItem[] }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const monthName = currentDate.toLocaleString(undefined, { month: 'long' }).toUpperCase();

  const getLogForDay = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return logs.find((l) => l.date === formattedDate);
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-10 px-4">
        <div className="flex items-center gap-6">
          <h4 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
            {monthName} <span className="text-slate-200">{year}</span>
          </h4>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
              title={tr('supervisor_attendance_calendar.tooltips.previous_month')}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
              title={tr('supervisor_attendance_calendar.tooltips.next_month')}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.legend.present')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.legend.late')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-100"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.legend.weekend_off')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border border-slate-50 rounded-[2.5rem] overflow-hidden bg-slate-50/20">
        {tr('supervisor_attendance_calendar.days.short').split('|').map((d) => (
          <div
            key={d}
            className="py-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] bg-white/50 border-b border-slate-50"
          >
            {d}
          </div>
        ))}
        {padding.map((i) => (
          <div key={`p-${i}`} className="aspect-square border-r border-b border-slate-50 bg-slate-50/10"></div>
        ))}
        {days.map((day) => {
          const log = getLogForDay(day);
          const isWeekend = (firstDayOfMonth + day - 1) % 7 === 0 || (firstDayOfMonth + day - 1) % 7 === 6;
          const now = new Date();
          const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

          return (
            <div
              key={day}
              className={`aspect-square p-4 border-r border-b border-slate-50 group transition-all relative ${
                isToday ? 'bg-blue-600/10' : isWeekend ? 'bg-slate-50/30' : 'bg-white hover:bg-blue-50/30'
              }`}
            >
              <span
                className={`text-sm font-black ${
                  isToday ? 'text-blue-700' : log ? 'text-slate-900' : isWeekend ? 'text-slate-200' : 'text-slate-300'
                }`}
              >
                {day}
              </span>

              {log && (
                <div className="mt-2 space-y-2">
                  <div
                    className={`p-2 rounded-xl border flex flex-col gap-1 transition-all group-hover:shadow-lg group-hover:-translate-y-1 ${
                      log.status === 'PRESENT'
                        ? 'bg-emerald-50 border-emerald-100'
                        : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[8px] font-black uppercase tracking-widest ${
                          log.status === 'PRESENT' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {log.status}
                      </span>
                      {log.mode === 'WFO' ? (
                        <Building2 size={10} className="text-slate-400" />
                      ) : (
                        <Home size={10} className="text-slate-400" />
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-800">
                      {log.clockIn} — {log.clockOut}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface AttendanceTabProps {
  internId?: string;
  logs: AttendanceLogItem[];
  viewMode: AttendanceViewMode;
  onViewModeChange: (mode: AttendanceViewMode) => void;
}

const AttendanceTab: React.FC<AttendanceTabProps> = ({ internId, logs, viewMode, onViewModeChange }) => {
  const { t } = useTranslation();
  const tr = (key: string) => String(t(key));
  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<'excel' | 'corrections'>('excel');
  const [corrections, setCorrections] = useState<CorrectionDoc[]>([]);
  const [excelImports, setExcelImports] = useState<ExcelImportDoc[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(logs.length / PAGE_SIZE)), [logs.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedLogs = useMemo(
    () => logs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, logs],
  );

  useEffect(() => {
    if (!isHistoryOpen || !internId) return;

    const unsubs: Array<() => void> = [];

    const q1 = query(collection(firestoreDb, 'timeCorrections'), where('internId', '==', internId));
    unsubs.push(
      onSnapshot(
        q1,
        (snap) => {
          const list: CorrectionDoc[] = [];
          snap.forEach((d) => {
            const raw = d.data() as any;
            const date = typeof raw?.date === 'string' ? raw.date : '';
            const reason = typeof raw?.reason === 'string' ? raw.reason : '';
            const status: CorrectionDoc['status'] =
              raw?.status === 'APPROVED' ? 'APPROVED' : raw?.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
            const requestedClockIn = typeof raw?.requestedClockIn === 'string' ? raw.requestedClockIn : undefined;
            const requestedClockOut = typeof raw?.requestedClockOut === 'string' ? raw.requestedClockOut : undefined;
            const supervisorDecisionNote = typeof raw?.supervisorDecisionNote === 'string' ? raw.supervisorDecisionNote : undefined;
            const workMode: 'WFH' | 'WFO' = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';
            const internName = typeof raw?.internName === 'string' ? raw.internName : 'Unknown';
            const attachments = Array.isArray(raw?.attachments)
              ? (raw.attachments as any[]).flatMap((a) => {
                  const fileName = typeof a?.fileName === 'string' ? a.fileName : '';
                  const storagePath = typeof a?.storagePath === 'string' ? a.storagePath : '';
                  if (!fileName || !storagePath) return [];
                  return [{ fileName, storagePath }];
                })
              : [];
            if (!date) return;
            list.push({
              id: d.id,
              internId,
              internName,
              date,
              reason,
              status,
              requestedClockIn,
              requestedClockOut,
              supervisorDecisionNote,
              workMode,
              attachments,
            });
          });
          list.sort((a, b) => b.date.localeCompare(a.date));
          setCorrections(list);
        },
        () => setCorrections([]),
      ),
    );

    const q2 = query(
      collection(firestoreDb, 'attendanceExcelImports'),
      where('internId', '==', internId),
      orderBy('submittedAt', 'desc'),
      limit(50),
    );
    unsubs.push(
      onSnapshot(
        q2,
        (snap) => {
          const list: ExcelImportDoc[] = [];
          snap.forEach((d) => {
            const raw = d.data() as any;
            const fileName = typeof raw?.fileName === 'string' ? raw.fileName : 'Excel';
            const storagePath = typeof raw?.storagePath === 'string' ? raw.storagePath : '';
            if (!storagePath) return;
            const internName = typeof raw?.internName === 'string' ? raw.internName : 'Unknown';
            const status: ExcelImportDoc['status'] =
              raw?.status === 'APPLIED' || raw?.status === 'FAILED' || raw?.status === 'APPROVED' || raw?.status === 'REJECTED'
                ? raw.status
                : 'PENDING';
            const submittedAtMs = typeof raw?.submittedAt?.toMillis === 'function' ? raw.submittedAt.toMillis() : undefined;
            const reviewedAtMs = typeof raw?.reviewedAt?.toMillis === 'function' ? raw.reviewedAt.toMillis() : undefined;
            const reviewedByName = typeof raw?.reviewedByName === 'string' ? raw.reviewedByName : undefined;
            const reviewedByRole = typeof raw?.reviewedByRole === 'string' ? raw.reviewedByRole : undefined;
            list.push({
              id: d.id,
              internId,
              internName,
              fileName,
              storagePath,
              status,
              submittedAtMs,
              reviewedAtMs,
              reviewedByName,
              reviewedByRole,
            });
          });
          setExcelImports(list);
        },
        () => setExcelImports([]),
      ),
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [internId, isHistoryOpen]);

  const handleOpenHistory = (tab?: 'excel' | 'corrections') => {
    if (!internId) return;
    if (tab) setHistoryTab(tab);
    setIsHistoryOpen(true);
  };

  const handleOpenStoragePath = async (path: string) => {
    try {
      const url = await getDownloadURL(storageRef(firebaseStorage, path));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">

      {isHistoryOpen ? (
        <>
          <div className="fixed inset-0 z-[180] bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <div className="w-full max-w-5xl bg-white rounded-[2.75rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-start justify-between gap-6">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_history.title')}</div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-2">{tr('supervisor_attendance_history.subtitle')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all flex items-center justify-center"
                  aria-label={tr('supervisor_attendance_history.close')}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-[1.75rem] p-2">
                  <button
                    type="button"
                    onClick={() => setHistoryTab('excel')}
                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                      historyTab === 'excel' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Files size={16} /> {tr('supervisor_attendance_history.tab_excel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab('corrections')}
                    className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                      historyTab === 'corrections' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <CircleAlert size={16} /> {tr('supervisor_attendance_history.tab_corrections')}
                  </button>
                </div>

                <div className="mt-8 max-h-[70vh] overflow-y-auto pr-2">
                  {historyTab === 'excel' ? (
                    <>
                      {excelImports.length === 0 ? (
                        <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_history.empty_excel')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {excelImports.map((req) => (
                            <div key={req.id} className="p-6 bg-slate-50/50 rounded-[2.25rem] border border-slate-100">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-base font-black text-slate-900 truncate">{req.internName}</div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{req.internId}</div>
                                  <button
                                    type="button"
                                    className="mt-4 text-left text-[11px] font-black text-blue-600 hover:underline break-words"
                                    onClick={() => void handleOpenStoragePath(req.storagePath)}
                                  >
                                    {req.fileName}
                                  </button>
                                  {typeof req.submittedAtMs === 'number' ? (
                                    <div className="mt-2 text-[10px] font-bold text-slate-500">Submitted: {new Date(req.submittedAtMs).toLocaleString()}</div>
                                  ) : null}
                                  {req.reviewedByName ? (
                                    <div className="mt-1 text-[10px] font-bold text-slate-500">
                                      Reviewed by: {req.reviewedByName}{req.reviewedByRole ? ` (${req.reviewedByRole})` : ''}
                                      {typeof req.reviewedAtMs === 'number' ? ` • ${new Date(req.reviewedAtMs).toLocaleString()}` : ''}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                  <span
                                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                                      req.status === 'APPLIED'
                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                        : req.status === 'FAILED'
                                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                                          : req.status === 'REJECTED'
                                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                                            : req.status === 'APPROVED'
                                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                                              : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}
                                  >
                                    {req.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {corrections.length === 0 ? (
                        <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_history.empty_corrections')}</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {corrections.map((req) => (
                            <div key={req.id} className="p-6 bg-slate-50/50 rounded-[2.25rem] border border-slate-100">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-base font-black text-slate-900 truncate">{req.internName}</div>
                                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{req.date}</div>
                                  {(req.requestedClockIn || req.requestedClockOut) ? (
                                    <div className="mt-3 flex items-center gap-4">
                                      <div className="flex flex-col gap-1">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-in</div>
                                        <div className="text-[13px] font-black text-emerald-700">{req.requestedClockIn || '--'}</div>
                                      </div>
                                      <div className="text-slate-200 font-black">→</div>
                                      <div className="flex flex-col gap-1">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-out</div>
                                        <div className="text-[13px] font-black text-rose-600">{req.requestedClockOut || '--'}</div>
                                      </div>
                                    </div>
                                  ) : null}
                                  {req.reason ? (
                                    <div className="mt-3 text-[11px] font-bold text-slate-700 whitespace-pre-wrap break-words">{req.reason}</div>
                                  ) : null}
                                  {req.supervisorDecisionNote ? (
                                    <div className="mt-2 text-[10px] font-bold text-slate-500 italic">Note: {req.supervisorDecisionNote}</div>
                                  ) : null}
                                  {req.attachments.length > 0 ? (
                                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                                      {req.attachments.map((a) => (
                                        <button
                                          key={a.storagePath}
                                          type="button"
                                          className="text-left text-[11px] font-black text-blue-600 hover:underline break-words"
                                          onClick={() => void handleOpenStoragePath(a.storagePath)}
                                        >
                                          {a.fileName}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                  <span
                                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                      req.status === 'APPROVED'
                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                        : req.status === 'REJECTED'
                                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                          : 'bg-amber-50 text-amber-600 border border-amber-100'
                                    }`}
                                  >
                                    {req.status === 'APPROVED' ? '✓ Approved' : req.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('supervisor_attendance_calendar.title')}</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase mt-1">{tr('supervisor_attendance_calendar.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleOpenHistory()}
              disabled={!internId}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <History size={16} /> {tr('supervisor_attendance_history.button')}
            </button>

            <div className="flex bg-slate-50 p-1 rounded-[1.25rem] border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => onViewModeChange('LOG')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${
                viewMode === 'LOG'
                  ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 scale-[1.05]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tr('supervisor_attendance_calendar.log_view')}
            </button>
            <button
              onClick={() => onViewModeChange('CALENDAR')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${
                viewMode === 'CALENDAR'
                  ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 scale-[1.05]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tr('supervisor_attendance_calendar.calendar')}
            </button>
            </div>
          </div>
        </div>

        {viewMode === 'LOG' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">{tr('supervisor_attendance_calendar.col_date')}</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.col_clock_in')}</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.col_clock_out')}</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.col_mode')}</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_attendance_calendar.col_total_time')}</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-4">{tr('supervisor_attendance_calendar.col_status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pagedLogs.map((log) => (
                  <tr key={log.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="py-6 pl-4 font-black text-slate-700 text-sm">{log.date}</td>
                    <td className="py-6 text-sm font-bold text-slate-600">{log.clockIn}</td>
                    <td className="py-6 text-sm font-bold text-slate-600">{log.clockOut}</td>
                    <td className="py-6">
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[9px] font-black uppercase ${
                          log.mode === 'WFO'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}
                      >
                        {log.mode === 'WFO' ? <Building2 size={12} /> : <Home size={12} />} {log.mode}
                      </div>
                    </td>
                    <td className="py-6 text-sm font-black text-slate-900">{log.duration}</td>
                    <td className="py-6 text-right pr-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                          log.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="py-32 text-center flex flex-col items-center">
                <History size={48} className="text-slate-100 mb-6" />
                <p className="text-slate-300 font-black uppercase tracking-[0.3em]">{tr('supervisor_attendance_calendar.no_records')}</p>
              </div>
            )}

            {logs.length > PAGE_SIZE && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-black disabled:opacity-40"
                >
                  {'<'}
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl border text-xs font-black transition-all ${
                      page === currentPage
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-black disabled:opacity-40"
                >
                  {'>'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <AttendanceCalendar logs={logs} />
        )}
      </div>
    </div>
  );
};

export default AttendanceTab;

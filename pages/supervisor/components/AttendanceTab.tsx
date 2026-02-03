import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, History, Home } from 'lucide-react';

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

const AttendanceCalendar = ({ logs }: { logs: AttendanceLogItem[] }) => {
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
              title="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
              title="Next month"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PRESENT</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LATE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-100"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WEEKEND / OFF</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 border border-slate-50 rounded-[2.5rem] overflow-hidden bg-slate-50/20">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
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
  logs: AttendanceLogItem[];
  viewMode: AttendanceViewMode;
  onViewModeChange: (mode: AttendanceViewMode) => void;
}

const AttendanceTab: React.FC<AttendanceTabProps> = ({ logs, viewMode, onViewModeChange }) => {
  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);

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

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
      <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Time Attendance Audit</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Verification of daily clock records</p>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-[1.25rem] border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => onViewModeChange('LOG')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${
                viewMode === 'LOG'
                  ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 scale-[1.05]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              LOG VIEW
            </button>
            <button
              onClick={() => onViewModeChange('CALENDAR')}
              className={`px-8 py-3 rounded-xl text-[11px] font-black transition-all ${
                viewMode === 'CALENDAR'
                  ? 'bg-white text-blue-600 shadow-xl shadow-blue-500/10 scale-[1.05]'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              CALENDAR
            </button>
          </div>
        </div>

        {viewMode === 'LOG' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">DATE</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">CLOCK IN</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">CLOCK OUT</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">MODE</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL TIME</th>
                  <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-4">STATUS</th>
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
                <p className="text-slate-300 font-black uppercase tracking-[0.3em]">No attendance records found</p>
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

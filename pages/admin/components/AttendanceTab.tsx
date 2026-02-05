import React, { useEffect, useMemo, useState } from 'react';

import { Building2, ChevronLeft, ChevronRight, Home } from 'lucide-react';

import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { firestoreDb } from '@/firebase';
import { normalizeAvatarUrl } from '@/app/avatar';

type UserDoc = {
  name?: string;
  avatar?: string;
  roles?: string[];
};

type AttendanceDoc = {
  date?: string;
  workMode?: 'WFO' | 'WFH';
  clockInAt?: unknown;
  clockOutAt?: unknown;
};

type AttendanceRow = {
  internId: string;
  name: string;
  avatar: string;
  date: string;
  clockIn: string;
  clockOut: string;
  mode: 'WFO' | 'WFH';
  status: 'PRESENT' | 'LATE' | '—';
};

const AttendanceTab: React.FC = () => {
  const PAGE_SIZE = 5;

  const [interns, setInterns] = useState<Array<{ id: string; name: string; avatar: string }>>([]);
  const [latestByIntern, setLatestByIntern] = useState<Record<string, AttendanceRow>>({});

  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'), where('roles', 'array-contains', 'INTERN'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as UserDoc;
          return {
            id: d.id,
            name: data.name || 'Unknown',
            avatar: normalizeAvatarUrl(data.avatar),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setInterns(list);
      },
      () => {
        setInterns([]);
        setLatestByIntern({});
      },
    );
  }, []);

  useEffect(() => {
    setLatestByIntern({});
    if (interns.length === 0) return;

    const unsubs: Array<() => void> = [];

    for (const intern of interns) {
      const attRef = collection(firestoreDb, 'users', intern.id, 'attendance');
      const q = query(attRef, orderBy('date', 'desc'), limit(1));

      const unsub = onSnapshot(
        q,
        (snap) => {
          const docSnap = snap.docs[0];
          if (!docSnap) {
            setLatestByIntern((prev) => {
              const next = { ...prev };
              delete next[intern.id];
              return next;
            });
            return;
          }

          const raw = docSnap.data() as AttendanceDoc;
          const date = typeof raw?.date === 'string' ? raw.date : docSnap.id;
          const mode: 'WFO' | 'WFH' = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';
          const clockIn = formatTime(raw?.clockInAt) ?? '--';
          const clockOut = formatTime(raw?.clockOutAt) ?? '--';
          const status: AttendanceRow['status'] = raw?.clockInAt ? computeStatus(raw.clockInAt) : '—';

          setLatestByIntern((prev) => ({
            ...prev,
            [intern.id]: {
              internId: intern.id,
              name: intern.name,
              avatar: intern.avatar,
              date: date || '--',
              clockIn,
              clockOut,
              mode,
              status,
            },
          }));
        },
        () => {
          setLatestByIntern((prev) => {
            const next = { ...prev };
            delete next[intern.id];
            return next;
          });
        },
      );

      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [interns]);

  const rows = useMemo(() => {
    const list: AttendanceRow[] = [];
    for (const intern of interns) {
      const row = latestByIntern[intern.id];
      if (row) list.push(row);
      else {
        list.push({
          internId: intern.id,
          name: intern.name,
          avatar: intern.avatar,
          date: '--',
          clockIn: '--',
          clockOut: '--',
          mode: 'WFO',
          status: '—',
        });
      }
    }
    return list;
  }, [interns, latestByIntern]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length]);

  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, rows],
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Program Attendance Audit</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verification of daily work sessions</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">Intern</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Latest Date</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock In</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock Out</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Mode</th>
                <th className="pb-6 text-right pr-4 text-[10px] font-black text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedRows.map((log) => (
                <tr key={log.internId} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-4">
                      <img src={log.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      <span className="text-sm font-black text-slate-900">{log.name}</span>
                    </div>
                  </td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.date}</td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.clockIn}</td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.clockOut}</td>
                  <td className="py-6">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[9px] font-black uppercase ${
                        log.mode === 'WFO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}
                    >
                      {log.mode === 'WFO' ? <Building2 size={12} /> : <Home size={12} />} {log.mode}
                    </div>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                        log.status === 'PRESENT'
                          ? 'bg-emerald-50 text-emerald-600'
                          : log.status === 'LATE'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > PAGE_SIZE && (
          <div className="pt-6 flex justify-center">
            <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                    page === currentPage
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AttendanceTab;

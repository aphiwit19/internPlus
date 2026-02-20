import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Building2, ChevronLeft, ChevronRight, CircleAlert, Home, X } from 'lucide-react';

import { httpsCallable } from 'firebase/functions';

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { firestoreDb, firebaseFunctions, firebaseStorage } from '@/firebase';
import { normalizeAvatarUrl } from '@/app/avatar';
import { useAppContext } from '@/app/AppContext';

type UserDoc = {
  name?: string;
  avatar?: string;
  roles?: string[];
  hasLoggedIn?: boolean;
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

const AttendanceTab: React.FC = () => {
  const { t } = useTranslation();
  const tr = (key: string) => String(t(key));
  const { user } = useAppContext();
  const PAGE_SIZE = 5;

  const [interns, setInterns] = useState<Array<{ id: string; name: string; avatar: string }>>([]);
  const [latestByIntern, setLatestByIntern] = useState<Record<string, AttendanceRow>>({});
  const [corrections, setCorrections] = useState<CorrectionDoc[]>([]);
  const [excelImports, setExcelImports] = useState<ExcelImportDoc[]>([]);
  const [excelReviewError, setExcelReviewError] = useState<string | null>(null);
  const [excelReviewBusyId, setExcelReviewBusyId] = useState<string | null>(null);

  const [decisionTarget, setDecisionTarget] = useState<CorrectionDoc | null>(null);
  const [decisionMode, setDecisionMode] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

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
        const list = snap.docs.flatMap((d) => {
          const data = d.data() as UserDoc;
          if (data.hasLoggedIn === false) return [];
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
    const q = query(collection(firestoreDb, 'timeCorrections'));
    return onSnapshot(q, (snap) => {
      const list: CorrectionDoc[] = [];
      snap.forEach((d) => {
        const raw = d.data() as any;
        const internId = typeof raw?.internId === 'string' ? raw.internId : '';
        const internName = typeof raw?.internName === 'string' ? raw.internName : 'Unknown';
        const date = typeof raw?.date === 'string' ? raw.date : '';
        const reason = typeof raw?.reason === 'string' ? raw.reason : '';
        const status: CorrectionDoc['status'] =
          raw?.status === 'APPROVED' ? 'APPROVED' : raw?.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
        const requestedClockIn = typeof raw?.requestedClockIn === 'string' ? raw.requestedClockIn : undefined;
        const requestedClockOut = typeof raw?.requestedClockOut === 'string' ? raw.requestedClockOut : undefined;
        const supervisorDecisionNote = typeof raw?.supervisorDecisionNote === 'string' ? raw.supervisorDecisionNote : undefined;
        const workMode: 'WFH' | 'WFO' = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';
        const attachments = Array.isArray(raw?.attachments)
          ? (raw.attachments as any[]).flatMap((a) => {
              const fileName = typeof a?.fileName === 'string' ? a.fileName : '';
              const storagePath = typeof a?.storagePath === 'string' ? a.storagePath : '';
              if (!fileName || !storagePath) return [];
              return [{ fileName, storagePath }];
            })
          : [];
        if (!internId || !date) return;
        list.push({ id: d.id, internId, internName, date, reason, status, requestedClockIn, requestedClockOut, supervisorDecisionNote, workMode, attachments });
      });
      list.sort((a, b) => b.date.localeCompare(a.date));
      setCorrections(list);
    }, () => setCorrections([]));
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'attendanceExcelImports'), orderBy('submittedAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list: ExcelImportDoc[] = [];
        snap.forEach((d) => {
          const raw = d.data() as any;
          const internId = typeof raw?.internId === 'string' ? raw.internId : '';
          const internName = typeof raw?.internName === 'string' ? raw.internName : 'Unknown';
          const fileName = typeof raw?.fileName === 'string' ? raw.fileName : 'Excel';
          const storagePath = typeof raw?.storagePath === 'string' ? raw.storagePath : '';
          if (!internId || !storagePath) return;

          const status: ExcelImportDoc['status'] =
            raw?.status === 'APPLIED' || raw?.status === 'FAILED' || raw?.status === 'APPROVED' || raw?.status === 'REJECTED'
              ? raw.status
              : 'PENDING';

          const submittedAtMs = typeof raw?.submittedAt?.toMillis === 'function' ? raw.submittedAt.toMillis() : undefined;
          const reviewedAtMs = typeof raw?.reviewedAt?.toMillis === 'function' ? raw.reviewedAt.toMillis() : undefined;
          const reviewedByName = typeof raw?.reviewedByName === 'string' ? raw.reviewedByName : undefined;
          const reviewedByRole = typeof raw?.reviewedByRole === 'string' ? raw.reviewedByRole : undefined;

          list.push({ id: d.id, internId, internName, fileName, storagePath, status, submittedAtMs, reviewedAtMs, reviewedByName, reviewedByRole });
        });
        setExcelImports(list);
      },
      () => setExcelImports([]),
    );
  }, []);

  const handleOpenExcelImport = async (path: string) => {
    try {
      const url = await getDownloadURL(storageRef(firebaseStorage, path));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  };

  const handleReviewExcelImport = async (req: ExcelImportDoc, decision: 'APPROVE' | 'REJECT') => {
    if (!user?.id) return;
    if (excelReviewBusyId) return;
    setExcelReviewError(null);

    try {
      setExcelReviewBusyId(req.id);
      const ref = doc(firestoreDb, 'attendanceExcelImports', req.id);
      await runTransaction(firestoreDb, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Request not found');
        const raw = snap.data() as any;
        const status = raw?.status;
        if (status !== 'PENDING') throw new Error('This request has already been reviewed.');

        tx.update(ref, {
          status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewAction: decision,
          reviewedById: user.id,
          reviewedByName: (user as any)?.name ?? 'Admin',
          reviewedByRole: 'HR_ADMIN',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      if (decision === 'APPROVE') {
        const fn = httpsCallable(firebaseFunctions, 'applyAttendanceExcelImport');
        await fn({ importId: req.id });
      }
    } catch (e) {
      setExcelReviewError((e as { message?: string })?.message ?? 'Failed to update request');
    } finally {
      setExcelReviewBusyId(null);
    }
  };

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

              const nextRow: AttendanceRow = {
            internId: intern.id,
            name: intern.name,
            avatar: intern.avatar,
            date: date || '--',
            clockIn,
            clockOut,
            mode,
            status,
          };

          setLatestByIntern((prev) => ({ ...prev, [intern.id]: nextRow }));
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

  const toLocalDateFromKey = (dateKey: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    const [y, m, d] = dateKey.split('-').map((x) => Number(x));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const parseHHMM = (value: string): { h: number; m: number } | null => {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const mm = Number(match[2]);
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    return { h, m: mm };
  };

  const buildTimestamp = (dateKey: string, hhmm: string): Date | null => {
    const base = toLocalDateFromKey(dateKey);
    const t = parseHHMM(hhmm);
    if (!base || !t) return null;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), t.h, t.m, 0, 0);
  };

  const handleConfirmDecision = async () => {
    if (!decisionTarget || !decisionMode || isSavingDecision) return;
    try {
      setIsSavingDecision(true);
      if (decisionMode === 'APPROVE') {
        if (!decisionTarget.requestedClockIn || !decisionTarget.requestedClockOut) return;
        const monthKey = decisionTarget.date.slice(0, 7);
        try {
          const paidSnap = await getDocs(
            query(
              collection(firestoreDb, 'allowanceClaims'),
              where('internId', '==', decisionTarget.internId),
              where('monthKey', '==', monthKey),
              where('status', '==', 'PAID'),
              limit(1),
            ),
          );
          if (!paidSnap.empty) {
            setDecisionError('This month has already been paid. Approval is blocked.');
            return;
          }
        } catch {
          setDecisionError('Failed to validate payout status.');
          return;
        }

        try {
          const attSnap = await getDocs(
            query(
              collection(firestoreDb, 'users', decisionTarget.internId, 'attendance'),
              where('date', '==', decisionTarget.date),
              limit(1),
            ),
          );
          if (!attSnap.empty) {
            const raw = attSnap.docs[0].data() as any;
            if (raw?.clockInAt && raw?.clockOutAt) {
              setDecisionError('Attendance already exists for this date. Approval is blocked.');
              return;
            }
          }
        } catch {
          setDecisionError('Failed to validate existing attendance.');
          return;
        }
        const clockInAt = buildTimestamp(decisionTarget.date, decisionTarget.requestedClockIn);
        const clockOutAt = buildTimestamp(decisionTarget.date, decisionTarget.requestedClockOut);
        if (!clockInAt || !clockOutAt || clockOutAt.getTime() <= clockInAt.getTime()) return;
        await updateDoc(doc(firestoreDb, 'timeCorrections', decisionTarget.id), {
          status: 'APPROVED',
          approvedBy: user?.id ?? 'admin',
          approvedAt: serverTimestamp(),
          ...(decisionNote.trim() ? { supervisorDecisionNote: decisionNote.trim() } : {}),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(firestoreDb, 'users', decisionTarget.internId, 'attendance', decisionTarget.date), {
          clockInAt,
          clockOutAt,
          workMode: decisionTarget.workMode,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(firestoreDb, 'timeCorrections', decisionTarget.id), {
          status: 'REJECTED',
          rejectedBy: user?.id ?? 'admin',
          rejectedAt: serverTimestamp(),
          ...(decisionNote.trim() ? { supervisorDecisionNote: decisionNote.trim() } : {}),
          updatedAt: serverTimestamp(),
        });
      }
      setDecisionTarget(null);
      setDecisionMode(null);
      setDecisionNote('');
      setDecisionError(null);
    } catch {
      // ignore
    } finally {
      setIsSavingDecision(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">

      {decisionTarget && decisionMode ? (
        <>
          <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm" onClick={() => (isSavingDecision ? void 0 : (setDecisionTarget(null), setDecisionMode(null)))} />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {decisionMode === 'APPROVE' ? 'Approve time correction' : 'Reject time correction'}
                  </h3>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    {decisionTarget.internName} • {decisionTarget.date}
                  </div>
                </div>
                <button onClick={() => (isSavingDecision ? void 0 : (setDecisionTarget(null), setDecisionMode(null)))} disabled={isSavingDecision} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="p-8 space-y-5">
                {decisionMode === 'APPROVE' ? (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem]">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested times</div>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-in</div>
                        <div className="text-[13px] font-black text-emerald-700">{decisionTarget.requestedClockIn || '--'}</div>
                      </div>
                      <div className="text-slate-200 font-black">→</div>
                      <div className="flex flex-col gap-1">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clock-out</div>
                        <div className="text-[13px] font-black text-rose-600">{decisionTarget.requestedClockOut || '--'}</div>
                      </div>
                    </div>
                    {!decisionTarget.requestedClockIn || !decisionTarget.requestedClockOut ? (
                      <div className="mt-2 text-[11px] font-bold text-rose-600">Clock-in and Clock-out are required to approve.</div>
                    ) : null}
                  </div>
                ) : null}

                {decisionError ? (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
                    {decisionError}
                  </div>
                ) : null}
                <label className="space-y-2 block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note (optional)</div>
                  <textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[100px]" />
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => (isSavingDecision ? void 0 : (setDecisionTarget(null), setDecisionMode(null), setDecisionError(null)))} disabled={isSavingDecision} className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-60">Cancel</button>
                  <button
                    onClick={() => void handleConfirmDecision()}
                    disabled={isSavingDecision || (decisionMode === 'APPROVE' && (!decisionTarget.requestedClockIn || !decisionTarget.requestedClockOut))}
                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-60 ${decisionMode === 'APPROVE' ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-500/20'}`}
                  >
                    {decisionMode === 'APPROVE' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('admin_attendance.title')}</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{tr('admin_attendance.subtitle')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">{tr('admin_attendance.col_intern')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_attendance.col_latest_date')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_attendance.col_clock_in')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_attendance.col_clock_out')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_attendance.col_mode')}</th>
                <th className="pb-6 text-right pr-4 text-[10px] font-black text-slate-400 uppercase">{tr('admin_attendance.col_status')}</th>
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
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[9px] font-black uppercase ${log.mode === 'WFO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                      {log.mode === 'WFO' ? <Building2 size={12} /> : <Home size={12} />} {log.mode}
                    </div>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${log.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : log.status === 'LATE' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
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

      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-10">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EXCEL IMPORT</div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-1">Requests</h3>
          </div>
          <div className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{excelImports.length}</div>
        </div>

        {excelReviewError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
            {excelReviewError}
          </div>
        ) : null}

        {excelImports.length === 0 ? (
          <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Excel import requests</p>
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
                      onClick={() => void handleOpenExcelImport(req.storagePath)}
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

                    {req.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReviewExcelImport(req, 'REJECT')}
                          disabled={excelReviewBusyId === req.id}
                          className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewExcelImport(req, 'APPROVE')}
                          disabled={excelReviewBusyId === req.id}
                          className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-60"
                        >
                          Approve
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-10">
          {corrections.some((c) => c.status === 'PENDING') ? (
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <CircleAlert size={18} />
            </div>
          ) : null}
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TIME CORRECTIONS</div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-1">All requests</h3>
          </div>
          <div className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{corrections.length}</div>
        </div>

        {corrections.length === 0 ? (
          <div className="p-10 bg-slate-50/50 rounded-[2.25rem] border border-slate-200 border-dashed text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No correction requests</p>
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
                            onClick={async () => {
                              try {
                                const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
                                window.open(url, '_blank', 'noopener,noreferrer');
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            {a.fileName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                      req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {req.status === 'APPROVED' ? '✓ Approved' : req.status === 'REJECTED' ? '✕ Rejected' : '⏳ Pending'}
                    </span>
                    {req.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setDecisionTarget(req); setDecisionMode('REJECT'); setDecisionNote(''); }}
                          className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDecisionTarget(req); setDecisionMode('APPROVE'); setDecisionNote(''); }}
                          disabled={!req.requestedClockIn || !req.requestedClockOut}
                          className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-60 disabled:hover:bg-emerald-50 disabled:hover:text-emerald-700"
                        >
                          Approve
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AttendanceTab;

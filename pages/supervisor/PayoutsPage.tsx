import React, { useEffect, useMemo, useState } from 'react';

import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { httpsCallable } from 'firebase/functions';

import { Language, UserProfile } from '@/types';
import { firestoreDb, firebaseFunctions } from '@/firebase';
import { normalizeAvatarUrl } from '@/app/avatar';
import { useTranslation } from 'react-i18next';

import AllowancesTab from '@/pages/admin/components/AllowancesTab';
import { AllowanceClaim } from '@/pages/admin/adminDashboardTypes';

interface SupervisorPayoutsPageProps {
  user: UserProfile;
  lang: Language;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const monthKeyFromDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const SupervisorPayoutsPage: React.FC<SupervisorPayoutsPageProps> = ({ user, lang }) => {
  void lang;
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthKeyFromDate(new Date()));
  const [payoutView, setPayoutView] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) => {
      const base = new Date();
      const x = new Date(base.getFullYear(), base.getMonth() - idx, 1);
      return monthKeyFromDate(x);
    });
  }, []);

  const [claims, setClaims] = useState<AllowanceClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [syncStateByInternId, setSyncStateByInternId] = useState<
    Record<string, { status?: string; startedAtMs?: number | null; errorMessage?: string | null }>
  >({});

  const [allowanceRules, setAllowanceRules] = useState({
    payoutFreq: 'MONTHLY' as 'MONTHLY' | 'END_PROGRAM',
    wfoRate: 100,
    wfhRate: 50,
    applyTax: true,
    taxPercent: 3,
  });

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const a = data?.allowance;
        if (!a) return;
        setAllowanceRules((prev) => ({
          payoutFreq: a.payoutFreq === 'END_PROGRAM' ? 'END_PROGRAM' : 'MONTHLY',
          wfoRate: typeof a.wfoRate === 'number' ? a.wfoRate : prev.wfoRate,
          wfhRate: typeof a.wfhRate === 'number' ? a.wfhRate : prev.wfhRate,
          applyTax: typeof a.applyTax === 'boolean' ? a.applyTax : prev.applyTax,
          taxPercent: typeof a.taxPercent === 'number' ? a.taxPercent : prev.taxPercent,
        }));
      },
      () => {
        // ignore
      },
    );
  }, []);

  const [editingClaim, setEditingClaim] = useState<AllowanceClaim | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [assignedInternIds, setAssignedInternIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadAssigned = async () => {
      const fromProfile = Array.isArray(user.assignedInterns) ? user.assignedInterns.filter(Boolean) : [];

      try {
        const snap = await getDocs(
          query(collection(firestoreDb, 'users'), where('supervisorId', '==', user.id)),
        );
        const nextIds: string[] = [...fromProfile];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data?.hasLoggedIn === false) return;
          if (!nextIds.includes(d.id)) nextIds.push(d.id);
        });
        if (!cancelled) setAssignedInternIds(nextIds);
      } catch {
        if (!cancelled) setAssignedInternIds(fromProfile);
      }
    };

    void loadAssigned();
    return () => {
      cancelled = true;
    };
  }, [user.assignedInterns, user.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const internIds = assignedInternIds;
        if (internIds.length === 0) {
          setClaims([]);
          return;
        }

        const userByInternId = new Map<
          string,
          {
            bankName?: string;
            bankAccountNumber?: string;
            internName?: string;
            avatar?: string;
            lifecycleStatus?: string;
            payoutCaseClosedAtMs?: number;
          }
        >();
        const idChunks = chunkArray(internIds, 10);

        for (const chunk of idChunks) {
          const userSnap = await getDocs(query(collection(firestoreDb, 'users'), where(documentId(), 'in', chunk)));
          userSnap.forEach((d) => {
            const raw = d.data() as any;
            const payoutCaseClosedAtMs =
              typeof raw?.payoutCaseClosedAt?.toMillis === 'function' ? raw.payoutCaseClosedAt.toMillis() : undefined;
            userByInternId.set(d.id, {
              bankName: typeof raw?.bankName === 'string' ? raw.bankName : undefined,
              bankAccountNumber: typeof raw?.bankAccountNumber === 'string' ? raw.bankAccountNumber : undefined,
              internName: typeof raw?.name === 'string' ? raw.name : undefined,
              avatar: normalizeAvatarUrl(raw?.avatar),
              lifecycleStatus: typeof raw?.lifecycleStatus === 'string' ? raw.lifecycleStatus : undefined,
              payoutCaseClosedAtMs: typeof payoutCaseClosedAtMs === 'number' ? payoutCaseClosedAtMs : undefined,
            });
          });
        }

        if (allowanceRules.payoutFreq === 'END_PROGRAM') {
          const allRows: AllowanceClaim[] = [];
          const foundWalletIds = new Set<string>();
          for (const chunk of idChunks) {
            const walletSnap = await getDocs(
              query(collection(firestoreDb, 'CurrentWallet'), where(documentId(), 'in', chunk)),
            );
            walletSnap.forEach((d) => {
              const internId = d.id;
              foundWalletIds.add(internId);
              const raw = d.data() as any;
              const u = userByInternId.get(internId);
              const totalAmount = typeof raw?.totalAmount === 'number' ? raw.totalAmount : 0;
              const totalCalculatedAmount =
                typeof raw?.totalCalculatedAmount === 'number'
                  ? raw.totalCalculatedAmount
                  : typeof raw?.totalAmount === 'number'
                    ? raw.totalAmount
                    : 0;
              const totalPaidAmount = typeof raw?.totalPaidAmount === 'number' ? raw.totalPaidAmount : 0;
              const totalPendingAmount = typeof raw?.totalPendingAmount === 'number' ? raw.totalPendingAmount : 0;
              const breakdown = {
                wfo: typeof raw?.totalBreakdown?.wfo === 'number' ? raw.totalBreakdown.wfo : 0,
                wfh: typeof raw?.totalBreakdown?.wfh === 'number' ? raw.totalBreakdown.wfh : 0,
                leaves: typeof raw?.totalBreakdown?.leaves === 'number' ? raw.totalBreakdown.leaves : 0,
              };
              const status: AllowanceClaim['status'] =
                totalAmount > 0 && totalPaidAmount >= totalAmount
                  ? 'PAID'
                  : totalPendingAmount > 0
                    ? 'PENDING'
                    : 'PENDING';

              const plannedPayoutDate = typeof raw?.plannedPayoutDate === 'string' ? raw.plannedPayoutDate : undefined;
              const paymentDate = typeof raw?.paymentDate === 'string' ? raw.paymentDate : undefined;
              const paidAtMs = typeof raw?.paidAtMs === 'number' ? raw.paidAtMs : undefined;

              allRows.push({
                id: internId,
                internId,
                internName: u?.internName ?? 'Unknown',
                avatar: u?.avatar ?? '',
                bankName: u?.bankName,
                bankAccountNumber: u?.bankAccountNumber,
                lifecycleStatus: u?.lifecycleStatus,
                payoutCaseClosedAtMs: u?.payoutCaseClosedAtMs,
                amount: totalAmount,
                calculatedAmount: totalCalculatedAmount,
                monthKey: selectedMonthKey,
                period: 'End Program',
                breakdown,
                status,
                plannedPayoutDate,
                paymentDate,
                paidAtMs,
              });
            });
          }

          // Include interns that don't have a wallet doc yet (e.g., never recalculated/synced).
          for (const internId of internIds) {
            if (foundWalletIds.has(internId)) continue;
            const u = userByInternId.get(internId);
            allRows.push({
              id: internId,
              internId,
              internName: u?.internName ?? 'Unknown',
              avatar: u?.avatar ?? '',
              bankName: u?.bankName,
              bankAccountNumber: u?.bankAccountNumber,
              lifecycleStatus: u?.lifecycleStatus,
              payoutCaseClosedAtMs: u?.payoutCaseClosedAtMs,
              amount: 0,
              calculatedAmount: 0,
              monthKey: selectedMonthKey,
              period: 'End Program',
              breakdown: { wfo: 0, wfh: 0, leaves: 0 },
              status: 'PENDING',
            });
          }

          allRows.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
          if (!cancelled) setClaims(allRows);
          return;
        }

        const allClaims: AllowanceClaim[] = [];
        const foundClaimInternIds = new Set<string>();
        for (const chunk of idChunks) {
          const snap = await getDocs(
            query(
              collection(firestoreDb, 'allowanceClaims'),
              where('monthKey', '==', selectedMonthKey),
              where('internId', 'in', chunk),
            ),
          );

          snap.forEach((d) => {
            const raw = d.data() as any;
            const internId = typeof raw?.internId === 'string' ? raw.internId : d.id.split('_')[0];
            foundClaimInternIds.add(internId);
            const paidAtMs = typeof raw?.paidAt?.toMillis === 'function' ? raw.paidAt.toMillis() : (typeof raw?.paidAt === 'number' ? raw.paidAt : undefined);
            const supervisorAdjustedAtMs =
              typeof raw?.supervisorAdjustedAt?.toMillis === 'function' ? raw.supervisorAdjustedAt.toMillis() : 
              (typeof raw?.supervisorAdjustedAt === 'number' ? raw.supervisorAdjustedAt : undefined);
            const adminAdjustedAtMs =
              typeof raw?.adminAdjustedAt?.toMillis === 'function' ? raw.adminAdjustedAt.toMillis() : 
              (typeof raw?.adminAdjustedAt === 'number' ? raw.adminAdjustedAt : undefined);
            const u = userByInternId.get(internId);

            const breakdown = {
              wfo: typeof raw?.breakdown?.wfo === 'number' ? raw.breakdown.wfo : 0,
              wfh: typeof raw?.breakdown?.wfh === 'number' ? raw.breakdown.wfh : 0,
              leaves: typeof raw?.breakdown?.leaves === 'number' ? raw.breakdown.leaves : 0,
            };

            const storedCalculated = typeof raw?.calculatedAmount === 'number' ? raw.calculatedAmount : undefined;

            const gross = breakdown.wfo * allowanceRules.wfoRate + breakdown.wfh * allowanceRules.wfhRate;
            const fallbackNet = allowanceRules.applyTax
              ? Math.max(0, Math.round(gross * (1 - allowanceRules.taxPercent / 100)))
              : gross;

            const computedNet = typeof storedCalculated === 'number' ? storedCalculated : fallbackNet;

            const storedAmount = typeof raw?.amount === 'number' ? raw.amount : 0;
            const supervisorAdjustedAmount = typeof raw?.supervisorAdjustedAmount === 'number' ? raw.supervisorAdjustedAmount : undefined;
            const adminAdjustedAmount = typeof raw?.adminAdjustedAmount === 'number' ? raw.adminAdjustedAmount : undefined;
            const shouldUseComputed =
              typeof supervisorAdjustedAmount !== 'number' &&
              typeof adminAdjustedAmount !== 'number' &&
              (storedAmount === 0) &&
              (breakdown.wfo > 0 || breakdown.wfh > 0) &&
              (raw?.status !== 'PAID');

            const amount =
              (() => {
                // Check who adjusted last based on timestamp
                const adminTime = typeof adminAdjustedAtMs === 'number' ? adminAdjustedAtMs : 0;
                const supervisorTime = typeof supervisorAdjustedAtMs === 'number' ? supervisorAdjustedAtMs : 0;
                
                if (adminTime > supervisorTime && typeof adminAdjustedAmount === 'number') {
                  return adminAdjustedAmount;
                } else if (supervisorTime > 0 && typeof supervisorAdjustedAmount === 'number') {
                  return supervisorAdjustedAmount;
                }
                return shouldUseComputed ? computedNet : storedAmount;
              })();

            allClaims.push({
              id: d.id,
              internId,
              internName: typeof raw?.internName === 'string' ? raw.internName : 'Unknown',
              avatar: normalizeAvatarUrl(raw?.avatar),
              bankName: u?.bankName,
              bankAccountNumber: u?.bankAccountNumber,
              lifecycleStatus: u?.lifecycleStatus,
              payoutCaseClosedAtMs: u?.payoutCaseClosedAtMs,
              monthKey: typeof raw?.monthKey === 'string' ? raw.monthKey : selectedMonthKey,
              amount,
              calculatedAmount: computedNet,
              supervisorAdjustedAmount,
              supervisorAdjustmentNote: typeof raw?.supervisorAdjustmentNote === 'string' ? raw.supervisorAdjustmentNote : undefined,
              supervisorAdjustedBy: typeof raw?.supervisorAdjustedBy === 'string' ? raw.supervisorAdjustedBy : undefined,
              supervisorAdjustedAtMs: typeof supervisorAdjustedAtMs === 'number' ? supervisorAdjustedAtMs : undefined,
              adminAdjustedAmount,
              adminAdjustmentNote: typeof raw?.adminAdjustmentNote === 'string' ? raw.adminAdjustmentNote : undefined,
              adminAdjustedBy: typeof raw?.adminAdjustedBy === 'string' ? raw.adminAdjustedBy : undefined,
              adminAdjustedAtMs: typeof adminAdjustedAtMs === 'number' ? adminAdjustedAtMs : undefined,
              period: typeof raw?.period === 'string' ? raw.period : selectedMonthKey,
              breakdown,
              status: raw?.status === 'PAID' || raw?.status === 'APPROVED' || raw?.status === 'PENDING' ? raw.status : 'PENDING',
              paymentDate: typeof raw?.paymentDate === 'string' ? raw.paymentDate : undefined,
              paidAtMs: typeof paidAtMs === 'number' ? paidAtMs : undefined,
              isPayoutLocked: typeof raw?.isPayoutLocked === 'boolean' ? raw.isPayoutLocked : undefined,
              lockReason: typeof raw?.lockReason === 'string' ? raw.lockReason : undefined,
            });
          });
        }

        // Include interns that don't have a claim doc yet for this month (e.g., never recalculated).
        for (const internId of internIds) {
          if (foundClaimInternIds.has(internId)) continue;
          const u = userByInternId.get(internId);
          allClaims.push({
            id: `${internId}_${selectedMonthKey}`,
            internId,
            internName: u?.internName ?? 'Unknown',
            avatar: u?.avatar ?? '',
            bankName: u?.bankName,
            bankAccountNumber: u?.bankAccountNumber,
            lifecycleStatus: u?.lifecycleStatus,
            payoutCaseClosedAtMs: u?.payoutCaseClosedAtMs,
            monthKey: selectedMonthKey,
            amount: 0,
            calculatedAmount: 0,
            period: selectedMonthKey,
            breakdown: { wfo: 0, wfh: 0, leaves: 0 },
            status: 'PENDING',
          });
        }

        allClaims.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        if (!cancelled) setClaims(allClaims);
      } catch (e) {
        if (!cancelled) {
          setClaims([]);
          const msg = e instanceof Error ? e.message : tr('supervisor_dashboard.payouts.save_failed');
          setErrorMessage(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [allowanceRules.applyTax, allowanceRules.payoutFreq, allowanceRules.taxPercent, allowanceRules.wfhRate, allowanceRules.wfoRate, assignedInternIds, selectedMonthKey]);

  useEffect(() => {
    if (allowanceRules.payoutFreq !== 'END_PROGRAM') {
      setSyncStateByInternId({});
      return;
    }

    const internIds = assignedInternIds;
    if (internIds.length === 0) {
      setSyncStateByInternId({});
      return;
    }

    const unsubs: Array<() => void> = [];
    const idChunks = chunkArray(internIds, 10);
    for (const chunk of idChunks) {
      const q = query(collection(firestoreDb, 'walletSyncLocks'), where(documentId(), 'in', chunk));
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            setSyncStateByInternId((prev) => {
              const next = { ...prev };
              snap.docs.forEach((d) => {
                const raw = d.data() as any;
                const startedAtMs =
                  typeof raw?.startedAt?.toMillis === 'function' ? raw.startedAt.toMillis() : (raw?.startedAtMs ?? null);
                next[d.id] = {
                  status: typeof raw?.status === 'string' ? raw.status : undefined,
                  startedAtMs: typeof startedAtMs === 'number' ? startedAtMs : null,
                  errorMessage: typeof raw?.errorMessage === 'string' ? raw.errorMessage : null,
                };
              });
              return next;
            });
          },
          () => {
            // ignore
          },
        ),
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [allowanceRules.payoutFreq, assignedInternIds]);

  const handleSyncWallet = async (internId: string) => {
    try {
      setSyncStateByInternId((prev) => ({
        ...prev,
        [internId]: {
          status: 'RUNNING',
          startedAtMs: Date.now(),
          errorMessage: null,
        },
      }));
      const fn = httpsCallable(firebaseFunctions, 'syncAllowanceWallet');
      const res = (await fn({ internId })) as any;
      const data = (res as any)?.data;
      if (data?.alreadyRunning) {
        alert(tr('allowances_tab.sync_wallet_running'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('allowances_tab.sync_wallet_error');
      alert(msg);
    }
  };

  const handleOpenEdit = (claim: AllowanceClaim) => {
    if (!assignedInternIds.includes(claim.internId)) return;
    if (claim.status === 'PAID') return;
    // Remove isPayoutLocked check to allow supervisor editing in end-program mode
    // Remove adminAdjustedAmount check to allow supervisor editing even if admin already adjusted
    setEditingClaim(claim);
    setEditAmount(String(claim.amount ?? 0));
    setEditNote('');
  };

  const handleSaveEdit = async () => {
    if (!editingClaim) return;
    if (!assignedInternIds.includes(editingClaim.internId)) return;
    if (editingClaim.status === 'PAID') return;
    // Remove isPayoutLocked check to allow supervisor editing in end-program mode
    // Remove adminAdjustedAmount check to allow supervisor editing even if admin already adjusted

    const nextAmount = Number(editAmount);
    if (!Number.isFinite(nextAmount)) return;
    const note = editNote.trim();
    if (!note) return;

    try {
      setIsSavingEdit(true);
      
      // Check if it's end-program mode - use CurrentWallet instead of allowanceClaims
      if (allowanceRules.payoutFreq === 'END_PROGRAM') {
        // Update CurrentWallet document
        await updateDoc(doc(firestoreDb, 'CurrentWallet', editingClaim.internId), {
          totalAmount: nextAmount,
          supervisorAdjustedAmount: nextAmount,
          supervisorAdjustmentNote: note,
          supervisorAdjustedBy: user.id,
          supervisorAdjustedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update allowanceClaims document
        await updateDoc(doc(firestoreDb, 'allowanceClaims', editingClaim.id), {
          amount: nextAmount,
          supervisorAdjustedAmount: nextAmount,
          supervisorAdjustmentNote: note,
          supervisorAdjustedBy: user.id,
          supervisorAdjustedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setClaims((prev) =>
        prev.map((c) =>
          c.id === editingClaim.id
            ? {
                ...c,
                amount: nextAmount,
                supervisorAdjustedAmount: nextAmount,
                supervisorAdjustmentNote: note,
                supervisorAdjustedBy: user.id,
                supervisorAdjustedAtMs: Date.now(),
                // Also update adminAdjustedAmount to ensure display uses supervisor's value
                adminAdjustedAmount: undefined,
                adminAdjustmentNote: undefined,
                adminAdjustedAtMs: undefined,
              }
            : c,
        ),
      );
      setEditingClaim(null);
      setEditAmount('');
      setEditNote('');
      
      // Force refresh data after a short delay to ensure Firestore sync
      setTimeout(() => {
        // This will trigger the useEffect to reload data
        const event = new Event('storage');
        window.dispatchEvent(event);
      }, 500);
    } catch {
      alert(tr('supervisor_dashboard.payouts.save_failed'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const visibleClaims = useMemo(() => {
    if (payoutView === 'HISTORY') {
      return claims.filter((c) => c.status === 'PAID' && c.lifecycleStatus !== 'WITHDRAWN');
    }

    return claims.filter((c) => {
      if (c.lifecycleStatus === 'WITHDRAWN') return false;
      if (c.lifecycleStatus === 'COMPLETED' && typeof c.payoutCaseClosedAtMs === 'number') return false;
      return true;
    });
  }, [claims, payoutView]);

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto p-4 md:p-6 lg:p-10 bg-slate-50">
      <div className="max-w-7xl mx-auto w-full mb-6 flex justify-end">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            type="button"
            onClick={() => setPayoutView('ACTIVE')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              payoutView === 'ACTIVE'
                ? 'bg-[#111827] text-white shadow-xl'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tr('allowances_tab.view_active')}
          </button>
          <button
            type="button"
            onClick={() => setPayoutView('HISTORY')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              payoutView === 'HISTORY'
                ? 'bg-[#111827] text-white shadow-xl'
                : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tr('allowances_tab.view_history')}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full">
        {editingClaim && (
          <>
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140]"
              onClick={() => (isSavingEdit ? void 0 : setEditingClaim(null))}
            />
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('supervisor_dashboard.payouts.adjust_title')}</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{editingClaim.internName}</div>
                  </div>
                  <button
                    onClick={() => (isSavingEdit ? void 0 : setEditingClaim(null))}
                    className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                    disabled={isSavingEdit}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-8 space-y-5">
                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.payouts.new_amount')}</div>
                    <input
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    />
                  </label>
                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.payouts.note_required')}</div>
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[120px]"
                    />
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setEditingClaim(null)}
                      disabled={isSavingEdit}
                      className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-60"
                    >
                      {tr('supervisor_dashboard.payouts.cancel')}
                    </button>
                    <button
                      onClick={() => void handleSaveEdit()}
                      disabled={isSavingEdit || !editNote.trim() || !String(editAmount).trim()}
                      className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-60 disabled:hover:bg-blue-600"
                    >
                      {tr('supervisor_dashboard.payouts.save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <AllowancesTab
          allowanceClaims={visibleClaims}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onAuthorize={() => void 0}
          onProcessPayment={() => void 0}
          onSyncWallet={allowanceRules.payoutFreq === 'END_PROGRAM' ? handleSyncWallet : undefined}
          syncStateByInternId={allowanceRules.payoutFreq === 'END_PROGRAM' ? syncStateByInternId : undefined}
          monthOptions={monthOptions}
          selectedMonthKey={selectedMonthKey}
          onSelectMonthKey={setSelectedMonthKey}
          readOnly
          allowEditInReadOnly={true}
          onRowClick={handleOpenEdit}
        />

        {!isLoading && !errorMessage && visibleClaims.length > 0 && (
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.payouts.tip')}</div>
        )}
      </div>
    </div>
  );
};

export default SupervisorPayoutsPage;

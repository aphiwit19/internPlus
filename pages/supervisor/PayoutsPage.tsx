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

import { Language, UserProfile } from '@/types';
import { firestoreDb } from '@/firebase';
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
      if (fromProfile.length > 0) {
        setAssignedInternIds(fromProfile);
        return;
      }

      try {
        const snap = await getDocs(
          query(collection(firestoreDb, 'users'), where('supervisorId', '==', user.id)),
        );
        const nextIds: string[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data?.hasLoggedIn === false) return;
          nextIds.push(d.id);
        });
        if (!cancelled) setAssignedInternIds(nextIds);
      } catch {
        if (!cancelled) setAssignedInternIds([]);
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
          { bankName?: string; bankAccountNumber?: string; internName?: string; avatar?: string }
        >();
        const idChunks = chunkArray(internIds, 10);

        for (const chunk of idChunks) {
          const userSnap = await getDocs(query(collection(firestoreDb, 'users'), where(documentId(), 'in', chunk)));
          userSnap.forEach((d) => {
            const raw = d.data() as any;
            userByInternId.set(d.id, {
              bankName: typeof raw?.bankName === 'string' ? raw.bankName : undefined,
              bankAccountNumber: typeof raw?.bankAccountNumber === 'string' ? raw.bankAccountNumber : undefined,
              internName: typeof raw?.name === 'string' ? raw.name : undefined,
              avatar: normalizeAvatarUrl(raw?.avatar),
            });
          });
        }

        if (allowanceRules.payoutFreq === 'END_PROGRAM') {
          const allRows: AllowanceClaim[] = [];
          for (const chunk of idChunks) {
            const walletSnap = await getDocs(
              query(collection(firestoreDb, 'CurrentWallet'), where(documentId(), 'in', chunk)),
            );
            walletSnap.forEach((d) => {
              const internId = d.id;
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

              allRows.push({
                id: internId,
                internId,
                internName: u?.internName ?? 'Unknown',
                avatar: u?.avatar ?? '',
                bankName: u?.bankName,
                bankAccountNumber: u?.bankAccountNumber,
                amount: totalAmount,
                calculatedAmount: totalCalculatedAmount,
                monthKey: selectedMonthKey,
                period: 'End Program',
                breakdown,
                status,
              });
            });
          }
          allRows.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
          if (!cancelled) setClaims(allRows);
          return;
        }

        const allClaims: AllowanceClaim[] = [];
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
            const paidAtMs = typeof raw?.paidAt?.toMillis === 'function' ? raw.paidAt.toMillis() : undefined;
            const supervisorAdjustedAtMs =
              typeof raw?.supervisorAdjustedAt?.toMillis === 'function' ? raw.supervisorAdjustedAt.toMillis() : undefined;
            const adminAdjustedAtMs =
              typeof raw?.adminAdjustedAt?.toMillis === 'function' ? raw.adminAdjustedAt.toMillis() : undefined;
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
              typeof adminAdjustedAmount === 'number'
                ? adminAdjustedAmount
                : typeof supervisorAdjustedAmount === 'number'
                  ? supervisorAdjustedAmount
                  : shouldUseComputed
                    ? computedNet
                    : storedAmount;

            allClaims.push({
              id: d.id,
              internId,
              internName: typeof raw?.internName === 'string' ? raw.internName : 'Unknown',
              avatar: normalizeAvatarUrl(raw?.avatar),
              bankName: u?.bankName,
              bankAccountNumber: u?.bankAccountNumber,
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

  const handleOpenEdit = (claim: AllowanceClaim) => {
    if (!assignedInternIds.includes(claim.internId)) return;
    if (claim.status === 'PAID') return;
    if (claim.isPayoutLocked) return;
    if (typeof claim.adminAdjustedAmount === 'number') return;
    setEditingClaim(claim);
    setEditAmount(String(claim.amount ?? 0));
    setEditNote('');
  };

  const handleSaveEdit = async () => {
    if (!editingClaim) return;
    if (!assignedInternIds.includes(editingClaim.internId)) return;
    if (editingClaim.status === 'PAID') return;
    if (editingClaim.isPayoutLocked) return;
    if (typeof editingClaim.adminAdjustedAmount === 'number') return;

    const nextAmount = Number(editAmount);
    if (!Number.isFinite(nextAmount)) return;
    const note = editNote.trim();
    if (!note) return;

    try {
      setIsSavingEdit(true);
      await updateDoc(doc(firestoreDb, 'allowanceClaims', editingClaim.id), {
        amount: nextAmount,
        supervisorAdjustedAmount: nextAmount,
        supervisorAdjustmentNote: note,
        supervisorAdjustedBy: user.id,
        supervisorAdjustedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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
              }
            : c,
        ),
      );
      setEditingClaim(null);
      setEditAmount('');
      setEditNote('');
    } catch {
      alert(tr('supervisor_dashboard.payouts.save_failed'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="h-full min-h-0 w-full overflow-y-auto p-4 md:p-6 lg:p-10 bg-slate-50">
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
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                      {editingClaim.internName}
                    </div>
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
          allowanceClaims={claims}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onAuthorize={() => void 0}
          onProcessPayment={() => void 0}
          monthOptions={monthOptions}
          selectedMonthKey={selectedMonthKey}
          onSelectMonthKey={setSelectedMonthKey}
          readOnly
          allowEditInReadOnly={allowanceRules.payoutFreq !== 'END_PROGRAM'}
          onRowClick={handleOpenEdit}
        />

        {!isLoading && !errorMessage && claims.length > 0 && (
          <div className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {tr('supervisor_dashboard.payouts.tip')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupervisorPayoutsPage;

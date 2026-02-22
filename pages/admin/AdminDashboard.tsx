import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ShieldCheck, 
  Trash2, 
  Award, 
  CreditCard, 
  Search, 
  ChevronRight, 
  Filter, 
  FileCheck, 
  Clock, 
  ArrowUpRight, 
  Building2, 
  Home, 
  X, 
  PenTool, 
  Eraser, 
  Stamp,
  Plus,
  Sparkles,
  CalendarCheck,
  Banknote,
  Users,
  UserPlus,
  UserCheck,
  MoreVertical,
  Briefcase,
  UserX,
  Info,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { httpsCallable } from 'firebase/functions';

import { toast } from 'sonner';

import { AdminTab } from './components/AdminDashboardTabs';
import AllowancesTab from './components/AllowancesTab';
import AttendanceTab from './components/AttendanceTab';
import AbsencesTab from './components/AbsencesTab';
import CertificatesTab from './components/CertificatesTab';
import RosterTab from './components/RosterTab';
import { AllowanceClaim, CertRequest, InternRecord, Mentor } from './adminDashboardTypes';

import { firestoreDb, firebaseFunctions } from '@/firebase';
import { firebaseAuth } from '@/firebase';
import { UserRole } from '@/types';
import { getDefaultAvatarUrl, normalizeAvatarUrl } from '@/app/avatar';

type MentorOption = Mentor & {
  position?: string;
  isCoAdmin?: boolean;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type UserDoc = {
  name?: string;
  avatar?: string;
  position?: string;
  department?: string;
  roles?: UserRole[];
  role?: UserRole;
  isDualRole?: boolean;
  assignedInterns?: string[];
  supervisorId?: string;
  supervisorName?: string;
  lifecycleStatus?: string;
  payoutCaseClosedAt?: any;
  bankName?: string;
  bankAccountNumber?: string;
};

function normalizeRoles(data: Pick<UserDoc, 'roles' | 'role' | 'isDualRole'> | null | undefined): UserRole[] {
  if (!data) return ['INTERN'];
  if (Array.isArray(data.roles) && data.roles.length > 0) return data.roles;
  if (data.role) return [data.role];
  if (data.isDualRole) return ['SUPERVISOR', 'HR_ADMIN'];
  return ['INTERN'];
}

function toInternRecord(id: string, data: UserDoc): InternRecord {
  // Map lifecycleStatus to display status - same logic as InternManagementPage
  let status: InternRecord['status'] = 'Active';
  
  if (data.lifecycleStatus === 'WITHDRAWN' || 
      data.lifecycleStatus === 'COMPLETED') {
    status = 'WITHDRAWN'; // Use WITHDRAWN for Inactive
  } else {
    status = 'Active';
  }

  return {
    id,
    name: data.name || 'Unknown',
    avatar: normalizeAvatarUrl(data.avatar),
    position: data.position || 'Intern',
    dept: data.department || 'Unknown',
    status,
    lifecycleStatus: data.lifecycleStatus,
    payoutCaseClosedAtMs: typeof data.payoutCaseClosedAt?.toMillis === 'function' ? data.payoutCaseClosedAt.toMillis() : undefined,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    supervisor: null,
  };
}

interface AdminDashboardProps {
  initialTab?: AdminTab;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab = 'roster' }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  
  // Track pending leave notification count from AppLayout
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  
  useEffect(() => {
    // Listen to leave requests and check against last visit
    const lastVisitKey = 'lastLeavePageVisit_admin';
    const storedVisit = localStorage.getItem(lastVisitKey);
    const lastVisit = storedVisit ? parseInt(storedVisit, 10) : 0;

    const leaveRef = collection(firestoreDb, 'leaveRequests');
    const q = query(leaveRef, where('status', '==', 'PENDING'));

    return onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt as string | undefined;
        if (createdAt) {
          const timestamp = new Date(createdAt).getTime();
          if (timestamp > lastVisit) {
            count++;
          }
        }
      });
      setPendingLeaveCount(count);
    });
  }, []);

  // Modal States
  const [signingCert, setSigningCert] = useState<CertRequest | null>(null);
  const [assigningIntern, setAssigningIntern] = useState<InternRecord | null>(null);
  const [payoutClaimId, setPayoutClaimId] = useState<string | null>(null);
  const [payoutPaidAtInput, setPayoutPaidAtInput] = useState('');
  
  // Signature States
  const [hasSigned, setHasSigned] = useState(false);
  const [isStampApplied, setIsStampApplied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [certRequests, setCertRequests] = useState<CertRequest[]>([]);

  const [allowanceClaims, setAllowanceClaims] = useState<AllowanceClaim[]>([]);
  const [isAllowanceLoading, setIsAllowanceLoading] = useState(false);
  const [allowanceLoadError, setAllowanceLoadError] = useState<string | null>(null);
  const [isBulkAuthorizing, setIsBulkAuthorizing] = useState(false);
  const [isBulkPaying, setIsBulkPaying] = useState(false);
  const [isBulkAuthorizeModalOpen, setIsBulkAuthorizeModalOpen] = useState(false);
  const [bulkAuthorizeCount, setBulkAuthorizeCount] = useState(0);
  const [isBulkPayModalOpen, setIsBulkPayModalOpen] = useState(false);
  const [bulkPaidAtInput, setBulkPaidAtInput] = useState('');

  const [editingAllowanceClaim, setEditingAllowanceClaim] = useState<AllowanceClaim | null>(null);
  const [editAllowanceAmount, setEditAllowanceAmount] = useState('');
  const [editAllowanceNote, setEditAllowanceNote] = useState('');
  const [isSavingAllowanceEdit, setIsSavingAllowanceEdit] = useState(false);

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

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const monthKeyFromDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => monthKeyFromDate(new Date()));
  const [payoutView, setPayoutView] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  const monthOptions = Array.from({ length: 12 }, (_, idx) => {
    const base = new Date();
    const x = new Date(base.getFullYear(), base.getMonth() - idx, 1);
    return monthKeyFromDate(x);
  });

  const handleOpenAdminAllowanceEdit = (claim: AllowanceClaim) => {
    if (activeTab !== 'allowances') return;
    if (claim.status === 'PAID') return;
    if (claim.isPayoutLocked) return;
    setEditingAllowanceClaim(claim);
    setEditAllowanceAmount(String(claim.amount ?? 0));
    setEditAllowanceNote('');
  };

  const handleSaveAdminAllowanceEdit = async () => {
    if (!editingAllowanceClaim) return;
    if (editingAllowanceClaim.status === 'PAID') return;
    if (editingAllowanceClaim.isPayoutLocked) return;

    const nextAmount = Number(editAllowanceAmount);
    if (!Number.isFinite(nextAmount)) return;
    const note = editAllowanceNote.trim();
    if (!note) return;

    try {
      setIsSavingAllowanceEdit(true);
      const uid = firebaseAuth.currentUser?.uid;
      await updateDoc(doc(firestoreDb, 'allowanceClaims', editingAllowanceClaim.id), {
        amount: nextAmount,
        adminAdjustedAmount: nextAmount,
        adminAdjustmentNote: note,
        adminAdjustedBy: uid ?? 'HR_ADMIN',
        adminAdjustedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAllowanceClaims((prev) =>
        prev.map((c) =>
          c.id === editingAllowanceClaim.id
            ? {
                ...c,
                amount: nextAmount,
                adminAdjustedAmount: nextAmount,
                adminAdjustmentNote: note,
                adminAdjustedBy: uid ?? 'HR_ADMIN',
                adminAdjustedAtMs: Date.now(),
              }
            : c,
        ),
      );
      setEditingAllowanceClaim(null);
      setEditAllowanceAmount('');
      setEditAllowanceNote('');
    } catch {
      toast.error('Failed to save admin adjustment. Please check permissions and try again.', { duration: 6000 });
    } finally {
      setIsSavingAllowanceEdit(false);
    }
  };

  const handleOpenBulkPayModal = () => {
    if (activeTab !== 'allowances') return;
    const candidates = allowanceClaims.filter((c) => c.status !== 'PAID' && !c.isPayoutLocked);
    if (candidates.length === 0) {
      toast.info(tr('admin_dashboard.toast_no_claims_to_pay'), { duration: 4000 });
      return;
    }
    setBulkPaidAtInput('');
    setIsBulkPayModalOpen(true);
  };

  const handleConfirmBulkPay = async () => {
    if (activeTab !== 'allowances') return;
    if (isBulkPaying) return;
    if (!bulkPaidAtInput) return;

    const paidAtDate = new Date(bulkPaidAtInput);
    if (Number.isNaN(paidAtDate.getTime())) return;

    const candidates = allowanceClaims.filter((c) => c.status !== 'PAID' && !c.isPayoutLocked);
    if (candidates.length === 0) {
      toast.info(tr('admin_dashboard.toast_no_claims_to_pay'), { duration: 4000 });
      return;
    }

    const paymentDate = paidAtDate.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      setIsBulkPaying(true);
      if (allowanceRules.payoutFreq === 'END_PROGRAM') {
        const internIds = Array.from(new Set(candidates.map((c) => c.internId).filter(Boolean)));
        let batch = writeBatch(firestoreDb);
        let ops = 0;
        const flush = async () => {
          if (ops === 0) return;
          await batch.commit();
          batch = writeBatch(firestoreDb);
          ops = 0;
        };

        for (const internId of internIds) {
          const snap = await getDocs(
            query(
              collection(firestoreDb, 'allowanceClaims'),
              where('internId', '==', internId),
              where('status', 'in', ['PENDING', 'APPROVED']),
            ),
          );
          for (const d of snap.docs) {
            const raw = d.data() as any;
            const currentStatus = raw?.status;
            batch.update(doc(firestoreDb, 'allowanceClaims', d.id), {
              status: 'PAID',
              ...(currentStatus === 'PENDING' ? { approvedAt: serverTimestamp() } : {}),
              paymentDate,
              paidAt: Timestamp.fromDate(paidAtDate),
              updatedAt: serverTimestamp(),
            });
            ops += 1;
            if (ops >= 450) await flush();
          }
        }
        await flush();
      } else {
        const batch = writeBatch(firestoreDb);
        for (const c of candidates) {
          batch.update(doc(firestoreDb, 'allowanceClaims', c.id), {
            status: 'PAID',
            ...(c.status === 'PENDING' ? { approvedAt: serverTimestamp() } : {}),
            paymentDate,
            paidAt: Timestamp.fromDate(paidAtDate),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      setAllowanceClaims((prev) =>
        prev.map((c) =>
          c.status !== 'PAID' && !c.isPayoutLocked
            ? { ...c, status: 'PAID', paymentDate, paidAtMs: paidAtDate.getTime() }
            : c,
        ),
      );
      setIsBulkPayModalOpen(false);
      setBulkPaidAtInput('');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error(
        (
          `Failed to bulk pay payouts. ${String(err?.code ?? '')} ${String(err?.message ?? '')}`.trim() ||
          'Failed to bulk pay payouts. Please check Firestore permissions and try again.'
        ),
        { duration: 8000 },
      );
    } finally {
      setIsBulkPaying(false);
    }
  };

  const isExitedLifecycle = (s: string | undefined | null) => s === 'COMPLETED';

  const canClosePayoutCase = (claim: AllowanceClaim) => {
    if (claim.status !== 'PAID') return false;
    if (!isExitedLifecycle(claim.lifecycleStatus)) return false;
    if (typeof claim.payoutCaseClosedAtMs === 'number') return false;
    return true;
  };

  const handleClosePayoutCase = async (internId: string) => {
    const ok = window.confirm(tr('allowances_tab.close_case_confirm'));
    if (!ok) return;

    try {
      const uid = firebaseAuth.currentUser?.uid;
      await updateDoc(doc(firestoreDb, 'users', internId), {
        payoutCaseClosedAt: serverTimestamp(),
        payoutCaseClosedBy: uid ?? 'HR_ADMIN',
        updatedAt: serverTimestamp(),
      });

      const now = Date.now();
      setInternRoster((prev) => prev.map((i) => (i.id === internId ? { ...i, payoutCaseClosedAtMs: now } : i)));
      setAllowanceClaims((prev) => prev.map((c) => (c.internId === internId ? { ...c, payoutCaseClosedAtMs: now } : c)));
    } catch {
      toast.error(tr('allowances_tab.close_case_failed'), { duration: 7000 });
    }
  };

  const visibleAllowanceClaims = React.useMemo(() => {
    if (payoutView === 'HISTORY') {
      return allowanceClaims.filter((c) => c.status === 'PAID' && c.lifecycleStatus !== 'WITHDRAWN');
    }

    return allowanceClaims.filter((c) => {
      if (c.lifecycleStatus === 'WITHDRAWN') return false;
      if (isExitedLifecycle(c.lifecycleStatus) && typeof c.payoutCaseClosedAtMs === 'number') return false;
      return true;
    });
  }, [allowanceClaims, payoutView]);

  const [internRoster, setInternRoster] = useState<InternRecord[]>([]);
  const [mentorOptions, setMentorOptions] = useState<MentorOption[]>([]);

  useEffect(() => {
    if (activeTab !== 'allowances') return;
    if (allowanceRules.payoutFreq !== 'END_PROGRAM') {
      setSyncStateByInternId({});
      return;
    }

    const internIds = internRoster.map((i) => i.id);
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
  }, [activeTab, allowanceRules.payoutFreq, internRoster]);

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
        toast.message(tr('allowances_tab.sync_wallet_running'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('allowances_tab.sync_wallet_error');
      toast.error(msg, { duration: 6000 });
    }
  };

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          allowance?: {
            payoutFreq?: 'MONTHLY' | 'END_PROGRAM';
            wfoRate?: number;
            wfhRate?: number;
            applyTax?: boolean;
            taxPercent?: number;
          };
        };
        const a = data.allowance;
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

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'allowances') return;
    if (internRoster.length === 0) {
      setAllowanceClaims([]);
      return;
    }

    const monthKey = selectedMonthKey;
    const load = async () => {
      try {
        if (!cancelled) setIsAllowanceLoading(true);
        if (!cancelled) setAllowanceLoadError(null);

        const internById = new Map(internRoster.map((i) => [i.id, i] as const));

        if (allowanceRules.payoutFreq === 'END_PROGRAM') {
          const internIds = internRoster.map((i) => i.id);
          const idChunks = chunkArray(internIds, 10);
          const next: AllowanceClaim[] = [];
          const foundWalletIds = new Set<string>();

          for (const chunk of idChunks) {
            const walletSnap = await getDocs(
              query(collection(firestoreDb, 'CurrentWallet'), where(documentId(), 'in', chunk)),
            );
            walletSnap.forEach((d) => {
              const raw = d.data() as any;
              const internId = d.id;
              foundWalletIds.add(internId);
              const intern = internById.get(internId);
              if (!intern) return;

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

              const isCompleted = intern.lifecycleStatus === 'COMPLETED';
              const lockedByEndProgram = !isCompleted;

              next.push({
                id: internId,
                internId,
                internName: intern.name,
                avatar: intern.avatar,
                bankName: intern.bankName,
                bankAccountNumber: intern.bankAccountNumber,
                amount: totalAmount,
                calculatedAmount: totalCalculatedAmount,
                period: 'End Program',
                breakdown,
                status,
                plannedPayoutDate,
                paymentDate,
                paidAtMs,
                lifecycleStatus: intern.lifecycleStatus,
                payoutCaseClosedAtMs: intern.payoutCaseClosedAtMs,
                ...(lockedByEndProgram ? { isPayoutLocked: true, lockReason: 'Locked until program completion' } : {}),
              });
            });
          }

          // Include interns that don't have a wallet doc yet (e.g., never recalculated/synced).
          for (const internId of internIds) {
            if (foundWalletIds.has(internId)) continue;
            const intern = internById.get(internId);
            if (!intern) continue;
            const isCompleted = intern.lifecycleStatus === 'COMPLETED';
            const lockedByEndProgram = !isCompleted;
            next.push({
              id: internId,
              internId,
              internName: intern.name,
              avatar: intern.avatar,
              bankName: intern.bankName,
              bankAccountNumber: intern.bankAccountNumber,
              amount: 0,
              calculatedAmount: 0,
              period: 'End Program',
              breakdown: { wfo: 0, wfh: 0, leaves: 0 },
              status: 'PENDING',
              lifecycleStatus: intern.lifecycleStatus,
              payoutCaseClosedAtMs: intern.payoutCaseClosedAtMs,
              ...(lockedByEndProgram ? { isPayoutLocked: true, lockReason: 'Locked until program completion' } : {}),
            });
          }

          next.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
          if (!cancelled) setAllowanceClaims(next);
          return;
        }

        const snap = await getDocs(
          query(collection(firestoreDb, 'allowanceClaims'), where('monthKey', '==', monthKey)),
        );
        const next: AllowanceClaim[] = [];

        snap.forEach((d) => {
          const raw = d.data() as any;
          const internId = typeof raw?.internId === 'string' ? raw.internId : '';
          if (!internId) return;
          const intern = internById.get(internId);

          next.push({
            ...(raw as AllowanceClaim),
            id: d.id,
            internId,
            internName: typeof raw?.internName === 'string' ? raw.internName : (intern?.name ?? 'Unknown'),
            avatar: typeof raw?.avatar === 'string' ? raw.avatar : (intern?.avatar ?? ''),
            bankName: intern?.bankName,
            bankAccountNumber: intern?.bankAccountNumber,
            lifecycleStatus: intern?.lifecycleStatus,
            payoutCaseClosedAtMs: intern?.payoutCaseClosedAtMs,
          });
        });

        next.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
        if (!cancelled) setAllowanceClaims(next);
      } catch (e) {
        if (!cancelled) setAllowanceClaims([]);
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Failed to load payouts.';
          setAllowanceLoadError(msg);
        }
      } finally {
        if (!cancelled) setIsAllowanceLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, allowanceRules.applyTax, allowanceRules.taxPercent, allowanceRules.wfhRate, allowanceRules.wfoRate, internRoster, selectedMonthKey]);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'users'));
    return onSnapshot(
      q,
      (snap) => {
        const supervisors: Array<{ id: string; name: string; avatar: string; assignedInterns: string[] }> = [];
        const supervisorsById: Record<string, { id: string; name: string; avatar: string; assignedInterns: string[] }> = {};
        const interns: Array<{ id: string; data: UserDoc }> = [];

        const nextMentors: MentorOption[] = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() as UserDoc;
          const roles = normalizeRoles(data);

          if (roles.includes('SUPERVISOR')) {
            const supervisorRecord = {
              id: docSnap.id,
              name: data.name || 'Unknown',
              avatar: normalizeAvatarUrl(data.avatar),
              assignedInterns: Array.isArray(data.assignedInterns) ? data.assignedInterns : [],
            };

            supervisors.push(supervisorRecord);
            supervisorsById[supervisorRecord.id] = supervisorRecord;

            nextMentors.push({
              id: docSnap.id,
              name: data.name || 'Unknown',
              avatar: normalizeAvatarUrl(data.avatar),
              dept: data.department || 'Unknown',
              position: data.position || 'Supervisor',
              isCoAdmin: roles.includes('HR_ADMIN'),
            });
          }

          if (roles.includes('INTERN')) {
            interns.push({ id: docSnap.id, data });
          }
        });

        const next: InternRecord[] = interns.map(({ id, data }) => {
          const internRecord = toInternRecord(id, data);

          const supervisorFromField = data.supervisorId ? supervisorsById[data.supervisorId] : undefined;
          const supervisorFromList = supervisors.find((s) => s.assignedInterns.includes(id));
          const supervisor = supervisorFromField || supervisorFromList;

          if (supervisor) {
            internRecord.supervisor = {
              id: supervisor.id,
              name: supervisor.name,
              avatar: supervisor.avatar,
            };
          }

          return internRecord;
        });

        setInternRoster(next);
        setMentorOptions(nextMentors);
      },
      () => {
        setInternRoster([]);
        setMentorOptions([]);
      },
    );
  }, []);

  const handleAssignMentor = async (mentor: Mentor) => {
    if (!assigningIntern) return;

    const internId = assigningIntern.id;
    const previousSupervisorId = assigningIntern.supervisor?.id || null;

    try {
      await updateDoc(doc(firestoreDb, 'users', internId), {
        supervisorId: mentor.id,
        supervisorName: mentor.name,
        updatedAt: new Date(),
      });

      await updateDoc(doc(firestoreDb, 'users', mentor.id), {
        assignedInterns: arrayUnion(internId),
        updatedAt: new Date(),
      });

      if (previousSupervisorId && previousSupervisorId !== mentor.id) {
        await updateDoc(doc(firestoreDb, 'users', previousSupervisorId), {
          assignedInterns: arrayRemove(internId),
          updatedAt: new Date(),
        });
      }

      setInternRoster((prev) =>
        prev.map((intern) => (intern.id === internId ? { ...intern, supervisor: mentor } : intern)),
      );
      setAssigningIntern(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to assign supervisor', { internId, mentorId: mentor.id }, err);
      toast.error(`Failed to assign supervisor: ${message}`, { duration: 7000 });
    }
  };

  const handleAuthorizeAllowance = async (id: string) => {
    const claim = allowanceClaims.find((c) => c.id === id);
    if (claim?.isPayoutLocked) {
      toast.info(claim.lockReason || tr('admin_dashboard.toast_payout_locked'), { duration: 5000 });
      return;
    }
    try {
      await updateDoc(doc(firestoreDb, 'allowanceClaims', id), {
        status: 'APPROVED',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAllowanceClaims((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'APPROVED' } : a)));
    } catch {
      toast.error('Failed to authorize payout. Please check Firestore permissions and try again.', { duration: 7000 });
    }
  };

  const handleAuthorizeAllAllowances = async () => {
    if (activeTab !== 'allowances') return;
    if (isBulkAuthorizing) return;

    if (allowanceRules.payoutFreq === 'END_PROGRAM') {
      toast.info(tr('admin_dashboard.toast_bulk_authorize_not_available'), { duration: 5000 });
      return;
    }

    const candidates = allowanceClaims.filter((c) => c.status === 'PENDING' && !c.isPayoutLocked);
    if (candidates.length === 0) {
      toast.info(tr('admin_dashboard.toast_no_pending_to_authorize'), { duration: 4000 });
      return;
    }

    setBulkAuthorizeCount(candidates.length);
    setIsBulkAuthorizeModalOpen(true);
  };

  const handleConfirmBulkAuthorize = async () => {
    if (activeTab !== 'allowances') return;
    if (isBulkAuthorizing) return;

    if (allowanceRules.payoutFreq === 'END_PROGRAM') {
      toast.info(tr('admin_dashboard.toast_bulk_authorize_not_available'), { duration: 5000 });
      return;
    }

    const candidates = allowanceClaims.filter((c) => c.status === 'PENDING' && !c.isPayoutLocked);
    if (candidates.length === 0) {
      toast.info(tr('admin_dashboard.toast_no_pending_to_authorize'), { duration: 4000 });
      setIsBulkAuthorizeModalOpen(false);
      setBulkAuthorizeCount(0);
      return;
    }

    try {
      setIsBulkAuthorizing(true);
      const batch = writeBatch(firestoreDb);
      for (const c of candidates) {
        batch.update(doc(firestoreDb, 'allowanceClaims', c.id), {
          status: 'APPROVED',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setAllowanceClaims((prev) =>
        prev.map((c) => (c.status === 'PENDING' && !c.isPayoutLocked ? { ...c, status: 'APPROVED' } : c)),
      );
      setIsBulkAuthorizeModalOpen(false);
      setBulkAuthorizeCount(0);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error(
        (
          `Failed to bulk authorize payouts. ${String(err?.code ?? '')} ${String(err?.message ?? '')}`.trim() ||
          'Failed to bulk authorize payouts. Please check Firestore permissions and try again.'
        ),
        { duration: 8000 },
      );
    } finally {
      setIsBulkAuthorizing(false);
    }
  };

  const handleProcessPayment = (id: string) => {
    const claim = allowanceClaims.find((c) => c.id === id);
    if (claim?.isPayoutLocked) {
      toast.info(claim.lockReason || tr('admin_dashboard.toast_payout_locked'), { duration: 5000 });
      return;
    }
    setPayoutClaimId(id);
    setPayoutPaidAtInput('');
  };

  const handleConfirmProcessPayment = async () => {
    if (!payoutClaimId) return;
    const claim = allowanceClaims.find((c) => c.id === payoutClaimId);
    if (claim?.isPayoutLocked) {
      toast.info(claim.lockReason || tr('admin_dashboard.toast_payout_locked'), { duration: 5000 });
      return;
    }
    if (!payoutPaidAtInput) return;

    const paidAtDate = new Date(payoutPaidAtInput);
    if (Number.isNaN(paidAtDate.getTime())) return;

    const paymentDate = paidAtDate.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      await updateDoc(doc(firestoreDb, 'allowanceClaims', payoutClaimId), {
        status: 'PAID',
        paymentDate,
        paidAt: Timestamp.fromDate(paidAtDate),
        updatedAt: serverTimestamp(),
      });
      setAllowanceClaims((prev) =>
        prev.map((a) =>
          a.id === payoutClaimId ? { ...a, status: 'PAID', paymentDate, paidAtMs: paidAtDate.getTime() } : a,
        ),
      );
      setPayoutClaimId(null);
      setPayoutPaidAtInput('');
    } catch {
      toast.error('Failed to process payout. Please check Firestore permissions and try again.', { duration: 7000 });
    }
  };

  // --- SIGNING LOGIC ---
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; 
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSigned) setHasSigned(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSigned(false);
    }
  };

  const handleFinalApprove = () => {
    if (!signingCert || !hasSigned || !isStampApplied) return;
    setIsProcessing(true);
    setTimeout(() => {
      setCertRequests(prev => prev.map(c => c.id === signingCert.id ? { ...c, status: 'ISSUED' } : c));
      setIsProcessing(false);
      setSigningCert(null);
      setHasSigned(false);
      setIsStampApplied(false);
    }, 2000);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {editingAllowanceClaim && (
          <>
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140]"
              onClick={() => (isSavingAllowanceEdit ? void 0 : setEditingAllowanceClaim(null))}
            />
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{tr('admin_dashboard.adjust_allowance')}</h3>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                      {editingAllowanceClaim.internName}
                    </div>
                  </div>
                  <button
                    onClick={() => (isSavingAllowanceEdit ? void 0 : setEditingAllowanceClaim(null))}
                    className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                    disabled={isSavingAllowanceEdit}
                  >
                    ✕
                  </button>
                </div>
                <div className="p-8 space-y-5">
                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.new_amount')}</div>
                    <input
                      value={editAllowanceAmount}
                      onChange={(e) => setEditAllowanceAmount(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    />
                  </label>
                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.note_required')}</div>
                    <textarea
                      value={editAllowanceNote}
                      onChange={(e) => setEditAllowanceNote(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all min-h-[120px]"
                    />
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setEditingAllowanceClaim(null)}
                      disabled={isSavingAllowanceEdit}
                      className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all disabled:opacity-60"
                    >
                      {tr('admin_dashboard.cancel')}
                    </button>
                    <button
                      onClick={() => void handleSaveAdminAllowanceEdit()}
                      disabled={isSavingAllowanceEdit || !editAllowanceNote.trim() || !String(editAllowanceAmount).trim()}
                      className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-60 disabled:hover:bg-blue-600"
                    >
                      {tr('admin_dashboard.save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Global Admin Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.title')}</h1>
            <p className="text-slate-500 text-sm font-medium pt-2">{tr('admin_dashboard.subtitle')}</p>
          </div>
          <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
             <TabBtn active={activeTab === 'roster'} onClick={() => setActiveTab('roster')} icon={<Users size={16}/>} label={tr('admin_dashboard.tab_roster')} />
             <TabBtn active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={16}/>} label={tr('admin_dashboard.tab_attendance')} />
             <TabBtn active={false} onClick={() => navigate('/admin/leave')} icon={<UserX size={16}/>} label={tr('admin_dashboard.tab_absences')} hasNotification={pendingLeaveCount > 0} />
             <TabBtn active={false} onClick={() => navigate('/admin/certificates')} icon={<Award size={16}/>} label={tr('admin_dashboard.tab_certs')} />
             <TabBtn active={activeTab === 'allowances'} onClick={() => setActiveTab('allowances')} icon={<CreditCard size={16}/>} label={tr('admin_dashboard.tab_payouts')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          
          {/* TAB: INTERN ROSTER */}
         {activeTab === 'roster' && (
           <RosterTab
             internRoster={internRoster}
             onAssignSupervisor={(intern) => setAssigningIntern(intern)}
           />
         )}

          {/* TAB: GLOBAL ATTENDANCE (NEW) */}
         {activeTab === 'attendance' && <AttendanceTab />}

          {/* TAB: ABSENCE MONITOR */}
         {activeTab === 'absences' && <AbsencesTab />}

          {/* TAB: CERTIFICATE REQUESTS */}
         {activeTab === 'certificates' && (
           <CertificatesTab
             certRequests={certRequests}
             onSelectForSigning={(req) => setSigningCert(req)}
           />
         )}

          {/* TAB: ALLOWANCE PAYOUTS */}
         {activeTab === 'allowances' && (
           <div className="space-y-6">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.bulk_actions')}</div>
                 <div className="text-sm font-black text-slate-900 mt-1">{tr('admin_dashboard.bulk_actions_desc')}</div>
               </div>
               <div className="flex items-center gap-3 flex-wrap">
                 <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                   <button
                     type="button"
                     onClick={() => setPayoutView('ACTIVE')}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                       payoutView === 'ACTIVE' ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                     }`}
                   >
                     {tr('allowances_tab.view_active')}
                   </button>
                   <button
                     type="button"
                     onClick={() => setPayoutView('HISTORY')}
                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                       payoutView === 'HISTORY' ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
                     }`}
                   >
                     {tr('allowances_tab.view_history')}
                   </button>
                 </div>

                 <button
                   type="button"
                   onClick={() => void handleAuthorizeAllAllowances()}
                   disabled={isAllowanceLoading || isBulkAuthorizing || isBulkPaying}
                   className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-60 disabled:hover:bg-blue-600"
                 >
                   {tr('admin_dashboard.authorize_all')}
                 </button>
                 <button
                   type="button"
                   onClick={handleOpenBulkPayModal}
                   disabled={isAllowanceLoading || isBulkAuthorizing || isBulkPaying}
                   className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-60 disabled:hover:bg-emerald-600"
                 >
                   {tr('admin_dashboard.pay_all')}
                 </button>
               </div>
             </div>

             <AllowancesTab
               allowanceClaims={visibleAllowanceClaims}
               isLoading={isAllowanceLoading}
               errorMessage={allowanceLoadError}
               onAuthorize={handleAuthorizeAllowance}
               onProcessPayment={handleProcessPayment}
               onClosePayoutCase={handleClosePayoutCase}
               canClosePayoutCase={canClosePayoutCase}
               onSyncWallet={allowanceRules.payoutFreq === 'END_PROGRAM' ? handleSyncWallet : undefined}
               syncStateByInternId={allowanceRules.payoutFreq === 'END_PROGRAM' ? syncStateByInternId : undefined}
               monthOptions={monthOptions}
               selectedMonthKey={selectedMonthKey}
               onSelectMonthKey={setSelectedMonthKey}
               onRowClick={handleOpenAdminAllowanceEdit}
             />
           </div>
         )}

        </div>
      </div>

      {/* --- MODAL: ASSIGN SUPERVISOR --- */}
      {assigningIntern && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.select_mentor')}</h3>
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">{tr('admin_dashboard.assigning_mentor_for', { name: assigningIntern.name })}</p>
                </div>
                <button onClick={() => setAssigningIntern(null)} className="text-slate-300 hover:text-slate-900"><X size={28}/></button>
              </div>

              <div className="space-y-3">
                 {mentorOptions.length === 0 ? (
                   <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm font-bold">
                     {tr('admin_dashboard.no_mentors_available')}
                   </div>
                 ) : (
                   mentorOptions.map((mentor) => (
                     <button
                       key={mentor.id}
                       onClick={() => handleAssignMentor(mentor)}
                       className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-blue-600 hover:bg-blue-50/30 transition-all group"
                     >
                       <div className="flex items-center gap-4">
                         <img src={mentor.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm" alt="" />
                         <div className="text-left">
                           <p className="text-sm font-black text-slate-900 group-hover:text-blue-600">{mentor.name}</p>
                           <div className="flex items-center gap-2">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                               {mentor.dept}
                               {mentor.position ? ` • ${mentor.position}` : ` ${tr('admin_dashboard.team_lead')}`}
                             </p>
                             {mentor.isCoAdmin ? (
                               <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-100">
                                 CO-ADMIN
                               </span>
                             ) : null}
                           </div>
                         </div>
                       </div>
                       <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                         <ChevronRight size={18} />
                       </div>
                     </button>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {isBulkAuthorizeModalOpen && (
        <div className="fixed inset-0 z-[124] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.authorize_all')}</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">
                  {tr('admin_dashboard.confirm_authorize_all', { count: bulkAuthorizeCount, month: selectedMonthKey } as any)}
                </p>
              </div>
              <button
                onClick={() => {
                  if (isBulkAuthorizing) return;
                  setIsBulkAuthorizeModalOpen(false);
                  setBulkAuthorizeCount(0);
                }}
                className="text-slate-300 hover:text-slate-900"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  if (isBulkAuthorizing) return;
                  setIsBulkAuthorizeModalOpen(false);
                  setBulkAuthorizeCount(0);
                }}
                className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
              >
                {tr('admin_dashboard.cancel')}
              </button>
              <button
                onClick={() => void handleConfirmBulkAuthorize()}
                disabled={bulkAuthorizeCount <= 0 || isBulkAuthorizing}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-60 disabled:hover:bg-blue-600"
              >
                {tr('admin_dashboard.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkPayModalOpen && (
        <div className="fixed inset-0 z-[124] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.confirm_bulk_payout')}</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">{tr('admin_dashboard.bulk_payout_subtitle')}</p>
              </div>
              <button
                onClick={() => {
                  if (isBulkPaying) return;
                  setIsBulkPayModalOpen(false);
                  setBulkPaidAtInput('');
                }}
                className="text-slate-300 hover:text-slate-900"
              >
                <X size={28} />
              </button>
            </div>

            <label className="space-y-2 block">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.paid_at')}</div>
              <input
                type="datetime-local"
                value={bulkPaidAtInput}
                onChange={(e) => setBulkPaidAtInput(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  if (isBulkPaying) return;
                  setIsBulkPayModalOpen(false);
                  setBulkPaidAtInput('');
                }}
                className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                disabled={isBulkPaying}
              >
                {tr('admin_dashboard.cancel')}
              </button>
              <button
                onClick={() => void handleConfirmBulkPay()}
                disabled={!bulkPaidAtInput || isBulkPaying}
                className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-60 disabled:hover:bg-emerald-600"
              >
                {tr('admin_dashboard.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {payoutClaimId && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.confirm_payout')}</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">{tr('admin_dashboard.payout_subtitle')}</p>
              </div>
              <button
                onClick={() => {
                  setPayoutClaimId(null);
                  setPayoutPaidAtInput('');
                }}
                className="text-slate-300 hover:text-slate-900"
              >
                <X size={28} />
              </button>
            </div>

            <label className="space-y-2 block">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.paid_at')}</div>
              <input
                type="datetime-local"
                value={payoutPaidAtInput}
                onChange={(e) => setPayoutPaidAtInput(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPayoutClaimId(null);
                  setPayoutPaidAtInput('');
                }}
                className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
              >
                {tr('admin_dashboard.cancel')}
              </button>
              <button
                onClick={() => void handleConfirmProcessPayment()}
                disabled={!payoutPaidAtInput}
                className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-60 disabled:hover:bg-emerald-600"
              >
                {tr('admin_dashboard.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: APPROVE & SIGN --- */}
      {signingCert && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 relative">
              <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-blue-100">
                      <Award size={32} />
                   </div>
                   <div>
                     <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{tr('admin_dashboard.final_authorization')}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">{tr('admin_dashboard.doc_certification_for', { name: signingCert.internName })}</p>
                   </div>
                </div>
                <button onClick={() => { setSigningCert(null); setIsStampApplied(false); setHasSigned(false); }} className="p-4 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
                  <X size={32} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-10 p-10 overflow-y-auto scrollbar-hide">
                 <div className="space-y-6">
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{tr('admin_dashboard.official_signature')}</h4>
                       <div className="aspect-[4/3] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] relative overflow-hidden group">
                          <canvas ref={canvasRef} width={600} height={450} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                          {!hasSigned && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
                              <PenTool size={48} className="text-slate-400 mb-4" />
                              <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{tr('admin_dashboard.sign_by_hand')}</span>
                            </div>
                          )}
                          {hasSigned && (
                            <button onClick={clearSignature} className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-md rounded-xl text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                              <Eraser size={24} />
                            </button>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-10">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('admin_dashboard.company_protocol')}</h4>
                       <div 
                         onClick={() => setIsStampApplied(!isStampApplied)}
                         className={`p-10 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-500 ${
                           isStampApplied ? 'bg-emerald-50 border-emerald-500 text-emerald-600 scale-[1.02] shadow-xl' : 'bg-slate-50 border-slate-200 text-slate-300 hover:border-blue-300'
                         }`}
                       >
                          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-transform duration-700 ${isStampApplied ? 'rotate-12 border-emerald-500' : 'border-slate-200'}`}>
                             <Stamp size={48} fill={isStampApplied ? 'currentColor' : 'none'} />
                          </div>
                       </div>
                    </div>
                    <button onClick={handleFinalApprove} disabled={!hasSigned || !isStampApplied || isProcessing} className="w-full py-6 bg-[#111827] text-white rounded-full font-black text-lg tracking-tight hover:bg-blue-600 transition-all shadow-2xl disabled:opacity-30 flex items-center justify-center gap-3">
                       {isProcessing ? <><Clock className="animate-spin" size={24} /> {tr('admin_dashboard.generating')}</> : <><FileCheck size={24} /> {tr('admin_dashboard.issue_certificate')}</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({
  active,
  onClick,
  icon,
  label,
  hasNotification,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hasNotification?: boolean;
}) => (
  <button onClick={onClick} className={`relative flex items-center gap-2.5 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-[#111827] text-white shadow-xl' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}>
    {icon} {label}
    {hasNotification && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
    )}
  </button>
);

export default AdminDashboard;

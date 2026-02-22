import admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

setGlobalOptions({ region: 'asia-southeast1' });

if (admin.apps.length === 0) {
  const projectId = process.env.GCLOUD_PROJECT;
  admin.initializeApp({
    storageBucket: projectId ? `${projectId}.firebasestorage.app` : undefined,
  });
}

export const syncAllowanceWallet = onCall({ cors: true }, async (request) => {
  await assertHrAdminOrSupervisor(request);
  const internId = String((request.data as any)?.internId ?? '').trim();
  if (!internId) throw new HttpsError('invalid-argument', 'Missing internId');
  const db = admin.firestore();
  try {
    const now = admin.firestore.Timestamp.now();
    const lockRef = db.collection('walletSyncLocks').doc(internId);

    const lockResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      const data = snap.exists ? (snap.data() as any) : null;
      const status = typeof data?.status === 'string' ? data.status : null;
      const startedAt = data?.startedAt instanceof admin.firestore.Timestamp ? data.startedAt : null;

      // Treat a running lock as stale after 10 minutes.
      const isStale =
        status === 'RUNNING' &&
        startedAt &&
        now.toMillis() - startedAt.toMillis() > 10 * 60 * 1000;

      if (status === 'RUNNING' && !isStale) {
        return { ok: false, alreadyRunning: true, startedAtMs: startedAt?.toMillis?.() ?? null };
      }

      tx.set(
        lockRef,
        {
          status: 'RUNNING',
          startedAt: now,
          startedByUid: request.auth?.uid ?? null,
          finishedAt: admin.firestore.FieldValue.delete(),
          errorMessage: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true },
      );

      return { ok: true, alreadyRunning: false };
    });

    if (!lockResult.ok) {
      return lockResult;
    }

    const result = await syncAllowanceWalletInternal(db, internId);
    await lockRef.set(
      {
        status: 'DONE',
        finishedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true },
    );
    return { ...result, ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('syncAllowanceWallet:error', { internId, err });
    try {
      await db
        .collection('walletSyncLocks')
        .doc(internId)
        .set(
          {
            status: 'ERROR',
            finishedAt: admin.firestore.Timestamp.now(),
            errorMessage: message,
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true },
        );
    } catch {
      // ignore
    }
    throw new HttpsError('internal', message);
  }
});

export const recalculateMyAllowance = onCall({ cors: true }, async (request) => {
  const caller = await assertInternSelf(request);
  const monthKey = String((request.data as any)?.monthKey ?? '').trim();
  if (!monthKey) throw new HttpsError('invalid-argument', 'Missing monthKey');
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new HttpsError('invalid-argument', 'Invalid monthKey');

  const db = admin.firestore();
  try {
    const result = await recalculateAllowanceClaimInternal(db, caller.uid, monthKey);
    await syncAllowanceWalletInternal(db, caller.uid);
    return { ok: true, ...result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('recalculateMyAllowance:error', { uid: caller.uid, monthKey, err });
    throw new HttpsError('internal', message);
  }
});

export const onAttendanceWritten = onDocumentWritten('users/{internId}/attendance/{dateKey}', async (event) => {
  try {
    const internId = String((event.params as any)?.internId ?? '').trim();
    if (!internId) return;

    const after = event.data?.after?.data() as any | undefined;
    if (!after) return;

    const before = event.data?.before?.data() as any | undefined;

    // Only recompute once a clock-out exists (calculation requires both clockInAt + clockOutAt).
    const hasClockIn = Boolean(after?.clockInAt);
    const hasClockOut = Boolean(after?.clockOutAt);
    if (!hasClockIn || !hasClockOut) return;

    // Avoid reprocessing if clockOutAt already existed before.
    if (before?.clockOutAt) return;

    const dateKey = typeof after?.date === 'string' ? after.date : String((event.params as any)?.dateKey ?? '');
    // dateKey is expected to be YYYY-MM-DD.
    const monthKey = typeof dateKey === 'string' && dateKey.length >= 7 ? dateKey.slice(0, 7) : '';
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return;

    const db = admin.firestore();
    await recalculateAllowanceClaimInternal(db, internId, monthKey);
    await syncAllowanceWalletInternal(db, internId);
  } catch (err) {
    console.error('onAttendanceWritten:error', err);
  }
});

const THIS_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

type CertificateRequestStatus = 'REQUESTED' | 'ISSUED';

type CertificateRequestType = 'COMPLETION' | 'RECOMMENDATION';

type CertificateRequestDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
  overrideInternName?: string | null;
  overrideInternPosition?: string | null;
  overrideInternDepartment?: string | null;
  overrideInternPeriod?: string | null;
  overrideSystemId?: string | null;
  overrideIssueDate?: string | null;
  overrideIssueDateTs?: admin.firestore.Timestamp | null;
  snapshotInternName?: string | null;
  snapshotInternPosition?: string | null;
  snapshotInternDepartment?: string | null;
  snapshotInternPeriod?: string | null;
  snapshotSystemId?: string | null;
  snapshotIssueDateTs?: admin.firestore.Timestamp | null;
  supervisorId: string | null;
  type: CertificateRequestType;
  status: CertificateRequestStatus;
  requestedAt?: unknown;
  issuedAt?: unknown;
  issuedById?: string;
  issuedByName?: string;
  issuedByRole?: 'SUPERVISOR' | 'HR_ADMIN';
  fileName?: string;
  storagePath?: string;
  templateId?: string;
  issuedPngPath?: string;
  issuedPdfPath?: string;
};

type CertificateTemplateDoc = {
  name: string;
  type: CertificateRequestType;
  backgroundPath?: string;
  active?: boolean;
  layout?: {
    canvas: { width: number; height: number };
    blocks: Array<{
      id: string;
      kind: 'text';
      x: number;
      y: number;
      width?: number;
      rotation?: number;
      fontSize: number;
      fontWeight?: number;
      color: string;
      opacity?: number;
      source:
        | { type: 'static'; text: string }
        | {
            type: 'field';
            key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate';
          };
    }>;
  };
  layoutVersion?: number;
  updatedAt?: unknown;
  updatedBy?: string;
};

type UserDoc = {
  name?: string;
  department?: string;
  position?: string;
  internPeriod?: string;
  systemId?: string;
};

function assertAdmin(context: Parameters<typeof onCall>[0] extends any ? any : never) {
  const auth = context.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  if ((auth.token as any)?.admin !== true) throw new HttpsError('permission-denied', 'Admin only.');
}

async function getCallerRoles(uid: string): Promise<Array<'INTERN' | 'SUPERVISOR' | 'HR_ADMIN'>> {
  const snap = await admin.firestore().collection('users').doc(uid).get();
  const roles = (snap.exists ? (snap.data() as any)?.roles : null) as unknown;
  return Array.isArray(roles) ? (roles as Array<'INTERN' | 'SUPERVISOR' | 'HR_ADMIN'>) : [];
}

async function assertInternSelf(context: Parameters<typeof onCall>[0] extends any ? any : never): Promise<{ uid: string; roles: string[] }> {
  const auth = context.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const uid = auth.uid;
  const roles = await getCallerRoles(uid);
  if (!roles.includes('INTERN')) throw new HttpsError('permission-denied', 'Intern only.');
  return { uid, roles };
}

async function assertHrAdminOrSupervisor(context: Parameters<typeof onCall>[0] extends any ? any : never): Promise<{ uid: string; roles: string[] }> {
  const auth = context.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const uid = auth.uid;
  const roles = await getCallerRoles(uid);
  if (!roles.includes('HR_ADMIN') && !roles.includes('SUPERVISOR')) {
    throw new HttpsError('permission-denied', 'HR_ADMIN or SUPERVISOR only.');
  }
  return { uid, roles };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function clampDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInclusive(startIso: string, endIso: string): Date[] {
  const s = new Date(`${startIso}T00:00:00.000Z`);
  const e = new Date(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const out: Date[] = [];
  const cur = new Date(s.getTime());
  while (cur.getTime() <= e.getTime()) {
    out.push(new Date(cur.getTime()));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function coerceToDate(value: unknown): Date | null {
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
}

type AllowanceRules = {
  payoutFreq: 'MONTHLY' | 'END_PROGRAM';
  wfoRate: number;
  wfhRate: number;
  applyTax: boolean;
  taxPercent: number;
};

type WalletStatusSummary = 'EMPTY' | 'ALL_PAID' | 'HAS_PENDING';

function isClaimStatus(value: unknown): value is 'PENDING' | 'APPROVED' | 'PAID' {
  return value === 'PENDING' || value === 'APPROVED' || value === 'PAID';
}

async function syncAllowanceWalletInternal(db: admin.firestore.Firestore, internId: string) {
  const userSnap = await db.collection('users').doc(internId).get();
  const userRaw = userSnap.exists ? (userSnap.data() as any) : null;
  const internName = typeof userRaw?.name === 'string' ? userRaw.name : 'Unknown';

  const allowanceRules = await loadAllowanceRules(db);

  const claimsSnap = await db.collection('allowanceClaims').where('internId', '==', internId).get();

  let totalAmount = 0;
  let totalPendingAmount = 0;
  let totalPaidAmount = 0;
  let totalCalculatedAmount = 0;
  let totalWfo = 0;
  let totalWfh = 0;
  let totalLeaves = 0;
  let hasPending = false;
  let hasAny = false;

  let nextPlannedPayoutDate: string | null = null;
  let lastPaymentDate: string | null = null;
  let lastPaidAtMs: number | null = null;

  // Store totals as a standalone document (no subcollection) per user's request.
  const totalsRef = db.collection('CurrentWallet').doc(internId);
  // Keep month breakdown docs in a separate structure.
  const walletMonthsParentRef = db.collection('allowanceWallets').doc(internId);
  const batch = db.batch();

  for (const d of claimsSnap.docs) {
    const raw = d.data() as any;
    const monthKey = typeof raw?.monthKey === 'string' ? raw.monthKey : undefined;
    if (!monthKey) continue;

    const amount = typeof raw?.amount === 'number' ? raw.amount : 0;
    const calculatedAmount = typeof raw?.calculatedAmount === 'number' ? raw.calculatedAmount : amount;
    const status: 'PENDING' | 'APPROVED' | 'PAID' = isClaimStatus(raw?.status) ? raw.status : 'PENDING';
    const breakdown = (raw?.breakdown ?? {}) as any;
    const wfo = typeof breakdown?.wfo === 'number' ? breakdown.wfo : 0;
    const wfh = typeof breakdown?.wfh === 'number' ? breakdown.wfh : 0;
    const leaves = typeof breakdown?.leaves === 'number' ? breakdown.leaves : 0;
    const periodLabel = typeof raw?.period === 'string' ? raw.period : monthKey;
    const plannedPayoutDate = typeof raw?.plannedPayoutDate === 'string' ? raw.plannedPayoutDate : undefined;
    const paymentDate = typeof raw?.paymentDate === 'string' ? raw.paymentDate : undefined;
    const paidAtMs =
      typeof raw?.paidAt?.toMillis === 'function'
        ? raw.paidAt.toMillis()
        : typeof raw?.paidAtMs === 'number'
          ? raw.paidAtMs
          : undefined;

    const hasAdjustment = typeof raw?.adminAdjustedAmount === 'number' || typeof raw?.supervisorAdjustedAmount === 'number';

    hasAny = true;
    totalAmount += amount;
    totalCalculatedAmount += calculatedAmount;
    totalWfo += wfo;
    totalWfh += wfh;
    totalLeaves += leaves;
    if (status === 'PAID') totalPaidAmount += amount;
    else {
      totalPendingAmount += amount;
      hasPending = true;
    }

    if (plannedPayoutDate && status !== 'PAID') {
      if (!nextPlannedPayoutDate || plannedPayoutDate < nextPlannedPayoutDate) nextPlannedPayoutDate = plannedPayoutDate;
    }

    if (status === 'PAID') {
      if (typeof paidAtMs === 'number') {
        if (!lastPaidAtMs || paidAtMs > lastPaidAtMs) {
          lastPaidAtMs = paidAtMs;
          lastPaymentDate = paymentDate ?? null;
        }
      } else if (!lastPaidAtMs && !lastPaymentDate && paymentDate) {
        // Fallback when we don't have a paidAt timestamp.
        lastPaymentDate = paymentDate;
      }
    }

    const monthRef = walletMonthsParentRef.collection('months').doc(monthKey);
    const monthPayload: Record<string, unknown> = {
      internId,
      internName,
      monthKey,
      periodLabel,
      amount,
      calculatedAmount,
      breakdown: { wfo, wfh, leaves },
      status,
      hasAdjustment,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (plannedPayoutDate) (monthPayload as any).plannedPayoutDate = plannedPayoutDate;
    if (paymentDate) (monthPayload as any).paymentDate = paymentDate;
    if (typeof paidAtMs === 'number') (monthPayload as any).paidAtMs = paidAtMs;

    batch.set(monthRef, monthPayload, { merge: true });
  }

  const statusSummary: WalletStatusSummary = !hasAny ? 'EMPTY' : hasPending ? 'HAS_PENDING' : 'ALL_PAID';

  const walletPayload: Record<string, unknown> = {
    internId,
    internName,
    payoutFreq: allowanceRules.payoutFreq,
    totalAmount,
    totalCalculatedAmount,
    totalPendingAmount,
    totalPaidAmount,
    totalBreakdown: {
      wfo: totalWfo,
      wfh: totalWfh,
      leaves: totalLeaves,
    },
    statusSummary,
    plannedPayoutDate: nextPlannedPayoutDate,
    paymentDate: lastPaymentDate,
    paidAtMs: lastPaidAtMs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByRole: 'SYSTEM',
  };

  batch.set(totalsRef, walletPayload, { merge: true });
  await batch.commit();

  return {
    ok: true,
    internId,
    totalAmount,
    totalPendingAmount,
    totalPaidAmount,
    statusSummary,
    monthsSynced: claimsSnap.size,
  };
}

async function loadAllowanceRules(db: admin.firestore.Firestore): Promise<AllowanceRules> {
  const snap = await db.collection('config').doc('systemSettings').get();
  const raw = snap.exists ? (snap.data() as any) : null;
  const a = raw?.allowance ?? {};
  return {
    payoutFreq: a?.payoutFreq === 'END_PROGRAM' ? 'END_PROGRAM' : 'MONTHLY',
    wfoRate: typeof a?.wfoRate === 'number' ? a.wfoRate : 100,
    wfhRate: typeof a?.wfhRate === 'number' ? a.wfhRate : 50,
    applyTax: typeof a?.applyTax === 'boolean' ? a.applyTax : true,
    taxPercent: typeof a?.taxPercent === 'number' ? a.taxPercent : 3,
  };
}

async function recalculateAllowanceClaimInternal(
  db: admin.firestore.Firestore,
  internId: string,
  monthKey: string,
): Promise<{ skipped: boolean; reason?: string; claimId: string; calculatedAmount: number; amount: number; breakdown: { wfo: number; wfh: number; leaves: number } } > {
  const parts = monthKey.split('-');
  const year = Number(parts[0]);
  const monthIdx = Number(parts[1]) - 1;
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonthIdx = Number.isFinite(monthIdx) && monthIdx >= 0 && monthIdx <= 11 ? monthIdx : new Date().getMonth();

  const monthStart = new Date(safeYear, safeMonthIdx, 1);
  const monthEnd = new Date(safeYear, safeMonthIdx + 1, 0);

  const payPeriodSnap = await db.collection('payPeriods').doc(monthKey).get();
  const payPeriodData = payPeriodSnap.exists ? (payPeriodSnap.data() as any) : null;
  const periodStartIso = typeof payPeriodData?.periodStart === 'string' ? payPeriodData.periodStart : null;
  const periodEndIso = typeof payPeriodData?.periodEnd === 'string' ? payPeriodData.periodEnd : null;
  const plannedPayoutDate = typeof payPeriodData?.plannedPayoutDate === 'string' ? payPeriodData.plannedPayoutDate : undefined;

  const toUtcDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const periodStart = clampDay(monthStart);
  const periodEnd = clampDay(monthEnd);
  void toUtcDate;
  void periodStartIso;
  void periodEndIso;
  const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const allowanceRules = await loadAllowanceRules(db);

  const userSnap = await db.collection('users').doc(internId).get();
  const userRaw = userSnap.exists ? (userSnap.data() as any) : null;
  const internName = typeof userRaw?.name === 'string' ? userRaw.name : 'Unknown';
  const avatar = typeof userRaw?.avatar === 'string' ? userRaw.avatar : '';
  const lifecycleStatus = typeof userRaw?.lifecycleStatus === 'string' ? userRaw.lifecycleStatus : '';
  const isCompleted = lifecycleStatus === 'COMPLETED';

  const claimId = `${internId}_${monthKey}`;
  const claimRef = db.collection('allowanceClaims').doc(claimId);
  const claimSnap = await claimRef.get();
  const claimRaw = claimSnap.exists ? (claimSnap.data() as any) : null;
  const status: 'PENDING' | 'APPROVED' | 'PAID' =
    claimRaw?.status === 'PAID' || claimRaw?.status === 'APPROVED' || claimRaw?.status === 'PENDING' ? claimRaw.status : 'PENDING';

  if (status === 'PAID') {
    return {
      skipped: true,
      reason: 'PAID',
      claimId,
      calculatedAmount: typeof claimRaw?.calculatedAmount === 'number' ? claimRaw.calculatedAmount : (typeof claimRaw?.amount === 'number' ? claimRaw.amount : 0),
      amount: typeof claimRaw?.amount === 'number' ? claimRaw.amount : 0,
      breakdown: {
        wfo: typeof claimRaw?.breakdown?.wfo === 'number' ? claimRaw.breakdown.wfo : 0,
        wfh: typeof claimRaw?.breakdown?.wfh === 'number' ? claimRaw.breakdown.wfh : 0,
        leaves: typeof claimRaw?.breakdown?.leaves === 'number' ? claimRaw.breakdown.leaves : 0,
      },
    };
  }

  const attendanceRef = db.collection('users').doc(internId).collection('attendance');
  const [attSnap, leaveSnap, corrSnap] = await Promise.all([
    attendanceRef
      .where(admin.firestore.FieldPath.documentId(), '>=', toDateKey(periodStart))
      .where(admin.firestore.FieldPath.documentId(), '<=', toDateKey(periodEnd))
      .get(),
    (async () => {
      const prevWindowStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate() - 31);
      const leaveFromKey = toDateKey(prevWindowStart);
      const leaveToKey = toDateKey(periodEnd);
      // Intentionally avoid composite indexes by only filtering by internId + status.
      // We will filter by date range overlap in-memory.
      return {
        snap: await db
          .collection('leaveRequests')
          .where('internId', '==', internId)
          .where('status', '==', 'APPROVED')
          .get(),
        leaveFromKey,
        leaveToKey,
      };
    })(),
    db.collection('timeCorrections').where('internId', '==', internId).where('status', '==', 'PENDING').get(),
  ]);

  let wfo = 0;
  let wfh = 0;
  let monthlyGross = 0;

  attSnap.forEach((d) => {
    const raw = d.data() as any;
    const dateKey = typeof raw?.date === 'string' ? raw.date : d.id;
    void dateKey;
    const hasClockIn = Boolean(raw?.clockInAt);
    if (!hasClockIn) return;
    const mode = raw?.workMode === 'WFH' ? 'WFH' : 'WFO';

    const clockInAt = coerceToDate(raw?.clockInAt);
    const clockOutAt = coerceToDate(raw?.clockOutAt);
    if (!clockInAt || !clockOutAt) return;
    const startMs = clockInAt.getTime();
    const endMs = clockOutAt.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;

    const totalHours = (endMs - startMs) / (1000 * 60 * 60);
    const payableHours = Math.min(8, Math.max(0, totalHours - 1));
    if (payableHours <= 0) return;

    if (mode === 'WFH') wfh += 1;
    else wfo += 1;

    const dayRate = mode === 'WFH' ? allowanceRules.wfhRate : allowanceRules.wfoRate;
    const hourRate = dayRate / 8;
    monthlyGross += hourRate * payableHours;
  });

  const leaveDaysSet = new Set<string>();
  const leaveSnapDocs = (leaveSnap as any)?.snap?.docs ? (leaveSnap as any).snap.docs : (leaveSnap as any)?.docs;
  const leaveFromKey = (leaveSnap as any)?.leaveFromKey as string | undefined;
  const leaveToKey = (leaveSnap as any)?.leaveToKey as string | undefined;
  (leaveSnapDocs ?? []).forEach((d: any) => {
    const raw = typeof d?.data === 'function' ? (d.data() as any) : (d as any);
    const startDate = typeof raw?.startDate === 'string' ? raw.startDate : null;
    const endDate = typeof raw?.endDate === 'string' ? raw.endDate : null;
    if (!startDate || !endDate) return;
    // Quick overlap filter for performance.
    if (leaveFromKey && endDate < leaveFromKey) return;
    if (leaveToKey && startDate > leaveToKey) return;

    for (const day of daysInclusive(startDate, endDate)) {
      const localDay = clampDay(new Date(day.getTime()));
      if (localDay.getTime() < periodStart.getTime()) continue;
      if (localDay.getTime() > periodEnd.getTime()) continue;
      leaveDaysSet.add(toDateKey(localDay));
    }
  });
  const leaves = leaveDaysSet.size;

  const calculatedAmount = allowanceRules.applyTax
    ? Math.max(0, Math.round(monthlyGross * (1 - allowanceRules.taxPercent / 100)))
    : Math.max(0, Math.round(monthlyGross));

  const supervisorAdjustedAmount = typeof claimRaw?.supervisorAdjustedAmount === 'number' ? claimRaw.supervisorAdjustedAmount : undefined;
  const adminAdjustedAmount = typeof claimRaw?.adminAdjustedAmount === 'number' ? claimRaw.adminAdjustedAmount : undefined;

  const finalAmount =
    typeof adminAdjustedAmount === 'number'
      ? adminAdjustedAmount
      : typeof supervisorAdjustedAmount === 'number'
        ? supervisorAdjustedAmount
        : calculatedAmount;

  const shouldPreserveExistingAmount =
    typeof adminAdjustedAmount === 'number' || typeof supervisorAdjustedAmount === 'number';
  const amountToStore =
    shouldPreserveExistingAmount && typeof claimRaw?.amount === 'number' ? claimRaw.amount : finalAmount;

  const lockedByEndProgram = allowanceRules.payoutFreq === 'END_PROGRAM' && !isCompleted;
  const lockedByPendingCorrection = !corrSnap.empty;
  const isPayoutLocked = lockedByEndProgram || lockedByPendingCorrection;
  const lockReason = lockedByPendingCorrection
    ? `Has ${corrSnap.size} pending time correction request(s). Payout locked until resolved.`
    : undefined;

  const payload: Record<string, unknown> = {
    internId,
    internName,
    avatar,
    monthKey,
    calculatedAmount,
    breakdown: { wfo, wfh, leaves },
    period: periodLabel,
    status,
    amount: amountToStore,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByRole: 'SYSTEM',
  };

  if (typeof plannedPayoutDate === 'string' && plannedPayoutDate) {
    (payload as any).plannedPayoutDate = plannedPayoutDate;
  }

  if (isPayoutLocked) {
    (payload as any).isPayoutLocked = true;
    if (lockReason) (payload as any).lockReason = lockReason;
  } else {
    // Explicitly clear lock fields when unlocked to keep UI consistent.
    (payload as any).isPayoutLocked = false;
    (payload as any).lockReason = null;
  }

  if (!claimSnap.exists) {
    (payload as any).createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await claimRef.set(payload, { merge: true });

  // Keep aggregated wallet in sync for END_PROGRAM view.
  try {
    await syncAllowanceWalletInternal(db, internId);
  } catch (e) {
    console.error('syncAllowanceWalletInternal:error', { internId, monthKey, e });
  }

  return {
    skipped: false,
    claimId,
    calculatedAmount,
    amount: amountToStore,
    breakdown: { wfo, wfh, leaves },
  };
}

export const recalculateAllowanceClaim = onCall({ cors: true }, async (request) => {
  await assertHrAdminOrSupervisor(request);
  const internId = String((request.data as any)?.internId ?? '').trim();
  const monthKey = String((request.data as any)?.monthKey ?? '').trim();
  if (!internId) throw new HttpsError('invalid-argument', 'Missing internId');
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new HttpsError('invalid-argument', 'Invalid monthKey');

  const db = admin.firestore();
  try {
    return await recalculateAllowanceClaimInternal(db, internId, monthKey);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('recalculateAllowanceClaim:error', { internId, monthKey, err });
    throw new HttpsError('internal', message);
  }
});

function dateKeyToParts(dateKey: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [yy, mm, dd] = dateKey.split('-').map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return { y: yy, m: mm, d: dd };
}

function dateInBangkok(y: number, m: number, d: number, hh: number, mm: number, ss = 0): Date {
  // Interpret given wall-clock time as Asia/Bangkok (+07:00) and convert to a UTC Date.
  const utcMs = Date.UTC(y, m - 1, d, hh - 7, mm, ss, 0);
  return new Date(utcMs);
}

function normalizeWorkMode(value: unknown): 'WFO' | 'WFH' | 'LEAVE' | null {
  const s = String(value ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s === 'WFH') return 'WFH';
  if (s === 'WFO') return 'WFO';
  if (s === 'OFFICE') return 'WFO';
  if (s === 'LEAVE') return 'LEAVE';
  return null;
}

const THAI_MONTHS: Record<string, number> = {
  'ม.ค.': 1,
  'ก.พ.': 2,
  'มี.ค.': 3,
  'เม.ย.': 4,
  'พ.ค.': 5,
  'มิ.ย.': 6,
  'ก.ค.': 7,
  'ส.ค.': 8,
  'ก.ย.': 9,
  'ต.ค.': 10,
  'พ.ย.': 11,
  'ธ.ค.': 12,
};

function parseThaiOrIsoDate(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel date serial.
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const y = Number(d.y);
    const m = String(Number(d.m)).padStart(2, '0');
    const dd = String(Number(d.d)).padStart(2, '0');
    if (!y || !m || !dd) return null;
    return `${y}-${m}-${dd}`;
  }

  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[-/](.+?)[-/](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const monthToken = String(m[2]).trim();
    const yearToken = Number(m[3]);
    const month = THAI_MONTHS[monthToken] ?? null;
    if (!month || !Number.isFinite(day) || !Number.isFinite(yearToken)) return null;
    const y = yearToken < 100 ? 2000 + yearToken : yearToken;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }

  return null;
}

function parseTimeToHM(value: unknown): { h: number; m: number; s: number } | null {
  if (value == null) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { h: value.getHours(), m: value.getMinutes(), s: value.getSeconds() };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel time fraction of a day.
    const totalSeconds = Math.round(value * 24 * 60 * 60);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return { h, m, s };
  }

  const s = String(value).trim();
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const sec = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
  return { h, m, s: sec };
}

type ParsedExcelRow = {
  dateKey: string;
  timeIn: { h: number; m: number; s: number };
  timeOut: { h: number; m: number; s: number };
  workMode: 'WFO' | 'WFH';
  email?: string;
};

function pickCell(row: Record<string, unknown>, names: string[]): unknown {
  for (const n of names) {
    const v = (row as any)[n];
    if (v != null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function parseExcelRows(rows: Array<Record<string, unknown>>): { parsed: ParsedExcelRow[]; emailFromFile: string | null; skippedInvalidRows: number } {
  const parsed: ParsedExcelRow[] = [];
  let emailFromFile: string | null = null;
  let skippedInvalidRows = 0;

  for (const r of rows) {
    const dateRaw = pickCell(r, ['Date', 'date', 'DATE', 'วันที่']);
    const timeInRaw = pickCell(r, ['Time In', 'TimeIn', 'time in', 'TIME IN', 'เข้างาน', 'เข้า']);
    const timeOutRaw = pickCell(r, ['Time Out', 'TimeOut', 'time out', 'TIME OUT', 'ออกงาน', 'ออก']);
    const modeRaw = pickCell(r, ['Work mode', 'Work Mode', 'work mode', 'Mode', 'โหมด', 'รูปแบบการทำงาน']);
    const emailRaw = pickCell(r, ['Email', 'email', 'EMAIL', 'E-mail', 'อีเมล']);

    const dateKey = parseThaiOrIsoDate(dateRaw);
    const timeIn = parseTimeToHM(timeInRaw);
    const timeOut = parseTimeToHM(timeOutRaw);
    const normalizedMode = normalizeWorkMode(modeRaw);

    const email = emailRaw ? String(emailRaw).trim() : '';
    if (!emailFromFile && email) emailFromFile = email;

    if (!dateKey || !timeIn || !timeOut || !normalizedMode) {
      skippedInvalidRows += 1;
      continue;
    }
    if (normalizedMode === 'LEAVE') {
      // Not an attendance day for allowance.
      continue;
    }

    parsed.push({
      dateKey,
      timeIn,
      timeOut,
      workMode: normalizedMode,
      ...(email ? { email } : {}),
    });
  }

  return { parsed, emailFromFile, skippedInvalidRows };
}

async function isPaidMonth(db: admin.firestore.Firestore, internId: string, monthKey: string): Promise<boolean> {
  const snap = await db
    .collection('allowanceClaims')
    .where('internId', '==', internId)
    .where('monthKey', '==', monthKey)
    .where('status', '==', 'PAID')
    .limit(1)
    .get();
  return !snap.empty;
}

async function hasCompleteAttendance(db: admin.firestore.Firestore, internId: string, dateKey: string): Promise<boolean> {
  const snap = await db.collection('users').doc(internId).collection('attendance').doc(dateKey).get();
  if (!snap.exists) return false;
  const raw = snap.data() as any;
  return Boolean(raw?.clockInAt && raw?.clockOutAt);
}

async function assertCanApplyExcelImport(
  db: admin.firestore.Firestore,
  caller: { uid: string; roles: string[] },
  importDoc: { internId: string; supervisorId?: string | null },
) {
  if (caller.roles.includes('HR_ADMIN')) return;
  // Supervisor only.
  const supId = importDoc.supervisorId ?? null;
  if (supId !== caller.uid) {
    throw new HttpsError('permission-denied', 'Supervisor can only apply imports for assigned interns.');
  }
}

export const applyAttendanceExcelImport = onCall({ cors: true }, async (request) => {
  const caller = await assertHrAdminOrSupervisor(request);

  const importId = String((request.data as any)?.importId ?? '').trim();
  if (!importId) throw new HttpsError('invalid-argument', 'Missing importId');

  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const importRef = db.collection('attendanceExcelImports').doc(importId);
  const importSnap = await importRef.get();
  if (!importSnap.exists) throw new HttpsError('not-found', 'Import request not found');

  const importRaw = importSnap.data() as any;
  const internId = typeof importRaw?.internId === 'string' ? importRaw.internId : '';
  const storagePath = typeof importRaw?.storagePath === 'string' ? importRaw.storagePath : '';
  const status = typeof importRaw?.status === 'string' ? importRaw.status : '';
  const supervisorId = typeof importRaw?.supervisorId === 'string' ? importRaw.supervisorId : null;
  if (!internId || !storagePath) throw new HttpsError('failed-precondition', 'Invalid import request data');

  await assertCanApplyExcelImport(db, caller, { internId, supervisorId });

  if (status === 'APPLIED') {
    return { ok: true, skipped: true, reason: 'Already applied' };
  }
  if (status !== 'APPROVED' && status !== 'PENDING') {
    throw new HttpsError('failed-precondition', 'Request must be approved before applying');
  }

  const errors: string[] = [];

  try {
    const file = bucket.file(storagePath);
    const [buf] = await file.download();
    const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Excel has no sheets');
    const ws = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

    const { parsed, emailFromFile, skippedInvalidRows } = parseExcelRows(rows);

    const skippedPaidMonthsSet = new Set<string>();
    const touchedMonthsSet = new Set<string>();
    let skippedPaidDays = 0;
    let skippedExistingAttendanceDays = 0;
    let appliedDays = 0;

    const paidCache = new Map<string, boolean>();

    const commitChunk = async (writes: Array<() => void>) => {
      if (writes.length === 0) return;
      const batch = db.batch();
      for (const fn of writes) fn.call(null);
      await batch.commit();
    };

    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const entry of parsed) {
      const parts = dateKeyToParts(entry.dateKey);
      if (!parts) {
        // should not happen if parser is correct
        continue;
      }

      const monthKey = entry.dateKey.slice(0, 7);
      touchedMonthsSet.add(monthKey);
      let isPaid = paidCache.get(monthKey);
      if (typeof isPaid !== 'boolean') {
        isPaid = await isPaidMonth(db, internId, monthKey);
        paidCache.set(monthKey, isPaid);
      }
      if (isPaid) {
        skippedPaidMonthsSet.add(monthKey);
        skippedPaidDays += 1;
        continue;
      }

      const alreadyComplete = await hasCompleteAttendance(db, internId, entry.dateKey);
      if (alreadyComplete) {
        skippedExistingAttendanceDays += 1;
        continue;
      }

      const clockInAt = admin.firestore.Timestamp.fromDate(
        dateInBangkok(parts.y, parts.m, parts.d, entry.timeIn.h, entry.timeIn.m, entry.timeIn.s),
      );
      const clockOutAt = admin.firestore.Timestamp.fromDate(
        dateInBangkok(parts.y, parts.m, parts.d, entry.timeOut.h, entry.timeOut.m, entry.timeOut.s),
      );

      if (clockOutAt.toMillis() <= clockInAt.toMillis()) {
        continue;
      }

      const attRef = db.collection('users').doc(internId).collection('attendance').doc(entry.dateKey);
      batch.set(
        attRef,
        {
          date: entry.dateKey,
          clockInAt,
          clockOutAt,
          workMode: entry.workMode,
          source: 'EXCEL_IMPORT',
          importId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      ops += 1;
      appliedDays += 1;
      if (ops >= 400) await flush();
    }

    await flush();

    // Recalculate allowance claims immediately for months affected by this import.
    for (const mk of Array.from(touchedMonthsSet.values())) {
      try {
        await recalculateAllowanceClaimInternal(db, internId, mk);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to recalculate allowance';
        errors.push(`recalculateAllowanceClaim(${mk}): ${msg}`);
      }
    }

    await importRef.update({
      status: 'APPLIED',
      emailFromFile: emailFromFile ?? (importRaw?.emailFromFile ?? null),
      skippedPaidMonths: Array.from(skippedPaidMonthsSet.values()).sort(),
      resultSummary: {
        appliedDays,
        skippedPaidDays,
        skippedExistingAttendanceDays,
        skippedInvalidRows,
      },
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      appliedById: caller.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(errors.length > 0 ? { errors } : { errors: admin.firestore.FieldValue.delete() }),
    });

    return {
      ok: true,
      appliedDays,
      skippedPaidDays,
      skippedExistingAttendanceDays,
      skippedInvalidRows,
      skippedPaidMonths: Array.from(skippedPaidMonthsSet.values()).sort(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('applyAttendanceExcelImport:error', { importId, err });
    try {
      await importRef.update({
        status: 'FAILED',
        errors: admin.firestore.FieldValue.arrayUnion(message),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('applyAttendanceExcelImport:updateFailed', { importId, e });
    }
    throw new HttpsError('internal', message);
  }
});

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

type EmbeddedFontSpec = {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  relativePath: string;
  mime: 'font/ttf' | 'font/otf';
  format: 'truetype' | 'opentype';
};

const EMBEDDED_FONTS: EmbeddedFontSpec[] = [
  {
    family: 'TH Sarabun New',
    weight: 400,
    style: 'normal',
    relativePath: 'front/thai/THSarabunNew.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 700,
    style: 'normal',
    relativePath: 'front/thai/THSarabunNew Bold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 400,
    style: 'italic',
    relativePath: 'front/thai/THSarabunNew Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'TH Sarabun New',
    weight: 700,
    style: 'italic',
    relativePath: 'front/thai/THSarabunNew BoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 300,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Light.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 300,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-LightItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 700,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Bold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond',
    weight: 700,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-BoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'DM Serif Display',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/eng/DM_Serif_Display/DMSerifDisplay-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'DM Serif Display',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/eng/DM_Serif_Display/DMSerifDisplay-Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Yeseva One',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/eng/Yeseva_One/YesevaOne-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Yeseva One',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/eng02/Yeseva_One/YesevaOne-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Light',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Light.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Light',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-LightItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Regular',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Regular.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Regular',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-Italic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Medium',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Medium.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Medium',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-MediumItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond SemiBold',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-SemiBold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond SemiBold',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-SemiBoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Bold',
    weight: 400,
    style: 'normal',
    relativePath: 'front/eng/static/CormorantGaramond-Bold.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
  {
    family: 'Cormorant Garamond Bold',
    weight: 400,
    style: 'italic',
    relativePath: 'front/eng/static/CormorantGaramond-BoldItalic.ttf',
    mime: 'font/ttf',
    format: 'truetype',
  },
];

const embeddedFontBase64Cache = new Map<string, string>();

function readFontBase64(relativePath: string): string {
  const cached = embeddedFontBase64Cache.get(relativePath);
  if (cached) return cached;

  // This file runs from lib/index.js in production. We copy src/front -> lib/front in the build script.
  const abs = path.resolve(THIS_FILE_DIR, relativePath);
  const buf = fs.readFileSync(abs);
  const b64 = buf.toString('base64');
  embeddedFontBase64Cache.set(relativePath, b64);
  return b64;
}

function buildEmbeddedFontStyleTag(fontFamiliesInUse: Set<string>): string {
  const faces = EMBEDDED_FONTS.filter((f) => fontFamiliesInUse.has(f.family));
  if (faces.length === 0) return '';

  const css = faces
    .map((f) => {
      const b64 = readFontBase64(f.relativePath);
      return (
        `@font-face{font-family:'${f.family}';src:url('data:${f.mime};base64,${b64}') format('${f.format}');font-weight:${f.weight};font-style:${f.style};}`
      );
    })
    .join('');

  return `<style>${css}</style>`;
}

function formatIssueDate(value: admin.firestore.Timestamp | Date | string | undefined | null): string {
  if (!value) return '';
  const d = value instanceof Date ? value : value instanceof admin.firestore.Timestamp ? value.toDate() : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  // English date
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' });
}

function parseDateOnlyToDate(value: string): Date | null {
  // Expected: YYYY-MM-DD (from <input type="date">)
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveFieldValue(key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate', ctx: {
  internName: string;
  internPosition: string;
  internDepartment: string;
  internPeriod: string;
  systemId: string;
  issuedAt: unknown;
}): string {
  switch (key) {
    case 'internName':
      return ctx.internName;
    case 'position':
      return ctx.internPosition;
    case 'department':
      return ctx.internDepartment;
    case 'internPeriod':
      return ctx.internPeriod;
    case 'systemId':
      return ctx.systemId;
    case 'issueDate':
      return formatIssueDate(ctx.issuedAt as any);
    default:
      return '';
  }
}

function buildSvgFromLayout(
  layout: NonNullable<CertificateTemplateDoc['layout']>,
  target: { width: number; height: number },
  ctx: {
    type: CertificateRequestType;
    internName: string;
    internPosition: string;
    internDepartment: string;
    internPeriod: string;
    systemId: string;
    issuedAt: unknown;
  },
): string {
  const srcW = layout.canvas?.width ?? target.width;
  const srcH = layout.canvas?.height ?? target.height;
  const sx = srcW ? target.width / srcW : 1;
  const sy = srcH ? target.height / srcH : 1;
  const sf = (sx + sy) / 2;

  const fontFamiliesInUse = new Set<string>();
  for (const b of layout.blocks) {
    const ff = (b as any)?.fontFamily;
    if (typeof ff === 'string' && ff.trim()) fontFamiliesInUse.add(ff.trim());
  }
  const embeddedFontsStyle = buildEmbeddedFontStyleTag(fontFamiliesInUse);

  const textNodes = layout.blocks
    .filter((b) => b && b.kind === 'text')
    .map((b) => {
      const raw =
        b.source.type === 'static'
          ? b.source.text
          : resolveFieldValue(b.source.key, {
              internName: ctx.internName,
              internPosition: ctx.internPosition,
              internDepartment: ctx.internDepartment,
              internPeriod: ctx.internPeriod,
              systemId: ctx.systemId,
              issuedAt: ctx.issuedAt,
            });

      const x = Math.round((b.x ?? 0) * sx);
      const yTop = Math.round((b.y ?? 0) * sy);
      const fontSize = Math.max(6, Math.round((b.fontSize ?? 24) * sf));
      const fontWeight = b.fontWeight ?? 600;
      const fill = b.color ?? '#111827';
      const opacity = b.opacity ?? 1;
      const rotation = Number((b as any)?.rotation ?? 0) || 0;
      const fontFamily = typeof (b as any).fontFamily === 'string' && String((b as any).fontFamily).trim()
        ? String((b as any).fontFamily).trim()
        : 'Arial';

      // Konva uses y as the top of the text box, while SVG uses y as baseline.
      // sharp's SVG renderer may ignore dominant-baseline, so we convert explicitly.
      const y = yTop + fontSize;

      const anchor = 'start';
      const lines = String(raw ?? '').split('\n');
      const lineHeight = Math.round(fontSize * 1.2);

      const tspans = lines
        .map((line, idx) => {
          const dy = idx === 0 ? 0 : lineHeight;
          return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
        })
        .join('');

      const text = `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${escapeXml(fill)}" opacity="${opacity}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}, sans-serif" font-weight="${fontWeight}">${tspans}</text>`;

      // Konva rotates around the node origin (top-left). We rotate around (x, yTop).
      if (rotation) {
        return `<g transform="rotate(${rotation} ${x} ${yTop})">${text}</g>`;
      }
      return text;
    })
    .join('\n');

  return `<svg width="${target.width}" height="${target.height}" xmlns="http://www.w3.org/2000/svg">\n${embeddedFontsStyle}${textNodes}\n</svg>`;
}

function resolveStoragePathFromTemplate(tpl: CertificateTemplateDoc): string {
  if (tpl.backgroundPath && typeof tpl.backgroundPath === 'string') {
    return tpl.backgroundPath;
  }

  throw new HttpsError('failed-precondition', 'Template has no backgroundPath');
}

async function buildTransformedBackgroundPng(
  backgroundInput: Buffer,
  target: { width: number; height: number },
  bg: { cx: number; cy: number; scale: number; rotation: number } | null,
): Promise<Buffer> {
  const width = target.width;
  const height = target.height;

  const basePng = await sharp(backgroundInput)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  const t = bg ?? { cx: width / 2, cy: height / 2, scale: 1, rotation: 0 };
  const cx = Number(t.cx) || width / 2;
  const cy = Number(t.cy) || height / 2;
  const scale = Math.max(0.05, Number(t.scale) || 1);
  const rotation = Number(t.rotation) || 0;

  if (scale === 1 && rotation === 0 && cx === width / 2 && cy === height / 2) {
    return basePng;
  }

  const b64 = basePng.toString('base64');
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="transparent"/>
  <image href="data:image/png;base64,${b64}" width="${width}" height="${height}" transform="translate(${cx} ${cy}) rotate(${rotation}) scale(${scale}) translate(${-width / 2} ${-height / 2})"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function placeholderValueForField(
  key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate',
): string {
  switch (key) {
    case 'internName':
      return '{{internName}}';
    case 'position':
      return '{{position}}';
    case 'department':
      return '{{department}}';
    case 'internPeriod':
      return '{{internPeriod}}';
    case 'systemId':
      return '{{systemId}}';
    case 'issueDate':
      return '{{issueDate}}';
    default:
      return '';
  }
}

export const generateTemplatePreview = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');
    const tpl = tplSnap.data() as CertificateTemplateDoc;

    const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);

    if (!tpl.layout || !Array.isArray(tpl.layout.blocks)) {
      throw new HttpsError('failed-precondition', 'Template has no layout');
    }

    let bgBuffer: Buffer;
    try {
      [bgBuffer] = await bucket.file(backgroundStoragePath).download();
    } catch (err: unknown) {
      console.error('generateTemplatePreview:downloadBackgroundFailed', { templateId, backgroundStoragePath, err });
      throw new HttpsError('failed-precondition', `Unable to download background image at path: ${backgroundStoragePath}`);
    }

    const bgSharp = sharp(bgBuffer);
    let meta;
    try {
      meta = await bgSharp.metadata();
    } catch (err: unknown) {
      console.error('generateTemplatePreview:backgroundMetadataFailed', { templateId, backgroundStoragePath, err });
      throw new HttpsError('failed-precondition', 'Background file is not a supported image (expected png/jpg).');
    }

    const width = tpl.layout.canvas?.width ?? meta.width ?? 2480;
    const height = tpl.layout.canvas?.height ?? meta.height ?? 3508;

    const transformedBgPng = await buildTransformedBackgroundPng(bgBuffer, { width, height }, (tpl.layout as any)?.background ?? null);
    const bg = sharp(transformedBgPng);

    // Note: buildSvgFromLayout already resolves field values; we want placeholders instead.
    // So we re-map blocks on the fly by injecting placeholders via a cloned layout.
    const layoutWithPlaceholders = {
      ...tpl.layout,
      blocks: tpl.layout.blocks.map((b) => {
        if (!b || b.kind !== 'text') return b;
        if (b.source.type === 'field') {
          return {
            ...b,
            source: { type: 'static', text: placeholderValueForField(b.source.key) },
          };
        }
        return b;
      }),
    } as NonNullable<CertificateTemplateDoc['layout']>;

    const svgWithPlaceholders = buildSvgFromLayout(
      layoutWithPlaceholders,
      { width, height },
      {
        type: tpl.type ?? 'COMPLETION',
        internName: '',
        internPosition: '',
        internDepartment: '',
        internPeriod: '',
        systemId: '',
        issuedAt: null,
      },
    );

    const previewPng = await bg
      .composite([
        {
          input: Buffer.from(svgWithPlaceholders),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const previewPath = `templates/previews/${templateId}/${Date.now()}_preview.png`;
    await bucket.file(previewPath).save(previewPng, {
      contentType: 'image/png',
      resumable: false,
      metadata: {
        cacheControl: 'no-store, max-age=0',
      },
    });

    await tplRef.update({
      previewPath,
      previewUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    } as any);

    return { ok: true, previewPath };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    console.error('generateTemplatePreview:internalError', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const generateCertificate = onCall({ cors: true }, async (request) => {
  try {
    const caller = await assertHrAdminOrSupervisor(request);

    const requestId = String((request.data as any)?.requestId ?? '');
    const templateId = String((request.data as any)?.templateId ?? '');
    const overridesRaw = ((request.data as any)?.overrides ?? null) as
      | {
          internName?: unknown;
          internPosition?: unknown;
          internDepartment?: unknown;
          internPeriod?: unknown;
          systemId?: unknown;
          issueDate?: unknown;
        }
      | null;

    if (!requestId) throw new HttpsError('invalid-argument', 'Missing requestId');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    console.log('generateCertificate:start', {
      requestId,
      templateId,
      callerUid: request.auth?.uid,
    });

    const reqRef = db.collection('certificateRequests').doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new HttpsError('not-found', 'certificateRequests doc not found');

    const req = reqSnap.data() as CertificateRequestDoc;
    if (!req.internId) throw new HttpsError('failed-precondition', 'Request has no internId');

    const overrides = overridesRaw
      ? {
          internName: typeof overridesRaw.internName === 'string' ? overridesRaw.internName : undefined,
          internPosition: typeof overridesRaw.internPosition === 'string' ? overridesRaw.internPosition : undefined,
          internDepartment: typeof overridesRaw.internDepartment === 'string' ? overridesRaw.internDepartment : undefined,
          internPeriod: typeof overridesRaw.internPeriod === 'string' ? overridesRaw.internPeriod : undefined,
          systemId: typeof overridesRaw.systemId === 'string' ? overridesRaw.systemId : undefined,
          issueDate: typeof overridesRaw.issueDate === 'string' ? overridesRaw.issueDate : undefined,
        }
      : null;

    if (caller.roles.includes('SUPERVISOR') && !caller.roles.includes('HR_ADMIN')) {
      if (req.supervisorId !== caller.uid) {
        throw new HttpsError('permission-denied', 'Supervisor can only generate certificates for assigned requests.');
      }
    }

    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');
    const tpl = tplSnap.data() as CertificateTemplateDoc;

    const backgroundStoragePath = resolveStoragePathFromTemplate(tpl);

    console.log('generateCertificate:resolvedTemplate', {
      requestId,
      templateId,
      type: req.type,
      backgroundStoragePath,
    });

    // Fetch intern profile (authoritative source)
    const userSnap = await db.collection('users').doc(req.internId).get();
    const user = (userSnap.exists ? (userSnap.data() as UserDoc) : {}) as UserDoc;

    const internName =
      (overrides?.internName ?? '').trim() || (req.overrideInternName ?? '').trim() || (req.snapshotInternName ?? '').trim() || user.name || req.internName || 'Intern';
    const internPosition =
      (overrides?.internPosition ?? '').trim() || (req.overrideInternPosition ?? '').trim() || (req.snapshotInternPosition ?? '').trim() || user.position || req.internPosition || '';
    const internDepartment =
      (overrides?.internDepartment ?? '').trim() || (req.overrideInternDepartment ?? '').trim() || (req.snapshotInternDepartment ?? '').trim() || user.department || req.internDepartment || '';
    const internPeriod =
      (overrides?.internPeriod ?? '').trim() || (req.overrideInternPeriod ?? '').trim() || (req.snapshotInternPeriod ?? '').trim() || user.internPeriod || '';
    const systemId =
      (overrides?.systemId ?? '').trim() || (req.overrideSystemId ?? '').trim() || (req.snapshotSystemId ?? '').trim() || user.systemId || '';

    const overrideIssueDateTs = overrides?.issueDate ? parseDateOnlyToDate(overrides.issueDate) : null;
    const issueDateTs =
      (overrideIssueDateTs ? admin.firestore.Timestamp.fromDate(overrideIssueDateTs) : null) ??
      req.overrideIssueDateTs ??
      req.snapshotIssueDateTs ??
      null;

    const legacyIssueDate = (req.overrideIssueDate ?? '').trim();
    const issueDateForRender = issueDateTs ?? (legacyIssueDate ? legacyIssueDate : null);

    // Download background image
    let bgBuffer: Buffer;
    try {
      [bgBuffer] = await bucket.file(backgroundStoragePath).download();
    } catch (err: unknown) {
      console.error('generateCertificate:downloadBackgroundFailed', { requestId, templateId, backgroundStoragePath, err });
      throw new HttpsError(
        'failed-precondition',
        `Unable to download background image at path: ${backgroundStoragePath}. Please verify the Storage file exists and the path is correct.`,
      );
    }

    const bgSharp = sharp(bgBuffer);
    let meta;
    try {
      meta = await bgSharp.metadata();
    } catch (err: unknown) {
      console.error('generateCertificate:backgroundMetadataFailed', { requestId, templateId, backgroundStoragePath, err });
      throw new HttpsError(
        'failed-precondition',
        'Background file is not a supported image (expected png/jpg). Please upload a valid image.',
      );
    }

    const width = meta.width ?? 2480;
    const height = meta.height ?? 3508;

    const hasCustomLayout = Array.isArray(tpl.layout?.blocks) && tpl.layout!.blocks.length > 0;

    // Fixed layout (Phase 1): simple centered text
    // Note: Thai font rendering depends on available fonts in the runtime.
    const fixedSvg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .title { font-size: ${Math.round(width * 0.04)}px; font-family: Arial, sans-serif; font-weight: 700; fill: #111827; }
    .name { font-size: ${Math.round(width * 0.055)}px; font-family: Arial, sans-serif; font-weight: 800; fill: #111827; }
    .meta { font-size: ${Math.round(width * 0.022)}px; font-family: Arial, sans-serif; font-weight: 600; fill: #334155; }
  </style>
  <text x="50%" y="${Math.round(height * 0.30)}" text-anchor="middle" class="title">${escapeXml(
    req.type === 'COMPLETION' ? 'Certificate of Completion' : 'Recommendation Letter',
  )}</text>

  <text x="50%" y="${Math.round(height * 0.45)}" text-anchor="middle" class="name">${escapeXml(internName)}</text>

  <text x="50%" y="${Math.round(height * 0.60)}" text-anchor="middle" class="meta">${escapeXml(internPeriod)}</text>

  <text x="50%" y="${Math.round(height * 0.92)}" text-anchor="middle" class="meta">${escapeXml(systemId)}</text>
</svg>`;

    const svg = hasCustomLayout
      ? buildSvgFromLayout(
          tpl.layout!,
          { width, height },
          {
            type: req.type,
            internName,
            internPosition,
            internDepartment,
            internPeriod,
            systemId,
            issuedAt: issueDateForRender ?? req.issuedAt ?? new Date(),
          },
        )
      : fixedSvg;

    const transformedBgPng = await buildTransformedBackgroundPng(bgBuffer, { width, height }, (tpl.layout as any)?.background ?? null);
    const issuedPng = await sharp(transformedBgPng)
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    // Create PDF by embedding the PNG as full page
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(issuedPng);

    // Use pixel size as PDF points for phase 1 (works for download/printing; can refine later)
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pngImage, { x: 0, y: 0, width, height });

    const pdfBytes = await pdfDoc.save();

    const issuedPngPath = `certificates/${req.internId}/${requestId}/certificate.png`;
    const issuedPdfPath = `certificates/${req.internId}/${requestId}/certificate.pdf`;

    await Promise.all([
      bucket.file(issuedPngPath).save(issuedPng, {
        contentType: 'image/png',
        resumable: false,
        metadata: { cacheControl: 'no-store, max-age=0' },
      }),
      bucket.file(issuedPdfPath).save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        resumable: false,
        metadata: { cacheControl: 'no-store, max-age=0' },
      }),
    ]);

    await reqRef.update({
      status: 'ISSUED',
      templateId,
      ...(overrides
        ? {
            overrideInternName: overrides.internName ?? null,
            overrideInternPosition: overrides.internPosition ?? null,
            overrideInternDepartment: overrides.internDepartment ?? null,
            overrideInternPeriod: overrides.internPeriod ?? null,
            overrideSystemId: overrides.systemId ?? null,
            overrideIssueDate: overrides.issueDate ?? null,
            ...(overrideIssueDateTs ? { overrideIssueDateTs: admin.firestore.Timestamp.fromDate(overrideIssueDateTs) } : { overrideIssueDateTs: null }),
            editedAt: admin.firestore.FieldValue.serverTimestamp(),
            editedById: caller.uid,
          }
        : {}),
      snapshotInternName: internName,
      snapshotInternPosition: internPosition,
      snapshotInternDepartment: internDepartment,
      snapshotInternPeriod: internPeriod,
      snapshotSystemId: systemId,
      snapshotIssueDateTs: issueDateTs,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      issuedById: caller.uid,
      issuedByName: (request.auth!.token as any)?.name ?? (caller.roles.includes('HR_ADMIN') ? 'Admin' : 'Supervisor'),
      issuedByRole: caller.roles.includes('HR_ADMIN') ? 'HR_ADMIN' : 'SUPERVISOR',
      issuedPngPath,
      issuedPdfPath,
    } satisfies Partial<CertificateRequestDoc>);

    console.log('generateCertificate:done', { requestId, issuedPngPath, issuedPdfPath });

    return {
      ok: true,
      issuedPngPath,
      issuedPdfPath,
    };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    console.error('generateCertificate:internalError', err);
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const deleteCertificateTemplate = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();

    if (!tplSnap.exists) {
      return { ok: true, skipped: true };
    }

    const tpl = tplSnap.data() as CertificateTemplateDoc;
    const path = tpl.backgroundPath;
    if (path) {
      try {
        await bucket.file(path).delete();
      } catch (err: unknown) {
        const e = err as { code?: number | string; message?: string };
        if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
          // ignore
        } else {
          console.error('deleteCertificateTemplate:deleteBackgroundFailed', { templateId, path, err });
          throw new HttpsError('internal', e?.message ?? 'Failed to delete background');
        }
      }
    }

    await tplRef.delete();
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

export const deleteTemplateBackground = onCall({ cors: true }, async (request) => {
  try {
    assertAdmin(request);

    const templateId = String((request.data as any)?.templateId ?? '');
    if (!templateId) throw new HttpsError('invalid-argument', 'Missing templateId');

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    const tplRef = db.collection('certificateTemplates').doc(templateId);
    const tplSnap = await tplRef.get();
    if (!tplSnap.exists) throw new HttpsError('not-found', 'certificateTemplates doc not found');

    const tpl = tplSnap.data() as CertificateTemplateDoc;
    const path = tpl.backgroundPath;
    if (!path) {
      // Idempotent: background already removed.
      await tplRef.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth?.uid ?? null,
      });
      return { ok: true, skipped: true };
    }

    try {
      await bucket.file(path).delete();
    } catch (err: unknown) {
      const e = err as { code?: number | string; message?: string };
      // Ignore not-found; still clear Firestore so UI does not keep pointing to a missing file.
      if (String(e?.code ?? '').includes('404') || String(e?.message ?? '').toLowerCase().includes('not found')) {
        // noop
      } else {
        console.error('deleteTemplateBackground:deleteFailed', { templateId, path, err });
        throw new HttpsError('internal', e?.message ?? 'Failed to delete background');
      }
    }

    await tplRef.update({
      backgroundPath: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth?.uid ?? null,
    });

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', err instanceof Error ? err.message : 'Unknown error');
  }
});

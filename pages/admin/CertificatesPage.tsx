
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, ChevronLeft, ChevronRight, Clock, CreditCard, Download, FileText, Settings2, Upload, Users, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, serverTimestamp, updateDoc, doc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { Language } from '@/types';
import { firestoreDb, firebaseFunctions, firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';
import { normalizeAvatarUrl } from '@/app/avatar';
import CertificateTemplatesManager from './components/CertificateTemplatesManager';

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
  overrideIssueDateTs?: unknown;
  snapshotInternName?: string | null;
  snapshotInternPosition?: string | null;
  snapshotInternDepartment?: string | null;
  snapshotInternPeriod?: string | null;
  snapshotSystemId?: string | null;
  snapshotIssueDateTs?: unknown;
  supervisorId: string | null;
  type: CertificateRequestType;
  status: CertificateRequestStatus;
  requestedAt?: unknown;
  issuedAt?: unknown;
  unlockedAt?: unknown;
  unlockedById?: string | null;
  unlockedByName?: string | null;
  unlockedByRole?: 'SUPERVISOR' | 'HR_ADMIN' | null;
  issuedById?: string;
  issuedByName?: string;
  issuedByRole?: 'SUPERVISOR' | 'HR_ADMIN';
  fileName?: string;
  storagePath?: string;
  attachmentLinks?: string[];
  templateId?: string;
  issuedPngPath?: string;
  issuedPdfPath?: string;
};

type CertificateTemplateDoc = {
  name?: string;
  type?: CertificateRequestType;
  backgroundPath?: string;
  backgroundUrl?: string;
  active?: boolean;
  isActive?: boolean;
  layout?: {
    blocks?: Array<{
      kind?: 'text' | string;
      source?:
        | { type: 'static'; text: string }
        | {
            type: 'field';
            key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate';
          };
    }>;
  };
};

interface AdminCertificatesPageProps {
  lang: Language;
}

const AdminCertificatesPage: React.FC<AdminCertificatesPageProps> = ({ lang }) => {
  const { t: i18t } = useTranslation();
  const tr = (key: string, options?: any) => String(i18t(key, options));
  const { user } = useAppContext();
  const navigate = useNavigate();

  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Certificates',
          subtitle: 'Review and issue internship certificates for all interns.',
          empty: 'No certificate requests yet',
          requested: 'Requested',
          issued: 'Issued',
          upload: 'Upload Signed PDF',
          download: 'Download',
          uploading: 'Uploading...',
        },
        TH: {
          title: 'ใบรับรอง',
          subtitle: 'ตรวจสอบและออกใบรับรองสำหรับนักศึกษาทั้งหมด',
          empty: 'ยังไม่มีคำขอใบรับรอง',
          requested: 'ส่งคำขอแล้ว',
          issued: 'ออกเอกสารแล้ว',
          upload: 'อัปโหลด PDF ที่เซ็นแล้ว',
          download: 'ดาวน์โหลด',
          uploading: 'กำลังอัปโหลด...',
        },
      }[lang]),
    [lang],
  );

  const [requests, setRequests] = useState<Array<CertificateRequestDoc & { id: string }>>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeInternId, setActiveInternId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ requestId: string } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ requestId: string } | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<CertificateTemplateDoc & { id: string }>>([]);
  const [selectedTemplateByType, setSelectedTemplateByType] = useState<Record<CertificateRequestType, string>>({
    COMPLETION: '',
    RECOMMENDATION: '',
  });
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<(CertificateRequestDoc & { id: string }) | null>(null);
  const [editTemplateId, setEditTemplateId] = useState('');
  const [editInternName, setEditInternName] = useState('');
  const [editInternPosition, setEditInternPosition] = useState('');
  const [editInternDepartment, setEditInternDepartment] = useState('');
  const [editInternPeriod, setEditInternPeriod] = useState('');
  const [editSystemId, setEditSystemId] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingCancelRequest, setPendingCancelRequest] = useState<(CertificateRequestDoc & { id: string }) | null>(null);
  const [mode, setMode] = useState<'requests' | 'templates'>('requests');
  const [internsPage, setInternsPage] = useState(1);
  const INTERNS_PAGE_SIZE = 5;

  const toDateInputValue = (value: unknown): string => {
    const anyVal = value as { toDate?: () => Date };
    const d = anyVal && typeof anyVal.toDate === 'function' ? anyVal.toDate() : value instanceof Date ? value : null;
    if (!d) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setLoadError(null);
    const q = query(collection(firestoreDb, 'certificateRequests'));

    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() as CertificateRequestDoc;
          return { id: d.id, ...data };
        });

        items.sort((a, b) => {
          const ax = (a.requestedAt ?? '') as unknown as { toMillis?: () => number };
          const bx = (b.requestedAt ?? '') as unknown as { toMillis?: () => number };
          const am = typeof ax?.toMillis === 'function' ? ax.toMillis() : 0;
          const bm = typeof bx?.toMillis === 'function' ? bx.toMillis() : 0;
          return bm - am;
        });

        setRequests(items);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load requests'}`);
      },
    );
  }, []);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'certificateTemplates'));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CertificateTemplateDoc) }));
        setTemplates(items);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load templates'}`);
      },
    );
  }, []);

  const openUpload = (requestId: string) => {
    setPendingUpload({ requestId });
    fileInputRef.current?.click();
  };

  const openAttachLink = (requestId: string) => {
    setPendingLink({ requestId });
    const req = requests.find((r) => r.id === requestId);
    const existing = Array.isArray((req as any)?.attachmentLinks) ? String((req as any).attachmentLinks[0] ?? '') : '';
    setLinkDraft(existing);
  };

  const handleFileSelected = async (file: File | null) => {
    if (!pendingUpload || !file) return;

    const { requestId } = pendingUpload;
    setPendingUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    setUploadingId(requestId);
    setUploadError(null);
    try {
      const storagePath = `certificates/${req.internId}/${requestId}/${Date.now()}_${file.name}`;
      await uploadBytes(storageRef(firebaseStorage, storagePath), file);

      await updateDoc(doc(firestoreDb, 'certificateRequests', requestId), {
        status: 'ISSUED',
        fileName: file.name,
        storagePath,
        issuedAt: serverTimestamp(),
        issuedById: user?.id ?? null,
        issuedByName: user?.name ?? 'Admin',
        issuedByRole: 'HR_ADMIN',
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveLink = async () => {
    if (!pendingLink) return;
    const requestId = pendingLink.requestId;
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    const url = linkDraft.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      setUploadError(
        lang === 'TH'
          ? 'กรุณากรอกลิ้งค์ที่ขึ้นต้นด้วย http:// หรือ https://'
          : 'Please enter a link that starts with http:// or https://',
      );
      return;
    }

    setSavingLinkId(requestId);
    setUploadError(null);
    try {
      await updateDoc(doc(firestoreDb, 'certificateRequests', requestId), {
        status: 'ISSUED',
        attachmentLinks: [url],
        issuedAt: serverTimestamp(),
        issuedById: user?.id ?? null,
        issuedByName: user?.name ?? 'Admin',
        issuedByRole: 'HR_ADMIN',
      });
      setPendingLink(null);
      setLinkDraft('');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Save link failed'}`);
    } finally {
      setSavingLinkId(null);
    }
  };

  const handleDownload = async (req: CertificateRequestDoc & { id: string }) => {
    const path = req.issuedPdfPath ?? req.storagePath;
    if (path) {
      const url = await getDownloadURL(storageRef(firebaseStorage, path));
      window.open(url, '_blank');
      return;
    }
    const link = Array.isArray(req.attachmentLinks) ? String(req.attachmentLinks[0] ?? '') : '';
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleGenerate = async (req: CertificateRequestDoc & { id: string }) => {
    if (generatingId) return;
    const templateId = selectedTemplateByType[req.type];
    if (!templateId) {
      setUploadError(lang === 'TH' ? 'กรุณาเลือก Template ก่อน' : 'Please select a template first.');
      return;
    }

    setGeneratingId(req.id);
    setUploadError(null);
    try {
      const fn = httpsCallable(firebaseFunctions, 'generateCertificate');
      await fn({ requestId: req.id, templateId });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Generate failed'}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCancelIssued = async (req: CertificateRequestDoc & { id: string }) => {
    if (cancelingId) return;
    if (req.type !== 'COMPLETION') return;
    if (req.status !== 'ISSUED') return;
    setPendingCancelRequest(req);
  };

  const confirmCancelIssued = async () => {
    const req = pendingCancelRequest;
    if (!req) return;
    if (cancelingId) return;

    setCancelingId(req.id);
    setUploadError(null);
    try {
      await updateDoc(doc(firestoreDb, 'certificateRequests', req.id), {
        status: 'REQUESTED',
        unlockedAt: serverTimestamp(),
        unlockedById: user?.id ?? null,
        unlockedByName: user?.name ?? 'Admin',
        unlockedByRole: 'HR_ADMIN',
      } as any);
      setPendingCancelRequest(null);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Cancel failed'}`);
    } finally {
      setCancelingId(null);
    }
  };

  const openEdit = (req: CertificateRequestDoc & { id: string }) => {
    setUploadError(null);
    setEditError(null);
    setEditingRequest(req);
    const currentTemplateId = (selectedTemplateByType[req.type] ?? '').trim() || String(req.templateId ?? '').trim();
    setEditTemplateId(currentTemplateId);
    setEditInternName(String(req.overrideInternName ?? req.snapshotInternName ?? req.internName ?? ''));
    setEditInternPosition(String(req.overrideInternPosition ?? req.snapshotInternPosition ?? req.internPosition ?? ''));
    setEditInternDepartment(String(req.overrideInternDepartment ?? req.snapshotInternDepartment ?? req.internDepartment ?? ''));
    setEditInternPeriod(String(req.overrideInternPeriod ?? req.snapshotInternPeriod ?? ''));
    setEditSystemId(String(req.overrideSystemId ?? req.snapshotSystemId ?? ''));

    const dateValue =
      toDateInputValue(req.overrideIssueDateTs) ||
      toDateInputValue(req.snapshotIssueDateTs) ||
      toDateInputValue(req.issuedAt) ||
      '';
    setEditIssueDate(dateValue);
  };

  const closeEdit = () => {
    setEditingRequest(null);
    setEditTemplateId('');
    setEditInternName('');
    setEditInternPosition('');
    setEditInternDepartment('');
    setEditInternPeriod('');
    setEditSystemId('');
    setEditIssueDate('');
    setIsEditSaving(false);
    setEditError(null);
  };

  const handleEditRegenerate = async () => {
    if (!editingRequest) return;
    if (isEditSaving) return;
    const templateId = editTemplateId.trim();
    if (!templateId) {
      setEditError(lang === 'TH' ? 'กรุณาเลือก Template ก่อน' : 'Please select a template first.');
      return;
    }

    setIsEditSaving(true);
    setEditError(null);
    try {
      const fn = httpsCallable(firebaseFunctions, 'generateCertificate');

      const overrides: Record<string, string> = {};
      if (shouldShowEditField('internName')) overrides.internName = editInternName.trim();
      if (shouldShowEditField('position')) overrides.internPosition = editInternPosition.trim();
      if (shouldShowEditField('department')) overrides.internDepartment = editInternDepartment.trim();
      if (shouldShowEditField('internPeriod')) overrides.internPeriod = editInternPeriod.trim();
      if (shouldShowEditField('systemId')) overrides.systemId = editSystemId.trim();
      if (shouldShowEditField('issueDate')) overrides.issueDate = editIssueDate.trim();

      await fn({
        requestId: editingRequest.id,
        templateId,
        overrides,
      });

      setSelectedTemplateByType((prev) => ({ ...prev, [editingRequest.type]: templateId }));
      closeEdit();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setEditError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Generate failed'}`);
    } finally {
      setIsEditSaving(false);
    }
  };

  const interns = useMemo(() => {
    const byIntern: Record<
      string,
      {
        internId: string;
        internName: string;
        internAvatar: string;
        internPosition?: string;
        internDepartment?: string;
        requests: Array<CertificateRequestDoc & { id: string }>;
      }
    > = {};

    for (const r of requests) {
      const safeInternId = r.internId || 'unknown';
      if (!byIntern[safeInternId]) {
        byIntern[safeInternId] = {
          internId: safeInternId,
          internName: r.internName || 'Unknown',
          internAvatar: normalizeAvatarUrl(r.internAvatar),
          internPosition: r.internPosition,
          internDepartment: r.internDepartment,
          requests: [],
        };
      }
      byIntern[safeInternId]!.requests.push(r);
    }

    const arr = Object.values(byIntern);
    arr.sort((a, b) => (a.internName || '').localeCompare(b.internName || ''));
    return arr;
  }, [requests]);

  const internsPageCount = useMemo(() => {
    const count = Math.ceil(interns.length / INTERNS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [interns.length, INTERNS_PAGE_SIZE]);

  const pagedInterns = useMemo(() => {
    const start = (internsPage - 1) * INTERNS_PAGE_SIZE;
    return interns.slice(start, start + INTERNS_PAGE_SIZE);
  }, [interns, internsPage, INTERNS_PAGE_SIZE]);

  useEffect(() => {
    setInternsPage(1);
  }, [interns.length]);

  const activeIntern = useMemo(() => {
    if (!activeInternId) return null;
    return interns.find((x) => x.internId === activeInternId) ?? null;
  }, [activeInternId, interns]);

  const requestByType = useMemo(() => {
    if (!activeIntern) return new Map<CertificateRequestType, (CertificateRequestDoc & { id: string })>();
    const map = new Map<CertificateRequestType, (CertificateRequestDoc & { id: string })>();

    const toMillis = (value: unknown): number => {
      const anyVal = value as { toMillis?: () => number; toDate?: () => Date };
      if (anyVal && typeof anyVal.toMillis === 'function') {
        const ms = anyVal.toMillis();
        return Number.isFinite(ms) ? ms : 0;
      }
      if (anyVal && typeof anyVal.toDate === 'function') {
        const d = anyVal.toDate();
        const ms = d?.getTime?.() ?? 0;
        return Number.isFinite(ms) ? ms : 0;
      }
      const d = new Date(String(value ?? ''));
      const ms = d.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    const score = (r: CertificateRequestDoc & { id: string }): number => {
      const statusWeight = r.status === 'ISSUED' ? 1_000_000_000_000_000 : 0;
      const issued = toMillis(r.issuedAt);
      const requested = toMillis(r.requestedAt);
      const ts = r.status === 'ISSUED' ? (issued || requested) : requested;
      return statusWeight + ts;
    };

    for (const r of activeIntern.requests) {
      const prev = map.get(r.type);
      if (!prev || score(r) > score(prev)) {
        map.set(r.type, r);
      }
    }
    return map;
  }, [activeIntern]);

  const requestStats = useMemo(() => {
    const requested = requests.filter((r) => r.status === 'REQUESTED').length;
    const issued = requests.filter((r) => r.status === 'ISSUED').length;
    return { requested, issued, total: requests.length };
  }, [requests]);

  const templatesByType = useMemo(() => {
    const byType: Record<CertificateRequestType, Array<CertificateTemplateDoc & { id: string }>> = {
      COMPLETION: [],
      RECOMMENDATION: [],
    };
    for (const tpl of templates) {
      const isDraft = (tpl as any)?.isDraft === true;
      if (isDraft) continue;
      const isTplActive = tpl.active ?? tpl.isActive ?? true;
      if (!isTplActive) continue;

      if (tpl.type === 'COMPLETION') {
        byType.COMPLETION.push(tpl);
        continue;
      }

      if (tpl.type === 'RECOMMENDATION') {
        byType.RECOMMENDATION.push(tpl);
        continue;
      }

      // If template has no type field (legacy / console-created), show it in both dropdowns.
      byType.COMPLETION.push(tpl);
      byType.RECOMMENDATION.push(tpl);
    }
    return byType;
  }, [templates]);

  const editTemplate = useMemo(() => {
    const id = editTemplateId.trim();
    if (!id) return null;
    return templates.find((t) => t.id === id) ?? null;
  }, [editTemplateId, templates]);

  const editTemplateFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    const blocks = editTemplate?.layout?.blocks;
    if (!Array.isArray(blocks)) return keys;
    for (const b of blocks) {
      if (!b || b.kind !== 'text') continue;
      const src = b.source as any;
      if (src && src.type === 'field' && typeof src.key === 'string') {
        keys.add(src.key);
      }
    }
    return keys;
  }, [editTemplate]);

  const editHasLayout = Boolean(editTemplate?.layout && Array.isArray(editTemplate?.layout?.blocks));

  const shouldShowEditField = (key: 'internName' | 'position' | 'department' | 'internPeriod' | 'systemId' | 'issueDate') => {
    // If the template has a layout, only show fields that exist in it.
    // If no layout (fixedSvg), show all fields.
    if (!editHasLayout) return true;
    return editTemplateFieldKeys.has(key);
  };

  const TabBtn = ({
    active,
    onClick,
    icon,
    label,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
  }) => {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2 px-6 py-3 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
          active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
        }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
      />

      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {loadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {loadError}
          </div>
        ) : null}

        {uploadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {uploadError}
          </div>
        ) : null}

        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{t.title}</h1>
              <p className="text-slate-500 text-sm font-medium pt-2">{t.subtitle}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="px-4 py-2 rounded-2xl bg-white border border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-600">
                  {lang === 'TH' ? 'ทั้งหมด' : 'Total'}: {requestStats.total}
                </div>
                <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-100 text-[11px] font-black uppercase tracking-widest text-amber-700">
                  {lang === 'TH' ? 'รอดำเนินการ' : 'Requested'}: {requestStats.requested}
                </div>
                <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 text-[11px] font-black uppercase tracking-widest text-emerald-700">
                  {lang === 'TH' ? 'ออกแล้ว' : 'Issued'}: {requestStats.issued}
                </div>
              </div>
            </div>

            <div className="flex bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm overflow-x-auto scrollbar-hide">
              <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=roster')} icon={<Users size={16} />} label={tr('admin_dashboard.tab_roster')} />
              <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=attendance')} icon={<Clock size={16} />} label={tr('admin_dashboard.tab_attendance')} />
              <TabBtn active={false} onClick={() => navigate('/admin/leave')} icon={<UserX size={16} />} label={tr('admin_dashboard.tab_absences')} />
              <TabBtn active onClick={() => void 0} icon={<Award size={16} />} label={tr('admin_dashboard.tab_certs')} />
              <TabBtn active={false} onClick={() => navigate('/admin/dashboard?tab=allowances')} icon={<CreditCard size={16} />} label={tr('admin_dashboard.tab_payouts')} />
            </div>
          </div>

          <div className="mt-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-1 flex items-center gap-1 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setMode('requests')}
                className={`flex-1 lg:flex-none px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  mode === 'requests' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lang === 'TH' ? 'คำขอ' : 'Requests'}
              </button>
              <button
                type="button"
                onClick={() => setMode('templates')}
                className={`flex-1 lg:flex-none px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  mode === 'templates' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Settings2 size={16} />
                {lang === 'TH' ? 'เทมเพลต' : 'Templates'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {mode === 'templates' ? (
            <CertificateTemplatesManager lang={lang} onBack={() => setMode('requests')} initialView="create" />
          ) : interns.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t.empty}</p>
            </div>
          ) : activeIntern ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setActiveInternId(null)}
                className="inline-flex items-center gap-2 text-slate-600 text-sm font-bold hover:text-slate-900"
              >
                <ChevronLeft size={18} />
                {lang === 'TH' ? 'กลับไปที่รายชื่อ' : 'Back to list'}
              </button>

              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <img src={activeIntern.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                <div>
                  <p className="text-lg font-black text-slate-900">{activeIntern.internName}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {(activeIntern.internPosition ?? 'Intern') + ' • ' + (activeIntern.internDepartment ?? 'Unknown')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  {
                    type: 'COMPLETION' as const,
                    label: 'COMPLETION',
                    icon: <Award size={18} />,
                    iconClass: 'bg-amber-50 text-amber-700',
                  },
                  {
                    type: 'RECOMMENDATION' as const,
                    label: 'RECOMMENDATION',
                    icon: <FileText size={18} />,
                    iconClass: 'bg-indigo-50 text-indigo-700',
                  },
                ] as const).map((meta) => {
                  const req = requestByType.get(meta.type) ?? null;
                  const status = req?.status ?? null;

                  return (
                    <div key={meta.type} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.iconClass}`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate">{meta.label}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                              {req?.fileName ?? (Array.isArray(req?.attachmentLinks) ? req?.attachmentLinks?.[0] : '') ?? (lang === 'TH' ? 'ยังไม่มีคำขอ' : 'No request yet')}
                            </p>
                          </div>
                        </div>

                        {status === 'REQUESTED' ? (
                          <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                            {t.requested}
                          </div>
                        ) : status === 'ISSUED' ? (
                          <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                            {t.issued}
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 text-[10px] font-black uppercase tracking-widest">
                            {lang === 'TH' ? 'ไม่มีคำขอ' : 'NO REQUEST'}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-3">
                        {status === 'REQUESTED' && req ? (
                          <div className="flex items-center gap-3">
                            {meta.type === 'COMPLETION' ? (
                              <>
                                <select
                                  value={selectedTemplateByType[meta.type]}
                                  onChange={(e) =>
                                    setSelectedTemplateByType((prev) => ({
                                      ...prev,
                                      [meta.type]: e.target.value,
                                    }))
                                  }
                                  className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                                >
                                  <option value="">{lang === 'TH' ? 'เลือก Template' : 'Select template'}</option>
                                  {templatesByType[meta.type].map((tpl) => (
                                    <option key={tpl.id} value={tpl.id}>
                                      {tpl.name || tpl.id}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => void handleGenerate(req)}
                                  disabled={generatingId === req.id}
                                  className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                  {generatingId === req.id ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}
                                  {generatingId === req.id ? (lang === 'TH' ? 'กำลังสร้าง...' : 'Generating...') : (lang === 'TH' ? 'Generate' : 'Generate')}
                                </button>

                                {req.unlockedAt ? (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(req)}
                                    className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50"
                                  >
                                    {lang === 'TH' ? 'แก้ไข' : 'Edit'}
                                  </button>
                                ) : null}
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => openUpload(req.id)}
                              disabled={uploadingId === req.id}
                              className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                            >
                              {uploadingId === req.id ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}
                              {uploadingId === req.id ? t.uploading : t.upload}
                            </button>

                            {meta.type === 'RECOMMENDATION' || meta.type === 'COMPLETION' ? (
                              <button
                                type="button"
                                onClick={() => openAttachLink(req.id)}
                                disabled={savingLinkId === req.id}
                                className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                              >
                                Attach Link
                              </button>
                            ) : null}
                          </div>
                        ) : status === 'ISSUED' && req ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void handleDownload(req)}
                              disabled={!(req.issuedPdfPath ?? req.storagePath) && !(Array.isArray(req.attachmentLinks) && req.attachmentLinks.length > 0)}
                              className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                              title={t.download}
                            >
                              <Download size={18} />
                            </button>

                            {meta.type === 'COMPLETION' ? (
                              <button
                                type="button"
                                onClick={() => void handleCancelIssued(req)}
                                disabled={cancelingId === req.id}
                                className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                              >
                                {cancelingId === req.id ? <Clock size={16} className="animate-spin" /> : null}
                                {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {pendingLink?.requestId === req?.id && (meta.type === 'RECOMMENDATION' || meta.type === 'COMPLETION') && req ? (
                        <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                          <input
                            type="text"
                            value={linkDraft}
                            onChange={(e) => setLinkDraft(e.target.value)}
                            placeholder={lang === 'TH' ? 'วางลิ้งค์ (Drive/URL)' : 'Paste link (Drive/URL)'}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveLink()}
                            disabled={savingLinkId === req.id}
                            className="px-5 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingLinkId === req.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingLink(null);
                              setLinkDraft('');
                            }}
                            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pagedInterns.map((intern) => {
                const requestedCount = intern.requests.filter((r) => r.status === 'REQUESTED').length;
                const issuedCount = intern.requests.filter((r) => r.status === 'ISSUED').length;

                return (
                  <button
                    key={intern.internId}
                    type="button"
                    onClick={() => setActiveInternId(intern.internId)}
                    className="w-full bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-6 hover:border-blue-200 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <img src={intern.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-black text-slate-900 truncate">{intern.internName}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                          {(intern.internPosition ?? 'Intern') + ' • ' + (intern.internDepartment ?? 'Unknown')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {requestedCount > 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                          {requestedCount} {lang === 'TH' ? 'รอดำเนินการ' : 'pending'}
                        </div>
                      ) : null}
                      {issuedCount > 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                          {issuedCount} {lang === 'TH' ? 'ออกแล้ว' : 'issued'}
                        </div>
                      ) : null}
                      {requestedCount === 0 && issuedCount === 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 text-[10px] font-black uppercase tracking-widest">
                          {lang === 'TH' ? 'ไม่มีคำขอ' : 'NO REQUEST'}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {internsPageCount > 1 && (
                <div className="pt-6 flex justify-center">
                  <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInternsPage((p) => Math.max(1, p - 1))}
                      disabled={internsPage <= 1}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {Array.from({ length: internsPageCount }, (_, idx) => idx + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setInternsPage(p)}
                        className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                          p === internsPage
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                        }`}
                        aria-current={p === internsPage ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setInternsPage((p) => Math.min(internsPageCount, p + 1))}
                      disabled={internsPage >= internsPageCount}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                      aria-label="Next page"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {editingRequest ? (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
              <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'TH' ? 'แก้ไขใบรับรอง' : 'Edit Certificate'}
                    </div>
                    <div className="text-xl font-black text-slate-900 truncate">{editingRequest.internName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="p-8 space-y-5">
                  {editError ? (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-xs font-bold">
                      {editError}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'Template' : 'Template'}</div>
                      <select
                        value={editTemplateId}
                        onChange={(e) => setEditTemplateId(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                      >
                        <option value="">{lang === 'TH' ? 'เลือก Template' : 'Select template'}</option>
                        {templatesByType.COMPLETION.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name || tpl.id}
                          </option>
                        ))}
                      </select>
                    </label>

                    {shouldShowEditField('issueDate') ? (
                      <label className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'วันที่ออก' : 'Issue date'}</div>
                        <input
                          type="date"
                          value={editIssueDate}
                          onChange={(e) => setEditIssueDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}

                    {shouldShowEditField('internName') ? (
                      <label className="space-y-2 md:col-span-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'ชื่อ' : 'Name'}</div>
                        <input
                          value={editInternName}
                          onChange={(e) => setEditInternName(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}

                    {shouldShowEditField('position') ? (
                      <label className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'ตำแหน่ง' : 'Position'}</div>
                        <input
                          value={editInternPosition}
                          onChange={(e) => setEditInternPosition(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}

                    {shouldShowEditField('department') ? (
                      <label className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'แผนก' : 'Department'}</div>
                        <input
                          value={editInternDepartment}
                          onChange={(e) => setEditInternDepartment(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}

                    {shouldShowEditField('internPeriod') ? (
                      <label className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'ช่วงฝึกงาน' : 'Intern period'}</div>
                        <input
                          value={editInternPeriod}
                          onChange={(e) => setEditInternPeriod(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}

                    {shouldShowEditField('systemId') ? (
                      <label className="space-y-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'รหัสระบบ' : 'System ID'}</div>
                        <input
                          value={editSystemId}
                          onChange={(e) => setEditSystemId(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeEdit}
                      disabled={isEditSaving}
                      className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                    >
                      {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEditRegenerate()}
                      disabled={isEditSaving}
                      className="px-8 py-3 rounded-2xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isEditSaving ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}
                      {isEditSaving ? (lang === 'TH' ? 'กำลังสร้าง...' : 'Generating...') : (lang === 'TH' ? 'Re-generate' : 'Re-generate')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {pendingCancelRequest ? (
            <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
              <div className="bg-white w-full max-w-xl rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'TH' ? 'ยืนยันการปลดล็อค' : 'Confirm Unlock'}
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {lang === 'TH' ? 'ยกเลิกสถานะออกเอกสาร (Issued)' : 'Cancel Issued Status'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingCancelRequest(null)}
                    className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="p-8 space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                    <div className="text-sm font-black text-slate-900">
                      {lang === 'TH'
                        ? 'คุณต้องการปลดล็อคใบรับรองนี้เพื่อแก้ไขและออกใหม่ใช่ไหม?'
                        : 'Do you want to unlock this certificate for editing and re-issuance?'}
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-500 leading-relaxed">
                      {lang === 'TH'
                        ? 'ระบบจะเปลี่ยนสถานะกลับเป็น REQUESTED เพื่อให้แก้ไขได้ และผู้ใช้งานฝั่ง intern จะเห็นเป็นรอดำเนินการจนกว่าจะ Generate ใหม่'
                        : 'This will switch the status back to REQUESTED. Interns will see it as pending until you generate again.'}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPendingCancelRequest(null)}
                      disabled={cancelingId !== null}
                      className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                    >
                      {lang === 'TH' ? 'คงไว้เหมือนเดิม' : 'Keep Issued'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmCancelIssued()}
                      disabled={cancelingId !== null}
                      className="px-8 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      {cancelingId ? <Clock size={16} className="animate-spin" /> : null}
                      {lang === 'TH' ? 'ปลดล็อคเพื่อแก้ไข' : 'Unlock & Edit'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminCertificatesPage;

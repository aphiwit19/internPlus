
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  CalendarDays,
  FileText, 
  Link as LinkIcon, 
  ExternalLink, 
  Copy, 
  Check, 
  Download,
  Upload, 
  Building2, 
  User, 
  Info,
  GraduationCap,
  ClipboardCheck,
  Plus,
  Trash2,
  FileCheck,
  Truck,
  Mail,
  MapPin,
  Save,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Language } from '@/types';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseAuth, firebaseStorage } from '@/firebase';
import { toast } from 'sonner';
import { arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useTranslation } from 'react-i18next';

interface UniDocument {
  id: string;
  name: string;
  category: 'Sending' | 'Evaluation' | 'Requirement' | 'Other';
  status: 'empty' | 'uploaded';
  fileName?: string;
}

type UniversityEvaluationLink = {
  id: string;
  label: string;
  url: string;
  createdAt?: unknown;
};

type UniversityEvaluationFile = {
  id: string;
  label: string;
  category?: 'Sending' | 'Evaluation' | 'Requirement' | 'Other';
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
};

type AppointmentHistoryEntry = {
  id: string;
  actor: 'INTERN' | 'SUPERVISOR';
  date?: string;
  time?: string;
  status?: string;
  mode?: string;
  note?: string;
  supervisorNote?: string;
  createdAt?: unknown;
};

type UniversityEvaluationDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
  supervisorId: string | null;
  updatedAt?: unknown;
  submissionStatus?: 'DRAFT' | 'SUBMITTED';
  submittedAt?: unknown;
  links?: UniversityEvaluationLink[];
  files?: UniversityEvaluationFile[];
  submittedLinks?: UniversityEvaluationLink[];
  submittedFiles?: UniversityEvaluationFile[];
  deliveryDetails?: {
    recipientName?: string;
    department?: string;
    method?: string;
    email?: string;
    address?: string;
    instructions?: string;
  };
  submittedDeliveryDetails?: {
    recipientName?: string;
    department?: string;
    method?: string;
    email?: string;
    address?: string;
    instructions?: string;
  };
  appointmentRequest?: {
    date?: string;
    time?: string;
    status?: 'DRAFT' | 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'DONE';
    mode?: 'ONLINE' | 'COMPANY';
    note?: string;
    supervisorNote?: string;
    updatedAt?: unknown;
  };
  appointmentHistory?: Array<{
    id: string;
    actor: 'INTERN' | 'SUPERVISOR';
    date?: string;
    time?: string;
    status?: string;
    mode?: string;
    note?: string;
    supervisorNote?: string;
    createdAt?: unknown;
  }>;
  pendingChanges?: boolean;
};

interface EvaluationPageProps {
  lang: Language;
}

const EvaluationPage: React.FC<EvaluationPageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const { t, i18n } = useTranslation();
  const lang: Language = (i18n.resolvedLanguage ?? i18n.language) === 'th' ? 'TH' : 'EN';
  const tr = (key: string, options?: any) => String(t(key, options));

  const meetingModeLabel = (mode?: UniversityEvaluationDoc['appointmentRequest'] extends { mode?: infer X } ? X : any) => {
    return (mode ?? 'ONLINE') === 'COMPANY' ? tr('intern_evaluation.appointment.mode_company') : tr('intern_evaluation.appointment.mode_online');
  };

  const categoryLabel = (category?: UniDocument['category']) => {
    if (category === 'Sending') return tr('intern_evaluation.categories.sending');
    if (category === 'Evaluation') return tr('intern_evaluation.categories.evaluation');
    if (category === 'Requirement') return tr('intern_evaluation.categories.requirement');
    if (category === 'Other') return tr('intern_evaluation.categories.other');
    return String(category ?? '');
  };

  const baseDocs = useMemo<UniDocument[]>(
    () => [
      {
        id: '1',
        name: String(t('intern_evaluation.base_docs.request_letter')),
        category: 'Sending',
        status: 'empty',
      },
      {
        id: '2',
        name: String(t('intern_evaluation.base_docs.formal_evaluation_form')),
        category: 'Evaluation',
        status: 'empty',
      },
    ],
    [lang, t],
  );

  const [links, setLinks] = useState<UniversityEvaluationLink[]>([]);
  const [files, setFiles] = useState<UniversityEvaluationFile[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<UniversityEvaluationDoc['submissionStatus']>('DRAFT');
  const [submittedAt, setSubmittedAt] = useState<unknown>(null);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deliverySubmitError, setDeliverySubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<UniDocument['category']>('Other');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);

  const LINKS_PAGE_SIZE = 3;
  const [linksPage, setLinksPage] = useState(1);

  const DOCS_PAGE_SIZE = 4;
  const [docsPage, setDocsPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    docId: string;
    label: string;
    category: UniDocument['category'];
  } | null>(null);

  const [deliveryDetails, setDeliveryDetails] = useState({
    recipientName: '',
    department: '',
    method: 'Email',
    email: '',
    address: '',
    instructions: '',
  });

  const [appointmentRequest, setAppointmentRequest] = useState<NonNullable<UniversityEvaluationDoc['appointmentRequest']>>({
    date: '',
    time: '',
    status: 'DRAFT',
    mode: 'ONLINE',
    note: '',
    supervisorNote: '',
  });

  const [appointmentHistory, setAppointmentHistory] = useState<AppointmentHistoryEntry[]>([]);
  const [appointmentHistoryPage, setAppointmentHistoryPage] = useState(1);
  const [showAppointmentHistory, setShowAppointmentHistory] = useState(false);

  const APPOINTMENT_HISTORY_PAGE_SIZE = 3;

  const [openSection, setOpenSection] = useState<'appointment' | 'links' | 'docs' | 'delivery' | 'final' | 'none'>(() => 'appointment');

  const reversedAppointmentHistory = useMemo(() => {
    return [...appointmentHistory].slice().reverse();
  }, [appointmentHistory]);

  const linksPageCount = useMemo(() => {
    const count = Math.ceil(links.length / LINKS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [LINKS_PAGE_SIZE, links.length]);

  useEffect(() => {
    setLinksPage((prev) => {
      if (prev < 1) return 1;
      if (prev > linksPageCount) return linksPageCount;
      return prev;
    });
  }, [linksPageCount]);

  const displayedLinks = useMemo(() => {
    const start = (linksPage - 1) * LINKS_PAGE_SIZE;
    return links.slice(start, start + LINKS_PAGE_SIZE);
  }, [LINKS_PAGE_SIZE, links, linksPage]);

  const appointmentHistoryPageCount = useMemo(() => {
    const count = Math.ceil(reversedAppointmentHistory.length / APPOINTMENT_HISTORY_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [reversedAppointmentHistory.length]);

  useEffect(() => {
    setAppointmentHistoryPage((prev) => {
      if (prev < 1) return 1;
      if (prev > appointmentHistoryPageCount) return appointmentHistoryPageCount;
      return prev;
    });
  }, [appointmentHistoryPageCount]);

  const displayedAppointmentHistory = useMemo(() => {
    const start = (appointmentHistoryPage - 1) * APPOINTMENT_HISTORY_PAGE_SIZE;
    return reversedAppointmentHistory.slice(start, start + APPOINTMENT_HISTORY_PAGE_SIZE);
  }, [appointmentHistoryPage, reversedAppointmentHistory]);

  const appointmentStatusLabel = useMemo(() => {
    const s = String(appointmentRequest.status ?? 'DRAFT');
    const isCancelled = s === 'CANCELLED';
    return isCancelled
      ? tr('intern_evaluation.appointment.status_cancelled_short')
      : tr('intern_evaluation.appointment.status_requested_short');
  }, [appointmentRequest.status, lang]);

  const supervisorRespondedBanner = useMemo(() => {
    const s = String(appointmentRequest.status ?? '');
    if (s !== 'CONFIRMED' && s !== 'RESCHEDULED' && s !== 'CANCELLED') return null;
    const title =
      s === 'CONFIRMED'
        ? tr('intern_evaluation.notifications.supervisor_confirmed')
        : s === 'RESCHEDULED'
          ? tr('intern_evaluation.notifications.supervisor_rescheduled')
          : tr('intern_evaluation.notifications.supervisor_cancelled');
    const note = String(appointmentRequest.supervisorNote ?? '').trim();
    const subtitle = note ? note : null;
    const toneClass =
      s === 'CANCELLED'
        ? 'bg-rose-50 border-rose-200 text-rose-700'
        : s === 'RESCHEDULED'
          ? 'bg-sky-50 border-sky-200 text-sky-700'
          : 'bg-emerald-50 border-emerald-200 text-emerald-700';
    const emphasisClass =
      s === 'RESCHEDULED'
        ? 'shadow-lg ring-4 ring-sky-100 border-sky-300'
        : 'shadow-sm';
    const accentClass =
      s === 'RESCHEDULED'
        ? 'bg-sky-500'
        : s === 'CANCELLED'
          ? 'bg-rose-500'
          : 'bg-emerald-500';
    return { title, subtitle, toneClass, emphasisClass, accentClass };
  }, [appointmentRequest.status, appointmentRequest.supervisorNote, lang]);

  const appointmentToastInitRef = useRef(false);
  const prevAppointmentToastKeyRef = useRef<string>('');

  const isAppointmentLocked = useMemo(() => {
    return false;
  }, []);

  const supervisorStatusLabel = useMemo(() => {
    const s = String(appointmentRequest.status ?? '');
    if (s === 'CONFIRMED') return tr('intern_evaluation.appointment.status_confirmed');
    if (s === 'RESCHEDULED') return tr('intern_evaluation.appointment.status_rescheduled');
    if (s === 'CANCELLED') return tr('intern_evaluation.appointment.status_cancelled');
    if (s === 'REQUESTED') return tr('intern_evaluation.appointment.status_requested');
    return tr('intern_evaluation.common.dash');
  }, [appointmentRequest.status, lang]);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    const ref = doc(firestoreDb, 'universityEvaluations', user.id);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLinks([]);
          setFiles([]);
          setSubmissionStatus('DRAFT');
          setSubmittedAt(null);
          setPendingChanges(false);
          setAppointmentRequest({ date: '', time: '', status: 'DRAFT', mode: 'ONLINE', note: '', supervisorNote: '' });
          setAppointmentHistory([]);
          appointmentToastInitRef.current = false;
          prevAppointmentToastKeyRef.current = '';
          return;
        }
        const data = snap.data() as UniversityEvaluationDoc;
        setLinks(Array.isArray(data.links) ? data.links : []);
        setFiles(Array.isArray(data.files) ? data.files : []);
        setSubmissionStatus(data.submissionStatus ?? 'DRAFT');
        setSubmittedAt(data.submittedAt ?? null);
        setPendingChanges(Boolean(data.pendingChanges));
        if (data.deliveryDetails) {
          setDeliveryDetails((prev) => ({ ...prev, ...data.deliveryDetails }));
        }
        if (data.appointmentRequest) {
          const nextAr = data.appointmentRequest;
          const nextStatus = String(nextAr.status ?? '');
          const toastKey = `${nextStatus}|${String(nextAr.date ?? '')}|${String(nextAr.time ?? '')}|${String(nextAr.mode ?? '')}|${String(nextAr.supervisorNote ?? '')}`;
          const shouldNotify =
            appointmentToastInitRef.current &&
            toastKey !== prevAppointmentToastKeyRef.current &&
            (nextStatus === 'CONFIRMED' || nextStatus === 'RESCHEDULED' || nextStatus === 'CANCELLED');

          setAppointmentRequest((prev) => ({ ...prev, ...nextAr }));

          if (!appointmentToastInitRef.current) {
            appointmentToastInitRef.current = true;
          } else if (shouldNotify) {
            const title =
              nextStatus === 'CONFIRMED'
                ? tr('intern_evaluation.notifications.supervisor_confirmed')
                : nextStatus === 'RESCHEDULED'
                  ? tr('intern_evaluation.notifications.supervisor_rescheduled')
                  : tr('intern_evaluation.notifications.supervisor_cancelled');

            const detail = `${String(nextAr.date ?? '--')} ${String(nextAr.time ?? '--')} • ${meetingModeLabel(nextAr.mode)}`;
            const description = String(nextAr.supervisorNote ?? '').trim();

            toast(title, {
              description: description ? `${detail}\n${description}` : detail,
              duration: 8000,
            });
          }

          prevAppointmentToastKeyRef.current = toastKey;
        }
        setAppointmentHistory(Array.isArray(data.appointmentHistory) ? (data.appointmentHistory as AppointmentHistoryEntry[]) : []);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_evaluation.errors.failed_to_load')}`);
      },
    );
  }, [lang, user]);

  const persist = async (patch: Partial<UniversityEvaluationDoc>) => {
    if (!user) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const ref = doc(firestoreDb, 'universityEvaluations', user.id);
      await setDoc(
        ref,
        {
          internId: user.id,
          internName: user.name,
          internAvatar: user.avatar,
          internPosition: user.position,
          internDepartment: user.department,
          supervisorId: user.supervisorId ?? null,
          updatedAt: serverTimestamp(),
          ...patch,
        } satisfies Partial<UniversityEvaluationDoc>,
        { merge: true },
      );
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setSaveError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_evaluation.errors.save_failed')}`);
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmitDeliveryDetails = useMemo(() => {
    const recipientName = deliveryDetails.recipientName.trim();
    const department = deliveryDetails.department.trim();
    const method = (deliveryDetails.method ?? '').trim();
    const email = deliveryDetails.email.trim();
    const address = deliveryDetails.address.trim();
    const instructions = deliveryDetails.instructions.trim();

    if (!recipientName) return false;
    if (!department) return false;
    if (!method) return false;
    if (!instructions) return false;

    if (method === 'Email') return Boolean(email);
    return Boolean(address);
  }, [deliveryDetails]);

  const isSubmitted = useMemo(() => submissionStatus === 'SUBMITTED', [submissionStatus]);
  const isFinalSubmitted = useMemo(() => isSubmitted && !pendingChanges, [isSubmitted, pendingChanges]);

  const canSendAppointment = useMemo(() => {
    const date = (appointmentRequest.date ?? '').trim();
    const time = (appointmentRequest.time ?? '').trim();
    const mode = (appointmentRequest.mode ?? '').trim();
    return Boolean(date && time && mode);
  }, [appointmentRequest]);

  const sendAppointment = async () => {
    const next: AppointmentHistoryEntry = {
      id: String(Date.now()),
      actor: 'INTERN' as const,
      date: (appointmentRequest.date ?? '').trim(),
      time: (appointmentRequest.time ?? '').trim(),
      status: 'REQUESTED',
      mode: appointmentRequest.mode ?? 'ONLINE',
      note: (appointmentRequest.note ?? '').trim(),
      createdAt: Date.now(),
    };
    await persist({
      appointmentRequest: {
        date: (appointmentRequest.date ?? '').trim(),
        time: (appointmentRequest.time ?? '').trim(),
        status: 'REQUESTED',
        mode: appointmentRequest.mode ?? 'ONLINE',
        note: (appointmentRequest.note ?? '').trim(),
        supervisorNote: (appointmentRequest.supervisorNote ?? '').trim(),
        updatedAt: serverTimestamp(),
      },
      appointmentHistory: arrayUnion(next) as unknown as AppointmentHistoryEntry[],
      pendingChanges: true,
    });
  };

  const submittedAtLabel = useMemo(() => {
    const x = submittedAt as unknown as { toDate?: () => Date };
    const d = typeof x?.toDate === 'function' ? x.toDate() : null;
    if (!d) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [submittedAt]);

  const submitDeliveryDetails = async () => {
    setDeliverySubmitError(null);
    if (!canSubmitDeliveryDetails) {
      setDeliverySubmitError(tr('intern_evaluation.delivery.errors.complete_all_fields'));
      return;
    }

    try {
      await persist({
        deliveryDetails,
        submittedDeliveryDetails: deliveryDetails,
        submittedLinks: links,
        submittedFiles: files,
        submissionStatus: 'SUBMITTED',
        submittedAt: serverTimestamp(),
        pendingChanges: false,
      });
      
      // Update local state immediately for real-time UI update
      setSubmissionStatus('SUBMITTED');
      setPendingChanges(false);
      setSubmittedAt(new Date());
      
      toast.success(
        tr('intern_evaluation.delivery.toast.saved'),
        { duration: 3000 }
      );
    } catch (error) {
      setDeliverySubmitError(tr('intern_evaluation.delivery.errors.save_failed'));
    }
  };

  const normalizedNewLinkLabel = useMemo(() => newLinkLabel.trim(), [newLinkLabel]);
  const normalizedNewLinkUrl = useMemo(() => newLinkUrl.trim(), [newLinkUrl]);
  const canAddLink = useMemo(
    () => normalizedNewLinkLabel.length > 0 && normalizedNewLinkUrl.length > 0,
    [normalizedNewLinkLabel, normalizedNewLinkUrl],
  );

  const handleAddLink = async () => {
    if (!user) return;
    if (!canAddLink) return;
    const next: UniversityEvaluationLink = {
      id: String(Date.now()),
      label: normalizedNewLinkLabel,
      url: normalizedNewLinkUrl,
      createdAt: Date.now(),
    };
    const nextLinks = [...links, next];
    setLinks(nextLinks);
    setNewLinkLabel('');
    setNewLinkUrl('');
    await persist({ links: nextLinks, pendingChanges: true });
  };

  const handleDeleteLink = async (id: string) => {
    if (!user) return;
    const nextLinks = links.filter((l) => l.id !== id);
    setLinks(nextLinks);
    await persist({ links: nextLinks, pendingChanges: true });
  };

  const openUpload = (d: UniDocument) => {
    setPendingUpload({ docId: d.id, label: d.name, category: d.category });
    fileInputRef.current?.click();
  };

  const handleDeleteFile = async (docId: string) => {
    if (!user) return;
    const item = files.find((x) => x.id === docId);
    if (!item) return;
    if (!window.confirm(tr('intern_evaluation.docs.confirm_delete'))) return;

    setUploadError(null);
    try {
      await deleteObject(storageRef(firebaseStorage, item.storagePath));
    } catch {
      // ignore
    }

    const nextFiles = files.filter((f) => f.id !== docId);
    setFiles(nextFiles);
    await persist({ files: nextFiles, pendingChanges: true });
  };

  const handleFileSelected = async (file: File | null) => {
    if (!user) return;
    if (!pendingUpload || !file) return;
    const { docId, label, category } = pendingUpload;
    setPendingUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadError(null);
    setUploadingDocId(docId);
    try {
      const path = `universityEvaluations/${user.id}/files/${docId}/${Date.now()}_${file.name}`;
      await uploadBytes(storageRef(firebaseStorage, path), file);

      const nextFile: UniversityEvaluationFile = {
        id: docId,
        label,
        category,
        fileName: file.name,
        storagePath: path,
        createdAt: Date.now(),
      };

      const existingIdx = files.findIndex((f) => f.id === docId);
      const existing = existingIdx >= 0 ? files[existingIdx] : null;
      const nextFiles = [...files];
      if (existingIdx >= 0) nextFiles[existingIdx] = nextFile;
      else nextFiles.push(nextFile);

      if (existing?.storagePath) {
        try {
          await deleteObject(storageRef(firebaseStorage, existing.storagePath));
        } catch {
          // ignore
        }
      }

      setFiles(nextFiles);
      await persist({ files: nextFiles, pendingChanges: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_evaluation.errors.upload_failed')}`);
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleDownload = async (docId: string) => {
    const f = files.find((x) => x.id === docId);
    if (!f) return;
    const url = await getDownloadURL(storageRef(firebaseStorage, f.storagePath));
    window.open(url, '_blank');
  };

  const handleAddCustomDocument = async () => {
    if (!user) return;
    const label = newDocLabel.trim();
    const file = newDocFile;
    if (!label || !file) return;

    const docId = `custom_${Date.now()}`;
    setUploadError(null);
    setUploadingDocId(docId);
    try {
      const path = `universityEvaluations/${user.id}/files/${docId}/${Date.now()}_${file.name}`;
      await uploadBytes(storageRef(firebaseStorage, path), file);

      const nextFile: UniversityEvaluationFile = {
        id: docId,
        label,
        category: newDocCategory,
        fileName: file.name,
        storagePath: path,
        createdAt: Date.now(),
      };

      const nextFiles = [...files, nextFile];
      setFiles(nextFiles);
      await persist({ files: nextFiles, pendingChanges: true });

      setIsAddingDoc(false);
      setNewDocLabel('');
      setNewDocCategory('Other');
      setNewDocFile(null);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_evaluation.errors.upload_failed')}`);
    } finally {
      setUploadingDocId(null);
    }
  };

  const uniDocs = useMemo(() => {
    const fileById = new Map<string, UniversityEvaluationFile>(files.map((f) => [f.id, f] as const));
    return baseDocs.map((d) => {
      const f = fileById.get(d.id) ?? null;
      return {
        ...d,
        status: f ? 'uploaded' : 'empty',
        fileName: f?.fileName,
      } as UniDocument;
    });
  }, [baseDocs, files]);

  const customFiles = useMemo(() => {
    const baseIds = new Set(baseDocs.map((d) => d.id));
    return files.filter((f) => !baseIds.has(f.id));
  }, [baseDocs, files]);

  const docsPageCount = useMemo(() => {
    const count = Math.ceil(customFiles.length / DOCS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [DOCS_PAGE_SIZE, customFiles.length]);

  useEffect(() => {
    setDocsPage((prev) => {
      if (prev < 1) return 1;
      if (prev > docsPageCount) return docsPageCount;
      return prev;
    });
  }, [docsPageCount]);

  const displayedCustomFiles = useMemo(() => {
    const start = (docsPage - 1) * DOCS_PAGE_SIZE;
    return customFiles.slice(start, start + DOCS_PAGE_SIZE);
  }, [DOCS_PAGE_SIZE, customFiles, docsPage]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
      />
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {loadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {loadError}
          </div>
        ) : null}

        {saveError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {saveError}
          </div>
        ) : null}

        {uploadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {uploadError}
          </div>
        ) : null}

        {deliverySubmitError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {deliverySubmitError}
          </div>
        ) : null}

        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight">{tr('intern_evaluation.title')}</h1><p className="text-slate-500 text-sm mt-1">{tr('intern_evaluation.subtitle')}</p></div>
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2"><GraduationCap size={16} /> {tr('intern_evaluation.portal_sync')}</div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto pb-24 scrollbar-hide pr-1">
          <div className="lg:col-span-8 space-y-8">
            <section className="rounded-[2rem] p-8 border border-slate-100 shadow-sm bg-white">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200">
                    <CalendarDays size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900">{tr('intern_evaluation.appointment.title')}</h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{tr('intern_evaluation.appointment.subtitle')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-700">
                    {appointmentStatusLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenSection((s) => (s === 'appointment' ? 'none' : 'appointment'))}
                    className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center"
                    aria-label="Toggle appointment section"
                    title={openSection === 'appointment' ? tr('intern_evaluation.common.collapse') : tr('intern_evaluation.common.expand')}
                  >
                    <ChevronDown size={18} className={`transition-transform ${openSection === 'appointment' ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {openSection === 'appointment' ? (
                <>
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {appointmentRequest.date ? appointmentRequest.date : '--'}
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {appointmentRequest.time ? appointmentRequest.time : '--'}
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {meetingModeLabel(appointmentRequest.mode)}
                    </div>
                    <div className="ml-auto hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Clock size={14} />
                      {tr('intern_evaluation.appointment.ready_hint')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('intern_evaluation.appointment.date')}</label>
                      <input
                        type="date"
                        value={appointmentRequest.date ?? ''}
                        onChange={(e) => setAppointmentRequest((prev) => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('intern_evaluation.appointment.time')}</label>
                      <input
                        type="time"
                        value={appointmentRequest.time ?? ''}
                        onChange={(e) => setAppointmentRequest((prev) => ({ ...prev, time: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('intern_evaluation.appointment.meeting_mode')}</label>
                      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setAppointmentRequest((prev) => ({ ...prev, mode: 'ONLINE' }))}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            (appointmentRequest.mode ?? 'ONLINE') === 'ONLINE'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {tr('intern_evaluation.appointment.mode_online')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAppointmentRequest((prev) => ({ ...prev, mode: 'COMPANY' }))}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            (appointmentRequest.mode ?? 'ONLINE') === 'COMPANY'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {tr('intern_evaluation.appointment.mode_company')}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{tr('intern_evaluation.appointment.note_optional')}</label>
                      <textarea
                        value={appointmentRequest.note ?? ''}
                        onChange={(e) => setAppointmentRequest((prev) => ({ ...prev, note: e.target.value }))}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 h-[96px] resize-none focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-200"
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => void sendAppointment()}
                      disabled={!user || isSaving || !canSendAppointment}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
                    >
                      <CalendarDays size={16} />
                      {tr('intern_evaluation.appointment.send_request')}
                    </button>
                  </div>

                  {appointmentHistory.length > 0 ? (
                    <div className="mt-8">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.35em]">
                          {tr('intern_evaluation.appointment.history.title')}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAppointmentHistory((v) => !v)}
                          className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                        >
                          {showAppointmentHistory
                            ? tr('intern_evaluation.appointment.history.hide')
                            : tr('intern_evaluation.appointment.history.view_with_count', { count: appointmentHistory.length } as any)}
                        </button>
                      </div>

                      {showAppointmentHistory ? (
                        <>
                          <div className="space-y-2">
                            {displayedAppointmentHistory.map((h) => (
                              <div key={h.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                        {h.actor === 'SUPERVISOR'
                                          ? tr('intern_evaluation.appointment.history.actor_supervisor')
                                          : tr('intern_evaluation.appointment.history.actor_intern')}
                                      </div>
                                      <div className="text-[11px] font-black text-slate-700">
                                        {(h.date ? String(h.date) : '--') + ' ' + (h.time ? String(h.time) : '--')}
                                      </div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div className="px-3 py-2 rounded-xl bg-white border border-slate-200">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                          {tr('intern_evaluation.appointment.history.status_label')}
                                        </div>
                                        <div className="text-[11px] font-black text-slate-800 mt-1">{String(h.status ?? '—')}</div>
                                      </div>
                                      <div className="px-3 py-2 rounded-xl bg-white border border-slate-200">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                          {tr('intern_evaluation.appointment.history.mode_label')}
                                        </div>
                                        <div className="text-[11px] font-black text-slate-800 mt-1">{String(h.mode ?? '--')}</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {String(h.supervisorNote ?? '').trim() ? (
                                  <div className="mt-3 p-3 rounded-xl bg-white border border-slate-200">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      {tr('intern_evaluation.appointment.history.supervisor_note_label')}
                                    </div>
                                    <div className="mt-1 text-xs font-bold text-slate-700 whitespace-pre-wrap">{String(h.supervisorNote)}</div>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          {appointmentHistoryPageCount > 1 && (
                            <div className="pt-4 flex justify-center">
                              <div className="max-w-full overflow-x-auto">
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex flex-wrap items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAppointmentHistoryPage((p) => Math.max(1, p - 1))}
                                    disabled={appointmentHistoryPage <= 1}
                                    className="w-10 h-10 shrink-0 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                  >
                                    <ChevronLeft size={18} />
                                  </button>

                                  {Array.from({ length: appointmentHistoryPageCount }, (_, i) => i + 1).map((p) => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setAppointmentHistoryPage(p)}
                                      className={`w-10 h-10 shrink-0 rounded-xl border text-[12px] font-black transition-all ${
                                        p === appointmentHistoryPage
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAppointmentHistoryPage((p) => Math.min(appointmentHistoryPageCount, p + 1))
                                    }
                                    disabled={appointmentHistoryPage >= appointmentHistoryPageCount}
                                    className="w-10 h-10 shrink-0 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                  >
                                    <ChevronRight size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <LinkIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tr('intern_evaluation.links.title')}</h2>
                    <p className="text-xs text-slate-400 mt-1">{tr('intern_evaluation.links.subtitle')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSection((s) => (s === 'links' ? 'none' : 'links'))}
                  className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center"
                  aria-label="Toggle links section"
                  title={openSection === 'links' ? tr('intern_evaluation.common.collapse') : tr('intern_evaluation.common.expand')}
                >
                  <ChevronDown size={18} className={`transition-transform ${openSection === 'links' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {openSection === 'links' ? (
                <>
                  <div className="bg-blue-50/30 p-6 rounded-[1.5rem] border border-blue-100/50">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase mb-4">{tr('intern_evaluation.links.add_link')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={newLinkLabel}
                        onChange={(e) => setNewLinkLabel(e.target.value)}
                        placeholder={tr('intern_evaluation.links.link_label_placeholder')}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                      />
                      <input
                        type="url"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder={tr('intern_evaluation.links.url_placeholder')}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAddLink()}
                      disabled={!user || !canAddLink || isSaving}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSaving ? <Clock size={16} className="animate-spin" /> : <Plus size={16} />} {tr('intern_evaluation.links.save_link')}
                    </button>
                  </div>

                  {links.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      {displayedLinks.map((l) => (
                        <div key={l.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 truncate">{l.label}</p>
                            <p className="text-[11px] font-bold text-slate-400 truncate">{l.url}</p>
                          </a>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                              title={tr('intern_evaluation.common.open')}
                            >
                              <ExternalLink size={16} />
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDeleteLink(l.id)}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                              title={tr('intern_evaluation.common.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {linksPageCount > 1 ? (
                    <div className="pt-4 flex justify-center">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLinksPage((p) => Math.max(1, p - 1))}
                          disabled={linksPage <= 1}
                          className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                          aria-label="Previous page"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        {Array.from({ length: linksPageCount }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setLinksPage(p)}
                            className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                              p === linksPage
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                            }`}
                            aria-current={p === linksPage ? 'page' : undefined}
                          >
                            {p}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setLinksPage((p) => Math.min(linksPageCount, p + 1))}
                          disabled={linksPage >= linksPageCount}
                          className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                          aria-label="Next page"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tr('intern_evaluation.docs.title')}</h2>
                    <p className="text-xs text-slate-400 mt-1">{tr('intern_evaluation.docs.subtitle')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSection((s) => (s === 'docs' ? 'none' : 'docs'))}
                  className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center"
                  aria-label="Toggle documents section"
                  title={openSection === 'docs' ? tr('intern_evaluation.common.collapse') : tr('intern_evaluation.common.expand')}
                >
                  <ChevronDown size={18} className={`transition-transform ${openSection === 'docs' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {openSection === 'docs' ? (
                <>
                  <div className="mb-6">
                    {!isAddingDoc ? (
                      <button
                        type="button"
                        onClick={() => setIsAddingDoc(true)}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <Plus size={16} /> {tr('intern_evaluation.docs.add_additional_document')}
                      </button>
                    ) : null}
                  </div>

                  {isAddingDoc ? (
                    <div className="mb-6 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                          type="text"
                          value={newDocLabel}
                          onChange={(e) => setNewDocLabel(e.target.value)}
                          placeholder={tr('intern_evaluation.docs.document_name_placeholder')}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                        />
                        <select
                          value={newDocCategory}
                          onChange={(e) => setNewDocCategory(e.target.value as UniDocument['category'])}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                        >
                          <option value="Sending">{tr('intern_evaluation.categories.sending')}</option>
                          <option value="Evaluation">{tr('intern_evaluation.categories.evaluation')}</option>
                          <option value="Requirement">{tr('intern_evaluation.categories.requirement')}</option>
                          <option value="Other">{tr('intern_evaluation.categories.other')}</option>
                        </select>
                        <input
                          type="file"
                          onChange={(e) => setNewDocFile(e.target.files?.[0] ?? null)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold md:col-span-2"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingDoc(false);
                            setNewDocLabel('');
                            setNewDocCategory('Other');
                            setNewDocFile(null);
                          }}
                          className="w-full py-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                        >
                          {tr('intern_evaluation.common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAddCustomDocument()}
                          disabled={!user || !newDocLabel.trim() || !newDocFile || Boolean(uploadingDocId)}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {uploadingDocId ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}{' '}
                          {tr('intern_evaluation.common.upload')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uniDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              doc.status === 'uploaded' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'
                            }`}
                          >
                            {doc.status === 'uploaded' ? <FileCheck size={24} /> : <FileText size={24} />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">{categoryLabel(doc.category)}</p>
                            <p className="text-sm font-bold text-slate-800 truncate">{doc.name}</p>
                          </div>
                        </div>

                        {doc.status === 'uploaded' ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleDownload(doc.id)}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                              title={tr('intern_evaluation.docs.view_download')}
                            >
                              <Download size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteFile(doc.id)}
                              className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                              title={tr('intern_evaluation.common.delete')}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openUpload(doc)}
                            disabled={!user || uploadingDocId === doc.id}
                            className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-lg disabled:opacity-50"
                            title={tr('intern_evaluation.common.upload')}
                          >
                            {uploadingDocId === doc.id ? <Clock size={18} className="animate-spin" /> : <Upload size={18} />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {customFiles.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        {tr('intern_evaluation.docs.additional_uploaded_documents')}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayedCustomFiles.map((f) => (
                          <div
                            key={f.id}
                            className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center gap-4 overflow-hidden min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                <FileCheck size={22} />
                              </div>
                              <div className="overflow-hidden min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5 truncate">{categoryLabel((f.category ?? 'Other') as any)}</p>
                                <p className="text-sm font-bold text-slate-800 truncate">{f.label}</p>
                                <p className="text-[11px] font-bold text-slate-400 truncate">{f.fileName}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => void handleDownload(f.id)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                                title={tr('intern_evaluation.docs.view_download')}
                              >
                                <Download size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteFile(f.id)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                                title={tr('intern_evaluation.common.delete')}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {customFiles.length > DOCS_PAGE_SIZE ? (
                        <div className="pt-4 flex justify-center">
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDocsPage((p) => Math.max(1, p - 1))}
                              disabled={docsPage <= 1}
                              className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                              aria-label="Previous page"
                            >
                              <ChevronLeft size={18} />
                            </button>

                            {Array.from({ length: docsPageCount }, (_, i) => i + 1).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setDocsPage(p)}
                                className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                                  p === docsPage
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                                }`}
                                aria-current={p === docsPage ? 'page' : undefined}
                              >
                                {p}
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => setDocsPage((p) => Math.min(docsPageCount, p + 1))}
                              disabled={docsPage >= docsPageCount}
                              className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                              aria-label="Next page"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>

            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{tr('intern_evaluation.delivery.title')}</h2>
                    <p className="text-xs text-slate-400 mt-1">{tr('intern_evaluation.delivery.subtitle')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSection((s) => (s === 'delivery' ? 'none' : 'delivery'))}
                  className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center"
                  aria-label="Toggle delivery section"
                  title={openSection === 'delivery' ? tr('intern_evaluation.common.collapse') : tr('intern_evaluation.common.expand')}
                >
                  <ChevronDown size={18} className={`transition-transform ${openSection === 'delivery' ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {openSection === 'delivery' ? (
                <>
                  {isSubmitted ? (
                    <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-[1.5rem] px-6 py-4 text-sm font-black flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Check size={18} />
                        </div>
                        <div>
                          <p>{tr('intern_evaluation.delivery.submitted_successfully')}</p>
                          {submittedAtLabel ? (
                            <p className="text-[11px] font-black text-emerald-600/80">{submittedAtLabel}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                        {pendingChanges ? tr('intern_evaluation.delivery.status_changes_pending') : tr('intern_evaluation.delivery.status_submitted')}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.recipient')}</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                          value={deliveryDetails.recipientName}
                          disabled={isFinalSubmitted}
                          onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, recipientName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.department')}</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                          value={deliveryDetails.department}
                          disabled={isFinalSubmitted}
                          onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, department: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.method')}</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                          value={deliveryDetails.method}
                          disabled={isFinalSubmitted}
                          onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, method: e.target.value }))}
                        >
                          <option value="Email">{tr('intern_evaluation.delivery.methods.email')}</option>
                          <option value="Postal Mail">{tr('intern_evaluation.delivery.methods.postal_mail')}</option>
                          <option value="Hand-carry">{tr('intern_evaluation.delivery.methods.hand_carry')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {deliveryDetails.method === 'Email' ? (
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.email')}</label>
                          <input
                            type="email"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                            value={deliveryDetails.email}
                            disabled={isFinalSubmitted}
                            onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.address')}</label>
                          <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs h-[112px] resize-none"
                            value={deliveryDetails.address}
                            disabled={isFinalSubmitted}
                            onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, address: e.target.value }))}
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{tr('intern_evaluation.delivery.fields.instructions')}</label>
                        <textarea
                          placeholder={tr('intern_evaluation.delivery.fields.instructions_placeholder')}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs h-[52px] resize-none"
                          value={deliveryDetails.instructions}
                          disabled={isFinalSubmitted}
                          onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, instructions: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void submitDeliveryDetails()}
                    disabled={!user || isSaving || !canSubmitDeliveryDetails || isFinalSubmitted}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3.5 rounded-2xl text-xs font-bold shadow-xl disabled:opacity-50"
                  >
                    {isFinalSubmitted ? <Check size={16} /> : isSaving ? <Clock size={16} className="animate-spin" /> : <Save size={16} />}{' '}
                    {isFinalSubmitted ? tr('intern_evaluation.delivery.button_submitted') : tr('intern_evaluation.delivery.save_instructions')}
                  </button>
                </>
              ) : null}
            </section>
          </div>
          <div className="lg:col-span-4 space-y-8">
            {supervisorRespondedBanner ? (
              <section
                className={`border rounded-[2.5rem] p-8 text-sm font-black relative overflow-hidden ${supervisorRespondedBanner.toneClass} ${supervisorRespondedBanner.emphasisClass}`}
                role="status"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${supervisorRespondedBanner.accentClass}`} />
                <div className="relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.35em] opacity-70">
                        {tr('intern_evaluation.common.notification')}
                      </div>
                      <div className="mt-2 text-[16px] leading-snug">{supervisorRespondedBanner.title}</div>
                    </div>
                  </div>
                  {supervisorRespondedBanner.subtitle ? (
                    <div className="mt-3 text-[12px] font-bold opacity-90 whitespace-pre-wrap">
                      {supervisorRespondedBanner.subtitle}
                    </div>
                  ) : null}
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <div className="px-4 py-2 rounded-2xl bg-white/70 border border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {supervisorStatusLabel}
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-white/60 border border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {appointmentRequest.date ? appointmentRequest.date : '--'}
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-white/60 border border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {appointmentRequest.time ? appointmentRequest.time : '--'}
                    </div>
                    <div className="px-4 py-2 rounded-2xl bg-white/70 border border-white/60 text-[10px] font-black uppercase tracking-widest text-slate-900">
                      {meetingModeLabel(appointmentRequest.mode)}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-blue-400" /></div><h3 className="text-lg font-bold">{tr('intern_evaluation.sidebar.company_info')}</h3></div>
                <div className="space-y-6">
                  <div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{tr('intern_evaluation.sidebar.official_name')}</p><p className="text-xs font-bold">vannessplus</p></div>
                  <div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{tr('intern_evaluation.sidebar.tax_id')}</p><p className="text-xs font-bold">0123456789012</p></div><div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{tr('intern_evaluation.sidebar.department')}</p><p className="text-xs font-bold">Product Design</p></div></div>
                </div>
              </div>
            </section>
            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6"><div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><ClipboardCheck size={18} /></div><h3 className="text-base font-bold text-slate-900">{tr('intern_evaluation.sidebar.final_tasks')}</h3></div>
              <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3"><Info size={16} className="text-blue-500 shrink-0 mt-0.5" /><p className="text-[10px] text-slate-500 font-medium leading-relaxed">{tr('intern_evaluation.sidebar.important_note')}</p></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationPage;

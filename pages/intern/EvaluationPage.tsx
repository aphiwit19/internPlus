
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
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
  Clock
} from 'lucide-react';
import { Language } from '@/types';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

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
  pendingChanges?: boolean;
};

interface EvaluationPageProps {
  lang: Language;
}

const EvaluationPage: React.FC<EvaluationPageProps> = ({ lang }) => {
  const { user } = useAppContext();
  const t = {
    EN: {
      title: "University Evaluation",
      subtitle: "Manage documents and links required by your educational institution.",
      portalSync: "University Portal Sync",
      linksTitle: "Supervisor Evaluation Links",
      linksSub: "Paste external form links for your supervisor to fill.",
      addLink: "Add New Evaluation Link",
      linkLabel: "Link Label",
      linkUrl: "Paste URL here...",
      saveLink: "Save Link",
      deliveryTitle: "Evaluation Delivery Details",
      deliverySub: "Provide contact info and instructions for where final documents should be sent.",
      recipient: "Recipient Name / Professor",
      dept: "University Department",
      method: "Delivery Method",
      methodEmail: "Digital (Email)",
      methodPost: "Postal Mail (Hard Copy)",
      methodCarry: "Hand-carry by Intern",
      emailLabel: "Recipient Email Address",
      addressLabel: "Physical Mailing Address",
      instLabel: "Additional Instructions",
      saveInst: "Save Delivery Instructions",
      saving: "Saving Instructions...",
      docsTitle: "University Documentation",
      docsSub: "Upload files required for your academic credit or final sign-off.",
      companyInfo: "Company Info",
      officialName: "Official Name",
      taxId: "Tax ID / Reg",
      deptName: "Department",
      mentorRef: "Mentor Reference",
      finalTasks: "Final Tasks",
      importantNote: "Most universities require these forms 2 weeks before your end date.",
      catSending: "Sending",
      catEval: "Evaluation",
      catReq: "Requirement",
      catOther: "Other"
    },
    TH: {
      title: "การประเมินผลจากมหาวิทยาลัย",
      subtitle: "จัดการเอกสารและลิงก์ที่สถาบันการศึกษาของคุณกำหนด",
      portalSync: "ซิงค์ข้อมูลกับมหาวิทยาลัย",
      linksTitle: "ลิงก์การประเมินสำหรับที่ปรึกษา",
      linksSub: "วางลิงก์แบบฟอร์มภายนอกเพื่อให้ที่ปรึกษาของคุณกรอกข้อมูล",
      addLink: "เพิ่มลิงก์การประเมินใหม่",
      linkLabel: "หัวข้อลิงก์",
      linkUrl: "วาง URL ที่นี่...",
      saveLink: "บันทึกลิงก์สำหรับที่ปรึกษา",
      deliveryTitle: "รายละเอียดการนำส่งผลการประเมิน",
      deliverySub: "ระบุข้อมูลการติดต่อและคำแนะนำในการจัดส่งเอกสารประเมินผลตัวจริง",
      recipient: "ชื่อผู้รับ / อาจารย์",
      dept: "คณะ / ภาควิชา",
      method: "รูปแบบการนำส่ง",
      methodEmail: "ดิจิทัล (อีเมล)",
      methodPost: "ไปรษณีย์ (ฉบับจริง)",
      methodCarry: "นักศึกษานำส่งด้วยตัวเอง",
      emailLabel: "อีเมลของผู้รับ",
      addressLabel: "ที่อยู่ในการจัดส่ง",
      instLabel: "คำแนะนำเพิ่มเติม",
      saveInst: "บันทึกคำแนะนำสำหรับที่ปรึกษา",
      saving: "กำลังบันทึกข้อมูล...",
      docsTitle: "เอกสารของมหาวิทยาลัย",
      docsSub: "อัปโหลดไฟล์ที่จำเป็นสำหรับการขอหน่วยกิตหรือการอนุมัติขั้นสุดท้าย",
      companyInfo: "ข้อมูลบริษัท",
      officialName: "ชื่อบริษัทอย่างเป็นทางการ",
      taxId: "เลขประจำตัวผู้เสียภาษี",
      deptName: "แผนก",
      mentorRef: "ข้อมูลที่ปรึกษา",
      finalTasks: "รายการตรวจสอบสุดท้าย",
      importantNote: "มหาวิทยาลัยส่วนใหญ่ต้องการเอกสารเหล่านี้ 2 สัปดาห์ก่อนวันสิ้นสุดการฝึกงาน",
      catSending: "การส่งตัว",
      catEval: "การประเมิน",
      catReq: "ข้อกำหนด",
      catOther: "อื่นๆ"
    }
  }[lang];

  const baseDocs = useMemo<UniDocument[]>(
    () => [
      {
        id: '1',
        name: lang === 'EN' ? 'University Request Letter' : 'หนังสือขอความอนุเคราะห์จากมหาวิทยาลัย',
        category: 'Sending',
        status: 'empty',
      },
      {
        id: '2',
        name: lang === 'EN' ? 'Formal Evaluation Form' : 'แบบฟอร์มการประเมินผลงาน',
        category: 'Evaluation',
        status: 'empty',
      },
    ],
    [lang],
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
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load'}`);
      },
    );
  }, [user]);

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
      setSaveError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Save failed'}`);
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
      setDeliverySubmitError(
        lang === 'TH'
          ? 'กรุณากรอกข้อมูลในส่วนรายละเอียดการจัดส่งให้ครบทุกช่องก่อนกดบันทึก'
          : 'Please complete all Delivery Details fields before saving.',
      );
      return;
    }

    await persist({
      deliveryDetails,
      submittedDeliveryDetails: deliveryDetails,
      submittedLinks: links,
      submittedFiles: files,
      submissionStatus: 'SUBMITTED',
      submittedAt: serverTimestamp(),
      pendingChanges: false,
    });
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
    if (!window.confirm(lang === 'TH' ? 'ลบเอกสารนี้หรือไม่?' : 'Delete this document?')) return;

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
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
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
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
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
          <div><h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1><p className="text-slate-500 text-sm mt-1">{t.subtitle}</p></div>
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2"><GraduationCap size={16} /> {t.portalSync}</div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto pb-24 scrollbar-hide pr-1">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><LinkIcon size={20} /></div><div><h2 className="text-xl font-bold text-slate-900">{t.linksTitle}</h2><p className="text-xs text-slate-400 mt-1">{t.linksSub}</p></div></div>
              <div className="bg-blue-50/30 p-6 rounded-[1.5rem] border border-blue-100/50">
                <h4 className="text-[10px] font-black text-blue-400 uppercase mb-4">{t.addLink}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder={t.linkLabel}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder={t.linkUrl}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddLink()}
                  disabled={!user || !canAddLink || isSaving}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Clock size={16} className="animate-spin" /> : <Plus size={16} />} {t.saveLink}
                </button>
              </div>

              {links.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {links.map((l) => (
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
                          title="Open"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleDeleteLink(l.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><FileText size={20} /></div><div><h2 className="text-xl font-bold text-slate-900">{t.docsTitle}</h2><p className="text-xs text-slate-400 mt-1">{t.docsSub}</p></div></div></div>

              <div className="mb-6">
                {!isAddingDoc ? (
                  <button
                    type="button"
                    onClick={() => setIsAddingDoc(true)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> {lang === 'TH' ? 'เพิ่มเอกสารเพิ่มเติม' : 'Add Additional Document'}
                  </button>
                ) : (
                  <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4">
                      {lang === 'TH' ? 'เอกสารเพิ่มเติม' : 'Additional Document'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input
                        type="text"
                        value={newDocLabel}
                        onChange={(e) => setNewDocLabel(e.target.value)}
                        placeholder={lang === 'TH' ? 'ชื่อเอกสาร' : 'Document name'}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                      />
                      <select
                        value={newDocCategory}
                        onChange={(e) => setNewDocCategory(e.target.value as UniDocument['category'])}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold"
                      >
                        <option value="Sending">{t.catSending}</option>
                        <option value="Evaluation">{t.catEval}</option>
                        <option value="Requirement">{t.catReq}</option>
                        <option value="Other">{t.catOther}</option>
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
                        {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAddCustomDocument()}
                        disabled={!user || !newDocLabel.trim() || !newDocFile || Boolean(uploadingDocId)}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {uploadingDocId ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}{' '}
                        {lang === 'TH' ? 'อัปโหลด' : 'Upload'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniDocs.map(doc => (
                  <div key={doc.id} className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all">
                    <div className="flex items-center gap-4 overflow-hidden"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${doc.status === 'uploaded' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`}>{doc.status === 'uploaded' ? <FileCheck size={24} /> : <FileText size={24} />}</div><div className="overflow-hidden"><p className="text-[9px] font-black text-slate-400 uppercase mb-1.5">{doc.category}</p><p className="text-sm font-bold text-slate-800 truncate">{doc.name}</p></div></div>
                    {doc.status === 'uploaded' ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleDownload(doc.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                          title={lang === 'TH' ? 'ดู/ดาวน์โหลด' : 'View/Download'}
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFile(doc.id)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                          title={lang === 'TH' ? 'ลบ' : 'Delete'}
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
                        title={lang === 'TH' ? 'อัปโหลด' : 'Upload'}
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
                    {lang === 'TH' ? 'เอกสารเพิ่มเติมที่อัปโหลดแล้ว' : 'Additional Uploaded Documents'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-5 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-center gap-4 overflow-hidden min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <FileCheck size={22} />
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5 truncate">{f.category ?? 'Other'}</p>
                            <p className="text-sm font-bold text-slate-800 truncate">{f.label}</p>
                            <p className="text-[11px] font-bold text-slate-400 truncate">{f.fileName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleDownload(f.id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-blue-600 hover:text-white transition-all"
                            title={lang === 'TH' ? 'ดู/ดาวน์โหลด' : 'View/Download'}
                          >
                            <Download size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteFile(f.id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                            title={lang === 'TH' ? 'ลบ' : 'Delete'}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Truck size={20} /></div><div><h2 className="text-xl font-bold text-slate-900">{t.deliveryTitle}</h2><p className="text-xs text-slate-400 mt-1">{t.deliverySub}</p></div></div>

              {isSubmitted ? (
                <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-[1.5rem] px-6 py-4 text-sm font-black flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Check size={18} />
                    </div>
                    <div>
                      <p>{lang === 'TH' ? 'ส่งข้อมูลเรียบร้อยแล้ว' : 'Submitted successfully'}</p>
                      {submittedAtLabel ? (
                        <p className="text-[11px] font-black text-emerald-600/80">{submittedAtLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                    {pendingChanges ? (lang === 'TH' ? 'มีการแก้ไข รอยืนยันส่ง' : 'changes pending') : 'submitted'}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.recipient}</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                      value={deliveryDetails.recipientName}
                      disabled={isFinalSubmitted}
                      onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, recipientName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.dept}</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                      value={deliveryDetails.department}
                      disabled={isFinalSubmitted}
                      onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, department: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.method}</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs"
                      value={deliveryDetails.method}
                      disabled={isFinalSubmitted}
                      onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, method: e.target.value }))}
                    >
                      <option value="Email">{t.methodEmail}</option>
                      <option value="Postal Mail">{t.methodPost}</option>
                      <option value="Hand-carry">{t.methodCarry}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  {deliveryDetails.method === 'Email' ? (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.emailLabel}</label>
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
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.addressLabel}</label>
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs h-[112px] resize-none"
                        value={deliveryDetails.address}
                        disabled={isFinalSubmitted}
                        onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">{t.instLabel}</label>
                    <textarea
                      placeholder="..."
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
                {isFinalSubmitted ? (lang === 'TH' ? 'ส่งแล้ว' : 'Submitted') : t.saveInst}
              </button>
            </section>
          </div>
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-blue-400" /></div><h3 className="text-lg font-bold">{t.companyInfo}</h3></div>
                <div className="space-y-6">
                  <div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{t.officialName}</p><p className="text-xs font-bold">vannessplus</p></div>
                  <div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{t.taxId}</p><p className="text-xs font-bold">0123456789012</p></div><div><p className="text-[9px] font-black text-slate-500 uppercase mb-1.5">{t.deptName}</p><p className="text-xs font-bold">Product Design</p></div></div>
                </div>
              </div>
            </section>
            <section className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6"><div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><ClipboardCheck size={18} /></div><h3 className="text-base font-bold text-slate-900">{t.finalTasks}</h3></div>
              <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3"><Info size={16} className="text-blue-500 shrink-0 mt-0.5" /><p className="text-[10px] text-slate-500 font-medium leading-relaxed">{t.importantNote}</p></div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluationPage;

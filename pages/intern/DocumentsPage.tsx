import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileText, Plus, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { Language } from '@/types';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseStorage } from '@/firebase';

type UserDocument = {
  label: string;
  fileName?: string;
  storagePath?: string;
  url?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ProcessType = 'DOC_UPLOAD' | 'NDA_SIGN' | 'MODULE_LINK' | 'EXTERNAL_URL';

type ConfigRoadmapStep = {
  id: string;
  title: string;
  active: boolean;
  type: ProcessType;
  targetPage?: string;
  externalUrl?: string;
  attachedDocuments: string[];
};

interface DocumentsPageProps {
  lang: Language;
}

const DocumentsPage: React.FC<DocumentsPageProps> = ({ lang }) => {
  const { user } = useAppContext();
  const [documents, setDocuments] = useState<(UserDocument & { id: string })[]>([]);

  const MAX_DOC_BYTES = 20 * 1024 * 1024;

  const [activeRequiredLabels, setActiveRequiredLabels] = useState<string[]>([]);
  const [allStepLabels, setAllStepLabels] = useState<string[]>([]);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newUrl, setNewUrl] = useState('');

  const fileSlotInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingSlotLabel, setPendingSlotLabel] = useState<string | null>(null);
  const [slotUrlDrafts, setSlotUrlDrafts] = useState<Record<string, string>>({});

  const t = useMemo(
    () =>
      ({
        EN: {
          breadcrumb: 'SETTINGS > DOCUMENTS',
          title: 'Document Vault',
          subtitle: 'Upload, update, download, and manage your internship documents.',
          add: 'Add Document',
          cancel: 'Cancel',
          save: 'Save',
          label: 'Document Name',
          choose: 'Choose File',
          upload: 'Upload',
          replace: 'Replace',
          download: 'Download',
          remove: 'Delete',
          empty: 'No documents yet',
        },
        TH: {
          breadcrumb: 'ตั้งค่า > เอกสาร',
          title: 'คลังเอกสาร',
          subtitle: 'อัปโหลด แก้ไข ดาวน์โหลด และจัดการเอกสารของคุณ',
          add: 'เพิ่มเอกสาร',
          cancel: 'ยกเลิก',
          save: 'บันทึก',
          label: 'ชื่อเอกสาร',
          choose: 'เลือกไฟล์',
          upload: 'อัปโหลด',
          replace: 'แทนที่ไฟล์',
          download: 'ดาวน์โหลด',
          remove: 'ลบ',
          empty: 'ยังไม่มีเอกสาร',
        },
      }[lang]),
    [lang],
  );

  useEffect(() => {
    if (!user) return;
    const colRef = collection(firestoreDb, 'users', user.id, 'documents');
    return onSnapshot(colRef, (snap) => {
      setDocuments(
        snap.docs.map((d) => {
          const data = d.data() as UserDocument;
          return { id: d.id, ...data };
        }),
      );
    });
  }, [user]);

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setActiveRequiredLabels([]);
        setAllStepLabels([]);
        return;
      }
      const data = snap.data() as { onboardingSteps?: ConfigRoadmapStep[] };
      const steps = Array.isArray(data.onboardingSteps) ? data.onboardingSteps : [];
      const ordered = [...steps].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));

      const allLabels = ordered
        .map((s) => (s.title ?? '').trim())
        .filter((v) => v.length > 0);

      const activeLabels = ordered
        .filter((s) => Boolean(s.active))
        .map((s) => (s.title ?? '').trim())
        .filter((v) => v.length > 0);

      setAllStepLabels(allLabels);
      setActiveRequiredLabels(activeLabels);
    });
  }, []);

  const visibleDocuments = useMemo(() => {
    if (allStepLabels.length === 0) return documents;
    const blocked = new Set(allStepLabels);
    return documents.filter((d) => !blocked.has(d.label));
  }, [documents, allStepLabels]);

  const normalizedNewLabel = useMemo(() => newLabel.trim(), [newLabel]);
  const isBlockedNewLabel = useMemo(() => {
    if (!normalizedNewLabel) return false;
    return allStepLabels.includes(normalizedNewLabel);
  }, [allStepLabels, normalizedNewLabel]);

  const upsertDocumentByLabel = async (label: string, file: File) => {
    if (!user) return;
    if (file.size > MAX_DOC_BYTES) {
      setUploadError(
        lang === 'TH'
          ? `ไฟล์ "${file.name}" มีขนาดเกิน 20MB กรุณาแนบลิงก์ (Drive/URL) แทน`
          : `File "${file.name}" exceeds 20MB. Please attach a Drive/URL link instead.`,
      );
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const safeName = file.name;
      const path = `users/${user.id}/documents/${Date.now()}_${safeName}`;
      await uploadBytes(storageRef(firebaseStorage, path), file);

      const existing = documents.find((d) => d.label === label);
      if (!existing) {
        await addDoc(collection(firestoreDb, 'users', user.id, 'documents'), {
          label,
          fileName: safeName,
          storagePath: path,
          url: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies UserDocument);
        return;
      }

      try {
        if (existing.storagePath) {
          await deleteObject(storageRef(firebaseStorage, existing.storagePath));
        }
      } catch {
        // ignore (e.g., missing file or permission)
      }

      await updateDoc(doc(firestoreDb, 'users', user.id, 'documents', existing.id), {
        fileName: safeName,
        storagePath: path,
        url: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('Document upload failed', e);
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const upsertDocumentLinkByLabel = async (label: string, url: string) => {
    if (!user) return;
    const v = url.trim();
    if (!v) return;
    if (!v.startsWith('http://') && !v.startsWith('https://')) {
      setUploadError(lang === 'TH' ? 'กรุณาใส่ลิงก์ที่ขึ้นต้นด้วย http/https' : 'Please enter a URL starting with http/https');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    try {
      const existing = documents.find((d) => d.label === label);
      if (!existing) {
        await addDoc(collection(firestoreDb, 'users', user.id, 'documents'), {
          label,
          fileName: v,
          url: v,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies UserDocument);
        return;
      }

      try {
        if (existing.storagePath) {
          await deleteObject(storageRef(firebaseStorage, existing.storagePath));
        }
      } catch {
        // ignore
      }

      await updateDoc(doc(firestoreDb, 'users', user.id, 'documents', existing.id), {
        fileName: v,
        url: v,
        storagePath: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('Document link save failed', e);
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Save failed'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddDocument = async () => {
    const label = normalizedNewLabel;
    if (!label) return;
    const linkValue = newUrl.trim();
    if (!newFile && !linkValue) return;
    if (isBlockedNewLabel) {
      setUploadError(lang === 'TH' ? 'ไม่สามารถเพิ่มเอกสารที่ถูกควบคุมโดยแอดมินได้' : 'This document name is controlled by admin.' );
      return;
    }
    if (newFile) {
      await upsertDocumentByLabel(label, newFile);
    } else {
      await upsertDocumentLinkByLabel(label, linkValue);
    }
    setIsAdding(false);
    setNewFile(null);
    setNewLabel('');
    setNewUrl('');
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user) return;
    const item = documents.find((d) => d.id === docId);
    if (!item) return;

    if (!window.confirm(lang === 'TH' ? 'ลบเอกสารนี้หรือไม่?' : 'Delete this document?')) return;

    if (item.storagePath) {
      await deleteObject(storageRef(firebaseStorage, item.storagePath));
    }
    await deleteDoc(doc(firestoreDb, 'users', user.id, 'documents', docId));
  };

  const handleDownloadDocument = async (docId: string) => {
    const item = documents.find((d) => d.id === docId);
    if (!item) return;
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!item.storagePath) return;
    const url = await getDownloadURL(storageRef(firebaseStorage, item.storagePath));
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleUploadForSlot = (label: string) => {
    setPendingSlotLabel(label);
    fileSlotInputRef.current?.click();
  };

  const handleSlotFileSelected = async (file: File | null) => {
    if (!pendingSlotLabel || !file) return;
    await upsertDocumentByLabel(pendingSlotLabel, file);
    setPendingSlotLabel(null);
    if (fileSlotInputRef.current) fileSlotInputRef.current.value = '';
  };

  const handleSlotSaveLink = async (label: string) => {
    const v = (slotUrlDrafts[label] ?? '').trim();
    if (!v) return;
    await upsertDocumentLinkByLabel(label, v);
    setSlotUrlDrafts((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  };

  if (!user) return null;

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-10 bg-[#F8FAFC]">
      <input
        ref={fileSlotInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleSlotFileSelected(e.target.files?.[0] ?? null)}
      />

      {uploadError && (
        <div className="mb-6 mx-2 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
          {uploadError}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 px-2">
        <div className="animate-in fade-in slide-in-from-left-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.35em] mb-2">{t.breadcrumb}</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{t.title}</h1>
          <p className="text-slate-400 text-sm font-medium mt-3">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
            <ShieldCheck size={16} /> SECURE
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className={`px-8 py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 ${
              isUploading ? 'bg-slate-300 text-white cursor-not-allowed shadow-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
            }`}
            disabled={isUploading}
          >
            <Plus size={18} strokeWidth={2.5} /> {t.add}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="max-w-[1200px] mx-auto">
          {activeRequiredLabels.length > 0 && (
            <div className="mb-6 bg-white border border-slate-100 rounded-[1.75rem] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    {lang === 'EN' ? 'REQUIRED DOCUMENTS' : 'เอกสารที่ต้องแนบ'}
                  </div>
                  <div className="text-sm font-black text-slate-900 mt-2">
                    {lang === 'EN'
                      ? 'These document slots are controlled by Admin Onboarding Flow Engine.'
                      : 'ช่องเอกสารเหล่านี้ถูกควบคุมโดยแอดมินใน Onboarding Flow Engine'}
                  </div>
                </div>
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                  {activeRequiredLabels.length} {lang === 'EN' ? 'ITEMS' : 'รายการ'}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeRequiredLabels.map((label) => {
                  const item = documents.find((d) => d.label === label) ?? null;
                  const isUploaded = Boolean(item);
                  const fileName = item?.fileName;

                  return (
                    <div
                      key={label}
                      className="p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                          <FileText size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                            {lang === 'EN' ? 'REQUIRED' : 'จำเป็น'}
                          </p>
                          <p className="text-[12px] font-black truncate text-slate-800" title={label}>
                            {label}
                          </p>
                          <div className="text-[11px] font-bold text-slate-500">
                            {lang === 'TH'
                              ? 'ขนาดไฟล์สูงสุด 20MB (ถ้าเกินให้แนบลิงก์แทน)'
                              : 'Max 20MB file size (if larger, attach a link instead).'}
                          </div>
                          {isUploaded ? (
                            <button
                              onClick={() => void handleDownloadDocument(item!.id)}
                              className="text-[11px] font-black truncate text-blue-600 hover:underline text-left"
                              title={t.download}
                            >
                              {fileName}
                            </button>
                          ) : (
                            <p className="text-[12px] font-black truncate text-slate-400">Not Uploaded</p>
                          )}

                          <div className="mt-3 flex items-center gap-2">
                            <input
                              value={slotUrlDrafts[label] ?? ''}
                              onChange={(e) =>
                                setSlotUrlDrafts((prev) => ({
                                  ...prev,
                                  [label]: e.target.value,
                                }))
                              }
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5"
                              placeholder={
                                lang === 'TH'
                                  ? 'แนบลิงก์ Drive/URL (http/https)'
                                  : 'Attach Drive/URL link (http/https)'
                              }
                            />
                            <button
                              type="button"
                              onClick={() => void handleSlotSaveLink(label)}
                              disabled={!((slotUrlDrafts[label] ?? '').trim()) || isUploading}
                              className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={lang === 'TH' ? 'บันทึกลิงก์' : 'Save link'}
                            >
                              <ExternalLink size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isUploaded ? (
                          <>
                            <button
                              onClick={() => handleUploadForSlot(label)}
                              className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                              title={t.replace}
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              onClick={() => void handleDeleteDocument(item!.id)}
                              className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"
                              title={t.remove}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUploadForSlot(label)}
                            className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                            title={t.upload}
                          >
                            <Upload size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-[1.75rem] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                  {lang === 'EN' ? 'OTHER DOCUMENTS' : 'เอกสารอื่น ๆ'}
                </div>
                <div className="text-sm font-black text-slate-900 mt-2">
                  {lang === 'EN'
                    ? 'These are documents you added yourself (not controlled by admin).'
                    : 'เอกสารที่คุณเพิ่มเอง (ไม่ถูกควบคุมโดยแอดมิน)'}
                </div>
              </div>
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {visibleDocuments.length} {lang === 'EN' ? 'FILES' : 'ไฟล์'}
              </div>
            </div>

            {visibleDocuments.length === 0 ? (
              <div className="pt-6 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t.empty}</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {visibleDocuments.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 bg-slate-50 border border-slate-100 rounded-[1.25rem] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                        <FileText size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                          {d.label}
                        </p>
                        <button
                          onClick={() => void handleDownloadDocument(d.id)}
                          className="text-[12px] font-black truncate text-slate-800 hover:underline text-left"
                          title={t.download}
                        >
                          {d.fileName}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUploadForSlot(d.label)}
                        className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                        title={t.replace}
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => void handleDeleteDocument(d.id)}
                        className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"
                        title={t.remove}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAdding && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setIsAdding(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.add}</h3>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8">
                <label className="space-y-2 block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.label}</div>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    placeholder={lang === 'EN' ? 'Enter document name' : 'กรอกชื่อเอกสาร'}
                  />
                </label>

                <div className="mt-4">
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (!f) {
                        setNewFile(null);
                        return;
                      }
                      if (f.size > MAX_DOC_BYTES) {
                        window.alert(
                          lang === 'TH'
                            ? `ไฟล์ "${f.name}" มีขนาดเกิน 20MB กรุณาแนบลิงก์ (Drive/URL) แทน`
                            : `File "${f.name}" exceeds 20MB. Please attach a Drive/URL link instead.`,
                        );
                        setNewFile(null);
                        return;
                      }
                      setNewUrl('');
                      setNewFile(f);
                    }}
                    className="block w-full text-sm"
                  />
                </div>

                <div className="mt-2 text-[11px] font-bold text-slate-500">
                  {lang === 'TH'
                    ? 'ขนาดไฟล์สูงสุด 20MB ต่อไฟล์ (ถ้าใหญ่กว่านี้ให้แนบลิงก์ Drive/URL แทน)'
                    : 'Max 20MB per file (if larger, attach a Drive/URL link instead).'}
                </div>

                <div className="mt-6">
                  <label className="space-y-2 block">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'TH' ? 'หรือแนบลิงก์ (Drive/URL)' : 'Or attach link (Drive/URL)'}
                    </div>
                    <input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                      placeholder={lang === 'TH' ? 'วางลิงก์ที่แชร์ได้ (http/https)' : 'Paste a shareable link (http/https)'}
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={() => void handleAddDocument()}
                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                    disabled={!normalizedNewLabel || (!newFile && !newUrl.trim()) || isBlockedNewLabel}
                  >
                    {t.upload}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentsPage;

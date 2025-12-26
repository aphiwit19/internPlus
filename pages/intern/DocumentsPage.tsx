import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, FileText, GraduationCap, Home, Layout, Plus, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { Language } from '@/types';
import { useAppContext } from '@/app/AppContext';
import { firestoreDb, firebaseStorage } from '@/firebase';

type UserDocument = {
  label: string;
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

interface DocumentsPageProps {
  lang: Language;
}

const DocumentsPage: React.FC<DocumentsPageProps> = ({ lang }) => {
  const { user } = useAppContext();
  const [documents, setDocuments] = useState<(UserDocument & { id: string })[]>([]);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('NATIONAL ID / PASSPORT');
  const [newFile, setNewFile] = useState<File | null>(null);

  const fileSlotInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingSlotLabel, setPendingSlotLabel] = useState<string | null>(null);

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

  const slots = useMemo(
    () =>
      [
        { label: 'NATIONAL ID / PASSPORT', icon: <CreditCard size={18} /> },
        { label: 'RESUME / CV', icon: <FileText size={18} /> },
        { label: 'ACADEMIC TRANSCRIPT', icon: <GraduationCap size={18} /> },
        { label: 'CERTIFICATE', icon: <FileText size={18} /> },
        { label: 'HOUSE REGISTRATION', icon: <Home size={18} /> },
        { label: 'BANKBOOK COVER', icon: <Layout size={18} /> },
        { label: 'OTHER', icon: <Plus size={18} /> },
      ],
    [],
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

  const upsertDocumentByLabel = async (label: string, file: File) => {
    if (!user) return;
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies UserDocument);
        return;
      }

      try {
        await deleteObject(storageRef(firebaseStorage, existing.storagePath));
      } catch {
        // ignore (e.g., missing file or permission)
      }

      await updateDoc(doc(firestoreDb, 'users', user.id, 'documents', existing.id), {
        fileName: safeName,
        storagePath: path,
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

  const handleAddDocument = async () => {
    if (!newLabel.trim() || !newFile) return;
    await upsertDocumentByLabel(newLabel.trim(), newFile);
    setIsAdding(false);
    setNewFile(null);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user) return;
    const item = documents.find((d) => d.id === docId);
    if (!item) return;

    if (!window.confirm(lang === 'TH' ? 'ลบเอกสารนี้หรือไม่?' : 'Delete this document?')) return;

    await deleteObject(storageRef(firebaseStorage, item.storagePath));
    await deleteDoc(doc(firestoreDb, 'users', user.id, 'documents', docId));
  };

  const handleDownloadDocument = async (docId: string) => {
    const item = documents.find((d) => d.id === docId);
    if (!item) return;
    const url = await getDownloadURL(storageRef(firebaseStorage, item.storagePath));
    window.open(url, '_blank');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {slots.map((slot) => {
              const item = documents.find((d) => d.label === slot.label) ?? null;
              const isUploaded = Boolean(item);
              const fileName = item?.fileName;

              return (
                <div
                  key={slot.label}
                  className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all relative overflow-hidden"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-colors">
                      {slot.icon}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{slot.label}</p>
                      {isUploaded ? (
                        <button
                          onClick={() => void handleDownloadDocument(item!.id)}
                          className="text-[12px] font-black truncate text-slate-800 hover:underline text-left"
                          title={t.download}
                        >
                          {fileName}
                        </button>
                      ) : (
                        <p className="text-[12px] font-black truncate text-slate-400">Not Uploaded</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isUploaded ? (
                      <>
                        <button
                          onClick={() => handleUploadForSlot(slot.label)}
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
                        onClick={() => handleUploadForSlot(slot.label)}
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

          {documents.length === 0 && (
            <div className="pt-10 text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t.empty}</p>
            </div>
          )}
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
                  <select
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                  >
                    {slots.map((s) => (
                      <option key={s.label} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-4">
                  <input
                    type="file"
                    onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm"
                  />
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
                    disabled={!newLabel.trim() || !newFile}
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

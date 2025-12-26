import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Plus, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';

type UserDocument = {
  label: string;
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DocumentsTab: React.FC<{ internId: string }> = ({ internId }) => {
  const [documents, setDocuments] = useState<(UserDocument & { id: string })[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('NATIONAL ID / PASSPORT');
  const [newFile, setNewFile] = useState<File | null>(null);

  const fileSlotInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingSlotLabel, setPendingSlotLabel] = useState<string | null>(null);

  const slots = useMemo(
    () => [
      { label: 'NATIONAL ID / PASSPORT' },
      { label: 'RESUME / CV' },
      { label: 'ACADEMIC TRANSCRIPT' },
      { label: 'CERTIFICATE' },
      { label: 'HOUSE REGISTRATION' },
      { label: 'BANKBOOK COVER' },
      { label: 'OTHER' },
    ],
    [],
  );

  useEffect(() => {
    const colRef = collection(firestoreDb, 'users', internId, 'documents');
    return onSnapshot(colRef, (snap) => {
      setDocuments(
        snap.docs.map((d) => {
          const data = d.data() as UserDocument;
          return { id: d.id, ...data };
        }),
      );
    });
  }, [internId]);

  const upsertDocumentByLabel = async (label: string, file: File) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      const safeName = file.name;
      const path = `users/${internId}/documents/${Date.now()}_${safeName}`;
      await uploadBytes(storageRef(firebaseStorage, path), file);

      const existing = documents.find((d) => d.label === label);
      if (!existing) {
        await addDoc(collection(firestoreDb, 'users', internId, 'documents'), {
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
        // ignore
      }

      await updateDoc(doc(firestoreDb, 'users', internId, 'documents', existing.id), {
        fileName: safeName,
        storagePath: path,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('Intern document upload failed', e);
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    const item = documents.find((d) => d.id === docId);
    if (!item) return;

    if (!window.confirm('Delete this document?')) return;

    try {
      await deleteObject(storageRef(firebaseStorage, item.storagePath));
    } catch {
      // ignore
    }

    await deleteDoc(doc(firestoreDb, 'users', internId, 'documents', docId));
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

  const handleAddDocument = async () => {
    if (!newLabel.trim() || !newFile) return;
    await upsertDocumentByLabel(newLabel.trim(), newFile);
    setIsAdding(false);
    setNewFile(null);
  };

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-500">
      <input
        ref={fileSlotInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void handleSlotFileSelected(e.target.files?.[0] ?? null)}
      />

      {uploadError && (
        <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
          {uploadError}
        </div>
      )}

      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Document</h3>
            <p className="text-slate-400 text-sm font-medium mt-2">Intern documents for identity and internship records.</p>
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
              <Plus size={18} strokeWidth={2.5} /> ADD DOCUMENT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {slots.map((slot) => {
            const item = documents.find((d) => d.label === slot.label) ?? null;
            const isUploaded = Boolean(item);

            return (
              <div
                key={slot.label}
                className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all"
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{slot.label}</p>
                  {isUploaded ? (
                    <button
                      onClick={() => void handleDownloadDocument(item!.id)}
                      className="text-[12px] font-black truncate text-slate-800 hover:underline text-left"
                      title="Download"
                    >
                      {item!.fileName}
                    </button>
                  ) : (
                    <p className="text-[12px] font-black truncate text-slate-400">Not Uploaded</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isUploaded ? (
                    <>
                      <button
                        onClick={() => handleUploadForSlot(slot.label)}
                        className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                        title="Replace"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        onClick={() => void handleDeleteDocument(item!.id)}
                        className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center border border-rose-100 hover:bg-rose-500 hover:text-white transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUploadForSlot(slot.label)}
                      className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                      title="Upload"
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

      {isAdding && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setIsAdding(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Add Document</h3>
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
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Name</div>
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
                  <input type="file" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleAddDocument()}
                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                    disabled={!newLabel.trim() || !newFile}
                  >
                    Upload
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

export default DocumentsTab;

import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useTranslation } from 'react-i18next';

import { firestoreDb, firebaseStorage } from '@/firebase';

type UserDocument = {
  label: string;
  fileName?: string;
  storagePath?: string;
  url?: string;
  policyTitle?: string;
  acknowledgementText?: string;
  signedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const DocumentsTab: React.FC<{ internId: string }> = ({ internId }) => {
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const isEn = (i18n.language ?? '').toLowerCase().startsWith('en');
  const [documents, setDocuments] = useState<(UserDocument & { id: string })[]>([]);
  const [policyPreviewUrls, setPolicyPreviewUrls] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [linkDraftById, setLinkDraftById] = useState<Record<string, string>>({});
  const [isAttachingById, setIsAttachingById] = useState<Record<string, boolean>>({});

  const triggerDownload = (url: string, fileName?: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    if (fileName) a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const formatDateTime = (value: unknown): string | null => {
    if (!value) return null;
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe?.toDate !== 'function') return null;
    const d = maybe.toDate();
    return d.toLocaleString();
  };

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

  const handleDownloadDocument = async (docId: string) => {
    setDownloadError(null);
    setDownloadNotice(isEn ? 'Preparing download...' : 'กำลังเตรียมดาวน์โหลด...');
    const item = documents.find((d) => d.id === docId);
    if (!item) {
      setDownloadNotice(null);
      return;
    }
    if (item.url) {
      triggerDownload(item.url, item.fileName);
      setDownloadNotice(null);
      return;
    }
    if (!item.storagePath) {
      setDownloadError(isEn ? 'Missing document link/path.' : 'ไม่พบลิงก์/ที่อยู่ไฟล์เอกสาร');
      setDownloadNotice(null);
      return;
    }
    try {
      const url = await getDownloadURL(storageRef(firebaseStorage, item.storagePath));
      triggerDownload(url, item.fileName);
      setDownloadNotice(null);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('[DocumentsTab] getDownloadURL failed', { docId, storagePath: item.storagePath, err: e });
      setDownloadError(`${e?.code ?? 'unknown'}: ${e?.message ?? (isEn ? 'Download failed.' : 'ดาวน์โหลดไม่สำเร็จ')}`);
      setDownloadNotice(null);
    }
  };

  const setAttaching = (docId: string, value: boolean) => {
    setIsAttachingById((prev) => {
      if (prev[docId] === value) return prev;
      return { ...prev, [docId]: value };
    });
  };

  const handleAttachUrl = async (docId: string) => {
    setDownloadError(null);
    const raw = (linkDraftById[docId] ?? '').trim();
    if (!raw) {
      setDownloadError(isEn ? 'Please enter a URL.' : 'กรุณาใส่ลิงก์');
      return;
    }
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      setDownloadError(isEn ? 'URL must start with http(s)://' : 'ลิงก์ต้องขึ้นต้นด้วย http(s)://');
      return;
    }
    setAttaching(docId, true);
    try {
      await updateDoc(doc(firestoreDb, 'users', internId, 'documents', docId), {
        url: raw,
        storagePath: null,
        fileName: raw,
        updatedAt: serverTimestamp(),
      });
      setLinkDraftById((prev) => {
        if (!prev[docId]) return prev;
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDownloadError(`${e?.code ?? 'unknown'}: ${e?.message ?? (isEn ? 'Failed to save link.' : 'บันทึกลิงก์ไม่สำเร็จ')}`);
    } finally {
      setAttaching(docId, false);
    }
  };

  const handleUploadFile = async (docId: string, file: File) => {
    setDownloadError(null);
    setAttaching(docId, true);
    try {
      const safeName = file.name;
      const path = `users/${internId}/documents/${Date.now()}_${safeName}`;
      await uploadBytes(storageRef(firebaseStorage, path), file);
      await updateDoc(doc(firestoreDb, 'users', internId, 'documents', docId), {
        fileName: safeName,
        storagePath: path,
        url: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDownloadError(`${e?.code ?? 'unknown'}: ${e?.message ?? (isEn ? 'Upload failed.' : 'อัปโหลดไม่สำเร็จ')}`);
    } finally {
      setAttaching(docId, false);
    }
  };

  const orderedDocuments = useMemo(() => {
    const arr = [...documents];
    arr.sort((a, b) => {
      const ax = (a.updatedAt ?? a.createdAt ?? '') as unknown as { toMillis?: () => number };
      const bx = (b.updatedAt ?? b.createdAt ?? '') as unknown as { toMillis?: () => number };
      const am = typeof ax?.toMillis === 'function' ? ax.toMillis() : 0;
      const bm = typeof bx?.toMillis === 'function' ? bx.toMillis() : 0;
      return bm - am;
    });
    return arr;
  }, [documents]);

  const isPolicyAcknowledgement = (d: (UserDocument & { id: string })) => {
    if (d.id.startsWith('policyTraining:')) return true;
    if (d.label === 'POLICY ACKNOWLEDGEMENT') return true;
    return false;
  };

  const isWithdrawalEvidence = (d: (UserDocument & { id: string })) => {
    if (d.id.startsWith('withdrawal:')) return true;
    if (d.label === 'WITHDRAWAL SIGNATURE') return true;
    return false;
  };

  const policyAcknowledgements = useMemo(() => {
    return orderedDocuments.filter(isPolicyAcknowledgement);
  }, [orderedDocuments]);

  const withdrawalEvidence = useMemo(() => {
    return orderedDocuments.filter(isWithdrawalEvidence);
  }, [orderedDocuments]);

  const otherDocuments = useMemo(() => {
    return orderedDocuments.filter((d) => !isPolicyAcknowledgement(d) && !isWithdrawalEvidence(d));
  }, [orderedDocuments]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const toFetch = [...policyAcknowledgements, ...withdrawalEvidence].filter((d) => d.storagePath && !policyPreviewUrls[d.id]);
      if (toFetch.length === 0) return;

      const entries = await Promise.all(
        toFetch.map(async (d) => {
          try {
            const url = await getDownloadURL(storageRef(firebaseStorage, d.storagePath!));
            return [d.id, url] as const;
          } catch {
            return [d.id, ''] as const;
          }
        }),
      );

      if (cancelled) return;

      setPolicyPreviewUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of entries) {
          if (!url) continue;
          next[id] = url;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [policyAcknowledgements, withdrawalEvidence, policyPreviewUrls]);

  const renderDocRow = (d: UserDocument & { id: string }, previewUrl?: string) => (
    <div key={d.id} className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all">
      <div className="flex items-center gap-4 overflow-hidden min-w-0">
        {previewUrl ? (
          <button
            type="button"
            onClick={() => void handleDownloadDocument(d.id)}
            className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0"
            title="Preview"
          >
            <img src={previewUrl} alt="Signature" className="w-full h-full object-contain" />
          </button>
        ) : (
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0">
            <FileText size={18} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">{d.label}</p>
          <p className="text-[12px] font-black text-slate-800 truncate">{d.fileName ?? (d.url ? d.url : '-')}</p>
          {!d.url && !d.storagePath && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                {isEn ? 'Missing file link/path' : 'ยังไม่มีลิงก์/พาธไฟล์'}
              </div>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  value={linkDraftById[d.id] ?? ''}
                  onChange={(e) => setLinkDraftById((p) => ({ ...p, [d.id]: e.target.value }))}
                  placeholder={isEn ? 'Paste URL (https://...)' : 'วางลิงก์ (https://...)'}
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => void handleAttachUrl(d.id)}
                  disabled={Boolean(isAttachingById[d.id])}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isAttachingById[d.id] ? (isEn ? 'Saving...' : 'กำลังบันทึก...') : (isEn ? 'Save Link' : 'บันทึกลิงก์')}
                </button>
              </div>
              <div>
                <label className="inline-flex items-center">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.currentTarget.value = '';
                      if (!f) return;
                      void handleUploadFile(d.id, f);
                    }}
                  />
                  <span
                    className={`inline-flex items-center px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      isAttachingById[d.id]
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {isEn ? 'Upload File' : 'อัปโหลดไฟล์'}
                  </span>
                </label>
              </div>
            </div>
          )}
          {(d.policyTitle || d.acknowledgementText) && (
            <p className="text-[11px] font-bold text-slate-500 truncate mt-1">{d.policyTitle ? d.policyTitle : d.acknowledgementText}</p>
          )}
          {d.acknowledgementText && d.policyTitle && (
            <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{d.acknowledgementText}</p>
          )}
          {d.signedAt && <p className="text-[10px] font-bold text-slate-400 truncate mt-1">{tr('supervisor_dashboard.documents.signed_at')}: {formatDateTime(d.signedAt) ?? '-'}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleDownloadDocument(d.id);
        }}
        className={`relative z-10 pointer-events-auto h-10 px-4 rounded-xl border transition-all flex-shrink-0 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
          !d.url && !d.storagePath
            ? 'bg-slate-50 text-slate-300 border-slate-100'
            : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
        }`}
        title={tr('supervisor_dashboard.documents.download')}
      >
        <Download size={16} /> {isEn ? 'Download' : 'ดาวน์โหลด'}
      </button>
    </div>
  );

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('supervisor_dashboard.documents.title')}</h3>
            <p className="text-slate-400 text-sm font-medium mt-2">{tr('supervisor_dashboard.documents.subtitle')}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
              <ShieldCheck size={16} /> {tr('supervisor_dashboard.documents.secure')}
            </div>
          </div>
        </div>

        {downloadNotice && (
          <div className="mb-6 bg-blue-50 border border-blue-100 text-blue-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {downloadNotice}
          </div>
        )}

        {downloadError && (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {downloadError}
          </div>
        )}

        {orderedDocuments.length === 0 ? (
          <div className="pt-10 text-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.no_documents')}</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.policy_acknowledgements')}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{tr('supervisor_dashboard.documents.policy_acknowledgements_subtitle')}</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.documents.items', { count: policyAcknowledgements.length })}</div>
              </div>

              {policyAcknowledgements.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.no_signature_evidence')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {policyAcknowledgements.map((d) => renderDocRow(d, policyPreviewUrls[d.id]))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.withdrawal_evidence')}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{tr('supervisor_dashboard.documents.withdrawal_evidence_subtitle')}</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.documents.items', { count: withdrawalEvidence.length })}</div>
              </div>

              {withdrawalEvidence.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.no_withdrawal_evidence')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawalEvidence.map((d) => renderDocRow(d, policyPreviewUrls[d.id]))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.uploaded_documents')}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{tr('supervisor_dashboard.documents.uploaded_documents_subtitle')}</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.documents.items', { count: otherDocuments.length })}</div>
              </div>

              {otherDocuments.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.documents.no_other_documents')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {otherDocuments.map((d) => renderDocRow(d))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsTab;

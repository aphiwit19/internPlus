import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

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
  const [documents, setDocuments] = useState<(UserDocument & { id: string })[]>([]);
  const [policyPreviewUrls, setPolicyPreviewUrls] = useState<Record<string, string>>({});

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
            const url = await getDownloadURL(storageRef(firebaseStorage, d.storagePath));
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

  const DocumentRow: React.FC<{ d: UserDocument & { id: string }; previewUrl?: string }> = ({ d, previewUrl }) => (
    <div className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all">
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
          {(d.policyTitle || d.acknowledgementText) && (
            <p className="text-[11px] font-bold text-slate-500 truncate mt-1">{d.policyTitle ? d.policyTitle : d.acknowledgementText}</p>
          )}
          {d.acknowledgementText && d.policyTitle && (
            <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">{d.acknowledgementText}</p>
          )}
          {d.signedAt && <p className="text-[10px] font-bold text-slate-400 truncate mt-1">Signed: {formatDateTime(d.signedAt) ?? '-'}</p>}
        </div>
      </div>

      <button
        onClick={() => void handleDownloadDocument(d.id)}
        className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex-shrink-0"
        title={d.url ? 'Open' : 'Download'}
      >
        {d.url ? <ExternalLink size={16} /> : <Download size={16} />}
      </button>
    </div>
  );

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Document</h3>
            <p className="text-slate-400 text-sm font-medium mt-2">All intern documents (always visible for admin/supervisor).</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
              <ShieldCheck size={16} /> SECURE
            </div>
          </div>
        </div>

        {orderedDocuments.length === 0 ? (
          <div className="pt-10 text-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No documents yet</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Signature Evidence</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Policy acknowledgement records signed by the intern.</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{policyAcknowledgements.length} items</div>
              </div>

              {policyAcknowledgements.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No signature evidence yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {policyAcknowledgements.map((d) => (
                    <DocumentRow key={d.id} d={d} previewUrl={policyPreviewUrls[d.id]} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Withdrawal Evidence</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Withdrawal request signature record signed by the intern.</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{withdrawalEvidence.length} items</div>
              </div>

              {withdrawalEvidence.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No withdrawal evidence yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawalEvidence.map((d) => (
                    <DocumentRow key={d.id} d={d} previewUrl={policyPreviewUrls[d.id]} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Intern Documents</p>
                  <p className="text-xs font-bold text-slate-500 mt-1">Other documents uploaded/generated for this intern.</p>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{otherDocuments.length} items</div>
              </div>

              {otherDocuments.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.75rem]">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No other documents</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {otherDocuments.map((d) => (
                    <DocumentRow key={d.id} d={d} />
                  ))}
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

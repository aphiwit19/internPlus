import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

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
    const url = await getDownloadURL(storageRef(firebaseStorage, item.storagePath));
    window.open(url, '_blank');
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
          <div className="space-y-3">
            {orderedDocuments.map((d) => (
              <div
                key={d.id}
                className="p-6 bg-white border border-slate-100 rounded-[1.75rem] flex items-center justify-between group hover:border-blue-200 hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4 overflow-hidden min-w-0">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-colors flex-shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">{d.label}</p>
                    <p className="text-[12px] font-black text-slate-800 truncate">{d.fileName}</p>
                  </div>
                </div>

                <button
                  onClick={() => void handleDownloadDocument(d.id)}
                  className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex-shrink-0"
                  title="Download"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsTab;

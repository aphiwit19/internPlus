import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, ChevronLeft, Clock, Download, FileText, Upload } from 'lucide-react';
import { collection, onSnapshot, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { Language } from '@/types';
import { firestoreDb, firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

type CertificateRequestStatus = 'REQUESTED' | 'ISSUED';

type CertificateRequestType = 'COMPLETION' | 'RECOMMENDATION';

type CertificateRequestDoc = {
  internId: string;
  internName: string;
  internAvatar: string;
  internPosition?: string;
  internDepartment?: string;
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
};

interface AdminCertificatesPageProps {
  lang: Language;
}

const AdminCertificatesPage: React.FC<AdminCertificatesPageProps> = ({ lang }) => {
  const { user } = useAppContext();

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

  const openUpload = (requestId: string) => {
    setPendingUpload({ requestId });
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (file: File | null) => {
    if (!pendingUpload || !file) return;

    const { requestId } = pendingUpload;
    setPendingUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadingId(requestId);
    setUploadError(null);
    try {
      const storagePath = `certificateRequests/${requestId}/${Date.now()}_${file.name}`;
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

  const handleDownload = async (req: CertificateRequestDoc & { id: string }) => {
    if (!req.storagePath) return;
    const url = await getDownloadURL(storageRef(firebaseStorage, req.storagePath));
    window.open(url, '_blank');
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
          internAvatar: r.internAvatar || `https://picsum.photos/seed/${encodeURIComponent(safeInternId)}/100/100`,
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

  const activeIntern = useMemo(() => {
    if (!activeInternId) return null;
    return interns.find((x) => x.internId === activeInternId) ?? null;
  }, [activeInternId, interns]);

  const requestByType = useMemo(() => {
    if (!activeIntern) return new Map<CertificateRequestType, (CertificateRequestDoc & { id: string })>();
    const map = new Map<CertificateRequestType, (CertificateRequestDoc & { id: string })>();
    for (const r of activeIntern.requests) {
      if (!map.has(r.type)) map.set(r.type, r);
    }
    return map;
  }, [activeIntern]);

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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
          <p className="text-slate-500 text-sm mt-1">{t.subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {interns.length === 0 ? (
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
                              {req?.fileName ?? (lang === 'TH' ? 'ยังไม่มีคำขอ' : 'No request yet')}
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
                          <button
                            type="button"
                            onClick={() => openUpload(req.id)}
                            disabled={uploadingId === req.id}
                            className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                          >
                            {uploadingId === req.id ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}
                            {uploadingId === req.id ? t.uploading : t.upload}
                          </button>
                        ) : status === 'ISSUED' && req ? (
                          <button
                            type="button"
                            onClick={() => void handleDownload(req)}
                            disabled={!req.storagePath}
                            className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                            title={t.download}
                          >
                            <Download size={18} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {interns.map((intern) => {
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCertificatesPage;

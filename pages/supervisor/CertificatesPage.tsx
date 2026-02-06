import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Clock, Download, FileText, Upload } from 'lucide-react';
import { collection, onSnapshot, query, serverTimestamp, updateDoc, where, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useTranslation } from 'react-i18next';

import { Language, UserProfile } from '@/types';
import { firestoreDb, firebaseFunctions, firebaseStorage } from '@/firebase';
import { normalizeAvatarUrl } from '@/app/avatar';

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
  attachmentLinks?: string[];
  templateId?: string;
  issuedPngPath?: string;
  issuedPdfPath?: string;
};

type CertificateTemplateDoc = {
  name?: string;
  type?: CertificateRequestType;
  backgroundPath?: string;
  active?: boolean;
  isActive?: boolean;
};

interface SupervisorCertificatesPageProps {
  lang: Language;
  user: UserProfile;
}

const SupervisorCertificatesPage: React.FC<SupervisorCertificatesPageProps> = ({ lang: _lang, user }) => {
  const { t } = useTranslation();
  const lng = _lang === 'TH' ? 'th' : 'en';
  const tr = (key: string, options?: any) => String(t(key, { ...(options ?? {}), lng }));

  const [requests, setRequests] = useState<Array<CertificateRequestDoc & { id: string }>>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<CertificateTemplateDoc & { id: string }>>([]);
  const [selectedTemplateByType, setSelectedTemplateByType] = useState<Record<CertificateRequestType, string>>({
    COMPLETION: '',
    RECOMMENDATION: '',
  });
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [activeInternId, setActiveInternId] = useState<string | null>(null);
  const [internsPage, setInternsPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ requestId: string } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ requestId: string } | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    const q = query(collection(firestoreDb, 'certificateRequests'), where('supervisorId', '==', user.id));

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
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('supervisor_certificates.errors.load_failed')}`);
      },
    );
  }, [user.id]);

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
        setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('supervisor_certificates.errors.load_templates_failed')}`);
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

    if (req.supervisorId !== user.id) {
      alert(tr('supervisor_certificates.errors.missing_supervisor'));
      return;
    }

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
        issuedById: user.id,
        issuedByName: user.name,
        issuedByRole: 'SUPERVISOR',
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('supervisor_certificates.errors.upload_failed')}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveLink = async () => {
    if (!pendingLink) return;
    const requestId = pendingLink.requestId;
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    if (req.supervisorId !== user.id) {
      alert(tr('supervisor_certificates.errors.missing_supervisor'));
      return;
    }

    const url = linkDraft.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      setUploadError(tr('supervisor_certificates.errors.url_must_start_with_http'));
      return;
    }

    setSavingLinkId(requestId);
    setUploadError(null);
    try {
      await updateDoc(doc(firestoreDb, 'certificateRequests', requestId), {
        status: 'ISSUED',
        attachmentLinks: [url],
        issuedAt: serverTimestamp(),
        issuedById: user.id,
        issuedByName: user.name,
        issuedByRole: 'SUPERVISOR',
      });
      setPendingLink(null);
      setLinkDraft('');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('supervisor_certificates.errors.save_link_failed')}`);
    } finally {
      setSavingLinkId(null);
    }
  };

  const handleDownload = async (req: CertificateRequestDoc & { id: string }) => {
    const path = req.issuedPdfPath ?? req.storagePath ?? req.issuedPngPath;
    if (path) {
      const url = await getDownloadURL(storageRef(firebaseStorage, path));
      window.open(url, '_blank');
      return;
    }
    const link = Array.isArray(req.attachmentLinks) ? String(req.attachmentLinks[0] ?? '') : '';
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  const templatesByType = useMemo(() => {
    const byType: Record<CertificateRequestType, Array<CertificateTemplateDoc & { id: string }>> = {
      COMPLETION: [],
      RECOMMENDATION: [],
    };
    for (const tpl of templates) {
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
      byType.COMPLETION.push(tpl);
      byType.RECOMMENDATION.push(tpl);
    }
    return byType;
  }, [templates]);

  const handleGenerate = async (req: CertificateRequestDoc & { id: string }) => {
    if (generatingId) return;
    const templateId = selectedTemplateByType[req.type];
    if (!templateId) {
      setUploadError(tr('supervisor_certificates.errors.select_template_first'));
      return;
    }

    setGeneratingId(req.id);
    setUploadError(null);
    try {
      const fn = httpsCallable(firebaseFunctions, 'generateCertificate');
      await fn({ requestId: req.id, templateId });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setUploadError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('supervisor_certificates.errors.generate_failed')}`);
    } finally {
      setGeneratingId(null);
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
          internName: r.internName || tr('supervisor_certificates.interns.name_fallback'),
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

  const activeIntern = useMemo(() => {
    if (!activeInternId) return null;
    return interns.find((x) => x.internId === activeInternId) ?? null;
  }, [activeInternId, interns]);

  const INTERNS_PAGE_SIZE = 6;

  const internsPageCount = useMemo(() => {
    const count = Math.ceil(interns.length / INTERNS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [interns.length]);

  useEffect(() => {
    setInternsPage((prev) => {
      if (prev < 1) return 1;
      if (prev > internsPageCount) return internsPageCount;
      return prev;
    });
  }, [internsPageCount]);

  useEffect(() => {
    setInternsPage(1);
  }, [interns.length]);

  const pagedInterns = useMemo(() => {
    const start = (internsPage - 1) * INTERNS_PAGE_SIZE;
    return interns.slice(start, start + INTERNS_PAGE_SIZE);
  }, [interns, internsPage]);

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
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{tr('supervisor_certificates.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('supervisor_certificates.subtitle')}</p>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {interns.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_certificates.empty')}</p>
            </div>
          ) : activeIntern ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setActiveInternId(null)}
                className="inline-flex items-center gap-2 text-slate-600 text-sm font-bold hover:text-slate-900"
              >
                <ChevronLeft size={18} />
                {tr('supervisor_certificates.actions.back_to_list')}
              </button>

              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <img src={activeIntern.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                <div>
                  <p className="text-lg font-black text-slate-900">{activeIntern.internName}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {(activeIntern.internPosition ?? tr('supervisor_certificates.interns.position_fallback')) +
                      ' • ' +
                      (activeIntern.internDepartment ?? tr('supervisor_certificates.interns.department_fallback'))}
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
                            <p className="text-sm font-black text-slate-900 truncate">{meta.type === 'COMPLETION' ? tr('supervisor_certificates.types.completion') : tr('supervisor_certificates.types.recommendation')}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                              req?.fileName ??
                                (Array.isArray(req?.attachmentLinks) ? req?.attachmentLinks?.[0] : '') ??
                                tr('supervisor_certificates.labels.no_request_yet')
                            </p>
                          </div>
                        </div>

                        {status === 'REQUESTED' ? (
                          <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                            {tr('supervisor_certificates.statuses.requested')}
                          </div>
                        ) : status === 'ISSUED' ? (
                          <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                            {tr('supervisor_certificates.statuses.issued')}
                          </div>
                        ) : (
                          <div className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 text-[10px] font-black uppercase tracking-widest">
                            {tr('supervisor_certificates.labels.no_request')}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-3">
                        {status === 'REQUESTED' && req ? (
                          <div className="flex items-center gap-3">
                            {meta.type !== 'RECOMMENDATION' ? (
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
                                  <option value="">{tr('supervisor_certificates.placeholders.select_template')}</option>
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
                                  {generatingId === req.id ? tr('supervisor_certificates.actions.generating') : tr('supervisor_certificates.actions.generate')}
                                </button>
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => openUpload(req.id)}
                              disabled={uploadingId === req.id}
                              className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                            >
                              {uploadingId === req.id ? <Clock size={16} className="animate-spin" /> : <Upload size={16} />}
                              {uploadingId === req.id
                                ? tr('supervisor_certificates.actions.uploading')
                                : tr('supervisor_certificates.actions.upload_signed_pdf')}
                            </button>

                            <button
                              type="button"
                              onClick={() => openAttachLink(req.id)}
                              disabled={savingLinkId === req.id}
                              className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50"
                            >
                              {tr('supervisor_certificates.actions.attach_link')}
                            </button>
                          </div>
                        ) : status === 'ISSUED' && req ? (
                          <button
                            type="button"
                            onClick={() => void handleDownload(req)}
                            disabled={!(req.issuedPdfPath ?? req.storagePath ?? req.issuedPngPath) && !(Array.isArray(req.attachmentLinks) && req.attachmentLinks.length > 0)}
                            className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                            title={tr('supervisor_certificates.actions.download')}
                          >
                            <Download size={18} />
                          </button>
                        ) : null}
                      </div>

                      {pendingLink?.requestId === req?.id ? (
                        <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                          <input
                            type="text"
                            value={linkDraft}
                            onChange={(e) => setLinkDraft(e.target.value)}
                            placeholder={tr('supervisor_certificates.placeholders.paste_drive_url')}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveLink()}
                            disabled={savingLinkId === req.id}
                            className="px-5 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingLinkId === req.id
                              ? tr('supervisor_certificates.actions.uploading')
                              : tr('supervisor_certificates.actions.save_link')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingLink(null);
                              setLinkDraft('');
                            }}
                            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                          >
                            {tr('supervisor_appointment_requests.actions.cancel')}
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
                          {(intern.internPosition ?? tr('supervisor_certificates.interns.position_fallback')) +
                            ' • ' +
                            (intern.internDepartment ?? tr('supervisor_certificates.interns.department_fallback'))}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {requestedCount > 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                          {requestedCount} {tr('supervisor_certificates.labels.pending')}
                        </div>
                      ) : null}
                      {issuedCount > 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                          {issuedCount} {tr('supervisor_certificates.labels.issued')}
                        </div>
                      ) : null}
                      {requestedCount === 0 && issuedCount === 0 ? (
                        <div className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 text-[10px] font-black uppercase tracking-widest">
                          {tr('supervisor_certificates.labels.no_request')}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {internsPageCount > 1 && (
                <div className="pt-2 flex justify-center">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInternsPage((p) => Math.max(1, p - 1))}
                      disabled={internsPage <= 1}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {Array.from({ length: internsPageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setInternsPage(p)}
                        className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                          p === internsPage
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setInternsPage((p) => Math.min(internsPageCount, p + 1))}
                      disabled={internsPage >= internsPageCount}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorCertificatesPage;

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Download, FileText, Link as LinkIcon } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { useTranslation } from 'react-i18next';

import { Language, UserProfile } from '@/types';
import { firestoreDb, firebaseStorage } from '@/firebase';

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

interface SupervisorUniversityEvaluationPageProps {
  lang: Language;
  user: UserProfile;
}

const SupervisorUniversityEvaluationPage: React.FC<SupervisorUniversityEvaluationPageProps> = ({ lang: _lang, user }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const [items, setItems] = useState<Array<UniversityEvaluationDoc & { id: string }>>([]);
  const [activeInternId, setActiveInternId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemsPage, setItemsPage] = useState(1);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const LINKS_PAGE_SIZE = 5;
  const FILES_PAGE_SIZE = 5;
  const [linksPage, setLinksPage] = useState(1);
  const [filesPage, setFilesPage] = useState(1);

  useEffect(() => {
    setLoadError(null);
    const q = query(collection(firestoreDb, 'universityEvaluations'), where('supervisorId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as UniversityEvaluationDoc) }))
          .filter((x) => x.submissionStatus === 'SUBMITTED');
        arr.sort((a, b) => (a.internName || '').localeCompare(b.internName || ''));
        setItems(arr);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load'}`);
      },
    );
  }, [user.id]);

  const ITEMS_PAGE_SIZE = 6;

  const itemsPageCount = useMemo(() => {
    const count = Math.ceil(items.length / ITEMS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [items.length]);

  useEffect(() => {
    setItemsPage((prev) => {
      if (prev < 1) return 1;
      if (prev > itemsPageCount) return itemsPageCount;
      return prev;
    });
  }, [itemsPageCount]);

  useEffect(() => {
    setItemsPage(1);
  }, [items.length]);

  const pagedItems = useMemo(() => {
    const start = (itemsPage - 1) * ITEMS_PAGE_SIZE;
    return items.slice(start, start + ITEMS_PAGE_SIZE);
  }, [items, itemsPage]);

  const active = useMemo(() => {
    if (!activeInternId) return null;
    return items.find((x) => x.internId === activeInternId || x.id === activeInternId) ?? null;
  }, [activeInternId, items]);

  const activeLinks = useMemo(() => {
    if (!active) return [] as UniversityEvaluationLink[];
    if (Array.isArray(active.submittedLinks)) return active.submittedLinks;
    if (active.pendingChanges) return [];
    return Array.isArray(active.links) ? active.links : [];
  }, [active]);

  const activeFiles = useMemo(() => {
    if (!active) return [] as UniversityEvaluationFile[];
    if (Array.isArray(active.submittedFiles)) return active.submittedFiles;
    if (active.pendingChanges) return [];
    return Array.isArray(active.files) ? active.files : [];
  }, [active]);

  const linksPageCount = useMemo(() => {
    const count = Math.ceil(activeLinks.length / LINKS_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [LINKS_PAGE_SIZE, activeLinks.length]);

  const filesPageCount = useMemo(() => {
    const count = Math.ceil(activeFiles.length / FILES_PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [FILES_PAGE_SIZE, activeFiles.length]);

  useEffect(() => {
    setLinksPage((prev) => {
      if (prev < 1) return 1;
      if (prev > linksPageCount) return linksPageCount;
      return prev;
    });
  }, [linksPageCount]);

  useEffect(() => {
    setFilesPage((prev) => {
      if (prev < 1) return 1;
      if (prev > filesPageCount) return filesPageCount;
      return prev;
    });
  }, [filesPageCount]);

  useEffect(() => {
    setLinksPage(1);
    setFilesPage(1);
  }, [activeInternId]);

  const displayedLinks = useMemo(() => {
    const start = (linksPage - 1) * LINKS_PAGE_SIZE;
    return activeLinks.slice(start, start + LINKS_PAGE_SIZE);
  }, [LINKS_PAGE_SIZE, activeLinks, linksPage]);

  const displayedFiles = useMemo(() => {
    const start = (filesPage - 1) * FILES_PAGE_SIZE;
    return activeFiles.slice(start, start + FILES_PAGE_SIZE);
  }, [FILES_PAGE_SIZE, activeFiles, filesPage]);

  const activeDeliveryDetails = useMemo(() => {
    if (!active) return null;
    if (active.submittedDeliveryDetails) return active.submittedDeliveryDetails;
    if (active.pendingChanges) return null;
    return active.deliveryDetails ?? null;
  }, [active]);

  const handleDownload = async (f: UniversityEvaluationFile) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, f.storagePath));
    window.open(url, '_blank');
  };

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    if (!active) return;
    if (activeFiles.length === 0) return;

    setIsDownloadingAll(true);
    setDownloadAllError(null);
    try {
      const urls = await Promise.all(activeFiles.map((f) => getDownloadURL(storageRef(firebaseStorage, f.storagePath))));
      urls.forEach((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDownloadAllError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Download failed'}`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        {loadError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {loadError}
          </div>
        ) : null}

        <div className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{tr('supervisor_university_evaluation.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{tr('supervisor_university_evaluation.subtitle')}</p>
          </div>

          {active ? (
            <button
              type="button"
              onClick={() => void handleDownloadAll()}
              disabled={isDownloadingAll || activeFiles.length === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50"
              aria-label="Download all documents"
              title={tr('supervisor_university_evaluation.download_all.title')}
            >
              {isDownloadingAll ? <Clock size={16} className="animate-spin" /> : <Download size={16} />}
              {tr('supervisor_university_evaluation.download_all.button')}
            </button>
          ) : null}
        </div>

        {downloadAllError ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {downloadAllError}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {items.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_university_evaluation.empty')}</p>
            </div>
          ) : active ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setActiveInternId(null)}
                className="inline-flex items-center gap-2 text-slate-600 text-sm font-bold hover:text-slate-900"
              >
                <ChevronLeft size={18} />
                {tr('supervisor_university_evaluation.back')}
              </button>

              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                <img src={active.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-900 truncate">{active.internName}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                    {(active.internPosition ?? tr('supervisor_university_evaluation.interns.position_fallback')) +
                      ' • ' +
                      (active.internDepartment ?? tr('supervisor_university_evaluation.interns.department_fallback'))}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                        <LinkIcon size={18} />
                      </div>
                      <h2 className="text-lg font-black text-slate-900">{tr('supervisor_university_evaluation.links')}</h2>
                    </div>

                    {activeLinks.length === 0 ? (
                      <p className="text-sm text-slate-400 font-bold">{tr('supervisor_university_evaluation.no_links')}</p>
                    ) : (
                      <div className="space-y-3">
                        {displayedLinks.map((l) => (
                          <a
                            key={l.id}
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all"
                          >
                            <p className="text-xs font-black text-slate-900 truncate">{l.label}</p>
                            <p className="text-[11px] font-bold text-slate-400 truncate">{l.url}</p>
                          </a>
                        ))}

                        {linksPageCount > 1 ? (
                          <div className="pt-2 flex justify-center">
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
                      </div>
                    )}
                  </section>

                  <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <FileText size={18} />
                      </div>
                      <h2 className="text-lg font-black text-slate-900">{tr('supervisor_university_evaluation.documents')}</h2>
                    </div>

                    {activeFiles.length === 0 ? (
                      <p className="text-sm text-slate-400 font-bold">{tr('supervisor_university_evaluation.no_files')}</p>
                    ) : (
                      <div className="space-y-3">
                        {displayedFiles.map((f) => (
                          <div
                            key={f.id}
                            className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                                {f.category ?? 'Other'}
                              </p>
                              <p className="text-xs font-black text-slate-900 truncate">{f.label}</p>
                              <p className="text-[11px] font-bold text-slate-400 truncate">{f.fileName}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDownload(f)}
                              className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex-shrink-0"
                              title={tr('supervisor_university_evaluation.download')}
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        ))}

                        {filesPageCount > 1 ? (
                          <div className="pt-2 flex justify-center">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setFilesPage((p) => Math.max(1, p - 1))}
                                disabled={filesPage <= 1}
                                className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                aria-label="Previous page"
                              >
                                <ChevronLeft size={18} />
                              </button>

                              {Array.from({ length: filesPageCount }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setFilesPage(p)}
                                  className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                                    p === filesPage
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                                  }`}
                                  aria-current={p === filesPage ? 'page' : undefined}
                                >
                                  {p}
                                </button>
                              ))}

                              <button
                                type="button"
                                onClick={() => setFilesPage((p) => Math.min(filesPageCount, p + 1))}
                                disabled={filesPage >= filesPageCount}
                                className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                                aria-label="Next page"
                              >
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </section>
                </div>

                <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
                      <FileText size={18} />
                    </div>
                    <h2 className="text-lg font-black text-slate-900">{tr('supervisor_university_evaluation.delivery_details.title')}</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.recipient')}</p>
                      <p className="text-sm font-black text-slate-900">{activeDeliveryDetails?.recipientName ?? '-'}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.department')}</p>
                      <p className="text-sm font-black text-slate-900">{activeDeliveryDetails?.department ?? '-'}</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.method')}</p>
                      <p className="text-sm font-black text-slate-900">{activeDeliveryDetails?.method ?? '-'}</p>
                    </div>

                    {(activeDeliveryDetails?.method ?? '') === 'Email' ? (
                      <div className="p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.recipient_email')}</p>
                        <p className="text-sm font-black text-slate-900">{activeDeliveryDetails?.email ?? '-'}</p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.address')}</p>
                        <p className="text-sm font-black text-slate-900 whitespace-pre-wrap">{activeDeliveryDetails?.address ?? '-'}</p>
                      </div>
                    )}

                    <div className="p-4 rounded-2xl border border-slate-100 md:col-span-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_university_evaluation.delivery_details.instructions')}</p>
                      <p className="text-sm font-black text-slate-900 whitespace-pre-wrap">{activeDeliveryDetails?.instructions ?? '-'}</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pagedItems.map((intern) => (
                <button
                  key={intern.id}
                  type="button"
                  onClick={() => setActiveInternId(intern.internId || intern.id)}
                  className="w-full bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between gap-6 hover:border-blue-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <img src={intern.internAvatar} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-black text-slate-900 truncate">{intern.internName}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                        {(intern.internPosition ?? tr('supervisor_university_evaluation.interns.position_fallback')) +
                          ' • ' +
                          (intern.internDepartment ?? tr('supervisor_university_evaluation.interns.department_fallback'))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {Array.isArray(intern.submittedLinks) && intern.submittedLinks.length > 0 ? (
                      <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                        {tr('supervisor_university_evaluation.interns.links_count', { count: intern.submittedLinks.length } as any)}
                      </div>
                    ) : !intern.pendingChanges && Array.isArray(intern.links) && intern.links.length > 0 ? (
                      <div className="px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-black uppercase tracking-widest">
                        {tr('supervisor_university_evaluation.interns.links_count', { count: intern.links.length } as any)}
                      </div>
                    ) : null}

                    {Array.isArray(intern.submittedFiles) && intern.submittedFiles.length > 0 ? (
                      <div className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase tracking-widest">
                        {tr('supervisor_university_evaluation.interns.files_count', { count: intern.submittedFiles.length } as any)}
                      </div>
                    ) : !intern.pendingChanges && Array.isArray(intern.files) && intern.files.length > 0 ? (
                      <div className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase tracking-widest">
                        {tr('supervisor_university_evaluation.interns.files_count', { count: intern.files.length } as any)}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}

              {itemsPageCount > 1 && (
                <div className="pt-2 flex justify-center">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                      disabled={itemsPage <= 1}
                      className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {Array.from({ length: itemsPageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setItemsPage(p)}
                        className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                          p === itemsPage
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setItemsPage((p) => Math.min(itemsPageCount, p + 1))}
                      disabled={itemsPage >= itemsPageCount}
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

export default SupervisorUniversityEvaluationPage;

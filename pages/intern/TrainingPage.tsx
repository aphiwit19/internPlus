import React, { useEffect, useMemo, useState } from 'react';
import { 
  FileText, 
  Download, 
  ChevronRight, 
  Video,
  X,
  ShieldCheck,
  CheckCircle2,
  PenTool,
  ArrowRight,
  Eraser,
  ExternalLink
} from 'lucide-react';
import { Language } from '@/types';
import { PageId } from '@/pageTypes';
import { firestoreDb } from '@/firebase';
import { firebaseStorage } from '@/firebase';
import { useAppContext } from '@/app/AppContext';
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useTranslation } from 'react-i18next';

interface TrainingItem {
  id: string;
  title: string;
  meta: string;
  type: 'pdf' | 'video';
  content: string;
  isSignable: boolean;
  videoMode?: VideoMode;
  videoUrl?: string;
  videoStoragePath?: string;
  videoFileName?: string;
}

type VideoMode = 'NONE' | 'LINK' | 'UPLOAD';

type PolicyTrainingContent = {
  title: string;
  body?: string;
  published: boolean;
  videoMode: VideoMode;
  videoUrl?: string;
  videoStoragePath?: string;
  videoFileName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PolicyAsset = {
  type: 'FILE' | 'IMAGE' | 'PDF' | 'VIDEO';
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
};

interface TrainingPageProps {
  onNavigate: (id: PageId) => void;
  lang: Language;
}

const TrainingPage: React.FC<TrainingPageProps> = ({ onNavigate, lang: _lang }) => {
  const { user } = useAppContext();
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);

  useEffect(() => {
    const colRef = collection(firestoreDb, 'policyTrainingContents');
    return onSnapshot(colRef, (snap) => {
      const next: TrainingItem[] = snap.docs
        .map((d) => {
          const data = d.data() as PolicyTrainingContent;
          const videoMode = (data.videoMode ?? 'NONE') as VideoMode;
          const type: TrainingItem['type'] = videoMode === 'NONE' ? 'pdf' : 'video';
          const meta = type === 'video' ? tr('intern_training.meta.video') : tr('intern_training.meta.document');
          return {
            id: d.id,
            title: data.title ?? tr('intern_training.untitled'),
            meta,
            type,
            content: data.body ?? '',
            isSignable: true,
            videoMode,
            videoUrl: data.videoUrl,
            videoStoragePath: data.videoStoragePath,
            videoFileName: data.videoFileName,
            published: Boolean(data.published),
          } as TrainingItem & { published: boolean };
        })
        .filter((x) => Boolean((x as TrainingItem & { published: boolean }).published))
        .map(({ published, ...rest }) => rest);

      setTrainingItems(next);
    });
  }, [i18n.language]);

  const [selectedItem, setSelectedItem] = useState<TrainingItem | null>(null);
  const [signedDocs, setSignedDocs] = useState<Set<string>>(new Set());
  const [signingStep, setSigningStep] = useState<'reading' | 'signing' | 'completed'>('reading');
  const [isAckChecked, setIsAckChecked] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null);

  const [assetCountByTopicId, setAssetCountByTopicId] = useState<Record<string, number>>({});
  const [isLoadingAssetCounts, setIsLoadingAssetCounts] = useState(false);

  const [selectedAssets, setSelectedAssets] = useState<Array<PolicyAsset & { id: string }>>([]);
  const [isLoadingSelectedAssets, setIsLoadingSelectedAssets] = useState(false);

  const handleOpenDoc = (item: TrainingItem) => {
    setSelectedItem(item);
    setSigningStep('reading');
    setIsAckChecked(false);
    setHasSigned(false);
    setSignError(null);
    setSelectedAssets([]);

    setIsLoadingSelectedAssets(true);
    void (async () => {
      try {
        const snap = await getDocs(collection(firestoreDb, 'policyTrainingContents', item.id, 'assets'));
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PolicyAsset) }));
        setSelectedAssets(next);
      } finally {
        setIsLoadingSelectedAssets(false);
      }
    })();
  };

  useEffect(() => {
    if (trainingItems.length === 0) {
      setAssetCountByTopicId({});
      return;
    }

    let alive = true;
    setIsLoadingAssetCounts(true);
    void (async () => {
      try {
        const entries = await Promise.all(
          trainingItems.map(async (it) => {
            try {
              const snap = await getDocs(collection(firestoreDb, 'policyTrainingContents', it.id, 'assets'));
              return [it.id, snap.size] as const;
            } catch {
              return [it.id, 0] as const;
            }
          }),
        );
        if (!alive) return;
        const next: Record<string, number> = {};
        for (const [id, count] of entries) next[id] = count;
        setAssetCountByTopicId(next);
      } finally {
        if (alive) setIsLoadingAssetCounts(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [trainingItems]);

  const triggerDownload = (url: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadTopic = async (item: TrainingItem) => {
    setDownloadAllError(null);
    setIsDownloadingAll(true);
    try {
      const urlsToDownload: Array<{ url: string; filename?: string }> = [];
      const urlsToOpen: string[] = [];

      if (item.videoMode === 'LINK' && item.videoUrl) {
        urlsToOpen.push(item.videoUrl);
      }
      if (item.videoMode === 'UPLOAD' && item.videoStoragePath) {
        const url = await getDownloadURL(storageRef(firebaseStorage, item.videoStoragePath));
        urlsToDownload.push({ url, filename: item.videoFileName ?? `${item.title}.mp4` });
      }

      const assetsSnap = await getDocs(collection(firestoreDb, 'policyTrainingContents', item.id, 'assets'));
      for (const d of assetsSnap.docs) {
        const a = d.data() as PolicyAsset;
        if (!a?.storagePath) continue;
        const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
        urlsToDownload.push({ url, filename: a.fileName });
      }

      for (const entry of urlsToDownload) {
        triggerDownload(entry.url, entry.filename);
      }
      for (const u of urlsToOpen) {
        window.open(u, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDownloadAllError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_training.errors.download_failed')}`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadAllError(null);
    if (trainingItems.length === 0) return;

    setIsDownloadingAll(true);
    try {
      const urlsToDownload: Array<{ url: string; filename?: string }> = [];
      const urlsToOpen: string[] = [];

      for (const it of trainingItems) {
        if (it.videoMode === 'LINK' && it.videoUrl) {
          urlsToOpen.push(it.videoUrl);
        }
        if (it.videoMode === 'UPLOAD' && it.videoStoragePath) {
          const url = await getDownloadURL(storageRef(firebaseStorage, it.videoStoragePath));
          urlsToDownload.push({ url, filename: it.videoFileName ?? `${it.title}.mp4` });
        }

        const assetsSnap = await getDocs(collection(firestoreDb, 'policyTrainingContents', it.id, 'assets'));
        for (const d of assetsSnap.docs) {
          const a = d.data() as PolicyAsset;
          if (!a?.storagePath) continue;
          const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
          urlsToDownload.push({ url, filename: a.fileName });
        }
      }

      for (const entry of urlsToDownload) {
        triggerDownload(entry.url, entry.filename);
      }

      for (const u of urlsToOpen) {
        window.open(u, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setDownloadAllError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_training.errors.download_failed')}`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const openVideo = async (item: TrainingItem) => {
    if (item.videoMode === 'LINK' && item.videoUrl) {
      window.open(item.videoUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.videoMode === 'UPLOAD' && item.videoStoragePath) {
      const url = await getDownloadURL(storageRef(firebaseStorage, item.videoStoragePath));
      window.open(url, '_blank');
    }
  };

  const openAsset = async (asset: PolicyAsset & { id: string }) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, asset.storagePath));
    triggerDownload(url, asset.fileName);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSigned) setHasSigned(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSigned(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (trainingItems.length === 0) {
      setSignedDocs(new Set());
      return;
    }
    let alive = true;
    void (async () => {
      const signed = new Set<string>();
      for (const it of trainingItems) {
        try {
          const ackRef = doc(firestoreDb, 'policyTrainingContents', it.id, 'acknowledgements', user.id);
          const snap = await getDoc(ackRef);
          if (snap.exists()) signed.add(it.id);
        } catch {
          // ignore
        }
      }
      if (!alive) return;
      setSignedDocs(signed);
    })();
    return () => {
      alive = false;
    };
  }, [trainingItems, user]);

  const handleSign = async () => {
    if (!user || !selectedItem) return;
    setSignError(null);
    if (!isAckChecked) {
      setSignError(tr('intern_training.errors.ack_required'));
      return;
    }
    if (!hasSigned || !canvasRef.current) {
      setSignError(tr('intern_training.errors.signature_required'));
      return;
    }
    const canvas = canvasRef.current;
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    if (!blob) {
      setSignError(tr('intern_training.errors.signature_create_failed'));
      return;
    }
    const path = `policyTrainingContents/${selectedItem.id}/signatures/${user.id}_${Date.now()}.png`;
    try {
      await uploadBytes(storageRef(firebaseStorage, path), blob);
      await setDoc(
        doc(firestoreDb, 'policyTrainingContents', selectedItem.id, 'acknowledgements', user.id),
        {
          internId: user.id,
          signedAt: serverTimestamp(),
          signaturePath: path,
        },
        { merge: true },
      );

      await setDoc(
        doc(firestoreDb, 'users', user.id, 'documents', `policyTraining:${selectedItem.id}`),
        {
          label: 'POLICY ACKNOWLEDGEMENT',
          fileName: `signature_${selectedItem.id}.png`,
          storagePath: path,
          policyTitle: selectedItem.title,
          acknowledgementText: tr('intern_training.acknowledgement.label'),
          signedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setSignedDocs((prev) => new Set([...prev, selectedItem.id]));
      setSigningStep('completed');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setSignError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_training.errors.save_failed')}`);
    }
  };

  const isCurrentDocSigned = selectedItem && signedDocs.has(selectedItem.id);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-y-auto overscroll-contain relative p-4 md:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{tr('intern_training.title')}</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-2">{tr('intern_training.subtitle')}</p>
          </div>
          <button
            onClick={() => void handleDownloadAll()}
            disabled={isDownloadingAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm w-fit disabled:opacity-60"
          >
            <Download size={14} />
            {isDownloadingAll ? tr('intern_training.downloading') : tr('intern_training.actions.download_all')}
          </button>
        </div>

        {downloadAllError && (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
            {downloadAllError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-20">
          {trainingItems.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleOpenDoc(item)}
              className="group bg-white rounded-3xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col relative"
            >
              {(() => {
                const hasVideo = item.videoMode && item.videoMode !== 'NONE';
                const assetCount = assetCountByTopicId[item.id] ?? 0;
                const hasAssets = assetCount > 0;
                const showDownload = hasVideo || hasAssets;
                if (!showDownload) return null;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDownloadTopic(item);
                    }}
                    disabled={isDownloadingAll || isLoadingAssetCounts}
                    className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-white hover:border-slate-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    title={tr('intern_training.actions.download_topic')}
                  >
                    <Download size={14} />
                    {tr('intern_training.actions.download')}
                  </button>
                );
              })()}

              {signedDocs.has(item.id) && (
                <div className="absolute top-4 right-4 z-10 bg-emerald-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                  <CheckCircle2 size={12} strokeWidth={3} />
                </div>
              )}

              <div className="aspect-[16/9] rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-[0.98] bg-slate-50/80">
                {item.type === 'pdf' ? (
                  <FileText size={40} className="md:size-[48px] text-red-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <Video size={40} className="md:size-[48px] text-blue-400 group-hover:scale-110 transition-transform" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1 overflow-hidden pr-2">
                  <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate text-sm md:text-base">
                    {item.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {item.meta}
                    </p>
                    {item.isSignable && !signedDocs.has(item.id) && (
                      <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter">{tr('intern_training.badges.sign_required')}</span>
                    )}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-blue-500 group-hover:bg-blue-50 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 flex-shrink-0">
                  {selectedItem.type === 'pdf' ? <FileText size={20} /> : <Video size={20} />}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-base md:text-xl font-bold text-slate-900 leading-tight truncate">{selectedItem.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest font-bold">{tr('intern_training.labels.document')}</span>
                     {signedDocs.has(selectedItem.id) && (
                       <span className="flex items-center gap-1 text-[8px] md:text-[9px] text-emerald-600 font-black uppercase bg-emerald-50 px-2 py-0.5 rounded-full">
                         <CheckCircle2 size={10} /> {tr('intern_training.badges.signed')}
                       </span>
                     )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-2 md:p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/30">
              <div className="bg-white p-6 md:p-12 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800 text-sm md:text-base leading-relaxed space-y-6">
                {selectedItem.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para.trim()}</p>
                ))}

                <div className="pt-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{tr('intern_training.sections.attachments')}</div>
                  {isLoadingSelectedAssets ? (
                    <div className="text-xs text-slate-400">{tr('intern_training.loading')}</div>
                  ) : selectedAssets.length === 0 ? (
                    <div className="text-xs text-slate-400">{tr('intern_training.empty_attachments')}</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAssets.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => void openAsset(a)}
                          className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white transition-all flex items-center justify-between gap-4 text-left"
                        >
                          <div className="min-w-0">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{a.type}</div>
                            <div className="text-sm font-bold text-slate-900 truncate">{a.fileName}</div>
                          </div>
                          <ExternalLink size={18} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedItem.videoMode && selectedItem.videoMode !== 'NONE' && (
                  <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('intern_training.meta.video')}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {selectedItem.videoMode === 'LINK' ? (selectedItem.videoUrl ?? '') : (selectedItem.videoFileName ?? '')}
                      </p>
                    </div>
                    <button
                      onClick={() => void openVideo(selectedItem)}
                      className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-[12px] font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                      <ExternalLink size={16} /> {tr('intern_training.actions.open_video')}
                    </button>
                  </div>
                )}

                {selectedItem.isSignable && (
                  <div
                    className={`mt-10 md:mt-16 p-6 md:p-8 rounded-2xl border-2 border-dashed transition-all duration-500 ${
                      signedDocs.has(selectedItem.id)
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    {signedDocs.has(selectedItem.id) ? (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-100">
                          <CheckCircle2 size={24} />
                        </div>
                        <h5 className="italic text-2xl md:text-3xl text-slate-900 mb-1">{user?.name ?? tr('intern_training.signed_fallback')}</h5>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tr('intern_training.labels.signed_digitally')}</p>
                      </div>
                    ) : signingStep === 'signing' ? null : (
                      <div className="flex flex-col items-center text-center">
                        <PenTool size={32} className="text-slate-300 mb-4" />
                        <p className="text-[13px] font-bold text-slate-400 mb-6">{tr('intern_training.labels.signature_required')}</p>
                        <button
                          onClick={() => setSigningStep('signing')}
                          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                          {tr('intern_training.actions.sign_now')} <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {signingStep === 'signing' && !signedDocs.has(selectedItem.id) && (
              <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex flex-col gap-6 flex-shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={18} strokeWidth={2.5} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <input
                        id="confirm-sign"
                        type="checkbox"
                        checked={isAckChecked}
                        onChange={(e) => setIsAckChecked(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label
                        htmlFor="confirm-sign"
                        className="text-[13px] md:text-sm text-slate-600 font-medium cursor-pointer"
                      >
                        {tr('intern_training.acknowledgement.label')}
                      </label>
                    </div>

                    {signError && (
                      <div className="mt-3 text-[12px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                        {signError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={900}
                      height={260}
                      className="w-full h-[160px] md:h-[180px] cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasSigned && (
                      <div className="-mt-[180px] h-[180px] flex flex-col items-center justify-center pointer-events-none opacity-20">
                        <PenTool size={48} className="text-slate-400 mb-4" />
                        <span className="text-sm font-black text-slate-400 uppercase">{tr('intern_training.labels.signature_required')}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={clearSignature}
                    className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-bold hover:bg-white transition-all flex items-center gap-2 w-fit"
                  >
                    <Eraser size={16} /> {tr('intern_training.actions.clear')}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setSigningStep('reading')} className="px-5 py-3 rounded-2xl text-[13px] font-bold text-slate-500 hover:bg-slate-50">{tr('intern_training.actions.back')}</button>
                  <button onClick={handleSign} className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold text-[13px] shadow-xl hover:bg-blue-700 active:scale-95">{tr('intern_training.actions.confirm_sign')}</button>
                </div>
              </div>
            )}
            
            {(signingStep === 'completed' || isCurrentDocSigned) && (
               <div className="p-6 md:p-8 bg-white border-t border-slate-100 flex-shrink-0">
                 <button onClick={() => setSelectedItem(null)} className="w-full sm:w-auto mx-auto block px-12 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl">{tr('intern_training.actions.close')}</button>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingPage;

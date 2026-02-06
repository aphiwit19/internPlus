import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Edit3, Upload, ExternalLink, FileText, Video, X, CheckCircle2 } from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

import { firestoreDb, firebaseStorage } from '@/firebase';
import { Language } from '@/types';

type AssetType = 'FILE' | 'IMAGE' | 'PDF' | 'VIDEO';

type PolicyAsset = {
  id: string;
  type: AssetType;
  fileName: string;
  storagePath: string;
  createdAt?: unknown;
};

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

const guessAssetType = (file: File): AssetType => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'PDF';
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  return 'FILE';
};

const PolicyTrainingManager: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Policy & Training Manager',
          subtitle: 'Create topics, attach documents/media, and publish to interns.',
          add: 'Add Topic',
          edit: 'Edit',
          delete: 'Delete',
          published: 'Published',
          draft: 'Draft',
          details: 'Details',
          save: 'Save',
          cancel: 'Cancel',
          saved: 'Saved.',
          topicTitle: 'Topic Title',
          topicBody: 'Content',
          attachments: 'Attachments',
          addFiles: 'Add Files',
          open: 'Open',
          remove: 'Remove',
          video: 'Video',
          videoNone: 'No Video',
          videoLink: 'YouTube/Vimeo Link',
          videoUpload: 'Upload Video',
          videoUrl: 'Video URL',
          uploadVideo: 'Select Video File',
        },
        TH: {
          title: 'จัดการนโยบายและการฝึกอบรม',
          subtitle: 'สร้างหัวข้อ แนบเอกสาร/สื่อ และเผยแพร่ให้ฝั่งอินเทิร์น',
          add: 'เพิ่มหัวข้อ',
          edit: 'แก้ไข',
          delete: 'ลบ',
          published: 'เผยแพร่',
          draft: 'ฉบับร่าง',
          details: 'รายละเอียด',
          save: 'บันทึก',
          cancel: 'ยกเลิก',
          saved: 'บันทึกแล้ว',
          topicTitle: 'ชื่อหัวข้อ',
          topicBody: 'เนื้อหา',
          attachments: 'ไฟล์แนบ',
          addFiles: 'เพิ่มไฟล์',
          open: 'เปิดดู',
          remove: 'ลบ',
          video: 'วิดีโอ',
          videoNone: 'ไม่มีวิดีโอ',
          videoLink: 'ลิงก์ YouTube/Vimeo',
          videoUpload: 'อัปโหลดวิดีโอ',
          videoUrl: 'ลิงก์วิดีโอ',
          uploadVideo: 'เลือกไฟล์วิดีโอ',
        },
      }[lang]),
    [lang],
  );

  const [items, setItems] = useState<Array<{ id: string } & PolicyTrainingContent>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [published, setPublished] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>('NONE');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [assets, setAssets] = useState<PolicyAsset[]>([]);

  const addFilesInputRef = useRef<HTMLInputElement | null>(null);
  const addVideoInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilesInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const colRef = collection(firestoreDb, 'policyTrainingContents');
    return onSnapshot(colRef, (snap) => {
      const next = snap.docs
        .map((d) => {
          const data = d.data() as PolicyTrainingContent;
          return { id: d.id, ...data };
        })
        .sort((a, b) => {
          const ax = (a.updatedAt ?? a.createdAt ?? '') as unknown as { toMillis?: () => number };
          const bx = (b.updatedAt ?? b.createdAt ?? '') as unknown as { toMillis?: () => number };
          const am = typeof ax?.toMillis === 'function' ? ax.toMillis() : 0;
          const bm = typeof bx?.toMillis === 'function' ? bx.toMillis() : 0;
          return bm - am;
        });
      setItems(next);
      if (!selectedId && next.length > 0) setSelectedId(next[0].id);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setAssets([]);
      return;
    }
    const colRef = collection(firestoreDb, 'policyTrainingContents', selectedId, 'assets');
    return onSnapshot(colRef, (snap) => {
      setAssets(
        snap.docs
          .map((d) => {
            const data = d.data() as Omit<PolicyAsset, 'id'>;
            return { id: d.id, ...data } as PolicyAsset;
          })
          .sort((a, b) => {
            const ax = (a.createdAt ?? '') as unknown as { toMillis?: () => number };
            const bx = (b.createdAt ?? '') as unknown as { toMillis?: () => number };
            const am = typeof ax?.toMillis === 'function' ? ax.toMillis() : 0;
            const bm = typeof bx?.toMillis === 'function' ? bx.toMillis() : 0;
            return bm - am;
          }),
      );
    });
  }, [selectedId]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const resetForm = () => {
    setEditId(null);
    setTitle('');
    setBody('');
    setPublished(false);
    setVideoMode('NONE');
    setVideoUrl('');
    setVideoFile(null);
    setSaveError(null);
    setPendingFiles([]);
  };

  const startCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const startEdit = (it: { id: string } & PolicyTrainingContent) => {
    setEditId(it.id);
    setTitle(it.title ?? '');
    setBody(it.body ?? (it as unknown as { description?: string }).description ?? '');
    setPublished(Boolean(it.published));
    setVideoMode((it.videoMode ?? 'NONE') as VideoMode);
    setVideoUrl(it.videoUrl ?? '');
    setVideoFile(null);
    setSaveError(null);
    setPendingFiles([]);
    setIsEditing(true);
  };

  const saveDisabledReason = useMemo(() => {
    if (busy) return lang === 'TH' ? 'กำลังบันทึก...' : 'Saving...';
    if (!title.trim()) return lang === 'TH' ? 'กรุณากรอกชื่อหัวข้อ' : 'Please enter Topic Title';
    if (videoMode === 'LINK' && !videoUrl.trim()) return lang === 'TH' ? 'กรุณาใส่ลิงก์วิดีโอ' : 'Please enter Video URL';
    if (videoMode === 'UPLOAD') {
      if (!editId && !videoFile) return lang === 'TH' ? 'กรุณาเลือกไฟล์วิดีโอ' : 'Please select a video file';
    }
    return null;
  }, [busy, editId, lang, title, videoFile, videoMode, videoUrl]);

  const isSaveDisabled = Boolean(saveDisabledReason);

  const save = async () => {
    const vTitle = title.trim();
    setSaveError(null);

    if (!vTitle) {
      setSaveError(lang === 'TH' ? 'กรุณากรอกชื่อหัวข้อ' : 'Please enter Topic Title');
      return;
    }
    if (videoMode === 'LINK' && !videoUrl.trim()) {
      setSaveError(lang === 'TH' ? 'กรุณาใส่ลิงก์วิดีโอ' : 'Please enter Video URL');
      return;
    }
    if (videoMode === 'UPLOAD' && !editId && !videoFile) {
      setSaveError(lang === 'TH' ? 'กรุณาเลือกไฟล์วิดีโอ' : 'Please select a video file');
      return;
    }

    setBusy(true);
    try {
      const payload: PolicyTrainingContent = {
        title: vTitle,
        published,
        videoMode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const bodyText = body.trim();
      if (bodyText) payload.body = bodyText;

      if (videoMode === 'LINK') {
        const u = videoUrl.trim();
        if (u) payload.videoUrl = u;
      }

      if (!editId) {
        const created = await addDoc(collection(firestoreDb, 'policyTrainingContents'), payload);
        setSelectedId(created.id);

        if (pendingFiles.length > 0) {
          await uploadAssetsForContent(created.id, pendingFiles);
        }

        if (videoMode === 'UPLOAD' && videoFile) {
          const p = `policyTrainingContents/${created.id}/video/${Date.now()}_${videoFile.name}`;
          await uploadBytes(storageRef(firebaseStorage, p), videoFile);
          await updateDoc(doc(firestoreDb, 'policyTrainingContents', created.id), {
            videoStoragePath: p,
            videoFileName: videoFile.name,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        const ref = doc(firestoreDb, 'policyTrainingContents', editId);
        const updatePayload: Partial<PolicyTrainingContent> = {
          title: vTitle,
          published,
          videoMode,
          updatedAt: serverTimestamp(),
        };

        const bodyText2 = body.trim();
        if (bodyText2) updatePayload.body = bodyText2;
        else updatePayload.body = deleteField() as unknown as undefined;

        if (videoMode === 'LINK') {
          const u = videoUrl.trim();
          if (u) updatePayload.videoUrl = u;
          else updatePayload.videoUrl = deleteField() as unknown as undefined;
        } else {
          updatePayload.videoUrl = deleteField() as unknown as undefined;
        }

        const existing = items.find((x) => x.id === editId) ?? null;
        if (videoMode !== 'UPLOAD') {
          if (existing?.videoStoragePath) {
            try {
              await deleteObject(storageRef(firebaseStorage, existing.videoStoragePath));
            } catch {
              // ignore
            }
          }
          updatePayload.videoStoragePath = deleteField() as unknown as undefined;
          updatePayload.videoFileName = deleteField() as unknown as undefined;
        }

        if (videoMode === 'UPLOAD' && videoFile) {
          if (existing?.videoStoragePath) {
            try {
              await deleteObject(storageRef(firebaseStorage, existing.videoStoragePath));
            } catch {
              // ignore
            }
          }
          const p = `policyTrainingContents/${editId}/video/${Date.now()}_${videoFile.name}`;
          await uploadBytes(storageRef(firebaseStorage, p), videoFile);
          updatePayload.videoStoragePath = p;
          updatePayload.videoFileName = videoFile.name;
          updatePayload.videoUrl = deleteField() as unknown as undefined;
        }

        await updateDoc(ref, updatePayload);
        setSelectedId(editId);

        if (pendingFiles.length > 0) {
          await uploadAssetsForContent(editId, pendingFiles);
        }
      }

      setIsEditing(false);
      resetForm();
      alert(t.saved);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.error('PolicyTrainingManager save failed', e);
      const msg = `${e?.code ?? 'unknown'}: ${e?.message ?? (lang === 'TH' ? 'บันทึกไม่สำเร็จ' : 'Save failed')}`;
      setSaveError(msg);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(lang === 'TH' ? 'ลบหัวข้อนี้หรือไม่?' : 'Delete this topic?')) return;
    const existing = items.find((x) => x.id === id) ?? null;
    setBusy(true);
    try {
      if (existing?.videoStoragePath) {
        try {
          await deleteObject(storageRef(firebaseStorage, existing.videoStoragePath));
        } catch {
          // ignore
        }
      }
      await deleteDoc(doc(firestoreDb, 'policyTrainingContents', id));
      if (selectedId === id) setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  const uploadAssetsForContent = async (contentId: string, files: File[] | FileList | null) => {
    if (!contentId || !files) return;
    const list = Array.isArray(files) ? files : Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      for (const f of list) {
        const p = `policyTrainingContents/${contentId}/assets/${Date.now()}_${f.name}`;
        await uploadBytes(storageRef(firebaseStorage, p), f);
        await addDoc(collection(firestoreDb, 'policyTrainingContents', contentId, 'assets'), {
          type: guessAssetType(f),
          fileName: f.name,
          storagePath: p,
          createdAt: serverTimestamp(),
        } satisfies Omit<PolicyAsset, 'id'>);
      }
    } finally {
      setBusy(false);
      if (addFilesInputRef.current) addFilesInputRef.current.value = '';
    }
  };

  const uploadAssets = async (files: FileList | null) => {
    if (!selectedId) return;
    await uploadAssetsForContent(selectedId, files);
  };

  const openAsset = async (a: PolicyAsset) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
    window.open(url, '_blank');
  };

  const deleteAsset = async (assetId: string) => {
    if (!selectedId) return;
    const item = assets.find((x) => x.id === assetId) ?? null;
    if (!item) return;
    if (!window.confirm(lang === 'TH' ? 'ลบไฟล์นี้หรือไม่?' : 'Delete this file?')) return;

    setBusy(true);
    try {
      try {
        await deleteObject(storageRef(firebaseStorage, item.storagePath));
      } catch {
        // ignore
      }
      await deleteDoc(doc(firestoreDb, 'policyTrainingContents', selectedId, 'assets', assetId));
    } finally {
      setBusy(false);
    }
  };

  const openVideo = async () => {
    if (!selected) return;
    if (selected.videoMode === 'LINK' && selected.videoUrl) {
      window.open(selected.videoUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (selected.videoMode === 'UPLOAD' && selected.videoStoragePath) {
      const url = await getDownloadURL(storageRef(firebaseStorage, selected.videoStoragePath));
      window.open(url, '_blank');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
      <div className="lg:col-span-8">
        <section className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{t.title}</h2>
              <p className="text-slate-400 text-sm font-medium mt-2">{t.subtitle}</p>
            </div>
            <button
              onClick={startCreate}
              className="px-8 py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
              disabled={busy}
            >
              <Plus size={18} strokeWidth={2.5} /> {t.add}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-center">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No topics yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`p-6 rounded-[2rem] border transition-all cursor-pointer ${
                    selectedId === it.id ? 'bg-white border-blue-200 shadow-xl' : 'bg-[#F8FAFC]/80 border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-xl'
                  }`}
                  onClick={() => setSelectedId(it.id)}
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[15px] font-bold tracking-tight text-slate-900 truncate">{it.title}</h4>
                        {it.published ? (
                          <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                            <CheckCircle2 size={10} /> {t.published}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">
                            {t.draft}
                          </span>
                        )}
                      </div>
                      {it.body && <p className="text-slate-500 text-xs mt-2 line-clamp-2">{it.body}</p>}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(it);
                        }}
                        className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
                        title={t.edit}
                        disabled={busy}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(it.id);
                        }}
                        className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        title={t.delete}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="lg:col-span-4">
        <section className="bg-white rounded-[3.5rem] p-10 md:p-12 border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">{t.details}</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] mt-2">POLICY & TRAINING</p>
            </div>
          </div>

          {!selected ? (
            <div className="mt-8 p-6 rounded-[2rem] bg-slate-50 border border-slate-100 text-slate-500 text-sm">
              {lang === 'EN' ? 'Select a topic to view details.' : 'เลือกหัวข้อเพื่อดูรายละเอียด'}
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.topicTitle}</div>
                <div className="text-sm font-black text-slate-900 mt-2">{selected.title}</div>
                {selected.body && <div className="text-xs text-slate-500 mt-2 break-all">{selected.body}</div>}
              </div>

              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.attachments}</div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={() => addFilesInputRef.current?.click()}
                    className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    disabled={!selectedId || busy}
                  >
                    <Upload size={16} /> {t.addFiles}
                  </button>
                </div>

                <input
                  ref={addFilesInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void uploadAssets(e.target.files)}
                />

                {assets.length === 0 ? (
                  <div className="mt-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No files</div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {assets.map((a) => (
                      <div key={a.id} className="p-3 rounded-2xl bg-white border border-slate-100 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{a.type}</div>
                            <div className="text-[12px] font-black text-slate-800 truncate">{a.fileName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => void openAsset(a)}
                            className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
                            title={t.open}
                            disabled={busy}
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            onClick={() => void deleteAsset(a.id)}
                            className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                            title={t.remove}
                            disabled={busy}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{t.video}</div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => void openVideo()}
                    className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    disabled={busy || selected.videoMode === 'NONE'}
                  >
                    <Video size={16} /> {t.open}
                  </button>
                </div>
                <div className="text-xs text-slate-500 mt-3 break-all">
                  {selected.videoMode === 'LINK' && selected.videoUrl ? selected.videoUrl : selected.videoMode === 'UPLOAD' && selected.videoFileName ? selected.videoFileName : (lang === 'EN' ? 'No video' : 'ไม่มีวิดีโอ')}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {isEditing && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setIsEditing(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{editId ? t.edit : t.add}</h3>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                {saveError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
                    {saveError}
                  </div>
                )}

                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.topicTitle}</div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.topicBody}</div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                  />
                </div>

                <div className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.attachments}</div>
                  <input
                    ref={pendingFilesInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const list = Array.from(e.target.files ?? []);
                      setPendingFiles(list);
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => pendingFilesInputRef.current?.click()}
                      className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                      disabled={busy}
                    >
                      <Upload size={16} /> {t.addFiles}
                    </button>
                    {pendingFiles.length > 0 && (
                      <button
                        onClick={() => {
                          setPendingFiles([]);
                          if (pendingFilesInputRef.current) pendingFilesInputRef.current.value = '';
                        }}
                        className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                        disabled={busy}
                      >
                        <X size={16} /> {t.remove}
                      </button>
                    )}
                  </div>
                  {pendingFiles.length === 0 ? (
                    <div className="mt-3 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No files selected</div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {pendingFiles.map((f) => (
                        <div key={f.name} className="p-3 rounded-2xl bg-white border border-slate-100 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{guessAssetType(f)}</div>
                            <div className="text-[12px] font-black text-slate-800 truncate">{f.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.published}</div>
                    <div
                      onClick={() => setPublished((p) => !p)}
                      className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${published ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${published ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>

                  <div className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.video}</div>
                    <select
                      value={videoMode}
                      onChange={(e) => {
                        setVideoMode(e.target.value as VideoMode);
                        setVideoFile(null);
                        setVideoUrl('');
                      }}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none"
                    >
                      <option value="NONE">{t.videoNone}</option>
                      <option value="LINK">{t.videoLink}</option>
                      <option value="UPLOAD">{t.videoUpload}</option>
                    </select>

                    {videoMode === 'LINK' && (
                      <input
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full mt-3 px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none"
                        placeholder={t.videoUrl}
                      />
                    )}

                    {videoMode === 'UPLOAD' && (
                      <>
                        <input
                          ref={addVideoInputRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                        />
                        <button
                          onClick={() => addVideoInputRef.current?.click()}
                          className="w-full mt-3 px-5 py-4 rounded-[1.5rem] bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                          disabled={busy}
                        >
                          <Upload size={16} /> {t.uploadVideo}
                        </button>
                        {videoFile && <div className="text-xs text-slate-500 mt-2 truncate">{videoFile.name}</div>}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      resetForm();
                    }}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                    disabled={busy}
                  >
                    {t.cancel}
                  </button>
                  <div className="flex flex-col items-end">
                    <button
                      onClick={() => void save()}
                      className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 ${
                        isSaveDisabled ? 'bg-slate-300 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      disabled={isSaveDisabled}
                    >
                      {t.save}
                    </button>
                    {saveDisabledReason && (
                      <div className="text-[10px] font-bold text-slate-400 mt-2">{saveDisabledReason}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PolicyTrainingManager;

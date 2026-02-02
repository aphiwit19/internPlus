import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Pencil, Plus, Save, Trash2, Upload, ChevronLeft } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { firestoreDb, firebaseAuth, firebaseFunctions, firebaseStorage } from '@/firebase';
import { Language } from '@/types';

import CertificateTemplateEditor, {
  CertificateTemplateDoc,
  CertificateTemplateLayout,
  CertificateRequestType,
} from './CertificateTemplateEditor';

type Props = {
  lang: Language;
  onBack: () => void;
  initialView?: 'create' | 'list';
};

const DEFAULT_LAYOUT: CertificateTemplateLayout = {
  canvas: { width: 2480, height: 3508 },
  blocks: [],
};

function tryResolveStoragePathFromFirebaseDownloadUrl(url: string): string | null {
  // Supports URLs like:
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?...
  try {
    const parsed = new URL(url);
    const marker = '/o/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    const encodedPath = parsed.pathname.slice(idx + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

export default function CertificateTemplatesManager({ lang, onBack, initialView }: Props) {
  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Certificate Templates',
          subtitle: 'Upload backgrounds and design certificates by drag & drop.',
          create: 'Create Template',
          edit: 'Edit',
          rename: 'Rename',
          saveName: 'Save Name',
          upload: 'Upload Background',
          viewBg: 'View Background',
          deleteBg: 'Remove Background',
          startCreate: 'Start Creating',
          manageExisting: 'Manage Existing Templates',
          back: 'Back',
          empty: 'No templates yet',
          name: 'Name',
          type: 'Type',
        },
        TH: {
          title: 'Template ใบรับรอง',
          subtitle: 'อัปโหลดพื้นหลังและออกแบบด้วยการลากวาง',
          create: 'สร้าง Template',
          edit: 'แก้ไข',
          rename: 'แก้ชื่อ',
          saveName: 'บันทึกชื่อ',
          upload: 'อัปโหลดพื้นหลัง',
          viewBg: 'ดูพื้นหลัง',
          deleteBg: 'ลบพื้นหลัง',
          startCreate: 'เริ่มสร้างเทมเพลท',
          manageExisting: 'จัดการเทมเพลทที่มีอยู่',
          back: 'ย้อนกลับ',
          empty: 'ยังไม่มี Template',
          name: 'ชื่อ',
          type: 'ประเภท',
        },
      }[lang]),
    [lang],
  );

  const [templates, setTemplates] = useState<Array<CertificateTemplateDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [loadingBg, setLoadingBg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingUploadTemplateId, setPendingUploadTemplateId] = useState<string | null>(null);
  const pendingUploadTemplateIdRef = useRef<string | null>(null);
  const localBgPreviewUrlRef = useRef<string | null>(null);
  const pendingBgFileRef = useRef<{ templateId: string; file: File } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string>('');
  const [savingName, setSavingName] = useState(false);
  const [deletingBgId, setDeletingBgId] = useState<string | null>(null);
  const [deletingTplId, setDeletingTplId] = useState<string | null>(null);
  const [confirmDeleteTplId, setConfirmDeleteTplId] = useState<string | null>(null);
  const migratedTemplateIdsRef = useRef<Set<string>>(new Set());
  const [view, setView] = useState<'create' | 'list'>(initialView ?? 'create');
  const openEditorAfterUploadRef = useRef<string | null>(null);

  useEffect(() => {
    const q = query(collection(firestoreDb, 'certificateTemplates'));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CertificateTemplateDoc) }));
        items.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
        setTemplates(items);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load templates'}`);
      },
    );
  }, []);

  const editingTemplate = useMemo(
    () => (editingId ? templates.find((x) => x.id === editingId) ?? null : null),
    [editingId, templates],
  );

  useEffect(() => {
    // Canonicalize to backgroundPath only.
    // If older docs contain backgroundUrl, decode it into a storage path and persist.
    for (const tpl of templates) {
      if (!tpl) continue;
      if (migratedTemplateIdsRef.current.has(tpl.id)) continue;
      if (tpl.backgroundPath) continue;
      if (!tpl.backgroundUrl) continue;

      const resolved = tryResolveStoragePathFromFirebaseDownloadUrl(tpl.backgroundUrl);
      if (!resolved) continue;

      migratedTemplateIdsRef.current.add(tpl.id);
      void updateDoc(doc(firestoreDb, 'certificateTemplates', tpl.id), {
        backgroundPath: resolved,
        backgroundUrl: null,
        updatedAt: serverTimestamp(),
      }).catch(() => {
        migratedTemplateIdsRef.current.delete(tpl.id);
      });
    }
  }, [templates]);

  useEffect(() => {
    const tpl = editingTemplate;
    if (!tpl) {
      if (localBgPreviewUrlRef.current) {
        URL.revokeObjectURL(localBgPreviewUrlRef.current);
        localBgPreviewUrlRef.current = null;
      }
      pendingBgFileRef.current = null;
      setBgUrl(null);
      return;
    }

    if (editingId && pendingBgFileRef.current?.templateId === editingId && localBgPreviewUrlRef.current) {
      return;
    }

    if (tpl.backgroundUrl) {
      const resolved = tryResolveStoragePathFromFirebaseDownloadUrl(tpl.backgroundUrl);
      if (!resolved) {
        setBgUrl(tpl.backgroundUrl);
        return;
      }

      setLoadingBg(true);
      void getDownloadURL(storageRef(firebaseStorage, resolved))
        .then((url) => setBgUrl(url))
        .catch(() => setBgUrl(tpl.backgroundUrl ?? null))
        .finally(() => setLoadingBg(false));
      return;
    }

    const backgroundPath = tpl.backgroundPath as string | undefined;
    const previewPath = (tpl as any).previewPath as string | undefined;
    const candidates = [backgroundPath, previewPath].filter(Boolean) as string[];

    if (candidates.length === 0) {
      setBgUrl(null);
      return;
    }

    setLoadingBg(true);
    void (async () => {
      let lastErr: unknown = null;
      for (const p of candidates) {
        try {
          const url = await getDownloadURL(storageRef(firebaseStorage, p));
          setBgUrl(url);
          return;
        } catch (err: unknown) {
          lastErr = err;
        }
      }

      const e = lastErr as { code?: string; message?: string };
      if (e?.code === 'storage/object-not-found') {
        setError(
          lang === 'TH'
            ? `ไม่พบไฟล์ใน Storage: ${candidates[0] ?? ''} (ไฟล์อาจถูกลบไปแล้ว) กรุณาอัปโหลดพื้นหลังใหม่หรือกดลบพื้นหลังใน Template นี้`
            : `File not found in Storage: ${candidates[0] ?? ''}. Please upload a new background or remove the background from this template.`,
        );
      } else {
        setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load template image'}`);
      }
      setBgUrl(null);
    })().finally(() => setLoadingBg(false));
  }, [editingTemplate]);

  const createTemplate = async () => {
    setError(null);
    try {
      const res = await addDoc(collection(firestoreDb, 'certificateTemplates'), {
        name: 'New Template',
        type: 'COMPLETION' as CertificateRequestType,
        active: true,
        layout: DEFAULT_LAYOUT,
        layoutVersion: 1,
        createdAt: serverTimestamp(),
      } satisfies CertificateTemplateDoc);
      setEditingId(res.id);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Create failed'}`);
    }
  };

  const saveTemplateWithPreview = async (
    templateId: string,
    template: CertificateTemplateDoc & { id: string },
    layout: CertificateTemplateLayout,
    previewPng: Blob | null,
    name: string,
  ) => {
    setError(null);
    try {
      let backgroundPath: string | null | undefined;
      let previewPath: string | null | undefined;

      const pending = pendingBgFileRef.current;
      if (pending && pending.templateId === templateId) {
        const path = `templates/backgrounds/${Date.now()}_${pending.file.name}`;
        await uploadBytes(storageRef(firebaseStorage, path), pending.file);
        backgroundPath = path;
      }

      if (previewPng) {
        const p = `templates/previews/${templateId}/${Date.now()}_preview.png`;
        await uploadBytes(storageRef(firebaseStorage, p), previewPng, { contentType: 'image/png' });
        previewPath = p;
      }

      const nextVersion = (template.layoutVersion ?? 0) + 1;
      const ref = doc(firestoreDb, 'certificateTemplates', templateId);
      await updateDoc(ref, {
        name,
        layout,
        layoutVersion: nextVersion,
        ...(backgroundPath
          ? {
              backgroundPath,
              backgroundUrl: null,
            }
          : {}),
        ...(previewPath
          ? {
              previewPath,
            }
          : {
              previewPath: null,
            }),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseAuth.currentUser?.uid ?? null,
      });

      if (localBgPreviewUrlRef.current) {
        URL.revokeObjectURL(localBgPreviewUrlRef.current);
        localBgPreviewUrlRef.current = null;
      }
      pendingBgFileRef.current = null;
      setBgUrl(null);
      setEditingId(null);
      setView('list');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Save failed'}`);
      throw err;
    }
  };

  const openRename = (tplId: string) => {
    const tpl = templates.find((x) => x.id === tplId);
    setRenamingId(tplId);
    setNameDraft((tpl?.name ?? '').toString());
    setError(null);
  };

  const saveRename = async () => {
    if (!renamingId) return;
    const next = nameDraft.trim();
    if (!next) {
      setError(lang === 'TH' ? 'ชื่อ Template ห้ามว่าง' : 'Template name cannot be empty.');
      return;
    }

    const norm = next.toLowerCase();
    const dup = templates.some((t) => t.id !== renamingId && (t.name ?? '').trim().toLowerCase() === norm);
    if (dup) {
      setError(lang === 'TH' ? 'มี Template ชื่อนี้อยู่แล้ว' : 'A template with this name already exists.');
      return;
    }

    setSavingName(true);
    setError(null);
    try {
      await updateDoc(doc(firestoreDb, 'certificateTemplates', renamingId), {
        name: next,
        updatedAt: serverTimestamp(),
      });
      setRenamingId(null);
      setNameDraft('');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Rename failed'}`);
    } finally {
      setSavingName(false);
    }
  };

  const viewBackground = async (tplId: string) => {
    const tpl = templates.find((x) => x.id === tplId);
    if (!tpl) return;
    setError(null);

    // Open a window synchronously to avoid popup blockers (we'll set URL later)
    const win = window.open('', '_blank');
    try {
      let url: string | null = null;
      if ((tpl as any).previewPath) {
        url = await getDownloadURL(storageRef(firebaseStorage, (tpl as any).previewPath));
      } else if (tpl.backgroundPath) {
        url = await getDownloadURL(storageRef(firebaseStorage, tpl.backgroundPath));
      } else if (tpl.backgroundUrl) {
        const resolved = tryResolveStoragePathFromFirebaseDownloadUrl(tpl.backgroundUrl);
        url = resolved ? await getDownloadURL(storageRef(firebaseStorage, resolved)) : tpl.backgroundUrl;
      }
      if (!url) {
        setError(lang === 'TH' ? 'Template นี้ยังไม่มีพื้นหลัง' : 'This template has no background yet.');
        if (win) win.close();
        return;
      }

      if (win) {
        win.location.href = url;
      } else {
        // Popup blocked: fallback
        window.location.href = url;
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'storage/object-not-found') {
        setError(
          lang === 'TH'
            ? `ไม่พบไฟล์พื้นหลังใน Storage: ${tpl.backgroundPath ?? ''} (ไฟล์อาจถูกลบไปแล้ว) กรุณาอัปโหลดพื้นหลังใหม่`
            : `Background file not found in Storage. Please upload a new background.`,
        );
      } else {
        setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to open background'}`);
      }
      if (win) win.close();
    }
  };

  const openUpload = (templateId: string) => {
    pendingUploadTemplateIdRef.current = templateId;
    setPendingUploadTemplateId(templateId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (file: File | null) => {
    const templateId = pendingUploadTemplateIdRef.current ?? pendingUploadTemplateId;
    pendingUploadTemplateIdRef.current = null;
    setPendingUploadTemplateId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!templateId || !file) return;

    setError(null);
    try {
      if (localBgPreviewUrlRef.current) {
        URL.revokeObjectURL(localBgPreviewUrlRef.current);
        localBgPreviewUrlRef.current = null;
      }

      // Preview only. Commit to Storage/Firestore on Save.
      const previewUrl = URL.createObjectURL(file);
      localBgPreviewUrlRef.current = previewUrl;
      setBgUrl(previewUrl);
      pendingBgFileRef.current = { templateId, file };
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Upload failed'}`);
    }
  };

  const saveTemplate = async (templateId: string, template: CertificateTemplateDoc & { id: string }, layout: CertificateTemplateLayout) => {
    setError(null);
    try {
      let backgroundPath: string | null | undefined;

      const pending = pendingBgFileRef.current;
      if (pending && pending.templateId === templateId) {
        const path = `templates/backgrounds/${Date.now()}_${pending.file.name}`;
        await uploadBytes(storageRef(firebaseStorage, path), pending.file);
        backgroundPath = path;
      }

      const nextVersion = (template.layoutVersion ?? 0) + 1;
      const ref = doc(firestoreDb, 'certificateTemplates', templateId);
      await updateDoc(ref, {
        layout,
        layoutVersion: nextVersion,
        ...(backgroundPath
          ? {
              backgroundPath,
              backgroundUrl: null,
              updatedAt: serverTimestamp(),
              updatedBy: firebaseAuth.currentUser?.uid ?? null,
            }
          : {
              updatedAt: serverTimestamp(),
              updatedBy: firebaseAuth.currentUser?.uid ?? null,
            }),
      });

      if (backgroundPath) {
        // Best-effort: resolve a public URL for later view/background actions.
        // UI will return to list view after save.
        await getDownloadURL(storageRef(firebaseStorage, backgroundPath)).catch(() => null);
      }

      if (localBgPreviewUrlRef.current) {
        URL.revokeObjectURL(localBgPreviewUrlRef.current);
        localBgPreviewUrlRef.current = null;
      }
      pendingBgFileRef.current = null;
      setBgUrl(null);
      setEditingId(null);
      setView('list');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Save failed'}`);
      throw err;
    }
  };

  const deleteBackground = async (tplId: string) => {
    const tpl = templates.find((x) => x.id === tplId);
    if (!tpl) return;
    if (deletingBgId) return;

    setDeletingBgId(tplId);
    setError(null);
    try {
      const fn = httpsCallable(firebaseFunctions, 'deleteTemplateBackground');
      await fn({ templateId: tplId });
      if (editingId === tplId) {
        setBgUrl(null);
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; details?: unknown };
      // eslint-disable-next-line no-console
      console.error('deleteBackground failed', err);
      const details = e?.details ? ` | details: ${JSON.stringify(e.details)}` : '';
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to remove background'}${details}`);
    } finally {
      setDeletingBgId(null);
    }
  };

  const deleteTemplate = async (tplId: string) => {
    if (deletingTplId) return;
    setDeletingTplId(tplId);
    setError(null);
    try {
      const fn = httpsCallable(firebaseFunctions, 'deleteCertificateTemplate');
      await fn({ templateId: tplId });
      if (editingId === tplId) {
        setEditingId(null);
        setBgUrl(null);
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; details?: unknown };
      // eslint-disable-next-line no-console
      console.error('deleteTemplate failed', err);
      const details = e?.details ? ` | details: ${JSON.stringify(e.details)}` : '';
      setError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to delete template'}${details}`);
    } finally {
      setDeletingTplId(null);
    }
  };

  const openDeleteTemplateConfirm = (tplId: string) => {
    setConfirmDeleteTplId(tplId);
  };

  const confirmDeleteTemplate = async () => {
    if (!confirmDeleteTplId) return;
    const id = confirmDeleteTplId;
    setConfirmDeleteTplId(null);
    await deleteTemplate(id);
  };

  if (editingId && !editingTemplate) {
    return (
      <div className="w-full">
        {error ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="inline-flex items-center gap-2 text-slate-600 text-sm font-bold hover:text-slate-900"
          >
            <ChevronLeft size={18} />
            {t.back}
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 text-center">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
            {lang === 'TH' ? 'กำลังโหลดเทมเพลท...' : 'Loading template...'}
          </div>
        </div>
      </div>
    );
  }

  if (editingTemplate && editingId) {
    return (
      <div className="w-full">
        {confirmDeleteTplId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-xl p-6">
              <div className="text-lg font-black text-slate-900">
                {lang === 'TH' ? 'ยืนยันลบ Template' : 'Confirm delete template'}
              </div>
              <div className="mt-2 text-sm text-slate-500 font-semibold">
                {lang === 'TH'
                  ? 'การลบนี้จะลบเอกสาร Template ใน Firestore และลบไฟล์พื้นหลัง (ถ้ามี) (ย้อนกลับไม่ได้)'
                  : 'This will delete the template document in Firestore and remove its background file (if any). This cannot be undone.'}
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTplId(null)}
                  className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
                >
                  {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteTemplate()}
                  className="px-4 py-3 rounded-2xl bg-rose-600 text-white text-xs font-black"
                >
                  {lang === 'TH' ? 'ลบ Template' : 'Delete Template'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="inline-flex items-center gap-2 text-slate-600 text-sm font-bold hover:text-slate-900"
          >
            <ChevronLeft size={18} />
            {t.back}
          </button>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => openUpload(editingId)}
              className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-2"
            >
              <Upload size={16} />
              {t.upload}
            </button>
            <button
              type="button"
              onClick={() => openDeleteTemplateConfirm(editingId)}
              disabled={deletingTplId === editingId}
              className="px-4 py-2 rounded-2xl bg-rose-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {lang === 'TH' ? 'ลบ Template' : 'Delete Template'}
            </button>
          </div>
        </div>

        <CertificateTemplateEditor
          lang={lang}
          templateId={editingId}
          template={editingTemplate}
          backgroundUrl={bgUrl}
          onBack={() => setEditingId(null)}
          onSave={(layout, previewPng, name) => saveTemplateWithPreview(editingId, editingTemplate, layout, previewPng, name)}
        />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="w-full">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-2xl font-black text-slate-900">{t.title}</div>
            <div className="text-sm text-slate-500 font-semibold">{t.subtitle}</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
            >
              {t.back}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
            {error}
          </div>
        ) : null}

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
          <div className="text-lg font-black text-slate-900">
            {lang === 'TH' ? 'สร้างเทมเพลทใหม่' : 'Create a new template'}
          </div>
          <div className="text-sm text-slate-500 font-semibold mt-2">
            {lang === 'TH'
              ? 'เริ่มจากอัปโหลดพื้นหลัง แล้วลากวางข้อความ/ข้อมูลนักศึกษาในหน้าออกแบบ'
              : 'Start by uploading a background, then drag & drop text/fields in the editor.'}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void createTemplate()}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              {t.startCreate}
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
            >
              {t.manageExisting}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {confirmDeleteTplId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] border border-slate-100 shadow-xl p-6">
            <div className="text-lg font-black text-slate-900">
              {lang === 'TH' ? 'ยืนยันลบ Template' : 'Confirm delete template'}
            </div>
            <div className="mt-2 text-sm text-slate-500 font-semibold">
              {lang === 'TH'
                ? 'การลบนี้จะลบเอกสาร Template ใน Firestore และลบไฟล์พื้นหลัง (ถ้ามี) (ย้อนกลับไม่ได้)'
                : 'This will delete the template document in Firestore and remove its background file (if any). This cannot be undone.'}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTplId(null)}
                className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
              >
                {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTemplate()}
                className="px-4 py-3 rounded-2xl bg-rose-600 text-white text-xs font-black"
              >
                {lang === 'TH' ? 'ลบ Template' : 'Delete Template'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-2xl font-black text-slate-900">{t.title}</div>
          <div className="text-sm text-slate-500 font-semibold">{t.subtitle}</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setView('create')}
            className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
          >
            {lang === 'TH' ? 'กลับ' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => void createTemplate()}
            className="px-4 py-2 rounded-2xl bg-blue-600 text-white text-xs font-black flex items-center gap-2"
          >
            <Plus size={16} />
            {t.create}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-[1.5rem] px-6 py-4 text-sm font-bold">
          {error}
        </div>
      ) : null}

      {templates.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{t.empty}</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 px-6 py-4 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <div className="col-span-6">{t.name}</div>
            <div className="col-span-3">{t.type}</div>
            <div className="col-span-3 text-right"> </div>
          </div>

          {templates.map((tpl) => (
            <div key={tpl.id} className="grid grid-cols-12 px-6 py-4 border-b border-slate-50 items-center">
              <div className="col-span-6 min-w-0">
                <div className="text-sm font-black text-slate-900 truncate">{tpl.name ?? tpl.id}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{tpl.id}</div>
              </div>
              <div className="col-span-3">
                <div className="text-xs font-black text-slate-700">{tpl.type ?? '-'}</div>
              </div>
              <div className="col-span-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void viewBackground(tpl.id)}
                  className="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  {t.viewBg}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteTemplateConfirm(tpl.id)}
                  disabled={deletingTplId === tpl.id}
                  className="px-3 py-2 rounded-2xl bg-rose-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {lang === 'TH' ? 'ลบ Template' : 'Delete Template'}
                </button>
                <button
                  type="button"
                  onClick={() => openRename(tpl.id)}
                  className="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black flex items-center gap-2"
                >
                  <Pencil size={14} />
                  {t.rename}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(tpl.id)}
                  className="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-2"
                >
                  <Pencil size={14} />
                  {t.edit}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {renamingId ? (
        <div className="mt-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.saveName}</div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-800"
              placeholder={lang === 'TH' ? 'ชื่อ Template' : 'Template name'}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRenamingId(null);
                  setNameDraft('');
                }}
                className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black"
              >
                {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void saveRename()}
                disabled={savingName}
                className="px-4 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {t.saveName}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

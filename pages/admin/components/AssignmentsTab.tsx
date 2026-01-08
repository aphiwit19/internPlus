import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Layers, CalendarDays, FileText, Trash2, Upload } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import { deleteObject, ref as storageRef, uploadBytes } from 'firebase/storage';

import { firebaseStorage, firestoreDb } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

type AssignmentProjectDoc = {
  title: string;
  description: string;
  status: 'IN PROGRESS' | 'TODO';
  date: string;
  tasks: any[];
  attachments?: Array<{ fileName: string; storagePath: string }>;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  createdById?: string;
};

type AssignmentProject = AssignmentProjectDoc & { id: string };

interface AssignmentsTabProps {
  internId: string;
}

export default function AssignmentsTab({ internId }: AssignmentsTabProps) {
  const { roleSlug, pageId } = useParams<{ roleSlug: string; pageId: string }>();
  const { user, lang } = useAppContext();

  const baseRole = roleSlug ?? 'admin';
  const basePage = pageId ?? 'manage-interns';

  const [projects, setProjects] = useState<AssignmentProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const statusLabel = (status: AssignmentProjectDoc['status']) => {
    if (status === 'IN PROGRESS') return lang === 'TH' ? 'กำลังดำเนินการ' : 'IN PROGRESS';
    return lang === 'TH' ? 'มอบหมายแล้ว' : 'ASSIGNED';
  };

  const statusBadgeClass = (status: AssignmentProjectDoc['status']) => {
    if (status === 'IN PROGRESS') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  };

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [newProjectFiles, setNewProjectFiles] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const colRef = collection(firestoreDb, 'users', internId, 'assignmentProjects');
    setLoadError(null);
    return onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AssignmentProjectDoc) }));
        list.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
        setProjects(list);
      },
      (err) => {
        const e = err as { code?: string; message?: string };
        setLoadError(`${e?.code ?? 'unknown'}: ${e?.message ?? 'Failed to load assignments.'}`);
      },
    );
  }, [internId]);

  const t = useMemo(
    () =>
      ({
        EN: {
          title: 'Assignments',
          subtitle: 'Assign and review intern planning and work logs.',
          createProject: 'New Assignment',
          projectTitle: 'Project Title',
          projectDesc: 'Description',
          cancel: 'Cancel',
          create: 'Create',
          empty: 'No assignments yet',
        },
        TH: {
          title: 'มอบหมายงาน',
          subtitle: 'มอบหมายและตรวจสอบแผนงานของนักศึกษา',
          createProject: 'มอบหมายงานใหม่',
          projectTitle: 'ชื่อโปรเจกต์',
          projectDesc: 'รายละเอียด',
          cancel: 'ยกเลิก',
          create: 'สร้าง',
          empty: 'ยังไม่มีงานที่มอบหมาย',
        },
      }[lang]),
    [lang],
  );

  const handleCreateProject = async () => {
    const title = newProject.title.trim();
    if (!title) return;

    const nowDate = new Date().toISOString().split('T')[0];
    const docRef = await addDoc(collection(firestoreDb, 'users', internId, 'assignmentProjects'), {
      title,
      description: newProject.description.trim(),
      status: 'TODO',
      date: nowDate,
      tasks: [],
      attachments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user?.name ?? 'HR',
      createdById: user?.id ?? null,
    } satisfies AssignmentProjectDoc);

    if (newProjectFiles.length > 0) {
      const uploaded = await Promise.all(
        newProjectFiles.map(async (file) => {
          const name = `${Date.now()}_${file.name}`;
          const path = `users/${internId}/assignmentProjects/${docRef.id}/projectAttachments/${name}`;
          await uploadBytes(storageRef(firebaseStorage, path), file);
          return { fileName: file.name, storagePath: path };
        }),
      );
      await updateDoc(doc(firestoreDb, 'users', internId, 'assignmentProjects', docRef.id), {
        attachments: uploaded,
        updatedAt: serverTimestamp(),
      });
    }

    setIsCreatingProject(false);
    setNewProject({ title: '', description: '' });
    setNewProjectFiles([]);
  };

  const canDeleteProject = (p: AssignmentProject) => {
    if (!user) return false;
    // HR admin can delete any assignment; supervisor can delete only what they created.
    if (user.roles.includes('HR_ADMIN')) return true;
    if (p.createdById && p.createdById === user.id) return true;
    // Backward-compat for old docs (createdById missing)
    if (!p.createdById && p.createdBy && p.createdBy === user.name) return true;
    return false;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canDeleteProject(deleteTarget)) {
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      const attachmentPaths: string[] = [];

      if (Array.isArray(deleteTarget.attachments)) {
        for (const a of deleteTarget.attachments) {
          if (a?.storagePath) attachmentPaths.push(a.storagePath);
        }
      }

      const tasks = Array.isArray(deleteTarget.tasks) ? deleteTarget.tasks : [];
      for (const t of tasks) {
        const atts = Array.isArray(t?.attachments) ? t.attachments : [];
        for (const a of atts) {
          if (typeof a === 'string') continue;
          if (a?.storagePath) attachmentPaths.push(a.storagePath);
        }
      }

      await Promise.all(
        attachmentPaths.map(async (path) => {
          try {
            await deleteObject(storageRef(firebaseStorage, path));
          } catch {
            // ignore missing/permission errors; still attempt to delete the doc
          }
        }),
      );

      await deleteDoc(doc(firestoreDb, 'users', internId, 'assignmentProjects', deleteTarget.id));
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{t.title}</h3>
          <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2">{t.subtitle}</p>
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.25em] mt-3">INTERN: {internId}</p>
        </div>
        <button
          onClick={() => setIsCreatingProject(true)}
          type="button"
          className="flex items-center gap-3 px-8 py-3.5 bg-[#111827] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
        >
          <Plus size={18} strokeWidth={3} /> {t.createProject}
        </button>
      </div>

      <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm">
        {loadError && (
          <div className="mb-6 p-6 bg-rose-50 border border-rose-100 rounded-[2rem]">
            <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Load Error</div>
            <div className="mt-2 text-sm font-bold text-rose-700 break-words">{loadError}</div>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
              <Layers size={26} />
            </div>
            <div className="
              mt-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]"
            >
              {t.empty}
            </div>
            <div className="mt-3 text-sm font-bold text-slate-500">
              {lang === 'TH' ? 'กด “มอบหมายงานใหม่” เพื่อสร้างชิ้นงานให้ intern' : 'Create a new assignment to start tracking intern progress.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((p) => (
              <div key={p.id} className="relative">
                <Link
                  to={`/${baseRole}/${basePage}/assignment/${encodeURIComponent(internId)}/${encodeURIComponent(p.id)}`}
                  className="block text-left p-8 pb-20 rounded-[2.5rem] border border-slate-100 bg-white hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                        <Layers size={20} />
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-900 leading-tight">{p.title}</div>
                        <div className={`mt-3 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border w-fit ${statusBadgeClass(p.status)}`}
                        >
                          {statusLabel(p.status)}
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <CalendarDays size={14} /> {p.date}
                    </div>
                  </div>

                  {p.description ? <div className="mt-6 text-sm text-slate-500 font-medium line-clamp-2">{p.description}</div> : null}
                </Link>

                {canDeleteProject(p) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    className="absolute bottom-6 right-6 w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center"
                    title={lang === 'TH' ? 'ลบชิ้นงาน' : 'Delete assignment'}
                    disabled={isDeleting}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => (isDeleting ? null : setDeleteTarget(null))} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xl font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'ยืนยันการลบ' : 'Confirm delete'}</div>
                <button
                  onClick={() => (isDeleting ? null : setDeleteTarget(null))}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                  disabled={isDeleting}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="text-sm font-bold text-slate-600">
                  {lang === 'TH' ? 'ต้องการลบชิ้นงานนี้ใช่ไหม?' : 'Do you want to delete this assignment?'}
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'ชิ้นงาน' : 'Assignment'}</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{deleteTarget.title}</div>
                  {deleteTarget.description ? <div className="mt-2 text-sm font-bold text-slate-500">{deleteTarget.description}</div> : null}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                    disabled={isDeleting}
                    type="button"
                  >
                    {lang === 'TH' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => void handleConfirmDelete()}
                    className="px-8 py-3 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20"
                    disabled={isDeleting}
                    type="button"
                  >
                    {isDeleting ? (lang === 'TH' ? 'กำลังลบ...' : 'Deleting...') : lang === 'TH' ? 'ลบ' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isCreatingProject && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => setIsCreatingProject(false)} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xl font-black text-slate-900 tracking-tight">{t.createProject}</div>
                <button onClick={() => setIsCreatingProject(false)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <label className="space-y-2 block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.projectTitle}</div>
                  <input
                    value={newProject.title}
                    onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                  />
                </label>
                <label className="space-y-2 block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.projectDesc}</div>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all h-28 resize-none"
                  />
                </label>

                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'TH' ? 'ไฟล์แนบ' : 'Attachments'}</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      id="new-assignment-files"
                      onChange={(e) => {
                        const files = e.target.files ? Array.from(e.target.files) : [];
                        setNewProjectFiles(files);
                      }}
                    />
                    <label
                      htmlFor="new-assignment-files"
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <Upload size={16} /> {lang === 'TH' ? 'เลือกไฟล์' : 'Choose files'}
                    </label>
                    {newProjectFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewProjectFiles([])}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                      >
                        <Trash2 size={16} /> {lang === 'TH' ? 'ล้างไฟล์' : 'Clear'}
                      </button>
                    )}
                  </div>

                  {newProjectFiles.length > 0 && (
                    <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-5">
                      <div className="space-y-3">
                        {newProjectFiles.map((f) => (
                          <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-black text-slate-900 truncate">{f.name}</div>
                                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{Math.ceil(f.size / 1024)} KB</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsCreatingProject(false)}
                    className="px-6 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={() => void handleCreateProject()}
                    className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                    disabled={!newProject.title.trim()}
                  >
                    {t.create}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

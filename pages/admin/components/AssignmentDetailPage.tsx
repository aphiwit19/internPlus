import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock, CalendarDays, Download, ExternalLink, FileText, Trash2, X } from 'lucide-react';
import { deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef } from 'firebase/storage';

import { firebaseStorage, firestoreDb } from '@/firebase';
import { TaskAttachment } from '@/types';
import { useAppContext } from '@/app/AppContext';

type ProjectAttachment = { fileName: string; storagePath: string };

type AssignmentProjectDoc = {
  title: string;
  description: string;
  status?: 'IN PROGRESS' | 'TODO';
  date?: string;
  tasks?: any[];
  attachments?: ProjectAttachment[];
};

type ProjectKind = 'assigned' | 'personal';

interface AssignmentDetailPageProps {
  internId: string;
  projectKind?: string;
  projectId: string;
  onBack: () => void;
}

export default function AssignmentDetailPage({ internId, projectKind, projectId, onBack }: AssignmentDetailPageProps) {
  const { lang, user } = useAppContext();

  const [project, setProject] = useState<(AssignmentProjectDoc & { id: string }) | null>(null);
  const [resolvedKind, setResolvedKind] = useState<ProjectKind | null>(null);

  const [internSupervisorId, setInternSupervisorId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const ref = doc(firestoreDb, 'users', internId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setInternSupervisorId(null);
        return;
      }
      const data = snap.data() as { supervisorId?: string | null };
      setInternSupervisorId(typeof data?.supervisorId === 'string' ? data.supervisorId : null);
    });
  }, [internId]);

  useEffect(() => {
    const normalizedKind = projectKind === 'assigned' || projectKind === 'personal' ? projectKind : null;

    // If kind is known, subscribe only to the correct collection.
    if (normalizedKind) {
      const col = normalizedKind === 'personal' ? 'personalProjects' : 'assignmentProjects';
      const ref = doc(firestoreDb, 'users', internId, col, projectId);
      return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          setProject(null);
          setResolvedKind(null);
          return;
        }
        setResolvedKind(normalizedKind);
        setProject({ id: snap.id, ...(snap.data() as AssignmentProjectDoc) });
      });
    }

    // Backward-compat: legacy route doesn't include kind.
    // Try assignmentProjects first; if not found, fall back to personalProjects.
    let unsubPersonal: null | (() => void) = null;

    const assignedRef = doc(firestoreDb, 'users', internId, 'assignmentProjects', projectId);
    const unsubAssigned = onSnapshot(assignedRef, (snap) => {
      if (snap.exists()) {
        if (unsubPersonal) {
          unsubPersonal();
          unsubPersonal = null;
        }
        setResolvedKind('assigned');
        setProject({ id: snap.id, ...(snap.data() as AssignmentProjectDoc) });
        return;
      }

      if (!unsubPersonal) {
        const personalRef = doc(firestoreDb, 'users', internId, 'personalProjects', projectId);
        unsubPersonal = onSnapshot(personalRef, (pSnap) => {
          if (!pSnap.exists()) {
            setProject(null);
            setResolvedKind(null);
            return;
          }
          setResolvedKind('personal');
          setProject({ id: pSnap.id, ...(pSnap.data() as AssignmentProjectDoc) });
        });
      }
    });

    return () => {
      unsubAssigned();
      if (unsubPersonal) unsubPersonal();
    };
  }, [internId, projectId, projectKind]);

  const statusLabel = useMemo(() => {
    const status = project?.status ?? 'TODO';
    if (status === 'IN PROGRESS') return lang === 'TH' ? 'กำลังดำเนินการ' : 'IN PROGRESS';
    return lang === 'TH' ? 'มอบหมายแล้ว' : 'ASSIGNED';
  }, [lang, project?.status]);

  const statusBadgeClass = useMemo(() => {
    const status = project?.status ?? 'TODO';
    if (status === 'IN PROGRESS') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
  }, [project?.status]);

  const attachmentLabel = (a: TaskAttachment) => (typeof a === 'string' ? a : a.fileName);

  const attachmentUrl = async (a: TaskAttachment): Promise<string | null> => {
    if (typeof a === 'string') {
      const v = a.trim();
      if (!v.startsWith('http://') && !v.startsWith('https://')) return null;
      return v;
    }
    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
    return url;
  };

  const projectAttachmentUrl = async (a: ProjectAttachment): Promise<string> => {
    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
    return url;
  };

  const openStoragePath = async (path: string) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, path));
    window.open(url, '_blank');
  };

  const canDelete = useMemo(() => {
    if (!user) return false;
    if (user.roles.includes('HR_ADMIN')) return true;
    if (user.roles.includes('SUPERVISOR') && internSupervisorId && internSupervisorId === user.id) return true;
    return false;
  }, [internSupervisorId, user]);

  const handleConfirmDelete = async () => {
    if (!project || !resolvedKind) return;
    if (!canDelete) {
      setDeleteOpen(false);
      return;
    }
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const attachmentPaths: string[] = [];

      const projectAttachments = Array.isArray(project.attachments) ? project.attachments : [];
      for (const a of projectAttachments) {
        if (a?.storagePath) attachmentPaths.push(a.storagePath);
      }

      const tasks = Array.isArray(project.tasks) ? project.tasks : [];
      for (const t of tasks) {
        const atts = Array.isArray((t as any)?.attachments) ? (t as any).attachments : [];
        for (const a of atts) {
          if (typeof a === 'string') continue;
          if (a?.storagePath) attachmentPaths.push(a.storagePath);
        }
      }

      const hl = (project as any)?.handoffLatest;
      const hlFiles = Array.isArray(hl?.files) ? hl.files : [];
      for (const f of hlFiles) {
        if (f?.storagePath) attachmentPaths.push(String(f.storagePath));
      }
      const hlVideos = Array.isArray(hl?.videos) ? hl.videos : [];
      for (const v of hlVideos) {
        if (typeof v === 'string') continue;
        if (v?.storagePath) attachmentPaths.push(String(v.storagePath));
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

      const col = resolvedKind === 'personal' ? 'personalProjects' : 'assignmentProjects';
      await deleteDoc(doc(firestoreDb, 'users', internId, col, project.id));

      setDeleteOpen(false);
      onBack();
    } finally {
      setIsDeleting(false);
    }
  };

  if (!project) {
    return (
      <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-6xl mx-auto w-full p-6">
          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-all active:scale-90"
                title={lang === 'TH' ? 'กลับ' : 'Back'}
              >
                <ChevronLeft size={22} />
              </button>
              <div className="text-sm font-black text-slate-700">{lang === 'TH' ? 'ไม่พบชิ้นงาน' : 'Assignment not found'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const projectAttachments = Array.isArray(project.attachments) ? project.attachments : [];

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-6xl mx-auto w-full p-6">
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <button
              onClick={onBack}
              className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-all active:scale-90"
              title={lang === 'TH' ? 'กลับ' : 'Back'}
            >
              <ChevronLeft size={22} />
            </button>

            <div className="flex-1">
              <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border w-fit ${statusBadgeClass}`}
              >
                {statusLabel}
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight mt-3">{project.title}</div>
              {project.description ? <div className="mt-4 text-sm font-medium text-slate-500 max-w-3xl">{project.description}</div> : null}

              {projectAttachments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">{lang === 'TH' ? 'ไฟล์แนบชิ้นงาน' : 'Project attachments'}</div>
                  <div className="flex flex-wrap gap-3">
                    {projectAttachments.map((a, idx) => (
                      <button
                        key={`${a.storagePath}-${idx}`}
                        onClick={() => {
                          void projectAttachmentUrl(a).then((url) => {
                            window.open(url, '_blank');
                          });
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/20 transition-all"
                        title={lang === 'TH' ? 'ดาวน์โหลด' : 'Download'}
                        type="button"
                      >
                        <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center border border-slate-100">
                          <FileText size={18} />
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-black text-slate-900 max-w-[420px] truncate">{a.fileName}</div>
                          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'คลิกเพื่อเปิด' : 'Click to open'}</div>
                        </div>
                        <div className="w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center ml-2">
                          <Download size={18} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {project.date ? (
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 pt-3">
                <CalendarDays size={14} /> {project.date}
              </div>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 text-slate-300 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-2xl transition-all"
                title={lang === 'TH' ? 'ลบชิ้นงาน' : 'Delete assignment'}
                disabled={isDeleting}
              >
                <Trash2 size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {tasks.map((task: any) => (
            <div key={task.id ?? task.title} className="bg-white rounded-[2.25rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.status ?? '-'}</div>
                  <div className="text-xl font-black text-slate-900 mt-3">{task.title ?? '-'}</div>
                  {String(task.status ?? '') === 'DELAYED' ? (
                    <div className="mt-3">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest ${
                          String(task.workResult ?? '') === 'NOT_FINISHED'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}
                      >
                        {String(task.workResult ?? '') === 'NOT_FINISHED'
                          ? lang === 'TH'
                            ? 'งานยังไม่เสร็จ'
                            : 'The work is not finished yet.'
                          : lang === 'TH'
                            ? 'เสร็จแล้ว'
                            : 'Finished'}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 pt-1">
                  <Clock size={14} />
                  {task.plannedStart && task.plannedEnd
                    ? `${new Date(task.plannedStart).toLocaleString()} - ${new Date(task.plannedEnd).toLocaleString()}`
                    : task.plannedEnd
                      ? new Date(task.plannedEnd).toLocaleString()
                      : task.plannedStart
                        ? new Date(task.plannedStart).toLocaleString()
                        : '-'}
                </div>
              </div>

              {typeof task.delayRemark === 'string' && task.delayRemark.trim() ? (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">
                    {lang === 'TH' ? 'หมายเหตุงานล่าช้า' : 'Delay remark'}
                  </div>
                  <div className="text-sm font-bold text-slate-700 bg-rose-50/60 border border-rose-100 rounded-2xl p-4 whitespace-pre-wrap">
                    {task.delayRemark}
                  </div>
                </div>
              ) : null}

              {Array.isArray(task.attachments) && task.attachments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">{lang === 'TH' ? 'หลักฐาน/ไฟล์แนบ' : 'Attachments'}</div>
                  <div className="flex flex-wrap gap-3">
                    {task.attachments.map((a: TaskAttachment, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          void attachmentUrl(a).then((url) => {
                            if (!url) return;
                            window.open(url, '_blank');
                          });
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/20 transition-all"
                        title={typeof a === 'string' ? (lang === 'TH' ? 'เปิดลิงก์' : 'Open') : (lang === 'TH' ? 'ดาวน์โหลด' : 'Download')}
                        type="button"
                      >
                        <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center border border-slate-100">
                          <FileText size={18} />
                        </div>
                        <div className="text-left">
                          <div className="text-[12px] font-black text-slate-900 max-w-[420px] truncate">{attachmentLabel(a)}</div>
                          <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'คลิกเพื่อเปิด' : 'Click to open'}</div>
                        </div>
                        <div className="w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center ml-2">
                          {typeof a === 'string' ? <ExternalLink size={18} /> : <Download size={18} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {tasks.length === 0 ? (
            <div className="bg-white rounded-[2.25rem] p-12 border border-slate-100 shadow-sm">
              <div className="py-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                  <FileText size={26} />
                </div>
                <div className="mt-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.35em]">{lang === 'TH' ? 'ยังไม่มีแผนงาน' : 'No tasks yet'}</div>
                <div className="mt-3 text-sm font-bold text-slate-500">
                  {lang === 'TH' ? 'รอให้นักศึกษาวางแผนงานในหน้า Assignment' : 'Waiting for the intern to plan tasks in their Assignment page.'}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {deleteOpen && project && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]" onClick={() => (isDeleting ? null : setDeleteOpen(false))} />
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xl font-black text-slate-900 tracking-tight">{lang === 'TH' ? 'ยืนยันการลบ' : 'Confirm delete'}</div>
                <button
                  onClick={() => (isDeleting ? null : setDeleteOpen(false))}
                  className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
                  disabled={isDeleting}
                  type="button"
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
                  <div className="mt-2 text-lg font-black text-slate-900">{project.title}</div>
                  {project.description ? <div className="mt-2 text-sm font-bold text-slate-500">{project.description}</div> : null}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteOpen(false)}
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
    </div>
  );
}

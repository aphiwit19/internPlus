import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock, CalendarDays, Download, FileText } from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

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

type HandoffSubmissionDoc = {
  version: number;
  status: 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED';
  links?: string[];
  files?: Array<{ fileName: string; storagePath: string }>;
  videos?: Array<
    { type: 'upload'; title?: string; fileName: string; storagePath: string }
  >;
  submittedAt?: unknown;
  submittedById?: string;
  submittedByName?: string;
  reviewedAt?: unknown;
  reviewedById?: string;
  reviewedByName?: string;
  reviewComment?: string;
};

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
  const [handoffSubmissions, setHandoffSubmissions] = useState<Array<HandoffSubmissionDoc & { id: string }>>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [reviewCommentDraft, setReviewCommentDraft] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

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

  useEffect(() => {
    if (!resolvedKind) {
      setHandoffSubmissions([]);
      setSelectedSubmissionId(null);
      return;
    }

    const col = resolvedKind === 'personal' ? 'personalProjects' : 'assignmentProjects';
    const submissionsRef = collection(firestoreDb, 'users', internId, col, projectId, 'handoffSubmissions');
    const q = query(submissionsRef, orderBy('version', 'desc'));

    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as HandoffSubmissionDoc) }));
      setHandoffSubmissions(list);
      setSelectedSubmissionId((prev) => {
        if (prev && list.some((x) => x.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    });
  }, [internId, projectId, resolvedKind]);

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
    if (typeof a === 'string') return null;
    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
    return url;
  };

  const projectAttachmentUrl = async (a: ProjectAttachment): Promise<string> => {
    const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
    return url;
  };

  const submission = useMemo(() => {
    if (!selectedSubmissionId) return null;
    return handoffSubmissions.find((s) => s.id === selectedSubmissionId) ?? null;
  }, [handoffSubmissions, selectedSubmissionId]);

  const openStoragePath = async (path: string) => {
    const url = await getDownloadURL(storageRef(firebaseStorage, path));
    window.open(url, '_blank');
  };

  const canReview = Boolean(user);

  const updateSubmissionStatus = async (nextStatus: HandoffSubmissionDoc['status']) => {
    if (!canReview) return;
    if (!resolvedKind) return;
    if (!submission) return;
    if (isReviewing) return;

    setIsReviewing(true);
    try {
      const col = resolvedKind === 'personal' ? 'personalProjects' : 'assignmentProjects';
      const submissionRef = doc(firestoreDb, 'users', internId, col, projectId, 'handoffSubmissions', submission.id);
      const projectRef = doc(firestoreDb, 'users', internId, col, projectId);

      const reviewerName = user?.name ?? 'Reviewer';
      const reviewerId = user?.id ?? null;

      await updateDoc(submissionRef, {
        status: nextStatus,
        reviewComment: reviewCommentDraft.trim(),
        reviewedAt: serverTimestamp(),
        reviewedByName: reviewerName,
        reviewedById: reviewerId,
      });

      await updateDoc(projectRef, {
        handoffLatest: {
          version: submission.version,
          status: nextStatus,
          submittedAt: submission.submittedAt ?? null,
          reviewedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      setReviewCommentDraft('');
    } finally {
      setIsReviewing(false);
    }
  };

  if (!project) {
    return (
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
    );
  }

  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const projectAttachments = Array.isArray(project.attachments) ? project.attachments : [];

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto w-full">
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
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <div className="bg-white rounded-[2.25rem] p-8 border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{lang === 'TH' ? 'ส่งมอบชิ้นงาน' : 'Project handoff'}</div>
                <div className="mt-2 text-xl font-black text-slate-900">{lang === 'TH' ? 'ประวัติการส่งมอบ' : 'Handoff history'}</div>
                <div className="mt-2 text-[11px] font-bold text-slate-400">
                  {handoffSubmissions.length > 0
                    ? lang === 'TH'
                      ? `ทั้งหมด ${handoffSubmissions.length} เวอร์ชัน`
                      : `${handoffSubmissions.length} versions`
                    : lang === 'TH'
                      ? 'ยังไม่มีการส่งมอบ'
                      : 'No handoff submissions yet'}
                </div>
              </div>

              {handoffSubmissions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {handoffSubmissions.slice(0, 6).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSubmissionId(s.id)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                        selectedSubmissionId === s.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      v{s.version}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {submission && (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-xl border w-fit ${
                      submission.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : submission.status === 'REVISION_REQUESTED'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}
                  >
                    {submission.status}
                  </span>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v{submission.version}</span>
                </div>

                {Array.isArray(submission.links) && submission.links.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'ลิงก์ชิ้นงาน' : 'Links'}</div>
                    <div className="mt-4 space-y-3">
                      {submission.links.map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-4 py-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all"
                        >
                          <div className="text-[10px] font-bold text-slate-400 truncate">{url}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(submission.files) && submission.files.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'เอกสาร' : 'Documents'}</div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {submission.files.map((f, idx) => (
                        <button
                          key={`${f.storagePath}-${idx}`}
                          type="button"
                          onClick={() => void openStoragePath(f.storagePath)}
                          className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/20 transition-all"
                        >
                          <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center border border-slate-100">
                            <FileText size={18} />
                          </div>
                          <div className="text-left">
                            <div className="text-[12px] font-black text-slate-900 max-w-[420px] truncate">{f.fileName}</div>
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

                {Array.isArray(submission.videos) && submission.videos.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-6">
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'วิดีโอ' : 'Videos'}</div>
                    <div className="mt-4 space-y-3">
                      {submission.videos.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl border border-slate-100">
                          <div className="min-w-0">
                            <div className="text-[12px] font-black text-slate-900 truncate">{v.title ?? (lang === 'TH' ? 'วิดีโอ' : 'Video')}</div>
                            <div className="text-[10px] font-bold text-slate-400 truncate">{v.fileName}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openStoragePath(v.storagePath)}
                            className="w-10 h-10 bg-[#111827] text-white rounded-xl flex items-center justify-center shrink-0"
                            title={lang === 'TH' ? 'ดาวน์โหลด' : 'Download'}
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{lang === 'TH' ? 'คอมเมนต์ผู้ตรวจ' : 'Reviewer comment'}</div>
                  <textarea
                    value={reviewCommentDraft}
                    onChange={(e) => setReviewCommentDraft(e.target.value)}
                    className="mt-4 w-full px-5 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all h-28 resize-none"
                    disabled={!canReview || isReviewing}
                  />
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void updateSubmissionStatus('REVISION_REQUESTED')}
                      className="px-8 py-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                      disabled={!canReview || isReviewing}
                    >
                      {lang === 'TH' ? 'ขอแก้ไข' : 'Request revision'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateSubmissionStatus('APPROVED')}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20"
                      disabled={!canReview || isReviewing}
                    >
                      {lang === 'TH' ? 'รับมอบ' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {tasks.map((task: any) => (
            <div key={task.id ?? task.title} className="bg-white rounded-[2.25rem] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task.status ?? '-'}</div>
                  <div className="text-xl font-black text-slate-900 mt-3">{task.title ?? '-'}</div>
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 pt-1">
                  <Clock size={14} /> {task.plannedEnd ? new Date(task.plannedEnd).toLocaleString() : '-'}
                </div>
              </div>

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
                        title={lang === 'TH' ? 'ดาวน์โหลด' : 'Download'}
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
                          <Download size={18} />
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
    </div>
  );
}

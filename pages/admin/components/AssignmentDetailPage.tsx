import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock, CalendarDays, Download, FileText } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

import { firebaseStorage, firestoreDb } from '@/firebase';
import { TaskAttachment } from '@/types';
import { useAppContext } from '@/app/AppContext';

type AssignmentProjectDoc = {
  title: string;
  description: string;
  status?: 'IN PROGRESS' | 'TODO';
  date?: string;
  tasks?: any[];
};

interface AssignmentDetailPageProps {
  internId: string;
  projectId: string;
  onBack: () => void;
}

export default function AssignmentDetailPage({ internId, projectId, onBack }: AssignmentDetailPageProps) {
  const { lang } = useAppContext();

  const [project, setProject] = useState<(AssignmentProjectDoc & { id: string }) | null>(null);

  useEffect(() => {
    const ref = doc(firestoreDb, 'users', internId, 'assignmentProjects', projectId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setProject(null);
        return;
      }
      setProject({ id: snap.id, ...(snap.data() as AssignmentProjectDoc) });
    });
  }, [internId, projectId]);

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
            </div>

            {project.date ? (
              <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 pt-3">
                <CalendarDays size={14} /> {project.date}
              </div>
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

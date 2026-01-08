import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Layers, CalendarDays } from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';

import { firestoreDb } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

type AssignmentProjectDoc = {
  title: string;
  description: string;
  status: 'IN PROGRESS' | 'TODO';
  date: string;
  tasks: any[];
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
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
    await addDoc(collection(firestoreDb, 'users', internId, 'assignmentProjects'), {
      title,
      description: newProject.description.trim(),
      status: 'TODO',
      date: nowDate,
      tasks: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user?.name ?? 'HR',
    } satisfies AssignmentProjectDoc);

    setIsCreatingProject(false);
    setNewProject({ title: '', description: '' });
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
              <Link
                key={p.id}
                to={`/${baseRole}/${basePage}/assignment/${encodeURIComponent(internId)}/${encodeURIComponent(p.id)}`}
                className="text-left p-8 rounded-[2.5rem] border border-slate-100 bg-white hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm"
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
            ))}
          </div>
        )}
      </div>

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

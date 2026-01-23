import React from 'react';
import { Check, CheckCircle2, Clock, Download, FileText, Plus, RotateCcw } from 'lucide-react';

import { TaskAttachment } from '@/types';
import { firebaseStorage } from '@/firebase';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';

export type TaskStatus = 'DONE' | 'IN_PROGRESS' | 'DELAYED' | 'REVISION';

export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  date?: string;
  attachments: TaskAttachment[];
}

interface TasksTabProps {
  tasks: TaskItem[];
  onNewAssignment: () => void;
  onUpdateTaskStatus: (taskId: string, status: 'DONE' | 'REVISION') => void;
}

const TasksTab: React.FC<TasksTabProps> = ({ tasks, onNewAssignment, onUpdateTaskStatus }) => {
  const attachmentLabel = (a: TaskAttachment) => (typeof a === 'string' ? a : a.fileName);

  const handleOpenAttachment = async (a: TaskAttachment) => {
    if (typeof a === 'string') {
      const v = a.trim();
      if (!v.startsWith('http://') && !v.startsWith('https://')) return;
      window.open(v, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const url = await getDownloadURL(storageRef(firebaseStorage, a.storagePath));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-500">
      <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Work Log Audits</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Assignments and tracked logs</p>
          </div>
          <button
            onClick={onNewAssignment}
            className="flex items-center gap-3 px-8 py-3.5 bg-[#111827] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
          >
            <Plus size={18} strokeWidth={3} /> New Assignment
          </button>
        </div>

        <div className="space-y-6">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="p-8 bg-[#F8FAFC]/50 border border-slate-100 rounded-[2.5rem] flex flex-col lg:flex-row justify-between gap-10 transition-all hover:bg-white hover:shadow-xl group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <span
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      task.status === 'DONE'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : task.status === 'REVISION'
                          ? 'bg-amber-50 text-amber-600 border-amber-100'
                          : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                  {task.date && (
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{task.date}</span>
                  )}
                </div>
                <h4 className="text-3xl font-black text-slate-900 mb-6 tracking-tight group-hover:text-blue-600 transition-colors">
                  {task.title}
                </h4>
                <div className="flex flex-wrap gap-4">
                  {task.attachments.length > 0 ? (
                    task.attachments.map((file, fIdx) => (
                      <div
                        key={fIdx}
                        className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-4 group/file hover:border-blue-300 transition-all shadow-sm"
                      >
                        <div className="w-12 h-12 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover/file:bg-blue-600 group-hover/file:text-white transition-all shadow-inner">
                          <FileText size={24} />
                        </div>
                        <p className="text-[14px] font-black text-slate-800 truncate max-w-[200px] leading-none mb-1">{attachmentLabel(file)}</p>
                        <button
                          type="button"
                          onClick={() => void handleOpenAttachment(file)}
                          className="w-11 h-11 bg-[#111827] text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all ml-2 shadow-xl shadow-slate-900/10 active:scale-95"
                        >
                          <Download size={20} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-5 border-2 border-dashed border-slate-100 rounded-3xl flex items-center gap-3 text-slate-300">
                      <Clock size={20} />
                      <span className="text-[11px] font-bold uppercase">No artifacts submitted yet</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:w-72 flex flex-col gap-3">
                {task.status === 'DONE' ? (
                  <div className="p-8 bg-emerald-50/50 border border-emerald-100 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-center">
                    <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={2.5} />
                    <div>
                      <p className="text-[11px] font-black text-emerald-900 uppercase tracking-widest leading-none mb-1">Approved</p>
                      <p className="text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">Task finalized</p>
                    </div>
                    <button
                      onClick={() => onUpdateTaskStatus(task.id, 'REVISION')}
                      className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      Re-open Audit
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onUpdateTaskStatus(task.id, 'DONE')}
                      className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <Check size={18} strokeWidth={3} /> Approve Task
                    </button>
                    <button
                      onClick={() => onUpdateTaskStatus(task.id, 'REVISION')}
                      className="w-full py-5 bg-amber-50 text-amber-600 border border-amber-100 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-amber-100 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <RotateCcw size={18} strokeWidth={3} /> Needs Revision
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="py-40 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
                <FileText size={48} />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-[0.3em]">No assigned tasks or logs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasksTab;

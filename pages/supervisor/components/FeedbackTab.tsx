import React from 'react';
import { ExternalLink, FileText, MessageSquareMore, Play, Star, Zap } from 'lucide-react';

export interface FeedbackItem {
  id: string;
  label: string;
  period: string;
  status: string;
  internReflection?: string;
  internProgramFeedback?: string;
  videoUrl?: string;
  videoStoragePath?: string;
  videoFileName?: string;
  attachments?: Array<{ fileName: string; storagePath: string }>;
  supervisorScore?: number;
  programRating: number;
  supervisorComments?: string;
}

interface FeedbackTabProps {
  feedback: FeedbackItem[];
  activeFeedbackId: string;
  onSelectFeedback: (id: string) => void;
  activeFeedback?: FeedbackItem;
  onOpenStoragePath?: (path: string) => void;
}

const FeedbackTab: React.FC<FeedbackTabProps> = ({
  feedback,
  activeFeedbackId,
  onSelectFeedback,
  activeFeedback,
  onOpenStoragePath,
}) => {
  const handleOpen = (path?: string) => {
    if (!path) return;
    if (!onOpenStoragePath) return;
    onOpenStoragePath(path);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col gap-4">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-4">SELECT ASSESSMENT PERIOD</span>
        <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit overflow-x-auto scrollbar-hide max-w-full">
          {feedback.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelectFeedback(f.id)}
              className={`px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex-shrink-0 ${
                activeFeedbackId === f.id ? 'bg-[#0B0F19] text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {activeFeedback ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-12 space-y-10">
            <div className="bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.75rem] flex items-center justify-center">
                    <Zap size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{activeFeedback.period}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">INTERN SUBMISSION DETAILS</p>
                  </div>
                </div>
                {activeFeedback.status === 'reviewed' && (
                  <div className="bg-emerald-50 text-emerald-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    REVIEWED
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 pb-12 border-b border-slate-50">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">VLOG REFLECTION</h4>
                  {activeFeedback.videoStoragePath ? (
                    <div
                      className="aspect-video bg-[#0B0F19] rounded-[2.5rem] relative overflow-hidden group/video cursor-pointer"
                      onClick={() => handleOpen(activeFeedback.videoStoragePath)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/10 transition-all">
                        <Play size={48} className="text-white fill-white drop-shadow-2xl" />
                      </div>
                      <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-white/70 text-[10px] font-black uppercase tracking-widest">
                        <span className="truncate">{activeFeedback.videoFileName || 'Video'}</span>
                        <span className="flex items-center gap-2">
                          <ExternalLink size={14} /> OPEN
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-[#0B0F19]/30 rounded-[2.5rem] relative overflow-hidden border border-slate-100 flex items-center justify-center text-slate-300">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">NO VIDEO</span>
                    </div>
                  )}

                  {Array.isArray(activeFeedback.attachments) && activeFeedback.attachments.length > 0 && (
                    <div className="mt-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">ATTACHMENTS</div>
                      <div className="space-y-2">
                        {activeFeedback.attachments.map((a, idx) => (
                          <button
                            key={`${a.storagePath}-${idx}`}
                            onClick={() => handleOpen(a.storagePath)}
                            className="w-full p-4 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-between gap-4 hover:border-blue-200 hover:shadow-sm transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-black text-slate-800 truncate">{a.fileName}</div>
                              </div>
                            </div>
                            <div className="text-blue-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                              <ExternalLink size={14} /> OPEN
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">PROGRAM SATISFACTION</h4>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          activeFeedback.programRating >= s
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-100'
                            : 'bg-slate-50 text-slate-200'
                        }`}
                      >
                        <Star size={20} fill={activeFeedback.programRating >= s ? 'currentColor' : 'none'} />
                      </div>
                    ))}
                  </div>
                  <p className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic text-slate-500 text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                    "{activeFeedback.internProgramFeedback || 'No feedback provided'}"
                  </p>
                </div>
              </div>

              <div className="p-10 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">INTERN SELF-REFLECTION</h4>
                <p className="text-lg text-slate-700 leading-relaxed italic font-medium">
                  "{activeFeedback.internReflection || 'Submission pending'}"
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-40 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
            <MessageSquareMore size={48} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em]">No feedback milestones available</p>
        </div>
      )}
    </div>
  );
};

export default FeedbackTab;

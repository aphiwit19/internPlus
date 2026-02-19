import React, { useState, useEffect } from 'react';
import { BarChart3, ExternalLink, FileText, MessageSquareMore, Play, Star, StickyNote, Zap } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { firestoreDb } from '@/firebase';

import { PerformanceMetrics } from '@/types';

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
  supervisorPerformance?: PerformanceMetrics;
  supervisorSummary?: string;
  supervisorReviewedDate?: string;
  selfPerformance?: PerformanceMetrics;
  selfSummary?: string;
  submissionDate?: string;
  submittedAtMs?: number;
  updatedAtMs?: number;

  supervisorOverallComments?: string;
  supervisorWorkPerformanceComments?: string;
  supervisorMentorshipQualityRating?: number;
  supervisorProgramSatisfactionRating?: number;
}

interface FeedbackTabProps {
  feedback: FeedbackItem[];
  activeFeedbackId: string;
  onSelectFeedback: (id: string) => void;
  activeFeedback?: FeedbackItem;
  onOpenStoragePath?: (path: string) => void;

  readOnly?: boolean;
  hideWhenNoData?: boolean;

  // Supervisor Performance Analysis (optional)
  editPerformance?: PerformanceMetrics;
  onEditPerformanceChange?: (next: PerformanceMetrics) => void;
  editOverallComments?: string;
  onEditOverallCommentsChange?: (next: string) => void;
  editWorkPerformanceComments?: string;
  onEditWorkPerformanceCommentsChange?: (next: string) => void;
  editMentorshipQualityRating?: number;
  onEditMentorshipQualityRatingChange?: (next: number) => void;
  editSupervisorProgramSatisfaction?: number;
  onEditSupervisorProgramSatisfactionChange?: (next: number) => void;
  onResetPerformance?: () => void;
  onSavePerformance?: () => void;
  isSavingPerformance?: boolean;
  savePerformanceError?: string | null;
}

const FeedbackTab: React.FC<FeedbackTabProps> = ({
  feedback,
  activeFeedbackId,
  onSelectFeedback,
  activeFeedback,
  onOpenStoragePath,

  readOnly,
  hideWhenNoData,

  editPerformance,
  onEditPerformanceChange,
  editOverallComments,
  onEditOverallCommentsChange,
  editWorkPerformanceComments,
  onEditWorkPerformanceCommentsChange,
  editMentorshipQualityRating,
  onEditMentorshipQualityRatingChange,
  editSupervisorProgramSatisfaction,
  onEditSupervisorProgramSatisfactionChange,
  onResetPerformance,
  onSavePerformance,
  isSavingPerformance,
  savePerformanceError,
}) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const isReadOnly = Boolean(readOnly);
  const shouldHideWhenNoData = Boolean(hideWhenNoData);

  const hasPerformancePanel =
    !!editPerformance &&
    !!onEditPerformanceChange &&
    typeof editOverallComments === 'string' &&
    !!onEditOverallCommentsChange &&
    typeof editWorkPerformanceComments === 'string' &&
    !!onEditWorkPerformanceCommentsChange &&
    typeof editMentorshipQualityRating === 'number' &&
    !!onEditMentorshipQualityRatingChange &&
    typeof editSupervisorProgramSatisfaction === 'number' &&
    !!onEditSupervisorProgramSatisfactionChange &&
    !!onResetPerformance &&
    !!onSavePerformance;

  const showReadOnlyPerformance =
    isReadOnly &&
    Boolean(
      activeFeedback &&
        ((activeFeedback.supervisorPerformance && typeof activeFeedback.supervisorPerformance.overallRating === 'number') ||
          typeof activeFeedback.supervisorScore === 'number' ||
          (activeFeedback.supervisorOverallComments ?? '').trim() ||
          (activeFeedback.supervisorWorkPerformanceComments ?? '').trim() ||
          (activeFeedback.supervisorSummary ?? '').trim()),
    );

  const showReadOnlyFeedback =
    isReadOnly &&
    Boolean(
      activeFeedback &&
        (activeFeedback.submissionDate ||
          (activeFeedback.internReflection ?? '').trim() ||
          (activeFeedback.internProgramFeedback ?? '').trim() ||
          (activeFeedback.selfSummary ?? '').trim() ||
          (activeFeedback.videoStoragePath ?? '').trim() ||
          (Array.isArray(activeFeedback.attachments) && activeFeedback.attachments.length > 0) ||
          (activeFeedback.selfPerformance && typeof activeFeedback.selfPerformance.overallRating === 'number' && activeFeedback.selfPerformance.overallRating > 0) ||
          activeFeedback.programRating > 0),
    );

  const canShowPerformanceView = hasPerformancePanel || (isReadOnly ? true : showReadOnlyPerformance);

  const [viewMode, setViewMode] = React.useState<'FEEDBACK' | 'PERFORMANCE'>('FEEDBACK');

  const handleOpen = (path?: string) => {
    if (!path) return;
    if (!onOpenStoragePath) return;
    onOpenStoragePath(path);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-4">{tr('supervisor_dashboard.feedback.select_view')}</span>
          {canShowPerformanceView && (
            <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm w-fit">
              <button
                onClick={() => setViewMode('FEEDBACK')}
                className={`px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'FEEDBACK' ? 'bg-[#0B0F19] text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {tr('supervisor_dashboard.feedback.tab_feedback')}
              </button>
              <button
                onClick={() => setViewMode('PERFORMANCE')}
                className={`px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === 'PERFORMANCE' ? 'bg-[#0B0F19] text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {tr('supervisor_dashboard.feedback.tab_performance')}
              </button>
            </div>
          )}
        </div>

        {hasPerformancePanel && viewMode === 'PERFORMANCE' && (
          <>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-4">{tr('supervisor_dashboard.feedback.select_assessment_period')}</span>
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
          </>
        )}

        {viewMode === 'FEEDBACK' && (
          <>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-4">{tr('supervisor_dashboard.feedback.select_assessment_period')}</span>
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
          </>
        )}
      </div>

      {viewMode === 'PERFORMANCE' && !isReadOnly && hasPerformancePanel && (
        <PerformanceAnalysisPanel
          editPerformance={editPerformance}
          onEditPerformanceChange={onEditPerformanceChange}
          editOverallComments={editOverallComments}
          onEditOverallCommentsChange={onEditOverallCommentsChange}
          editWorkPerformanceComments={editWorkPerformanceComments}
          onEditWorkPerformanceCommentsChange={onEditWorkPerformanceCommentsChange}
          editMentorshipQualityRating={editMentorshipQualityRating}
          onEditMentorshipQualityRatingChange={onEditMentorshipQualityRatingChange}
          editSupervisorProgramSatisfaction={editSupervisorProgramSatisfaction}
          onEditSupervisorProgramSatisfactionChange={onEditSupervisorProgramSatisfactionChange}
          onSendBack={onSavePerformance}
          isSaving={!!isSavingPerformance}
          saveError={savePerformanceError ?? null}
          milestoneLabel={activeFeedback?.label ?? activeFeedbackId}
          programRating={typeof activeFeedback?.programRating === 'number' ? activeFeedback?.programRating : 0}
          submissionDate={activeFeedback?.submissionDate}
          reviewedDate={activeFeedback?.supervisorReviewedDate}
        />
      )}

      {viewMode === 'PERFORMANCE' && isReadOnly && showReadOnlyPerformance && (
        <ReadOnlyPerformancePanel item={activeFeedback} milestoneLabel={activeFeedback?.label ?? activeFeedbackId} />
      )}

      {viewMode === 'PERFORMANCE' && !hasPerformancePanel && !showReadOnlyPerformance &&
        (shouldHideWhenNoData ? (
          <div />
        ) : (
          <div className="py-24 text-center">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.feedback.no_performance_available')}</p>
          </div>
        ))}

      {viewMode === 'FEEDBACK' &&
        (activeFeedback && (!isReadOnly || !shouldHideWhenNoData || showReadOnlyFeedback) ? (
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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{tr('supervisor_dashboard.feedback.intern_submission_details')}</p>
                  </div>
                </div>
                {activeFeedback.status === 'reviewed' && (
                  <div className="bg-emerald-50 text-emerald-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                    {tr('supervisor_dashboard.feedback.reviewed_badge')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
                <div className="lg:col-span-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-10">
                  <div className="flex items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 bg-white border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-blue-600 flex-shrink-0">
                        <BarChart3 size={24} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tr('supervisor_dashboard.feedback.self_evaluation')}</div>
                        <div className="text-xl font-black text-slate-900 truncate">
                          {activeFeedback.submissionDate ? tr('supervisor_dashboard.feedback.submitted_on', { date: activeFeedback.submissionDate }) : tr('supervisor_dashboard.feedback.submission_pending')}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-end gap-3 flex-shrink-0">
                      <div className="text-5xl font-black tracking-tighter leading-none text-slate-900">
                        {typeof activeFeedback.selfPerformance?.overallRating === 'number' ? activeFeedback.selfPerformance.overallRating : 0}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-1">/100</div>
                    </div>
                  </div>

                  {activeFeedback.selfPerformance ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <MetricBar label="TECHNICAL" value={activeFeedback.selfPerformance.technical} color="bg-blue-600" />
                      <MetricBar label="COMMUNICATION" value={activeFeedback.selfPerformance.communication} color="bg-indigo-600" />
                      <MetricBar label="PUNCTUALITY" value={activeFeedback.selfPerformance.punctuality} color="bg-emerald-500" />
                      <MetricBar label="INITIATIVE" value={activeFeedback.selfPerformance.initiative} color="bg-rose-500" />
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{tr('supervisor_dashboard.feedback.no_self_evaluation')}</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-[#3B49DF] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-36 -mt-36 blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-white/10 border border-white/15 rounded-[1.5rem] flex items-center justify-center">
                        <StickyNote size={20} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">{tr('supervisor_dashboard.feedback.summary_label')}</div>
                        <div className="text-lg font-black tracking-tight">{tr('supervisor_dashboard.feedback.intern_note')}</div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-indigo-50 italic font-medium whitespace-pre-wrap break-words">
                      {activeFeedback.selfSummary ? `"${activeFeedback.selfSummary}"` : `"${tr('supervisor_dashboard.feedback.no_summary')}"`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12 pb-12 border-b border-slate-50">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">{tr('supervisor_dashboard.feedback.vlog_reflection')}</h4>
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
                          <ExternalLink size={14} /> {tr('supervisor_dashboard.feedback.open')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-[#0B0F19]/30 rounded-[2.5rem] relative overflow-hidden border border-slate-100 flex items-center justify-center text-slate-300">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">{tr('supervisor_dashboard.feedback.no_video')}</span>
                    </div>
                  )}

                  {Array.isArray(activeFeedback.attachments) && activeFeedback.attachments.length > 0 && (
                    <div className="mt-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">{tr('supervisor_dashboard.feedback.attachments')}</div>
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
                              <ExternalLink size={14} /> {tr('supervisor_dashboard.feedback.open')}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{tr('supervisor_dashboard.feedback.program_satisfaction')}</h4>
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
                    "{activeFeedback.internProgramFeedback || tr('supervisor_dashboard.feedback.no_feedback_provided')}"
                  </p>
                </div>
              </div>

              <div className="p-10 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">{tr('supervisor_dashboard.feedback.intern_self_reflection')}</h4>
                <p className="text-lg text-slate-700 leading-relaxed italic font-medium">
                  "{activeFeedback.internReflection || tr('supervisor_dashboard.feedback.submission_pending_reflection')}"
                </p>
              </div>
              </div>
            </div>
          </div>
        ) : shouldHideWhenNoData ? (
          <div />
        ) : (
          <div className="py-40 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 border border-slate-100 shadow-inner">
              <MessageSquareMore size={48} />
            </div>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em]">{tr('supervisor_dashboard.feedback.no_milestones')}</p>
          </div>
        ))}
    </div>
  );
};

const ReadOnlyPerformancePanel = ({ item, milestoneLabel }: { item?: FeedbackItem; milestoneLabel: string }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const perf: PerformanceMetrics = item?.supervisorPerformance ?? {
    technical: 0,
    communication: 0,
    punctuality: 0,
    initiative: 0,
    overallRating: typeof item?.supervisorScore === 'number' ? item.supervisorScore : 0,
  };

  const overallComments =
    (item?.supervisorOverallComments ?? '').trim() || (item?.supervisorSummary ?? '').trim() || (item?.supervisorComments ?? '').trim();
  const workPerformanceComments = (item?.supervisorWorkPerformanceComments ?? '').trim();
  const supervisorProgramSat = Math.max(0, Math.min(5, Number(item?.supervisorProgramSatisfactionRating) || 0));

  const [labels, setLabels] = React.useState<{
    technical: string;
    communication: string;
    punctuality: string;
    initiative: string;
    overallComments: string;
    workPerformance: string;
  }>({
    technical: 'TECHNICAL PROFICIENCY',
    communication: 'TEAM COMMUNICATION',
    punctuality: 'PUNCTUALITY & RELIABILITY',
    initiative: 'SELF-INITIATIVE',
    overallComments: 'OVERALL EVALUATION & COMMENTS',
    workPerformance: 'WORK PERFORMANCE',
  });

  React.useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data() as any;
      const next = raw?.evaluationLabels?.EN;
      if (!next) return;
      setLabels((prev) => ({
        technical: typeof next?.technical === 'string' ? next.technical : prev.technical,
        communication: typeof next?.communication === 'string' ? next.communication : prev.communication,
        punctuality: typeof next?.punctuality === 'string' ? next.punctuality : prev.punctuality,
        initiative: typeof next?.initiative === 'string' ? next.initiative : prev.initiative,
        overallComments: typeof next?.overallComments === 'string' ? next.overallComments : prev.overallComments,
        workPerformance: typeof next?.workPerformance === 'string' ? next.workPerformance : prev.workPerformance,
      }));
    });
  }, []);

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-7 bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('supervisor_dashboard.feedback.supervisor_performance_evaluation')}</h3>
                <div className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                  {milestoneLabel}
                  {item?.submissionDate ? `  •  ${tr('supervisor_dashboard.feedback.submitted_label')} ${item.submissionDate}` : ''}
                  {item?.supervisorReviewedDate ? `  •  ${tr('supervisor_dashboard.feedback.reviewed_label')} ${item.supervisorReviewedDate}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 mb-10">
            <MetricBar label={labels.technical} value={perf.technical} color="bg-blue-600" />
            <MetricBar label={labels.communication} value={perf.communication} color="bg-indigo-600" />
            <MetricBar label={labels.punctuality} value={perf.punctuality} color="bg-emerald-500" />
            <MetricBar label={labels.initiative} value={perf.initiative} color="bg-rose-500" />
          </div>

          <div className="mb-10">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">{tr('supervisor_dashboard.feedback.program_satisfaction_supervisor')}</div>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
                    supervisorProgramSat >= s
                      ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-100'
                      : 'bg-slate-50 text-slate-300 border-slate-100'
                  }`}
                >
                  <Star size={18} fill={supervisorProgramSat >= s ? 'currentColor' : 'none'} />
                </div>
              ))}
              <div className="ml-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {supervisorProgramSat}/5
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{labels.overallComments}</div>
              <div className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">
                {overallComments || '-'}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{labels.workPerformance}</div>
              <div className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">
                {workPerformanceComments || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 bg-[#3B49DF] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <h3 className="text-xl font-black mb-12 tracking-tight relative z-10">{tr('supervisor_dashboard.feedback.executive_summary')}</h3>
          <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
            <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
              <span className="text-6xl font-black tracking-tighter leading-none">{typeof perf.overallRating === 'number' ? perf.overallRating : 0}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">{tr('supervisor_dashboard.feedback.avg_score')}</span>
            </div>
            <p className="text-sm leading-relaxed text-indigo-50 text-center whitespace-pre-wrap break-words font-medium italic max-w-md">
              {overallComments ? `"${overallComments}"` : `"${tr('supervisor_dashboard.feedback.no_summary')}"`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScoreInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) => {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{label}</div>
        <div className="text-sm font-black text-slate-900">{safeValue}/100</div>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <input
          type="number"
          min={0}
          max={100}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 outline-none"
        />
      </div>
    </div>
  );
};

const clampScore = (v: number) => {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const computeOverall = (p: Pick<PerformanceMetrics, 'technical' | 'communication' | 'punctuality' | 'initiative'>) => {
  const avg = (p.technical + p.communication + p.punctuality + p.initiative) / 4;
  return clampScore(avg);
};

const PerformanceAnalysisPanel = ({
  editPerformance,
  onEditPerformanceChange,
  editOverallComments,
  onEditOverallCommentsChange,
  editWorkPerformanceComments,
  onEditWorkPerformanceCommentsChange,
  editMentorshipQualityRating,
  onEditMentorshipQualityRatingChange,
  editSupervisorProgramSatisfaction,
  onEditSupervisorProgramSatisfactionChange,
  onSendBack,
  isSaving,
  saveError,
  milestoneLabel,
  programRating,
  submissionDate,
  reviewedDate,
}: {
  editPerformance: PerformanceMetrics;
  onEditPerformanceChange: (next: PerformanceMetrics) => void;
  editOverallComments: string;
  onEditOverallCommentsChange: (next: string) => void;
  editWorkPerformanceComments: string;
  onEditWorkPerformanceCommentsChange: (next: string) => void;
  editMentorshipQualityRating: number;
  onEditMentorshipQualityRatingChange: (next: number) => void;
  editSupervisorProgramSatisfaction: number;
  onEditSupervisorProgramSatisfactionChange: (next: number) => void;
  onSendBack: () => void;
  isSaving: boolean;
  saveError: string | null;
  milestoneLabel: string;
  programRating: number;
  submissionDate?: string;
  reviewedDate?: string;
}) => {
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const isTh = (i18n.language ?? '').toLowerCase().startsWith('th');
  const hasSentBack = Boolean((reviewedDate ?? '').trim());
  const displayOverall = computeOverall(editPerformance);
  const mentorshipRating = Math.max(0, Math.min(5, Number(editMentorshipQualityRating) || 0));
  const supervisorProgramSat = Math.max(0, Math.min(5, Number(editSupervisorProgramSatisfaction) || 0));

  const [labels, setLabels] = React.useState<{
    technical: string;
    communication: string;
    punctuality: string;
    initiative: string;
    overallComments: string;
    workPerformance: string;
  }>({
    technical: 'TECHNICAL PROFICIENCY',
    communication: 'TEAM COMMUNICATION',
    punctuality: 'PUNCTUALITY & RELIABILITY',
    initiative: 'SELF-INITIATIVE',
    overallComments: 'OVERALL EVALUATION & COMMENTS',
    workPerformance: 'WORK PERFORMANCE',
  });

  React.useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data() as any;
      const next = raw?.evaluationLabels?.EN;
      if (!next) return;
      setLabels((prev) => ({
        technical: typeof next?.technical === 'string' ? next.technical : prev.technical,
        communication: typeof next?.communication === 'string' ? next.communication : prev.communication,
        punctuality: typeof next?.punctuality === 'string' ? next.punctuality : prev.punctuality,
        initiative: typeof next?.initiative === 'string' ? next.initiative : prev.initiative,
        overallComments: typeof next?.overallComments === 'string' ? next.overallComments : prev.overallComments,
        workPerformance: typeof next?.workPerformance === 'string' ? next.workPerformance : prev.workPerformance,
      }));
    });
  }, []);

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-7 bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-500/20">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('supervisor_dashboard.feedback.supervisor_performance_evaluation')}</h3>
                <div className="mt-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                  {milestoneLabel}
                  {submissionDate ? `  •  ${tr('supervisor_dashboard.feedback.submitted_label')} ${submissionDate}` : ''}
                  {reviewedDate ? `  •  ${tr('supervisor_dashboard.feedback.reviewed_label')} ${reviewedDate}` : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8 mb-10">
            <MetricBar label={labels.technical} value={editPerformance.technical} color="bg-blue-600" />
            <MetricBar label={labels.communication} value={editPerformance.communication} color="bg-indigo-600" />
            <MetricBar label={labels.punctuality} value={editPerformance.punctuality} color="bg-emerald-500" />
            <MetricBar label={labels.initiative} value={editPerformance.initiative} color="bg-rose-500" />
          </div>

          <div className="mb-10">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">{tr('supervisor_dashboard.feedback.program_satisfaction_supervisor')}</div>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onEditSupervisorProgramSatisfactionChange(s)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all ${
                    supervisorProgramSat >= s
                      ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-100'
                      : 'bg-slate-50 text-slate-300 border-slate-100 hover:bg-white'
                  }`}
                >
                  <Star size={18} fill={supervisorProgramSat >= s ? 'currentColor' : 'none'} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => onEditSupervisorProgramSatisfactionChange(0)}
                className="ml-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white"
              >
                {tr('supervisor_dashboard.feedback.clear')}
              </button>
              <div className="ml-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {supervisorProgramSat}/5
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {saveError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoreInput
                label={labels.technical}
                value={editPerformance.technical}
                onChange={(v) =>
                  onEditPerformanceChange({
                    ...editPerformance,
                    technical: clampScore(v),
                    overallRating: displayOverall,
                  })
                }
              />
              <ScoreInput
                label={labels.communication}
                value={editPerformance.communication}
                onChange={(v) =>
                  onEditPerformanceChange({
                    ...editPerformance,
                    communication: clampScore(v),
                    overallRating: displayOverall,
                  })
                }
              />
              <ScoreInput
                label={labels.punctuality}
                value={editPerformance.punctuality}
                onChange={(v) =>
                  onEditPerformanceChange({
                    ...editPerformance,
                    punctuality: clampScore(v),
                    overallRating: displayOverall,
                  })
                }
              />
              <ScoreInput
                label={labels.initiative}
                value={editPerformance.initiative}
                onChange={(v) =>
                  onEditPerformanceChange({
                    ...editPerformance,
                    initiative: clampScore(v),
                    overallRating: displayOverall,
                  })
                }
              />
            </div>

            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{labels.overallComments}</div>
              <textarea
                value={editOverallComments}
                onChange={(e) => onEditOverallCommentsChange(e.target.value)}
                rows={4}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                placeholder={tr('supervisor_dashboard.feedback.overall_comments_placeholder')}
              />
            </div>

            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">{labels.workPerformance}</div>
              <textarea
                value={editWorkPerformanceComments}
                onChange={(e) => onEditWorkPerformanceCommentsChange(e.target.value)}
                rows={4}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                placeholder={tr('supervisor_dashboard.feedback.work_performance_placeholder')}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onSendBack}
                className={`px-8 py-3 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-xl ${
                  hasSentBack
                    ? 'bg-emerald-600'
                    : isSaving
                      ? 'bg-blue-600'
                      : 'bg-[#111827] hover:bg-blue-600'
                } ${hasSentBack ? 'opacity-100' : ''}`}
                disabled={isSaving || hasSentBack}
              >
                {isSaving
                  ? tr('supervisor_dashboard.feedback.sending')
                  : hasSentBack
                    ? isTh
                      ? 'ส่งกลับแล้ว'
                      : 'Sent back'
                    : tr('supervisor_dashboard.feedback.send_back')}
              </button>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 bg-[#3B49DF] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <h3 className="text-xl font-black mb-12 tracking-tight relative z-10">{tr('supervisor_dashboard.feedback.executive_summary')}</h3>
          <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
            <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
              <span className="text-6xl font-black tracking-tighter leading-none">{displayOverall}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">{tr('supervisor_dashboard.feedback.avg_score')}</span>
            </div>
            <div className="w-full max-w-md bg-white/10 border border-white/15 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70 mb-4">{tr('supervisor_dashboard.feedback.overall_bar')}</div>
              <div className="h-3.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, displayOverall))}%` }}
                />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-indigo-50 text-center whitespace-pre-wrap break-words font-medium italic max-w-md">
              {editOverallComments ? `"${editOverallComments}"` : `"${tr('supervisor_dashboard.feedback.no_summary')}"`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBar = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{label}</div>
        <div className="text-sm font-black text-slate-900">{safeValue}/100</div>
      </div>
      <div className="h-3 w-full bg-white rounded-full overflow-hidden border border-slate-100 p-0.5">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
};

export default FeedbackTab;

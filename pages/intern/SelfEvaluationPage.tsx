import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Save, StickyNote } from 'lucide-react';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { PerformanceMetrics, Language } from '@/types';
import { firestoreDb } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

const DEFAULT_PERFORMANCE: PerformanceMetrics = {
  technical: 0,
  communication: 0,
  punctuality: 0,
  initiative: 0,
  overallRating: 0,
};

const clampScore = (v: number) => {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
};

const computeOverall = (p: Pick<PerformanceMetrics, 'technical' | 'communication' | 'punctuality' | 'initiative'>) => {
  const avg = (p.technical + p.communication + p.punctuality + p.initiative) / 4;
  return clampScore(avg);
};

interface SelfEvaluationPageProps {
  lang: Language;
}

const SelfEvaluationPage: React.FC<SelfEvaluationPageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const { t, i18n } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const uiLang: Language = (i18n.resolvedLanguage ?? i18n.language) === 'th' ? 'TH' : 'EN';

  const [savedPerformance, setSavedPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [savedSummary, setSavedSummary] = useState('');

  const [editPerformance, setEditPerformance] = useState<PerformanceMetrics>(DEFAULT_PERFORMANCE);
  const [editSummary, setEditSummary] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [evaluationLabels, setEvaluationLabels] = useState<{
    technical: string;
    communication: string;
    punctuality: string;
    initiative: string;
  }>(() => ({
    technical: tr('intern_self_evaluation.labels.technical'),
    communication: tr('intern_self_evaluation.labels.communication'),
    punctuality: tr('intern_self_evaluation.labels.punctuality'),
    initiative: tr('intern_self_evaluation.labels.initiative'),
  }));

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data() as any;
      const next = raw?.evaluationLabels?.[uiLang];
      if (!next) return;
      setEvaluationLabels((prev) => ({
        technical: typeof next?.technical === 'string' ? next.technical : prev.technical,
        communication: typeof next?.communication === 'string' ? next.communication : prev.communication,
        punctuality: typeof next?.punctuality === 'string' ? next.punctuality : prev.punctuality,
        initiative: typeof next?.initiative === 'string' ? next.initiative : prev.initiative,
      }));
    });
  }, [uiLang]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(firestoreDb, 'users', user.id);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        selfPerformance?: Partial<PerformanceMetrics>;
        selfSummary?: string;
      };

      const raw = data.selfPerformance ?? null;
      const normalized: PerformanceMetrics = {
        technical: typeof raw?.technical === 'number' ? raw.technical : DEFAULT_PERFORMANCE.technical,
        communication: typeof raw?.communication === 'number' ? raw.communication : DEFAULT_PERFORMANCE.communication,
        punctuality: typeof raw?.punctuality === 'number' ? raw.punctuality : DEFAULT_PERFORMANCE.punctuality,
        initiative: typeof raw?.initiative === 'number' ? raw.initiative : DEFAULT_PERFORMANCE.initiative,
        overallRating: typeof raw?.overallRating === 'number' ? raw.overallRating : DEFAULT_PERFORMANCE.overallRating,
      };

      const nextSummary = typeof data.selfSummary === 'string' ? data.selfSummary : '';

      setSavedPerformance(normalized);
      setSavedSummary(nextSummary);

      setEditPerformance(normalized);
      setEditSummary(nextSummary);
      setSaveError(null);
    });
  }, [user]);

  const displayPerformance = useMemo(() => {
    const next: PerformanceMetrics = {
      technical: clampScore(editPerformance.technical),
      communication: clampScore(editPerformance.communication),
      punctuality: clampScore(editPerformance.punctuality),
      initiative: clampScore(editPerformance.initiative),
      overallRating: computeOverall(editPerformance),
    };
    return next;
  }, [editPerformance]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const nextPerf: PerformanceMetrics = {
        technical: clampScore(editPerformance.technical),
        communication: clampScore(editPerformance.communication),
        punctuality: clampScore(editPerformance.punctuality),
        initiative: clampScore(editPerformance.initiative),
        overallRating: computeOverall(editPerformance),
      };

      await updateDoc(doc(firestoreDb, 'users', user.id), {
        selfPerformance: nextPerf,
        selfSummary: editSummary,
        selfEvaluatedAt: serverTimestamp(),
      });

      setSavedPerformance(nextPerf);
      setSavedSummary(editSummary);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      setSaveError(`${e?.code ?? 'unknown'}: ${e?.message ?? tr('intern_self_evaluation.errors.save_failed')}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 relative p-4 md:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 md:mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{tr('intern_self_evaluation.title')}</h1>
            <p className="text-slate-500 text-xs md:text-sm mt-1">{tr('intern_self_evaluation.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditPerformance(savedPerformance);
                setEditSummary(savedSummary);
                setSaveError(null);
              }}
              className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              disabled={isSaving}
            >
              {tr('intern_self_evaluation.actions.reset')}
            </button>
            <button
              onClick={() => void handleSave()}
              className="px-6 py-3 rounded-2xl bg-[#111827] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex items-center gap-2"
              disabled={isSaving}
            >
              <Save size={14} />
              {isSaving ? tr('intern_self_evaluation.actions.saving') : tr('intern_self_evaluation.actions.save')}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
          {saveError && (
            <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl px-5 py-4 text-sm font-bold">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{tr('intern_self_evaluation.sections.analysis')}</div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">{tr('intern_self_evaluation.sections.score_sheet')}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <ScoreInput
                  label={evaluationLabels.technical}
                  value={editPerformance.technical}
                  onChange={(v) => setEditPerformance((p) => ({ ...p, technical: v }))}
                />
                <ScoreInput
                  label={evaluationLabels.communication}
                  value={editPerformance.communication}
                  onChange={(v) => setEditPerformance((p) => ({ ...p, communication: v }))}
                />
                <ScoreInput
                  label={evaluationLabels.punctuality}
                  value={editPerformance.punctuality}
                  onChange={(v) => setEditPerformance((p) => ({ ...p, punctuality: v }))}
                />
                <ScoreInput
                  label={evaluationLabels.initiative}
                  value={editPerformance.initiative}
                  onChange={(v) => setEditPerformance((p) => ({ ...p, initiative: v }))}
                />

                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                      <StickyNote size={18} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{tr('intern_self_evaluation.sections.summary')}</div>
                      <div className="text-sm font-black text-slate-900">{tr('intern_self_evaluation.sections.summary_sent_to_admin')}</div>
                    </div>
                  </div>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={6}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
                    placeholder={tr('intern_self_evaluation.placeholders.summary')}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#3B49DF] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <h3 className="text-xl font-black mb-10 tracking-tight relative z-10">{tr('intern_self_evaluation.sections.summary')}</h3>
              <div className="flex flex-col items-center gap-10 flex-1 relative z-10">
                <div className="w-40 h-40 bg-white/10 backdrop-blur-xl rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-6xl font-black tracking-tighter leading-none">{displayPerformance.overallRating}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-3 text-indigo-100">
                    {tr('intern_self_evaluation.labels.avg_score')}
                  </span>
                </div>
                <p className="text-lg leading-relaxed text-indigo-50 italic font-medium text-center">
                  {editSummary
                    ? `\"${editSummary}\"`
                    : `\"${tr('intern_self_evaluation.placeholders.summary_quote')}\"`}
                </p>
              </div>
            </div>
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
          value={Number.isFinite(value) ? value : 0}
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

export default SelfEvaluationPage;

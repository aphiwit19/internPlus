import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChevronLeft, ChevronRight, Users, UserPlus, X } from 'lucide-react';

import { InternRecord } from '../adminDashboardTypes';

interface RosterTabProps {
  internRoster: InternRecord[];
  onAssignSupervisor: (intern: InternRecord) => void;
}

const RosterTab: React.FC<RosterTabProps> = ({ internRoster, onAssignSupervisor }) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const visibleInterns = useMemo(() => {
    return internRoster.filter((intern) => intern.status === 'Active' || intern.status === 'WITHDRAWN');
  }, [internRoster]);

  const pageCount = useMemo(() => {
    const count = Math.ceil(visibleInterns.length / PAGE_SIZE);
    return count > 0 ? count : 1;
  }, [visibleInterns.length]);

  useEffect(() => {
    setPage((prev) => {
      if (prev < 1) return 1;
      if (prev > pageCount) return pageCount;
      return prev;
    });
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [visibleInterns.length]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleInterns.slice(start, start + PAGE_SIZE);
  }, [page, visibleInterns]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{tr('admin_roster.title')}</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
              {tr('admin_roster.active')}: {internRoster.filter(i => i.status === 'Active').length} | {tr('admin_roster.inactive')}: {internRoster.filter(i => i.status === 'WITHDRAWN').length}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">{tr('admin_roster.col_intern')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_roster.col_department')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_roster.col_supervisor')}</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('admin_roster.col_program_status')}</th>
                <th className="pb-6 text-right pr-4">{tr('admin_roster.col_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageItems.map(intern => (
                <tr key={intern.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-4">
                      <img src={intern.avatar} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100" alt="" />
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none mb-1">{intern.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{intern.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-6">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{intern.dept}</span>
                  </td>
                  <td className="py-6">
                    {intern.supervisor ? (
                      <div className="flex items-center gap-3">
                        <img src={intern.supervisor.avatar} className="w-8 h-8 rounded-lg object-cover" alt="" />
                        <span className="text-xs font-bold text-slate-700">{intern.supervisor.name}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                        <X size={12} /> {tr('admin_roster.unassigned')}
                      </span>
                    )}
                  </td>
                  <td className="py-6">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border transition-colors ${
                        intern.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}
                    >
                      {intern.status === 'Active' ? tr('admin_roster.active') : tr('admin_roster.inactive')}
                    </span>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <button
                      onClick={() => onAssignSupervisor(intern)}
                      className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-95"
                      title={tr('admin_roster.reassign_mentor')}
                    >
                      <UserPlus size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="pt-6 flex justify-center">
            <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <ChevronLeft size={18} />
              </button>

              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                    p === page
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="w-10 h-10 rounded-xl border border-slate-100 bg-white text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default RosterTab;

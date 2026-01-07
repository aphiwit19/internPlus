import React from 'react';

import { Users, UserPlus, X } from 'lucide-react';

import { InternRecord } from '../adminDashboardTypes';

interface RosterTabProps {
  internRoster: InternRecord[];
  onAssignSupervisor: (intern: InternRecord) => void;
}

const RosterTab: React.FC<RosterTabProps> = ({ internRoster, onAssignSupervisor }) => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Intern Status Overview</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
              Active: {internRoster.filter(i => i.status === 'Active').length} | Inactive: {internRoster.filter(i => i.status === 'WITHDRAWN').length}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">Intern Identity</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Department</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Supervisor</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Program Status</th>
                <th className="pb-6 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {internRoster
                .filter(intern => 
                  intern.status === 'Active' || 
                  intern.status === 'WITHDRAWN'
                )
                .map(intern => (
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
                        <X size={12} /> Unassigned
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
                      {intern.status === 'Active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <button
                      onClick={() => onAssignSupervisor(intern)}
                      className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all active:scale-95"
                      title="Re-assign Mentor"
                    >
                      <UserPlus size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default RosterTab;

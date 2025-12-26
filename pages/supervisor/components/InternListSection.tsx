import React from 'react';
import { Filter, Search, Star, UserPlus } from 'lucide-react';

export interface InternListItem {
  id: string;
  name: string;
  avatar: string;
  position: string;
  progress: number;
  attendance: string;
  performance: {
    overallRating: number;
  };
}

interface InternListSectionProps {
  interns: InternListItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenAssignIntern?: () => void;
  showAssignButton?: boolean;
  onSelectIntern: (internId: string) => void;
}

const InternListSection: React.FC<InternListSectionProps> = ({
  interns,
  searchQuery,
  onSearchQueryChange,
  onOpenAssignIntern,
  showAssignButton = true,
  onSelectIntern,
}) => {
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Intern Management</h1>
          <p className="text-slate-400 text-sm font-medium mt-4">Review performance, approve tasks, and provide feedback.</p>
        </div>
        <div className="flex items-center">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              type="text"
              placeholder="Search interns..."
              className="pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none w-full md:w-[34rem] focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </div>
          <button className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm ml-[30px]">
            <Filter size={20} />
          </button>
          {showAssignButton && (
            <button
              onClick={onOpenAssignIntern}
              className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2 ml-4"
            >
              <UserPlus size={18} strokeWidth={2.5} /> Assign Intern
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {interns.map((intern) => (
          <div
            key={intern.id}
            onClick={() => onSelectIntern(intern.id)}
            className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-6 mb-10">
              <img
                src={intern.avatar}
                className="w-20 h-20 rounded-[1.75rem] object-cover ring-6 ring-slate-50 group-hover:scale-110 transition-transform shadow-md"
                alt=""
              />
              <div>
                <h4 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{intern.name}</h4>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">{intern.position}</p>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                <span>Cohort Progress</span>
                <span className="text-slate-900 font-black">{intern.progress}%</span>
              </div>
              <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                  style={{ width: `${intern.progress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-8 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    intern.attendance === 'Clocked In'
                      ? 'bg-emerald-50 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'bg-slate-300'
                  }`}
                ></div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{intern.attendance}</span>
              </div>
              <div className="flex items-center gap-2 text-amber-500 font-black text-sm bg-amber-50 px-5 py-2 rounded-[1rem] border border-amber-100 shadow-sm">
                <Star size={16} fill="currentColor" /> {intern.performance.overallRating}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default InternListSection;

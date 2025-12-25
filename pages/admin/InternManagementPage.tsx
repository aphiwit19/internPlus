import React, { useMemo, useState } from 'react';
import { Filter, Search, UserPlus, X } from 'lucide-react';

type AdminInternStatus = 'Active' | 'Onboarding' | 'Inactive';

type AdminInternListItem = {
  id: string;
  name: string;
  avatar: string;
  position: string;
  dept: string;
  status: AdminInternStatus;
  supervisor?: {
    name: string;
    avatar: string;
  } | null;
};

const MOCK_INTERNS: AdminInternListItem[] = [
  {
    id: 'u-1',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop',
    position: 'Junior UI/UX Designer',
    dept: 'Design',
    status: 'Active',
    supervisor: {
      name: 'Sarah Connor',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop',
    },
  },
  {
    id: 'u-2',
    name: 'James Wilson',
    avatar: 'https://picsum.photos/seed/james/100/100',
    position: 'Backend Developer Intern',
    dept: 'Engineering',
    status: 'Active',
    supervisor: {
      name: 'Marcus Miller',
      avatar: 'https://picsum.photos/seed/marcus/100/100',
    },
  },
  {
    id: 'u-3',
    name: 'Sophia Chen',
    avatar: 'https://picsum.photos/seed/sophia/100/100',
    position: 'Product Manager Intern',
    dept: 'Product',
    status: 'Active',
    supervisor: null,
  },
  {
    id: 'u-4',
    name: 'Marcus Aurelius',
    avatar: 'https://picsum.photos/seed/marcus-a/100/100',
    position: 'Data Analyst Trainee',
    dept: 'Engineering',
    status: 'Onboarding',
    supervisor: null,
  },
];

const InternManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [interns] = useState<AdminInternListItem[]>(MOCK_INTERNS);

  const filteredInterns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return interns;
    return interns.filter((intern) => {
      return (
        intern.name.toLowerCase().includes(q) ||
        intern.position.toLowerCase().includes(q) ||
        intern.dept.toLowerCase().includes(q) ||
        (intern.supervisor?.name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [interns, searchQuery]);

  return (
    <div className="h-full w-full bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scrollbar-hide animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
            <div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Intern Management</h1>
              <p className="text-slate-400 text-sm font-medium mt-4">Assign supervisors and manage the active roster.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  type="text"
                  placeholder="Search interns..."
                  className="pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none w-full md:w-80 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                <Filter size={20} />
              </button>
              <button
                onClick={() => alert('Assign Intern (admin) - TODO')}
                className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
              >
                <UserPlus size={18} strokeWidth={2.5} /> Assign Intern
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredInterns.map((intern) => (
              <div
                key={intern.id}
                className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all group"
              >
                <div className="flex items-start justify-between gap-6 mb-10">
                  <div className="flex items-center gap-6">
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
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest">
                    {intern.dept}
                  </span>
                  <span
                    className={`px-4 py-2 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest border ${
                      intern.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : intern.status === 'Onboarding'
                          ? 'bg-blue-50 text-blue-600 border-blue-100'
                          : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                  >
                    {intern.status}
                  </span>
                </div>

                <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                  {intern.supervisor ? (
                    <div className="flex items-center gap-3">
                      <img src={intern.supervisor.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      <div>
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Supervisor</p>
                        <p className="text-sm font-black text-slate-900 leading-none mt-2">{intern.supervisor.name}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                      <X size={12} /> Unassigned
                    </span>
                  )}
                  <button
                    onClick={() => alert('Assign / Re-assign Supervisor (admin) - TODO')}
                    className="px-6 py-3 bg-[#EBF3FF] text-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternManagementPage;

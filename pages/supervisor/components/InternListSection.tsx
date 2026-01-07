import React, { useState } from 'react';
import { Filter, Search, Star, UserPlus, ChevronDown, X } from 'lucide-react';

export interface InternListItem {
  id: string;
  name: string;
  avatar: string;
  position: string;
  progress: number;
  attendance: string;
  status: 'Active' | 'Inactive';
  performance: {
    overallRating: number;
  };
}

interface InternListSectionProps {
  interns: InternListItem[];
  searchQuery: string;
  statusFilter: string;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onOpenAssignIntern?: () => void;
  showAssignButton?: boolean;
  onSelectIntern: (internId: string) => void;
}

const InternListSection: React.FC<InternListSectionProps> = ({
  interns,
  searchQuery,
  statusFilter,
  onSearchQueryChange,
  onStatusFilterChange,
  onOpenAssignIntern,
  showAssignButton = true,
  onSelectIntern,
}) => {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
  ];

  const filteredInterns = interns.filter(intern => {
    const matchesSearch = intern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         intern.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || intern.status === statusFilter;
    console.log('🔍 Debug - Intern Filter:', intern.name, intern.status, 'matchesStatus:', matchesStatus);
    return matchesSearch && matchesStatus;
  });
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Intern Management</h1>
          <p className="text-slate-400 text-sm font-medium mt-4">Review performance, approve tasks, and provide feedback.</p>
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm font-medium text-slate-600">
              Active: <span className="text-emerald-600 font-bold ml-1">{interns.filter(i => i.status === 'Active').length}</span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              | Inactive: <span className="text-rose-600 font-bold ml-1">{interns.filter(i => i.status === 'Inactive').length}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
          
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none hover:bg-slate-50 transition-all shadow-sm"
            >
              <Filter size={18} />
              <span>{statusOptions.find(opt => opt.value === statusFilter)?.label || 'All Status'}</span>
              <ChevronDown size={16} className={`transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showStatusDropdown && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-slate-100 rounded-[1.5rem] shadow-lg z-50 min-w-[200px]">
                <div className="py-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onStatusFilterChange(option.value);
                        setShowStatusDropdown(false);
                      }}
                      className={`w-full text-left px-6 py-3 text-sm font-medium hover:bg-slate-50 transition-colors ${
                        statusFilter === option.value ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {showAssignButton && (
            <button
              onClick={onOpenAssignIntern}
              className="px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-2"
            >
              <UserPlus size={18} strokeWidth={2.5} /> Assign Intern
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredInterns.map((intern) => (
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
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                    intern.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {intern.status === 'Active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
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

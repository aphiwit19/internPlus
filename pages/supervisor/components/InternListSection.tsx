import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Search, Star, UserPlus, ChevronDown, ChevronLeft, ChevronRight, X, BarChart3, StickyNote } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  selfEvaluation?: {
    overallRating: number;
    period?: string;
    summary?: string;
    submissionDate?: string;
  };
  hasNotifications?: boolean;
  notificationCount?: number;
}

interface InternListSectionProps {
  interns: InternListItem[];
  searchQuery: string;
  statusFilter: string;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onOpenAssignIntern?: () => void;
  showAssignButton?: boolean;
  showHeader?: boolean;
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
  showHeader = true,
  onSelectIntern,
}) => {
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [internsPage, setInternsPage] = useState(1);

  const activeCount = interns.filter((i) => i.status === 'Active').length;
  const inactiveCount = interns.filter((i) => i.status === 'Inactive').length;

  const statusOptions = [
    { value: 'all', label: tr('supervisor_dashboard.intern_list.all_status') },
    { value: 'Active', label: tr('supervisor_dashboard.intern_list.active') },
    { value: 'Inactive', label: tr('supervisor_dashboard.intern_list.inactive') },
  ];

  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
      const query = normalize(searchQuery);
      const tokens = query ? query.split(' ').filter(Boolean) : [];
      const name = normalize(intern.name);
      const matchesSearch = tokens.length === 0 ? true : tokens.every((t) => name.includes(t));
      const matchesStatus = statusFilter === 'all' || intern.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [interns, searchQuery, statusFilter]);

  const INTERNS_PER_PAGE = 9;

  const internsPageCount = useMemo(() => {
    const count = Math.ceil(filteredInterns.length / INTERNS_PER_PAGE);
    return count > 0 ? count : 1;
  }, [filteredInterns.length]);

  useEffect(() => {
    setInternsPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    setInternsPage((prev) => {
      if (prev < 1) return 1;
      if (prev > internsPageCount) return internsPageCount;
      return prev;
    });
  }, [internsPageCount]);

  const pagedInterns = useMemo(() => {
    const start = (internsPage - 1) * INTERNS_PER_PAGE;
    return filteredInterns.slice(start, start + INTERNS_PER_PAGE);
  }, [filteredInterns, internsPage]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
        {showHeader ? (
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{tr('supervisor_dashboard.intern_list.title')}</h1>
            <p className="text-slate-400 text-sm font-medium mt-4">{tr('supervisor_dashboard.intern_list.subtitle')}</p>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm font-medium text-slate-600">
                {tr('supervisor_dashboard.intern_list.active')}:{' '}
                <span className="text-emerald-600 font-bold ml-1">{activeCount}</span>
              </span>
              <span className="text-sm font-medium text-slate-600">
                | {tr('supervisor_dashboard.intern_list.inactive')}:{' '}
                <span className="text-rose-600 font-bold ml-1">{inactiveCount}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-end">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600">
                {tr('supervisor_dashboard.intern_list.active')}: <span className="text-emerald-600 font-bold ml-1">{activeCount}</span>
              </span>
              <span className="text-sm font-medium text-slate-600">
                | {tr('supervisor_dashboard.intern_list.inactive')}: <span className="text-rose-600 font-bold ml-1">{inactiveCount}</span>
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              type="text"
              placeholder={tr('supervisor_dashboard.intern_list.search_placeholder')}
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
              <span>{statusOptions.find(opt => opt.value === statusFilter)?.label || tr('supervisor_dashboard.intern_list.all_status')}</span>
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
              <UserPlus size={18} strokeWidth={2.5} /> {tr('supervisor_dashboard.intern_list.assign_intern')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {pagedInterns.map((intern) => (
          <div
            key={intern.id}
            onClick={() => onSelectIntern(intern.id)}
            className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-6 mb-10">
              <div className="relative">
                <img
                  src={intern.avatar}
                  className="w-20 h-20 rounded-[1.75rem] object-cover ring-6 ring-slate-50 group-hover:scale-110 transition-transform shadow-md"
                  alt=""
                />
                {intern.hasNotifications && (
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-pulse shadow-lg">
                    {intern.notificationCount || '!'}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{intern.name}</h4>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">{intern.position}</p>
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                    intern.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {intern.status === 'Active' ? tr('supervisor_dashboard.intern_list.active') : tr('supervisor_dashboard.intern_list.inactive')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-300">
                <span>{tr('supervisor_dashboard.intern_list.cohort_progress')}</span>
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

      {internsPageCount > 1 && (
        <div className="pt-10 flex justify-center">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInternsPage((p) => Math.max(1, p - 1))}
              disabled={internsPage <= 1}
              className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: internsPageCount }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInternsPage(p)}
                className={`w-10 h-10 rounded-xl border text-[12px] font-black transition-all ${
                  p === internsPage
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-200'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setInternsPage((p) => Math.min(internsPageCount, p + 1))}
              disabled={internsPage >= internsPageCount}
              className="w-10 h-10 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 hover:text-slate-900 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InternListSection;

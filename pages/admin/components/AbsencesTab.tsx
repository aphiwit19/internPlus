import React from 'react';

import { CheckCircle2, UserX } from 'lucide-react';

const AbsencesTab: React.FC = () => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Absence & Leave Audit</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Cross-reference for unpaid leave payroll adjustments</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] flex items-center justify-between group hover:shadow-xl transition-all">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img src="https://picsum.photos/seed/james/100/100" className="w-16 h-16 rounded-[1.25rem] object-cover ring-4 ring-white" alt="" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full border-2 border-white flex items-center justify-center">
                  <UserX size={12} strokeWidth={3} />
                </div>
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">James Wilson</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-rose-100 text-rose-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">SICK LEAVE</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">NOV 10, 2024</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-10">
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">STIPEND IMPACT</p>
                <p className="text-lg font-black text-rose-600">-100 THB</p>
              </div>
              <div className="bg-white px-6 py-3 rounded-2xl border border-rose-100 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">LOGGED FOR PAYROLL</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AbsencesTab;

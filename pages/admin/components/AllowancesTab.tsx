import React from 'react';

import { ArrowUpRight, Banknote, Building2, CreditCard, Home, ShieldCheck, UserX } from 'lucide-react';

import { AllowanceClaim } from '../adminDashboardTypes';

interface AllowancesTabProps {
  allowanceClaims: AllowanceClaim[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onAuthorize: (id: string) => void;
  onProcessPayment: (id: string) => void;
}

const AllowancesTab: React.FC<AllowancesTabProps> = ({ allowanceClaims, isLoading = false, errorMessage = null, onAuthorize, onProcessPayment }) => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Allowance Disbursement</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Intern Identity</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Mix</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Amount</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="pb-6 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!isLoading && Boolean(errorMessage) && (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="text-sm font-black text-rose-600">โหลดข้อมูลไม่สำเร็จ</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1 break-words">{errorMessage}</div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="text-sm font-black text-slate-700">กำลังดาวน์โหลดอยู่…</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">Loading payout data</div>
                  </td>
                </tr>
              )}

              {!isLoading && !errorMessage && allowanceClaims.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center">
                    <div className="text-sm font-black text-slate-700">ไม่พบข้อมูล</div>
                  </td>
                </tr>
              )}

              {allowanceClaims.map(claim => (
                <tr key={claim.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-4">
                      <img src={claim.avatar} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      <span className="text-sm font-black text-slate-900">{claim.internName}</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black" title="Office Days">
                        <Building2 size={10} /> {claim.breakdown.wfo}
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-1 rounded-lg text-[9px] font-black" title="Remote Days">
                        <Home size={10} /> {claim.breakdown.wfh}
                      </div>
                      {claim.breakdown.leaves > 0 && (
                        <div className="flex items-center gap-1 bg-rose-50 text-rose-500 px-2 py-1 rounded-lg text-[9px] font-black" title="Unpaid Leave Days">
                          <UserX size={10} /> {claim.breakdown.leaves}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-6">
                    <span className="text-sm font-black text-slate-900">{claim.amount.toLocaleString()} THB</span>
                  </td>
                  <td className="py-6">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${
                        claim.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : claim.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </td>
                  <td className="py-6 text-right pr-4">
                    {claim.status === 'PENDING' ? (
                      <button
                        onClick={() => onAuthorize(claim.id)}
                        className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto"
                      >
                        <ShieldCheck size={14} /> Authorize
                      </button>
                    ) : claim.status === 'APPROVED' ? (
                      <button
                        onClick={() => onProcessPayment(claim.id)}
                        className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto"
                      >
                        <Banknote size={14} /> Process Payout
                      </button>
                    ) : (
                      <div className="flex justify-end pr-2">
                        <ArrowUpRight size={18} className="text-slate-300" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllowancesTab;

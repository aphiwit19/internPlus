import React, { useEffect, useMemo, useState } from 'react';

import { ArrowUpRight, Banknote, Building2, CreditCard, Home, ShieldCheck, UserX } from 'lucide-react';

import { AllowanceClaim } from '../adminDashboardTypes';

interface AllowancesTabProps {
  allowanceClaims: AllowanceClaim[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onAuthorize: (id: string) => void;
  onProcessPayment: (id: string) => void;
  monthOptions: string[];
  selectedMonthKey: string;
  onSelectMonthKey: (next: string) => void;
}

const AllowancesTab: React.FC<AllowancesTabProps> = ({
  allowanceClaims,
  isLoading = false,
  errorMessage = null,
  onAuthorize,
  onProcessPayment,
  monthOptions,
  selectedMonthKey,
  onSelectMonthKey,
}) => {
  const [nameQuery, setNameQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AllowanceClaim['status']>('ALL');
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const fromMs = payFrom ? new Date(payFrom).getTime() : null;
    const toMs = payTo ? new Date(payTo).getTime() : null;

    return allowanceClaims.filter((c) => {
      if (q && !String(c.internName ?? '').toLowerCase().includes(q)) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      if (fromMs !== null || toMs !== null) {
        const paidMs = typeof c.paidAtMs === 'number' ? c.paidAtMs : null;
        if (paidMs === null) return false;
        if (fromMs !== null && paidMs < fromMs) return false;
        if (toMs !== null && paidMs > toMs) return false;
      }

      return true;
    });
  }, [allowanceClaims, nameQuery, payFrom, payTo, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [nameQuery, statusFilter, payFrom, payTo, selectedMonthKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-10">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Allowance Disbursement</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
          <div className="lg:col-span-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Search name</div>
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search intern name"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
            />
          </div>

          <div className="lg:col-span-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Period</div>
            <select
              value={selectedMonthKey}
              onChange={(e) => onSelectMonthKey(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
            >
              <option value="ALL">ALL</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PAID">PAID</option>
            </select>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pay from</div>
              <input
                type="datetime-local"
                value={payFrom}
                onChange={(e) => setPayFrom(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
              />
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pay to</div>
              <input
                type="datetime-local"
                value={payTo}
                onChange={(e) => setPayTo(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-bold text-slate-700 outline-none focus:ring-8 focus:ring-blue-500/5 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Intern Identity</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Mix</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period Amount</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pay date</th>
                <th className="pb-6 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {!isLoading && Boolean(errorMessage) && (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <div className="text-sm font-black text-rose-600">โหลดข้อมูลไม่สำเร็จ</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1 break-words">{errorMessage}</div>
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <div className="text-sm font-black text-slate-700">กำลังดาวน์โหลดอยู่…</div>
                    <div className="text-[11px] font-bold text-slate-400 mt-1">Loading payout data</div>
                  </td>
                </tr>
              )}

              {!isLoading && !errorMessage && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <div className="text-sm font-black text-slate-700">ไม่พบข้อมูล</div>
                  </td>
                </tr>
              )}

              {pageItems.map(claim => (
                <tr key={claim.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-4">
                      <img src={claim.avatar} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      <span className="text-sm font-black text-slate-900">{claim.internName}</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <span className="text-[11px] font-black text-slate-700">{claim.bankName || '-'}</span>
                  </td>
                  <td className="py-6">
                    <span className="text-[11px] font-black text-slate-700">{claim.bankAccountNumber || '-'}</span>
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
                  <td className="py-6">
                    <span className="text-[11px] font-black text-slate-700">{claim.paymentDate || '-'}</span>
                  </td>
                  <td className="py-6 text-right pr-4">
                    {claim.isPayoutLocked ? (
                      <div className="flex flex-col items-end gap-2">
                        <button
                          disabled
                          className="px-5 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2"
                          title={claim.lockReason || 'Locked until program completion'}
                        >
                          <ShieldCheck size={14} /> Locked
                        </button>
                        <div className="text-[10px] font-bold text-slate-400 max-w-[220px] text-right">
                          {claim.lockReason || 'Locked until program completion'}
                        </div>
                      </div>
                    ) : claim.status === 'PENDING' ? (
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

        {filtered.length > pageSize && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Page {safePage} of {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                &lt;
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                    p === safePage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllowancesTab;

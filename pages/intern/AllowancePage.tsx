import React, { useEffect, useMemo, useState } from 'react';
import { 
  CreditCard, 
  Info, 
  AlertTriangle, 
  Building2, 
  Home, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  History,
  Coins,
  Receipt
} from 'lucide-react';
import { Language } from '@/types';
import { useTranslation } from 'react-i18next';

import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { firestoreDb } from '@/firebase';
import { useAppContext } from '@/app/AppContext';

type AllowanceClaimRow = {
  id: string;
  monthKey?: string;
  period?: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paymentDate?: string;
  breakdown?: { wfo?: number; wfh?: number; leaves?: number };
};

type AllowanceWalletDoc = {
  totalAmount: number;
  totalPendingAmount: number;
  totalPaidAmount: number;
  statusSummary?: string;
};

interface AllowancePageProps {
  lang: Language;
}

const AllowancePage: React.FC<AllowancePageProps> = ({ lang: _lang }) => {
  const { user } = useAppContext();
  const { t } = useTranslation();
  const tr = (key: string, options?: any) => String(t(key, options));

  const [claims, setClaims] = useState<AllowanceClaimRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const [payoutFreq, setPayoutFreq] = useState<'MONTHLY' | 'END_PROGRAM'>('MONTHLY');
  const [wallet, setWallet] = useState<AllowanceWalletDoc | null>(null);

  useEffect(() => {
    const ref = doc(firestoreDb, 'config', 'systemSettings');
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const raw = snap.data() as any;
        const freq = raw?.allowance?.payoutFreq === 'END_PROGRAM' ? 'END_PROGRAM' : 'MONTHLY';
        setPayoutFreq(freq);
      },
      () => {
        // ignore
      },
    );
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setClaims([]);
      setIsLoading(false);
      setSelectedMonthKey('');
      setWallet(null);
      return;
    }
    setIsLoading(true);
    const q = query(collection(firestoreDb, 'allowanceClaims'), where('internId', '==', user.id));
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const raw = d.data() as any;
            const amount = typeof raw?.amount === 'number' ? raw.amount : 0;
            const status: AllowanceClaimRow['status'] =
              raw?.status === 'PAID' || raw?.status === 'APPROVED' || raw?.status === 'PENDING' ? raw.status : 'PENDING';
            return {
              id: d.id,
              monthKey: typeof raw?.monthKey === 'string' ? raw.monthKey : undefined,
              period: typeof raw?.period === 'string' ? raw.period : undefined,
              amount,
              status,
              paymentDate: typeof raw?.paymentDate === 'string' ? raw.paymentDate : undefined,
              breakdown: raw?.breakdown,
            } satisfies AllowanceClaimRow;
          })
          .sort((a, b) => String(b.monthKey ?? '').localeCompare(String(a.monthKey ?? '')));
        setClaims(next);
        setSelectedMonthKey((prev) => {
          if (prev) return prev;
          const firstMonthKey = next.find((c) => c.monthKey)?.monthKey ?? '';
          return firstMonthKey;
        });
        setIsLoading(false);
      },
      () => {
        setClaims([]);
        setIsLoading(false);
      },
    );
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setWallet(null);
      return;
    }
    const ref = doc(firestoreDb, 'CurrentWallet', user.id);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setWallet(null);
          return;
        }
        const raw = snap.data() as any;
        setWallet({
          totalAmount: typeof raw?.totalAmount === 'number' ? raw.totalAmount : 0,
          totalPendingAmount: typeof raw?.totalPendingAmount === 'number' ? raw.totalPendingAmount : 0,
          totalPaidAmount: typeof raw?.totalPaidAmount === 'number' ? raw.totalPaidAmount : 0,
          statusSummary: typeof raw?.statusSummary === 'string' ? raw.statusSummary : undefined,
        });
      },
      () => {
        setWallet(null);
      },
    );
  }, [user?.id]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of claims) {
      if (c.monthKey) set.add(c.monthKey);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [claims]);

  useEffect(() => {
    if (payoutFreq !== 'END_PROGRAM') return;
    if (selectedMonthKey) return;
    const latest = monthOptions[0] ?? '';
    if (latest) setSelectedMonthKey(latest);
  }, [monthOptions, payoutFreq, selectedMonthKey]);

  const filteredClaims = useMemo(() => {
    if (payoutFreq === 'END_PROGRAM') {
      const mk = selectedMonthKey || monthOptions[0] || '';
      if (!mk) return [];
      return claims.filter((c) => c.monthKey === mk);
    }
    if (!selectedMonthKey) return claims;
    return claims.filter((c) => c.monthKey === selectedMonthKey);
  }, [claims, monthOptions, payoutFreq, selectedMonthKey]);

  const walletClaims = useMemo(() => {
    if (payoutFreq !== 'END_PROGRAM') return filteredClaims;
    // END_PROGRAM: Current Wallet should reflect total across all months.
    // Ledger remains per-month via filteredClaims.
    return claims;
  }, [claims, filteredClaims, payoutFreq]);

  const totals = useMemo(() => {
    // Prefer authoritative wallet totals from Firestore when available.
    if (wallet) {
      return {
        earned: wallet.totalAmount,
        pending: wallet.totalPendingAmount,
        paid: wallet.totalPaidAmount,
      };
    }
    let earned = 0;
    let pending = 0;
    let paid = 0;
    for (const c of walletClaims) {
      earned += c.amount;
      if (c.status === 'PAID') paid += c.amount;
      if (c.status === 'PENDING' || c.status === 'APPROVED') pending += c.amount;
    }
    return { earned, pending, paid };
  }, [wallet, walletClaims]);

  const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden relative p-6 md:p-10">
      <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{tr('intern_allowance.title')}</h1>
            <p className="text-slate-500 text-sm mt-1">{tr('intern_allowance.subtitle')}</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2"><Coins size={16} /> {tr('intern_allowance.portal')}</div>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 pb-20 scrollbar-hide space-y-8">
          <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center">
              <div className="lg:max-w-md"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 bg-amber-400 text-slate-900 rounded-xl flex items-center justify-center"><AlertTriangle size={20} /></div><h2 className="text-xl font-bold">{tr('intern_allowance.terms.title')}</h2></div><p className="text-slate-400 text-xs leading-relaxed">{tr('intern_allowance.terms.subtitle')}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-start gap-4">
                  <Info size={18} className="text-indigo-400" /><div><h4 className="text-[10px] font-black uppercase text-indigo-200 mb-1">{tr('intern_allowance.terms.rules.early_withdrawal.title')}</h4><p className="text-[11px] text-slate-300">{tr('intern_allowance.terms.rules.early_withdrawal.description')}</p></div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-start gap-4">
                  <CheckCircle2 size={18} className="text-emerald-400" /><div><h4 className="text-[10px] font-black uppercase text-emerald-200 mb-1">{tr('intern_allowance.terms.rules.work_quality.title')}</h4><p className="text-[11px] text-slate-300">{tr('intern_allowance.terms.rules.work_quality.description')}</p></div>
                </div>
              </div>
            </div>
          </section>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-6">{tr('intern_allowance.wallet.title')}</p>
                <div className="flex items-end justify-between mb-8"><div><h2 className="text-5xl font-black text-slate-900 tracking-tighter">{formatNumber(totals.earned)}</h2><p className="text-blue-600 font-bold text-xs uppercase mt-1">{tr('intern_allowance.wallet.total_earned_thb')}</p></div><div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><CreditCard size={28} /></div></div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-[11px] font-bold text-slate-500 uppercase">{tr('intern_allowance.wallet.pending_approval')}</span><span className="text-sm font-black text-amber-600">{formatNumber(totals.pending)} THB</span></div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-[11px] font-bold text-slate-500 uppercase">{tr('intern_allowance.wallet.already_paid')}</span><span className="text-sm font-black text-emerald-600">{formatNumber(totals.paid)} THB</span></div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-8 bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <History size={20} /> {tr('intern_allowance.ledger.title')}
                </h3>
                <div className="flex items-center gap-3">
                  {monthOptions.length > 0 && (
                    <select
                      value={selectedMonthKey}
                      onChange={(e) => setSelectedMonthKey(e.target.value)}
                      className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-500 uppercase border border-slate-100"
                    >
                      {payoutFreq !== 'END_PROGRAM' && <option value="">{tr('intern_allowance.filters.all')}</option>}
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-bold text-slate-400 uppercase">{tr('intern_allowance.ledger.transaction_history')}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left"><th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">{tr('intern_allowance.table.date')}</th><th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('intern_allowance.table.activity_mode')}</th><th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('intern_allowance.table.daily_payout')}</th><th className="pb-6 text-[10px] font-black text-slate-400 uppercase">{tr('intern_allowance.table.status')}</th><th className="pb-6 text-right pr-4">{tr('intern_allowance.table.action')}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center">
                          <div className="text-sm font-black text-slate-700">{tr('intern_allowance.loading.title')}</div>
                          <div className="text-[11px] font-bold text-slate-400 mt-1">{tr('intern_allowance.loading.subtitle')}</div>
                        </td>
                      </tr>
                    )}

                    {!isLoading && filteredClaims.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center">
                          <div className="text-sm font-black text-slate-700">{tr('intern_allowance.empty.no_data')}</div>
                        </td>
                      </tr>
                    )}

                    {filteredClaims.map((c) => (
                      <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-6 pl-4 font-bold text-slate-700 text-sm">{c.paymentDate ?? c.period ?? c.monthKey ?? '-'}</td>
                        <td className="py-6">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-blue-50 text-blue-600" title={tr('intern_allowance.tooltips.office_days')}>
                              <Building2 size={12} /> {c.breakdown?.wfo ?? 0}
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black bg-slate-50 text-slate-500" title={tr('intern_allowance.tooltips.remote_days')}>
                              <Home size={12} /> {c.breakdown?.wfh ?? 0}
                            </div>
                          </div>
                        </td>
                        <td className="py-6"><span className="text-sm font-black text-slate-900">+{formatNumber(c.amount)} THB</span></td>
                        <td className="py-6">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border ${c.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : c.status === 'APPROVED' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{c.status}</span>
                        </td>
                        <td className="py-6 text-right pr-4"><button className="p-2.5 text-slate-300 hover:text-blue-600"><ArrowUpRight size={18} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllowancePage;

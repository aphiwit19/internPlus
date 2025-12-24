import React from 'react';

import { FileCheck, ShieldCheck } from 'lucide-react';

import { CertRequest } from '../adminDashboardTypes';

interface CertificatesTabProps {
  certRequests: CertRequest[];
  onSelectForSigning: (req: CertRequest) => void;
}

const CertificatesTab: React.FC<CertificatesTabProps> = ({ certRequests, onSelectForSigning }) => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Certificate Issuance Queue</h3>
        </div>
        <div className="space-y-6">
          {certRequests.map(req => (
            <div
              key={req.id}
              className={`p-8 rounded-[2.5rem] border flex items-center justify-between transition-all ${
                req.status === 'ISSUED'
                  ? 'bg-slate-50 border-slate-100 opacity-60'
                  : 'bg-white border-slate-100 shadow-md hover:border-blue-200 group'
              }`}
            >
              <div className="flex items-center gap-6">
                <img src={req.avatar} className="w-16 h-16 rounded-[1.25rem] object-cover ring-4 ring-slate-50" alt="" />
                <div>
                  <h4 className="text-xl font-black text-slate-900 leading-none">{req.internName}</h4>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">Requested {req.date}</p>
                </div>
              </div>
              <div className="flex-1 flex justify-center">
                <div
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border ${
                    req.type === 'Completion'
                      ? 'bg-[#F0F7FF] text-[#0066FF] border-[#D0E7FF]'
                      : 'bg-[#F0F4FF] text-[#4F46E5] border-[#E0E7FF]'
                  }`}
                >
                  {req.type} Document
                </div>
              </div>
              <div className="flex items-center gap-4">
                {req.status === 'PENDING' ? (
                  <button
                    onClick={() => onSelectForSigning(req)}
                    className="px-8 py-4 bg-[#111827] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-3 shadow-xl"
                  >
                    <ShieldCheck size={18} /> APPROVE & SIGN
                  </button>
                ) : (
                  <div className="flex items-center gap-3 text-emerald-600 font-black text-xs uppercase tracking-widest bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100">
                    <FileCheck size={20} /> DOCUMENT ISSUED
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CertificatesTab;

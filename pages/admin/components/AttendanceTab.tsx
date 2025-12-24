import React from 'react';

import { Building2, Home } from 'lucide-react';

const AttendanceTab: React.FC = () => {
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Program Attendance Audit</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Verification of daily work sessions</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase pl-4">Intern</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Latest Date</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock In</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Clock Out</th>
                <th className="pb-6 text-[10px] font-black text-slate-400 uppercase">Mode</th>
                <th className="pb-6 text-right pr-4 text-[10px] font-black text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[ 
                { name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=2574&auto=format&fit=crop', date: '2024-11-20', in: '08:45', out: '18:15', mode: 'WFO', status: 'PRESENT' },
                { name: 'James Wilson', avatar: 'https://picsum.photos/seed/james/100/100', date: '2024-11-19', in: '09:05', out: '18:00', mode: 'WFO', status: 'PRESENT' },
                { name: 'Sophia Chen', avatar: 'https://picsum.photos/seed/sophia/100/100', date: '2024-11-20', in: '09:25', out: '--', mode: 'WFH', status: 'PRESENT' },
              ].map((log, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-4">
                      <img src={log.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      <span className="text-sm font-black text-slate-900">{log.name}</span>
                    </div>
                  </td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.date}</td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.in}</td>
                  <td className="py-6 text-sm font-bold text-slate-600">{log.out}</td>
                  <td className="py-6">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-[9px] font-black uppercase ${
                        log.mode === 'WFO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}
                    >
                      {log.mode === 'WFO' ? <Building2 size={12} /> : <Home size={12} />} {log.mode}
                    </div>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-50 text-emerald-600">{log.status}</span>
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

export default AttendanceTab;

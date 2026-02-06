import React from 'react';
import { Mail, Briefcase, Phone, MessageSquareMore, Copy } from 'lucide-react';
import { Supervisor, Language } from '@/types';
import { useTranslation } from 'react-i18next';

interface SupervisorCardProps {
  supervisor: Supervisor;
  lang: Language;
}

const SupervisorCard: React.FC<SupervisorCardProps> = ({ supervisor, lang: _lang }) => {
  const { t } = useTranslation();

  const handleCopyLine = () => {
    if (supervisor.lineId) {
      navigator.clipboard.writeText(supervisor.lineId);
      alert(t('supervisor_card.line_id_copied'));
    }
  };

  return (
    <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 h-fit flex flex-col">
      <div className="mb-6">
        <h3 className="text-sm font-black text-[#0F172A] leading-none uppercase tracking-tight">{t('supervisor_card.title')}</h3>
        <p className="text-[9px] text-slate-400 mt-1.5 uppercase tracking-widest font-black">{t('supervisor_card.support')}</p>
      </div>

      <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 mb-6 transition-all hover:bg-white hover:shadow-md">
        <img 
          src={supervisor.avatar} 
          alt={supervisor.name} 
          className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-sm"
        />
        <div className="overflow-hidden">
          <h4 className="text-xs font-black text-[#0F172A] truncate leading-tight">{supervisor.name}</h4>
          <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mt-1 truncate">{supervisor.role}</p>
        </div>
      </div>

      <div className="space-y-4 mb-8 px-1">
        <div className="flex items-center gap-3 text-slate-500 group cursor-default">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
            <Mail size={14} />
          </div>
          <span className="text-[11px] font-bold truncate">{supervisor.email}</span>
        </div>
        
        <div className="flex items-center gap-3 text-slate-500 group cursor-default">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
            <Phone size={14} />
          </div>
          <span className="text-[11px] font-bold truncate">{supervisor.phone || '--'}</span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 group cursor-default">
          <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
            <Briefcase size={14} />
          </div>
          <span className="text-[11px] font-bold truncate">{supervisor.department}</span>
        </div>
      </div>

      {/* Line ID Display / Action Button */}
      <div className="bg-[#EEFBF4] border border-[#D1F0E0] rounded-2xl p-4 group transition-all hover:bg-white hover:shadow-xl hover:border-[#00B900]">
        <div className="flex items-center justify-between mb-1.5">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#00B900] text-white rounded-lg flex items-center justify-center shadow-md">
                <MessageSquareMore size={18} fill="currentColor" strokeWidth={0} />
              </div>
              <span className="text-[9px] font-black text-[#00B900] uppercase tracking-widest">{t('supervisor_card.line_id')}</span>
           </div>
           <button 
             onClick={handleCopyLine}
             className="p-1.5 text-slate-400 hover:text-[#00B900] transition-colors"
             title={t('supervisor_card.copy_id')}
           >
             <Copy size={14} />
           </button>
        </div>
        <div className="pl-10">
           <p className="text-sm font-black text-slate-900 tracking-tight">{supervisor.lineId || t('common.no_id_assigned')}</p>
        </div>
      </div>
      
      <button 
        onClick={() => supervisor.lineId && window.open(`https://line.me/ti/p/~${supervisor.lineId}`, '_blank')}
        className="w-full mt-4 bg-white text-blue-600 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] border border-blue-100 hover:bg-blue-600 hover:text-white transition-all active:scale-95 uppercase tracking-widest shadow-sm"
      >
        {t('supervisor_card.send_message')}
      </button>
    </div>
  );
};

export default SupervisorCard;

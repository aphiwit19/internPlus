import React from 'react';
import { MapPin, Menu } from 'lucide-react';
import { Language, UserProfile } from '@/types';
import { normalizeAvatarUrl } from '@/app/avatar';

interface HeaderProps {
  onMenuToggle?: () => void;
  lang: Language;
  onLangToggle: () => void;
  user: UserProfile;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, lang, onLangToggle, user }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center sticky top-0 z-40 px-4 md:px-6">
      <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          {onMenuToggle && (
            <button 
              onClick={onMenuToggle}
              className="p-2 lg:hidden text-slate-500 hover:bg-slate-50 rounded-lg"
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          {/* Language Toggle Button */}
          <button 
            onClick={onLangToggle}
            className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 group hover:border-blue-200 transition-all"
          >
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'EN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>
              EN
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${lang === 'TH' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>
              TH
            </div>
          </button>
          
          <div className="h-6 w-[1px] bg-slate-100 hidden md:block"></div>

          <div className="flex items-center gap-3 group cursor-pointer p-0.5 rounded-xl transition-colors">
            <div className="text-right hidden sm:block">
              <h4 className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">{user.name}</h4>
              <div className="flex items-center gap-1 text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] justify-end mt-0.5">
                <MapPin size={8} className="text-blue-500" />
                {user.department || 'HQ UNIT'}
              </div>
            </div>
            <img 
              src={normalizeAvatarUrl(user.avatar)} 
              alt={user.name} 
              className="w-9 h-9 rounded-[0.75rem] object-cover ring-2 ring-slate-100 group-hover:ring-blue-100 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

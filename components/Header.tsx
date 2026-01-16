import React from 'react';
import { Search, Bell, MapPin, Menu, Languages } from 'lucide-react';
import { Language } from '@/types';

interface HeaderProps {
  onMenuToggle?: () => void;
  lang: Language;
  onLangToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, lang, onLangToggle }) => {
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
          
          <div className="relative w-full max-w-[350px] hidden sm:block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder={lang === 'EN' ? "Search features..." : "ค้นหา..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all outline-none placeholder:text-slate-400 shadow-sm"
            />
          </div>
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

          <button className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white group-hover:scale-110 transition-transform"></span>
          </button>
          
          <div className="h-6 w-[1px] bg-slate-100 hidden md:block"></div>

          <div className="flex items-center gap-3 group cursor-pointer p-0.5 rounded-xl transition-colors">
            <div className="text-right hidden sm:block">
              <h4 className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tight">Vanness Plus</h4>
              <div className="flex items-center gap-1 text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] justify-end mt-0.5">
                <MapPin size={8} className="text-blue-500" />
                HQ UNIT
              </div>
            </div>
            <img 
              src="https://picsum.photos/seed/vanness/100/100" 
              alt="Admin" 
              className="w-9 h-9 rounded-[0.75rem] object-cover ring-2 ring-slate-100 group-hover:ring-blue-100 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

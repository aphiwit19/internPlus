import React, { useState } from 'react';
import { Briefcase, User, ShieldCheck, Settings, Mail, ArrowLeft, Sparkles, Calendar, UserCheck, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface RegisterPageProps {
  isLoading?: boolean;
  errorMessage?: string | null;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onContinue: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ isLoading, errorMessage, onRegister, onContinue }) => {
  const { t } = useTranslation();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifyingDetails, setIsVerifyingDetails] = useState(false);

  const isSelfRegistrationDisabled = true;

  const [joinName, setJoinName] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const handleJoin = async () => {
    setIsInitializing(true);
    try {
      await onRegister(joinName, joinEmail, joinPassword);
      setIsVerifyingDetails(true);
    } catch {
      return;
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
        
        {/* Left Side: Branding */}
        <div className="text-white hidden lg:block">
          <div className="flex items-center gap-5 mb-10">
            <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 ring-1 ring-white/10">
              <Briefcase size={32} />
            </div>
            <div>
              {/* "Outside" branding with extra wide spacing and black weight - Subtitle removed */}
              <h1 className="text-white font-black text-4xl leading-none tracking-[0.15em]">
                intern<span className="text-blue-500">Plus test</span>
              </h1>
            </div>
          </div>
          
          <h2 className="text-6xl font-black tracking-tight leading-[1.05] mb-8">
            {t('login.hero_title_line_1')} <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{t('login.hero_title_highlight')}</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm font-medium">
            {t('login.hero_description')}
          </p>
        </div>

        {/* Right Side: Login/Join Card */}
        <div className="bg-white rounded-[3.5rem] p-10 md:p-14 shadow-2xl relative w-full max-w-lg mx-auto overflow-hidden">

          {!!errorMessage && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-bold">
              {errorMessage}
            </div>
          )}
          
          {isSelfRegistrationDisabled ? (
            <div className="animate-in fade-in slide-in-from-right-12 duration-500 flex flex-col h-full">
              <Link
                to="/login"
                className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-10 hover:text-slate-900 transition-colors w-fit group"
              >
                <ArrowLeft className="transition-transform group-hover:-translate-x-1" size={14} strokeWidth={3} /> {t('register.back_to_login')}
              </Link>

              <h3 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">{t('register.registration_disabled_title')}</h3>
              <p className="text-slate-400 text-[15px] mb-10 font-medium">
                {t('register.registration_disabled_desc')}
              </p>

              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-600 text-sm font-bold mb-10">
                {t('register.registration_disabled_note')}
              </div>

              <Link
                to="/login"
                className="w-full py-6 bg-[#111827] text-white rounded-[2.2rem] font-black text-[15px] uppercase tracking-widest transition-all hover:bg-blue-600 shadow-2xl flex items-center justify-center gap-3 active:scale-95"
              >
                {t('register.go_to_login')} <ChevronRight size={20} />
              </Link>
            </div>
          ) : isVerifyingDetails ? (
            /* NEXT STEP: Confirm Details View */
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 flex flex-col items-center text-center h-full">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[1.75rem] flex items-center justify-center mb-8 shadow-xl shadow-emerald-100 border border-emerald-100">
                <UserCheck size={40} />
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{t('register.identity_verified_title')}</h3>
              <p className="text-slate-400 text-[14px] mb-10 font-medium">{t('register.identity_verified_subtitle')}</p>

              <div className="w-full space-y-4 mb-12">
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-left relative group hover:border-blue-200 transition-all">
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 group-hover:text-blue-100 transition-colors">
                    <Briefcase size={48} strokeWidth={1.5} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('register.assigned_position_label')}</p>
                    <h4 className="text-lg font-black text-slate-900">{t('register.assigned_position_value')}</h4>
                    <p className="text-[11px] font-bold text-blue-600 mt-1">{t('register.assigned_division_unknown')}</p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-left relative group hover:border-blue-200 transition-all">
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200 group-hover:text-blue-100 transition-colors">
                    <Calendar size={48} strokeWidth={1.5} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('register.internship_period_label')}</p>
                    <h4 className="text-lg font-black text-slate-900">{t('register.internship_period_value')}</h4>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{t('register.program_duration')}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={onContinue}
                className="w-full py-6 bg-[#111827] text-white rounded-full font-black text-[15px] uppercase tracking-widest transition-all hover:bg-blue-600 shadow-2xl flex items-center justify-center gap-3 active:scale-95"
              >
                {t('register.continue')} <ChevronRight size={20} />
              </button>

              <div className="mt-10 flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <CheckCircle2 size={16} className="text-emerald-500" /> {t('register.secure_onboarding_active')}
              </div>
            </div>

          ) : (
            /* INVITE CODE VIEW - EXACT AS SCREENSHOT */
            <div className="animate-in fade-in slide-in-from-right-12 duration-500 flex flex-col h-full">
              <Link 
                to="/login"
                className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-10 hover:text-slate-900 transition-colors w-fit group"
              >
                <ArrowLeft className="transition-transform group-hover:-translate-x-1" size={14} strokeWidth={3} /> {t('register.back_to_login')}
              </Link>
              
              <h3 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">{t('register.join_program_title')}</h3>
              <p className="text-slate-400 text-[15px] mb-14 font-medium">{t('register.join_program_subtitle')}</p>

              {(isLoading || isInitializing) && (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-500 text-sm font-bold mb-6">
                  {t('register.processing')}
                </div>
              )}

              <div className="space-y-12">
                <div>
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 block">{t('register.full_name_label')}</label>
                  <input
                    type="text"
                    placeholder={t('register.full_name_placeholder')}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] px-8 py-5 text-[16px] font-black text-slate-700 focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 block">{t('register.email_label')}</label>
                  <input
                    type="email"
                    placeholder={t('register.email_placeholder')}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] px-8 py-5 text-[16px] font-black text-slate-700 focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                    value={joinEmail}
                    onChange={(e) => setJoinEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 block">{t('register.password_label')}</label>
                  <input
                    type="password"
                    placeholder={t('register.password_placeholder')}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] px-8 py-5 text-[16px] font-black text-slate-700 focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleJoin()}
                    autoComplete="new-password"
                  />
                </div>
                
                <button 
                  onClick={handleJoin}
                  disabled={isInitializing}
                  className={`w-full py-6 rounded-[2.2rem] font-black text-[15px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl ${
                    isInitializing 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-[#2563EB] text-white shadow-blue-500/30 hover:bg-[#1D4ED8]'
                  }`}
                >
                  {isInitializing ? (
                    <div className="flex items-center gap-3">
                       <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                       {t('register.initializing')}
                    </div>
                  ) : (
                    <>
                      <Sparkles size={20} /> {t('register.initialize_session')}
                    </>
                  )}
                </button>
                
                <p className="text-[11px] text-center text-slate-400 font-medium leading-relaxed italic max-w-xs mx-auto px-4 mt-6">
                  {t('register.disclaimer').split('\n').map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line}
                      {idx === 0 ? <br /> : null}
                    </React.Fragment>
                  ))}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

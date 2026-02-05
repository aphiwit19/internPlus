import React, { useState } from 'react';
import { Briefcase, User, ShieldCheck, Settings, Mail, ArrowLeft, Sparkles, Calendar, UserCheck, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LoginPageProps {
  isLoading?: boolean;
  errorMessage?: string | null;
  onLogin: (email: string, password: string) => Promise<void> | void;
}

const LoginPage: React.FC<LoginPageProps> = ({ isLoading, errorMessage, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
                intern<span className="text-blue-500">Plus</span>
              </h1>
            </div>
          </div>
          
          <h2 className="text-6xl font-black tracking-tight leading-[1.05] mb-8">
            The future of <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Internship Mastery.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed max-w-sm font-medium">
            A unified ecosystem for modern trainees, mentors, and administrators. 
            Onboarding, tracking, and certification simplified.
          </p>
          
          <div className="flex items-center gap-6 mt-12 pt-12 border-t border-white/5">
             <div className="flex -space-x-3">
               {[1,2,3,4].map(i => (
                 <img key={i} src={`https://picsum.photos/seed/user-${i}/100/100`} className="w-10 h-10 rounded-full border-2 border-slate-900 object-cover" alt="" />
               ))}
               <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-400">+500</div>
             </div>
             <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Joined by leading innovators</p>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="bg-white rounded-[3.5rem] p-10 md:p-14 shadow-2xl relative w-full max-w-lg mx-auto overflow-hidden">

          {!!errorMessage && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-bold">
              {errorMessage}
            </div>
          )}
          
          <div className="animate-in fade-in duration-500">
            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Welcome Back</h3>
            <p className="text-slate-500 text-sm mb-12 font-medium">Sign in with your email and password to continue.</p>

            {isLoading && (
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-500 text-sm font-bold mb-6">
                Processing...
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 block">EMAIL</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] px-8 py-5 text-[16px] font-black text-slate-700 focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 block">PASSWORD</label>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[1.5rem] px-8 py-5 text-[16px] font-black text-slate-700 focus:ring-8 focus:ring-blue-500/5 focus:bg-white focus:border-blue-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void onLogin(email, password)}
                  autoComplete="current-password"
                />
              </div>

              <button
                onClick={() => void onLogin(email, password)}
                disabled={!!isLoading}
                className={`w-full py-6 rounded-[2.2rem] font-black text-[15px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 shadow-2xl ${
                  isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#111827] text-white hover:bg-blue-600'
                }`}
              >
                SIGN IN <ChevronRight size={20} />
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-50 text-center">
              <Link
                to="/register"
                className="text-blue-600 font-black text-[13px] uppercase tracking-widest hover:underline active:scale-95 transition-all"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

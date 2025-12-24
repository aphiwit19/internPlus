import React from 'react';
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  Target, 
  Zap, 
  Star, 
  Award, 
  TrendingUp, 
  ArrowRight,
  Briefcase,
  FileCheck,
  MessageCircle,
  ShieldCheck,
  MessageSquareMore,
  Copy,
  ChevronRight as LucideChevronRight
} from 'lucide-react';
import { UserProfile, Language } from '@/types';
import { PageId } from '@/pageTypes';

interface InternDashboardProps {
  user: UserProfile;
  onNavigate: (page: PageId) => void;
  lang: Language;
}

const InternDashboard: React.FC<InternDashboardProps> = ({ user, onNavigate, lang }) => {
  const performance = {
    technical: 88,
    communication: 92,
    punctuality: 85,
    initiative: 95,
    overallRating: 4.5
  };

  const t = {
    EN: {
      welcome: "Welcome back",
      personal: "Personal Dashboard",
      period: "Internship Period",
      currentMonth: "4th month",
      as: "as a",
      completion: "Completion",
      rating: "Rating",
      daysLeft: "Days Left",
      attendance: "Attendance",
      analysis: "Performance Analysis",
      updated: "Updated Weekly",
      technical: "Technical Execution",
      collaboration: "Team Collaboration",
      punctuality: "Deadline Punctuality",
      solving: "Problem Solving",
      growth: "Growth Projection",
      history: "View Detailed History",
      assignment: "Current Assignment",
      due: "Due in 5 days",
      planner: "Open Planner",
      summary: "Executive Summary",
      avgGrade: "AVG GRADE",
      tasksVerified: "Tasks Verified",
      achievements: "Achievements",
      ontime: "On-time Ratio",
      mentor: "Your Primary Mentor",
      comm: "Mentor Communication",
      policy: "Request Policy Sync",
      next: "Next Milestone",
      roadmap: "View Roadmap"
    },
    TH: {
      welcome: "ยินดีต้อนรับกลับมา",
      personal: "แดชบอร์ดส่วนตัว",
      period: "ระยะเวลาการฝึกงาน",
      currentMonth: "เดือนที่ 4",
      as: "ในตำแหน่ง",
      completion: "ความคืบหน้า",
      rating: "คะแนนเฉลี่ย",
      daysLeft: "วันที่เหลือ",
      attendance: "การเข้างาน",
      analysis: "การวิเคราะห์ผลงาน",
      updated: "อัปเดตรายสัปดาห์",
      technical: "ทักษะด้านเทคนิค",
      collaboration: "การทำงานร่วมกัน",
      punctuality: "ความตรงต่อเวลา",
      solving: "การแก้ปัญหา",
      growth: "การคาดการณ์การเติบโต",
      history: "ดูประวัติโดยละเอียด",
      assignment: "งานที่ได้รับมอบหมาย",
      due: "ครบกำหนดใน 5 วัน",
      planner: "เปิดเครื่องมือวางแผน",
      summary: "สรุปผลงาน",
      avgGrade: "เกรดเฉลี่ย",
      tasksVerified: "งานที่ตรวจสอบแล้ว",
      achievements: "ความสำเร็จ",
      ontime: "อัตราตรงเวลา",
      mentor: "ที่ปรึกษาหลักของคุณ",
      comm: "การติดต่อที่ปรึกษา",
      policy: "ขอซิงค์นโยบาย",
      next: "เป้าหมายถัดไป",
      roadmap: "ดูแผนผังการทำงาน"
    }
  }[lang];

  const stats = [
    { label: t.completion, value: '65%', icon: <Target className="text-blue-600" />, color: 'blue' },
    { label: t.rating, value: '4.50', icon: <Star className="text-amber-500" />, color: 'amber' },
    { label: t.daysLeft, value: '42', icon: <Calendar className="text-indigo-600" />, color: 'indigo' },
    { label: t.attendance, value: '98%', icon: <Clock className="text-emerald-600" />, color: 'emerald' },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[#F8FAFC] p-4 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto w-full overflow-y-auto pb-20 px-2 scrollbar-hide">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
              internPlus <ArrowRight size={10} strokeWidth={3} /> {t.personal}
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
              {t.welcome}, <span className="text-blue-600">{user.name.split(' ')[0]}!</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium pt-2">
              {lang === 'EN' ? `You are currently in your ` : `คุณอยู่ในช่วง `}
              <span className="font-bold text-slate-900">{t.currentMonth}</span> 
              {lang === 'EN' ? ` as a ${user.position}.` : ` ในตำแหน่ง ${user.position}`}
            </p>
          </div>
          <div className="bg-white px-6 py-4 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t.period}</p>
              <p className="text-xs font-black text-slate-900">{user.internPeriod}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Calendar size={20} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-5 hover:border-blue-200 transition-all group">
              <div className={`w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                {stat.icon}
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">{stat.value}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-12">
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  <BarChart3 className="text-blue-600" size={24} /> {t.analysis}
                </h3>
                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-100">{t.updated}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <PerformanceBar label={t.technical} score={performance.technical} color="blue" />
                <PerformanceBar label={t.collaboration} score={performance.communication} color="indigo" />
                <PerformanceBar label={t.punctuality} score={performance.punctuality} color="emerald" />
                <PerformanceBar label={t.solving} score={performance.initiative} color="rose" />
              </div>
              <div className="mt-12 pt-10 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.growth}</p>
                      <p className="text-xs text-slate-400 font-medium italic">
                        {lang === 'EN' ? `"On track for senior intern certification by next month."` : `"มีแนวโน้มได้รับใบรับรองระดับอาวุโสในเดือนหน้า"`}
                      </p>
                    </div>
                 </div>
                 <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95">
                   {t.history} <LucideChevronRight size={14} />
                 </button>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-0 group-hover:opacity-60 transition-opacity"></div>
               <div className="flex items-center justify-between mb-8 relative z-10">
                 <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                   <Briefcase className="text-indigo-600" size={24} /> {t.assignment}
                 </h3>
                 <span className="text-xs font-bold text-slate-400">{t.due}</span>
               </div>
               <div className="p-8 bg-slate-50/50 border border-slate-100 rounded-3xl relative z-10">
                 <h4 className="text-lg font-black text-slate-900 mb-2">User Flow Mapping - Auth Module</h4>
                 <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                   {lang === 'EN' 
                    ? "Designing the logic for multi-factor authentication and social login integration workflows."
                    : "ออกแบบตรรกะสำหรับการตรวจสอบสิทธิ์หลายปัจจัยและการรวมระบบล็อกอินผ่านโซเชียล"}
                 </p>
                 <div className="flex items-center justify-between pt-6 border-t border-slate-200/50">
                    <div className="flex -space-x-3">
                       {[1,2,3].map(i => (
                         <img key={i} src={`https://picsum.photos/seed/${i+10}/50/50`} className="w-10 h-10 rounded-xl border-4 border-white object-cover" alt="" />
                       ))}
                       <div className="w-10 h-10 rounded-xl bg-slate-100 border-4 border-white flex items-center justify-center text-[10px] font-black text-slate-400">+2</div>
                    </div>
                    <button 
                      onClick={() => onNavigate('assignment')}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                    >
                      {t.planner} <ArrowRight size={14} />
                    </button>
                 </div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
               <Zap className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5" />
               <div className="relative z-10">
                 <h4 className="text-xl font-black mb-8 tracking-tight">{t.summary}</h4>
                 <div className="flex items-center gap-8 mb-10">
                    <div className="w-28 h-28 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 flex flex-col items-center justify-center shadow-2xl">
                       <span className="text-5xl font-black tracking-tighter leading-none">{performance.overallRating}</span>
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mt-2">{t.avgGrade}</span>
                    </div>
                    <div className="flex-1">
                       <p className="text-sm leading-relaxed text-indigo-100 italic font-medium">
                        {lang === 'EN'
                          ? "Your technical skills are excellent. Focusing more on meeting standup updates will elevate your professional profile."
                          : "ทักษะด้านเทคนิคของคุณยอดเยี่ยมมาก การให้ความสำคัญกับการอัปเดตการประชุมจะช่วยยกระดับความเป็นมืออาชีพของคุณ"}
                       </p>
                    </div>
                 </div>
                 <div className="space-y-4 pt-8 border-t border-white/10">
                    <SummaryItem icon={<FileCheck size={14}/>} label={t.tasksVerified} count="12/15" />
                    <SummaryItem icon={<Award size={14}/>} label={t.achievements} count="03" />
                    <SummaryItem icon={<Clock size={14}/>} label={t.ontime} count="94%" />
                 </div>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">{t.mentor}</h4>
               <div className="flex items-center gap-4 mb-8">
                  <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=2574&auto=format&fit=crop" className="w-14 h-14 rounded-2xl object-cover ring-4 ring-slate-50 shadow-sm" alt="" />
                  <div>
                    <h5 className="text-sm font-black text-slate-900">Sarah Connor</h5>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Lead Product Mentor</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 group hover:bg-slate-100 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{t.comm}</p>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#00B900] rounded-lg flex items-center justify-center text-white"><MessageSquareMore size={18} fill="currentColor"/></div>
                          <span className="text-sm font-black text-slate-800 tracking-tight">sarah_mentor_ip</span>
                       </div>
                       <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors" title="Copy LINE ID"><Copy size={16} /></button>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2">
                    <ShieldCheck size={16} /> {t.policy}
                  </button>
               </div>
            </div>

            <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform scale-150 -mr-10 -mt-10">
                  <div className="w-32 h-32 rounded-full border-[12px] border-white/40 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full border-[8px] border-white/30 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-white/20"></div>
                    </div>
                  </div>
               </div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{t.next}</p>
               <h4 className="text-xl font-bold mb-8 pr-10 leading-tight">
                {lang === 'EN' ? "Quarterly Program Review Phase" : "ช่วงการประเมินโปรแกรมรายไตรมาส"}
               </h4>
               <button 
                onClick={() => onNavigate('onboarding')}
                className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95 shadow-2xl"
               >
                 {t.roadmap}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PerformanceBar = ({ label, score, color }: { label: string, score: number, color: string }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-end">
      <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</h5>
      <span className={`text-lg font-black text-${color}-600 tracking-tighter leading-none`}>{score}<span className="text-[10px] font-bold text-slate-400 ml-1">/100</span></span>
    </div>
    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
      <div className={`h-full bg-${color}-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(var(--tw-color-${color}-500-rgb),0.3)]`} style={{ width: `${score}%` }}></div>
    </div>
  </div>
);

const SummaryItem = ({ icon, label, count }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
    <div className="flex items-center gap-3">
       <div className="text-blue-400">{icon}</div>
       <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{label}</span>
    </div>
    <span className="text-sm font-black text-white">{count}</span>
  </div>
);

export default InternDashboard;

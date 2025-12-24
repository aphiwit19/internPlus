import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/shared/LoginPage';
import { Sparkles } from 'lucide-react';
import { UserProfile, UserRole, Language } from './types';
import { PageId } from './pageTypes';
import { renderAppPage } from './roles/renderAppPage';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [activeRole, setActiveRole] = useState<UserRole>('INTERN');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>('EN');

  // Sync activeRole when user logs in
  useEffect(() => {
    if (user) {
      setActiveRole(user.role);
      // Default page per role
      if (user.role === 'INTERN') setActivePage('dashboard');
      else if (user.role === 'SUPERVISOR') setActivePage('dashboard');
      else if (user.role === 'HR_ADMIN') setActivePage('dashboard');
    }
  }, [user]);

  const handleLogin = (selectedUser: UserProfile) => {
    setUser(selectedUser);
  };

  const handleLogout = () => {
    setUser(null);
    setActivePage('dashboard');
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setActiveRole(newRole);
    setActivePage('dashboard'); // Always return to dashboard on switch for safety
  };

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden text-slate-900">
      <Sidebar 
        activeId={activePage} 
        activeRole={activeRole}
        onNavigate={setActivePage} 
        onRoleSwitch={user.isDualRole ? handleRoleSwitch : undefined}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
        lang={lang}
      />

      <div className={`flex-1 flex flex-col h-screen relative overflow-hidden transition-all duration-300 lg:ml-72`}>
        <Header 
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
          lang={lang}
          onLangToggle={() => setLang(prev => prev === 'EN' ? 'TH' : 'EN')}
        />
        
        <main className="flex-1 overflow-hidden">
          {renderAppPage({
            activePage,
            activeRole,
            user,
            lang,
            onNavigate: setActivePage,
          })}
        </main>

        <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#111827] text-white rounded-full flex items-center justify-center shadow-2xl shadow-slate-900/30 hover:bg-blue-600 hover:scale-110 transition-all z-20 active:scale-95 border-2 border-white/10 group">
          <Sparkles size={24} className="group-hover:animate-spin-slow" />
        </button>
      </div>
    </div>
  );
};

export default App;

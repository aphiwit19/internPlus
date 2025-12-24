import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { PageId } from '@/pageTypes';
import { UserRole } from '@/types';

import { useAppContext } from './AppContext';
import { isPageId, pageIdToPath, RoleSlug, slugToRole } from './routeUtils';

export default function AppLayout() {
  const navigate = useNavigate();
  const { roleSlug, pageId } = useParams<{ roleSlug: RoleSlug; pageId: string }>();
  const { user, setUser, activeRole, setActiveRole, lang, toggleLang } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (roleSlug) {
      const role = slugToRole(roleSlug);
      if (role && role !== activeRole) {
        setActiveRole(role);
      }
    }
  }, [roleSlug, activeRole, setActiveRole]);

  const activeId = useMemo<PageId>(() => {
    if (pageId && isPageId(pageId)) return pageId;
    return 'dashboard';
  }, [pageId]);

  const handleLogout = () => {
    setUser(null);
    navigate('/login', { replace: true });
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setActiveRole(newRole);
    navigate(pageIdToPath(newRole, 'dashboard'), { replace: true });
  };

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden text-slate-900">
      <Sidebar
        activeId={activeId}
        activeRole={activeRole}
        onNavigate={(id) => {
          navigate(pageIdToPath(activeRole, id));
          if (window.innerWidth < 1024) setIsSidebarOpen(false);
        }}
        onRoleSwitch={user.isDualRole ? handleRoleSwitch : undefined}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
        lang={lang}
      />

      <div className="flex-1 flex flex-col h-screen relative overflow-hidden transition-all duration-300 lg:ml-72">
        <Header
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          lang={lang}
          onLangToggle={toggleLang}
        />

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

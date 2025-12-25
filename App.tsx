import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './app/AppLayout';
import LoginRoute from './app/LoginRoute';
import RegisterRoute from './app/RegisterRoute';
import RequireAuth from './app/RequireAuth';
import RequireRole from './app/RequireRole';
import RolePage from './app/RolePage';
import RootRedirect from './app/RootRedirect';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/:roleSlug/:pageId"
        element={
          <RequireAuth>
            <RequireRole>
              <AppLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<RolePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;

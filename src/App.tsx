/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider } from './context/RealtimeContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { LoginView } from './components/LoginView.tsx';
import { ManagerDashboard } from './components/manager/ManagerDashboard.tsx';
import { AgentApp } from './components/agent/AgentApp.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';
import { PstnReceiverSoftphone } from './components/common/PstnReceiverSoftphone.tsx';
function MainAppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentHash, setCurrentHash] = React.useState<string>(() => window.location.hash || '');

  React.useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // When agent logs in, ensure URI is set to #/agent
  React.useEffect(() => {
    if (user?.role === 'agent' && !window.location.hash) {
      window.location.hash = '#/agent';
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-600">Initializing Pirates world Tele Solution...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated user -> Clean Login page
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <LoginView />
        </main>
      </div>
    );
  }

  // Determine active view strictly by user role to enforce separation:
  // Admin -> Admin Infrastructure Dashboard
  // Manager -> Manager Operations Dashboard
  // Agent -> Agent Station
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const isAgent = user.role === 'agent';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {isAdmin ? (
          <AdminDashboard />
        ) : isManager ? (
          <ManagerDashboard />
        ) : isAgent ? (
          <AgentApp />
        ) : (
          <AgentApp />
        )}
      </main>

      {/* Real-time audible PSTN Receiver handset for testing manager IVR voice & DTMF transfer */}
      <PstnReceiverSoftphone />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <MainAppContent />
      </RealtimeProvider>
    </AuthProvider>
  );
}

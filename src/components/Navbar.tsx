import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRealtime } from '../context/RealtimeContext.tsx';
import { PhoneCall, LogOut, Radio, User } from 'lucide-react';

interface NavbarProps {
  onSwitchToCustomerPortal?: () => void;
  showCustomerTab?: boolean;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useRealtime();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="bg-blue-900 text-blue-200 text-xs px-2.5 py-0.5 rounded-full font-medium">Administrator</span>;
      case 'manager':
        return <span className="bg-blue-700 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">Operations Manager</span>;
      case 'agent':
        return <span className="bg-emerald-700 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">Agent Station</span>;
      case 'customer':
        return <span className="bg-slate-700 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">Recipient Terminal</span>;
      default:
        return null;
    }
  };

  return (
    <header className="bg-blue-800 text-white shadow-md border-b border-blue-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Name */}
          <div className="flex items-center gap-3">
            <div className="bg-white text-blue-800 p-2 rounded-lg shadow-sm">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                Pirates world Tele Solution
              </h1>
              <p className="text-xs text-blue-200 hidden sm:block">
                Unified Voice Center & Outbound Calling Platform
              </p>
            </div>
          </div>

          {/* Right Status & User Menu */}
          <div className="flex items-center gap-4">
            {/* Real-time Connection Indicator */}
            <div className="flex items-center gap-1.5 text-xs bg-blue-900/60 px-2.5 py-1 rounded-full border border-blue-700">
              <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
              <span className={isConnected ? 'text-blue-100' : 'text-amber-300'}>
                {isConnected ? 'Real-Time Telephony Active' : 'Connecting Engine...'}
              </span>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{user.name}</span>
                    {getRoleBadge(user.role)}
                  </div>
                  <span className="text-xs text-blue-200">@{user.username}</span>
                </div>

                <button
                  onClick={() => logout()}
                  className="flex items-center gap-1.5 bg-blue-900/80 hover:bg-red-700 text-blue-100 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-blue-700 hover:border-red-600 shadow-sm"
                  title="Sign out of station"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm text-blue-100">
                  <User className="w-4 h-4" />
                  <span>Secure Portal</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

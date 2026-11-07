'use client';

import React from 'react';
import { ShieldCheck, User, LogOut, Sparkles, Building2, LayoutDashboard, FileCheck2, Settings, AlertCircle } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  user: FirebaseUser | null;
  userProfile: any | null;
  isSuperAdmin: boolean;
  activeView: 'employee' | 'admin' | 'standards' | 'threats';
  setActiveView: (view: 'employee' | 'admin' | 'standards' | 'threats') => void;
  onOpenProfile: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  isOnline: boolean;
  isSigningIn?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  userProfile,
  isSuperAdmin,
  activeView,
  setActiveView,
  onOpenProfile,
  onSignIn,
  onSignOut,
  isOnline,
  isSigningIn = false,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveView('employee')}>
            <div className="w-10 h-10 rounded-lg bg-[#0096AF] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">PRM Quality Intelligence</span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-[#0096AF] border border-teal-200">
                  TQM Platform
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Priority Risk Management • Quality & Process Audits</p>
            </div>
          </div>

          {/* Navigation Views */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveView('employee')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeView === 'employee'
                    ? 'bg-white text-[#0096AF] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>My Audits</span>
              </button>

              <button
                onClick={() => setActiveView('standards')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeView === 'standards'
                    ? 'bg-white text-[#0096AF] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>PRM Standards</span>
              </button>

              {isSuperAdmin && (
                <button
                  onClick={() => setActiveView('admin')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                    activeView === 'admin'
                      ? 'bg-[#0096AF] text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Admin Intelligence</span>
                </button>
              )}

              <button
                onClick={() => setActiveView('threats')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeView === 'threats'
                    ? 'bg-white text-[#DC582A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#DC582A]" />
                <span>Threat Model</span>
              </button>
            </nav>
          )}

          {/* User Controls & Profile */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div
                  onClick={onOpenProfile}
                  className="cursor-pointer flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                  title="Edit Profile & Office Location"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 ring-[#0096AF]/30">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left text-xs leading-tight">
                    <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                      <span>{userProfile?.displayName || user.email?.split('@')[0]}</span>
                      {isSuperAdmin && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-300">
                          SUPER ADMIN
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 font-normal">
                      {userProfile?.department ? `${userProfile.department} (${userProfile.officeLocation || 'Fishers'})` : 'Set Up Profile'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onSignOut}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-[#0096AF] hover:bg-[#008197] disabled:opacity-70 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                <User className="w-4 h-4" />
                <span>{isSigningIn ? 'Signing In...' : 'Google Sign-In'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

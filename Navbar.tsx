import React, { useState } from 'react';
import { UserProfile } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import { Shield, Bell, LogOut, Wallet, ChevronDown, User, Sparkles, CheckSquare, Gift } from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenNotifications,
  unreadCount,
  onLogout,
  onOpenAdmin,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070B14]/95 backdrop-blur-md border-b border-[#121D33]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: NX Brand Emblem & Title & UID */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 sm:gap-2.5 cursor-pointer whitespace-nowrap shrink-0 group"
        >
          {/* Circular Emerald Badge with bold NX */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#00C995] flex items-center justify-center shadow-lg shadow-[#00C995]/25 shrink-0 group-hover:scale-105 transition-transform">
            <span className="font-display font-black text-sm sm:text-base text-slate-950 tracking-tight">
              NX
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-extrabold text-sm sm:text-base tracking-wide text-white leading-tight">
                NEXA <span className="text-white">EARN</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#092723] text-[#00C995] border border-[#00C995]/40 uppercase tracking-wide">
                WEB
              </span>
              <span
                className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wide border ${
                  nexaService.isProductionMode()
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#121B30] text-slate-400 border-[#1E2E4E]'
                }`}
                title={
                  nexaService.isProductionMode()
                    ? 'Connected to live Supabase PostgreSQL'
                    : 'Local Preview Sandbox (Offline Storage)'
                }
              >
                {nexaService.isProductionMode() ? 'LIVE' : 'DEMO'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wide leading-tight">
              UID: <span className="text-[#00C995] font-semibold">{currentUser ? currentUser.uid : 'GUEST'}</span>
            </div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        {currentUser && (
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-300">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`hover:text-[#00C995] transition-colors whitespace-nowrap ${
                activeTab === 'dashboard' ? 'text-[#00C995] font-bold' : ''
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`hover:text-[#00C995] transition-colors whitespace-nowrap ${
                activeTab === 'tasks' ? 'text-[#00C995] font-bold' : ''
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('wheel')}
              className={`hover:text-[#00C995] transition-colors whitespace-nowrap flex items-center gap-1 ${
                activeTab === 'wheel' ? 'text-[#00C995] font-bold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00C995]" />
              Spin & Win
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`hover:text-[#00C995] transition-colors whitespace-nowrap ${
                activeTab === 'withdraw' ? 'text-[#00C995] font-bold' : ''
              }`}
            >
              Wallet
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`hover:text-[#00C995] transition-colors whitespace-nowrap ${
                activeTab === 'leaderboard' ? 'text-[#00C995] font-bold' : ''
              }`}
            >
              Leaderboard
            </button>
          </nav>
        )}

        {/* Right Section: Balance Pill + Notifications + Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentUser ? (
            <>
              {/* Reference-Styled Balance Pill */}
              <div
                onClick={() => setActiveTab('withdraw')}
                className="cursor-pointer bg-[#071D1F] hover:bg-[#0A2629] border border-[#00C995]/60 hover:border-[#00C995] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-2 transition-all shadow-sm shadow-[#00C995]/20"
                title="Wallet Balance - Click to Withdraw"
              >
                <div className="w-5 h-5 rounded-full bg-[#00C995]/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-3 h-3 text-[#00C995]" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[8px] sm:text-[9px] font-bold text-[#00C995] tracking-widest uppercase leading-none">
                    BALANCE
                  </span>
                  <span className="text-xs sm:text-sm font-bold font-mono text-white tabular-nums leading-tight">
                    Rs. {currentUser.balance_pkr.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Notification Bell */}
              <button
                onClick={onOpenNotifications}
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10192D] hover:bg-[#16233B] border border-[#1A2942] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-slate-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#00C995] text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Profile / Account Dropdown Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#10192D] hover:bg-[#16233B] border border-[#1A2942] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Account Menu"
                >
                  <ChevronDown className="w-4 h-4 text-slate-300" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0D1527] border border-[#192A47] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-xs">
                    <div className="px-3 py-2 border-b border-[#16233B] mb-1">
                      <div className="font-bold text-white truncate">{currentUser.email}</div>
                      <div className="text-[10px] text-[#00C995] font-mono">UID: {currentUser.uid}</div>
                      <div className="text-[10px] text-slate-400 capitalize">Tier: {currentUser.membership_tier.replace('_', ' ')}</div>
                    </div>

                    {currentUser.is_admin && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenAdmin();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <Shield className="w-4 h-4 text-amber-400" />
                        <span>Admin Control Panel</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setActiveTab('dashboard');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-[#16233B] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#00C995]" />
                      <span>My Profile & Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-400" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('login')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#10192D] rounded-xl transition-colors cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-[#00C995] hover:bg-[#05DF9F] rounded-xl shadow-md shadow-[#00C995]/20 transition-all cursor-pointer"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

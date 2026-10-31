import React from 'react';
import { Home, CheckSquare, Sparkles, Wallet, Users, Disc } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenInvite?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenInvite,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070B14]/98 backdrop-blur-lg border-t border-[#121D33] md:hidden">
      <div className="grid grid-cols-5 items-end h-16 px-2 pb-1 relative max-w-lg mx-auto">
        {/* 1. Home */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'dashboard' ? 'text-[#00C995]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold tracking-tight">Home</span>
        </button>

        {/* 2. Tasks */}
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'tasks' ? 'text-[#00C995]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold tracking-tight">Tasks</span>
        </button>

        {/* 3. Spin & Win - Elevated Prominent Circular Emerald Button */}
        <div className="flex flex-col items-center justify-center -mt-5">
          <button
            onClick={() => setActiveTab('wheel')}
            className={`w-13 h-13 rounded-full bg-[#00C995] hover:bg-[#05DF9F] flex items-center justify-center shadow-lg shadow-[#00C995]/40 border-4 border-[#070B14] active:scale-95 transition-all cursor-pointer ${
              activeTab === 'wheel' ? 'ring-2 ring-[#00C995]' : ''
            }`}
            title="Spin & Win"
          >
            <div className="w-6 h-6 rounded-full border-2 border-slate-950 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
            </div>
          </button>
          <span
            className={`text-[10px] font-bold mt-0.5 tracking-tight ${
              activeTab === 'wheel' ? 'text-[#00C995]' : 'text-slate-300'
            }`}
          >
            Spin & Win
          </span>
        </div>

        {/* 4. Wallet */}
        <button
          onClick={() => setActiveTab('withdraw')}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'withdraw' ? 'text-[#00C995]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold tracking-tight">Wallet</span>
        </button>

        {/* 5. Invite */}
        <button
          onClick={() => {
            if (onOpenInvite) {
              onOpenInvite();
            } else {
              setActiveTab('dashboard');
            }
          }}
          className={`flex flex-col items-center justify-center h-full transition-colors cursor-pointer ${
            activeTab === 'invite' ? 'text-[#00C995]' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-semibold tracking-tight">Invite</span>
        </button>
      </div>
    </nav>
  );
};

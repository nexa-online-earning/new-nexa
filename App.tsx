import React, { useState, useEffect } from 'react';
import { UserProfile } from './types/nexa';
import { nexaService } from './services/nexaService';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { ApkDownloadPage } from './pages/ApkDownloadPage';
import { LoginPage } from './pages/LoginPage';
import { SpinWheel } from './components/SpinWheel';
import { DailyTasksModal } from './components/DailyTasksModal';
import { WithdrawalModal } from './components/WithdrawalModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { PremiumUpgradeModal } from './components/PremiumUpgradeModal';
import { NotificationsModal } from './components/NotificationsModal';
import { AdminPortal } from './pages/AdminPortal';
import { BottomNav } from './components/BottomNav';
import { HelperPage } from './pages/HelperPage';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => nexaService.getCurrentUser());
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [initialRefCode, setInitialRefCode] = useState<string>('');
  const [isDirectRegistration, setIsDirectRegistration] = useState<boolean>(false);
  const [adminInitialTab, setAdminInitialTab] = useState<string>('verify');
  const [, setSyncTick] = useState(0);
  const [helper, setHelper] = useState<{ kind: 'verify' | 'bonus'; token: string } | null>(() => {
    const h = typeof window !== 'undefined' ? window.location.hash : '';
    if (h.startsWith('#helper-verify=')) return { kind: 'verify', token: h.slice('#helper-verify='.length) };
    if (h.startsWith('#helper-bonus=')) return { kind: 'bonus', token: h.slice('#helper-bonus='.length) };
    return null;
  });

  // Modals
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Sync route and hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#helper-verify=')) {
        setHelper({ kind: 'verify', token: hash.slice('#helper-verify='.length) });
      } else if (hash.startsWith('#helper-bonus=')) {
        setHelper({ kind: 'bonus', token: hash.slice('#helper-bonus='.length) });
      } else if (hash.startsWith('#ref=')) {
        const code = hash.replace('#ref=', '');
        setInitialRefCode(code);
        setIsDirectRegistration(false);
        setActiveTab('register');
      } else if (hash === '#register-direct') {
        setInitialRefCode('');
        setIsDirectRegistration(true);
        setActiveTab('register');
      } else if (hash === '#admin-verify') {
        setAdminInitialTab('verify');
        setActiveTab('admin');
      } else if (hash === '#admin-bonus') {
        setAdminInitialTab('bonus');
        setActiveTab('admin');
      } else if (hash === '#download') {
        setActiveTab('download');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Restore the real logged-in user (Supabase session) and keep data in sync
  useEffect(() => {
    nexaService.restoreSession().then((u) => {
      if (u) setCurrentUser(u);
      else if (nexaService.isProductionMode()) setCurrentUser(null);
    });
    const onSynced = () => {
      setCurrentUser(nexaService.getCurrentUser());
      setSyncTick((t) => t + 1);
    };
    window.addEventListener('nexa-synced', onSynced);
    return () => window.removeEventListener('nexa-synced', onSynced);
  }, []);

  // Update unread count
  useEffect(() => {
    if (currentUser) {
      const notifs = nexaService.getNotifications(currentUser.uid);
      setUnreadCount(notifs.filter((n) => !n.is_read).length);
    } else {
      setUnreadCount(0);
    }
  }, [currentUser]);

  const handleUserUpdated = (updated: UserProfile) => {
    setCurrentUser(updated);
    const notifs = nexaService.getNotifications(updated.uid);
    setUnreadCount(notifs.filter((n) => !n.is_read).length);
  };

  const handleRegistered = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    window.location.hash = '#download';
    setActiveTab('download');
  };

  const handleLoggedIn = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    nexaService.logoutUser();
    setCurrentUser(null);
    setActiveTab('login');
  };

  if (helper) {
    return <HelperPage kind={helper.kind} token={helper.token} />;
  }

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-[#00C995] selection:text-slate-950">
      {/* Top Bar Navigation */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (!currentUser && (tab === 'dashboard' || tab === 'wheel' || tab === 'tasks' || tab === 'withdraw' || tab === 'leaderboard')) {
            setActiveTab('login');
          } else {
            setActiveTab(tab);
          }
        }}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        unreadCount={unreadCount}
        onLogout={handleLogout}
        onOpenAdmin={() => setActiveTab('admin')}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-16">
        {/* If Admin Portal is active */}
        {activeTab === 'admin' && currentUser?.is_admin ? (
          <AdminPortal
            currentUser={currentUser}
            onExitAdmin={() => setActiveTab('dashboard')}
            initialTab={adminInitialTab}
          />
        ) : activeTab === 'download' ? (
          <ApkDownloadPage
            currentUser={currentUser}
            onProceedToDashboard={() => setActiveTab(currentUser ? 'dashboard' : 'login')}
          />
        ) : activeTab === 'register' || (!currentUser && activeTab !== 'login') ? (
          <RegistrationPage
            onRegistered={handleRegistered}
            onGoToLogin={() => setActiveTab('login')}
            initialRefCode={initialRefCode}
            isDirectRegistrationOnly={isDirectRegistration}
          />
        ) : activeTab === 'login' && !currentUser ? (
          <LoginPage
            onLoggedIn={handleLoggedIn}
            onGoToRegister={() => setActiveTab('register')}
          />
        ) : !currentUser ? (
          <LoginPage
            onLoggedIn={handleLoggedIn}
            onGoToRegister={() => setActiveTab('register')}
          />
        ) : activeTab === 'wheel' ? (
          <SpinWheel currentUser={currentUser} onUserUpdated={handleUserUpdated} />
        ) : activeTab === 'tasks' ? (
          <DailyTasksModal currentUser={currentUser} onUserUpdated={handleUserUpdated} />
        ) : activeTab === 'withdraw' ? (
          <WithdrawalModal
            currentUser={currentUser}
            onUserUpdated={handleUserUpdated}
            onOpenPremiumUpgrade={() => setShowPremiumModal(true)}
          />
        ) : activeTab === 'leaderboard' ? (
          <LeaderboardModal
            currentUser={currentUser}
            onUserUpdated={handleUserUpdated}
            onOpenPremiumUpgrade={() => setShowPremiumModal(true)}
          />
        ) : (
          <DashboardPage
            currentUser={currentUser}
            onUserUpdated={handleUserUpdated}
            onNavigateTab={setActiveTab}
            onOpenPremiumUpgrade={() => setShowPremiumModal(true)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed) */}
      {currentUser && activeTab !== 'admin' && activeTab !== 'download' && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenInvite={() => setActiveTab('dashboard')}
        />
      )}

      {/* Premium Upgrade Modal */}
      {showPremiumModal && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8">
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#16233B] border border-[#223554] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
            <PremiumUpgradeModal
              currentUser={currentUser}
              onUserUpdated={handleUserUpdated}
              onClose={() => setShowPremiumModal(false)}
            />
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotificationsModal && currentUser && (
        <NotificationsModal
          user_uid={currentUser.uid}
          onClose={() => setShowNotificationsModal(false)}
          onRefresh={() => {
            if (currentUser) {
              const notifs = nexaService.getNotifications(currentUser.uid);
              setUnreadCount(notifs.filter((n) => !n.is_read).length);
            }
          }}
        />
      )}

      {/* Quiet Footer */}
      <footer className="w-full border-t border-[#121D33] py-6 px-4 text-center text-xs text-slate-500 mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-white">NEXA EARN</span>
            <span>·</span>
            <span className="text-[#00C995] font-semibold">Official Release</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} NEXA EARN. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;

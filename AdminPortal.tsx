import React, { useState, useEffect } from 'react';
import { HelperLinkCard } from '../components/HelperLinkCard';
import { UserProfile, DailyTaskItem } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import { runAllNexaEarnTests, TestResult } from '../tests/businessRules.test';
import {
  Shield,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Crown,
  Wallet,
  Play,
  Gift,
  ArrowLeft,
  Sparkles,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface AdminPortalProps {
  currentUser: UserProfile;
  onExitAdmin: () => void;
  initialTab?: string;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onExitAdmin,
  initialTab = 'verify',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Bonus modal state
  const [bonusUidInput, setBonusUidInput] = useState('');
  const [bonusAmountInput, setBonusAmountInput] = useState(100);
  const [showBonusConfirmModal, setShowBonusConfirmModal] = useState(false);
  const [bonusTargetUser, setBonusTargetUser] = useState<UserProfile | null>(null);
  const [bonusHasPrevious, setBonusHasPrevious] = useState(false);

  // Test suite state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testRunning, setTestRunning] = useState(false);

  // Data refresh triggers
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Live site: load everything from Supabase and refresh whenever data changes
  useEffect(() => {
    nexaService.syncFromServer();
    const onSynced = () => setRefreshKey((k) => k + 1);
    window.addEventListener('nexa-synced', onSynced);
    return () => window.removeEventListener('nexa-synced', onSynced);
  }, []);

  const verifyRequests = nexaService.getVerificationRequests();
  const membershipPayments = nexaService.getMembershipPayments();
  const withdrawals = nexaService.getWithdrawals();
  const tasks = nexaService.getDailyTasks();
  const redeemCodes = nexaService.getRedeemCodes();
  const auditLogs = nexaService.getAuditLogs();

  // Search results
  const searchResults = searchQuery.trim() ? nexaService.searchUsers(searchQuery) : [];

  // Enforce server/client boundary admin check
  if (!currentUser?.is_admin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-[#0D1527] border border-red-500/40 text-center shadow-2xl">
        <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-sm text-slate-400 mb-6">
          You do not possess verified administrator authorization to access the NEXA EARN Admin Portal.
        </p>
        <button
          onClick={onExitAdmin}
          className="px-6 py-2.5 rounded-xl bg-[#00C995] text-slate-950 font-bold text-xs hover:bg-[#00E5AA] transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleCopyLink = (name: string, hash: string) => {
    const url = `${window.location.origin}/#${hash}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(name);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Verification actions
  const handleApproveVerification = async (user_uid: string) => {
    const res = await nexaService.approveUserVerification(user_uid, currentUser.email);
    alert(
      res.bonusCredited
        ? `User ${user_uid} verified! PKR 30 referral bonus credited to referrer.`
        : `User ${user_uid} verified successfully.`
    );
    refresh();
  };

  const handleRejectVerification = (user_uid: string) => {
    const reason = prompt('Enter rejection reason:') || 'Invalid details';
    nexaService.rejectUserVerification(user_uid, currentUser.email, reason);
    refresh();
  };

  // Membership payment approval
  const handleApprovePayment = async (paymentId: string) => {
    const res = await nexaService.approveMembershipPayment(paymentId, currentUser.email);
    alert(
      res.commissionCredited
        ? 'Membership Approved! User upgraded to Premium. PKR 200 commission credited to referrer!'
        : 'Membership Approved! User upgraded to Premium.'
    );
    refresh();
  };

  const handleRejectPayment = (paymentId: string) => {
    const reason = prompt('Enter rejection reason:') || 'TRX ID not found in mobile statement';
    nexaService.rejectMembershipPayment(paymentId, currentUser.email, reason);
    refresh();
  };

  // Withdrawal actions
  const handleApproveWithdrawal = (wdId: string) => {
    const trx = prompt('Enter Bank / Mobile TRX reference for confirmation:');
    if (!trx) return;
    nexaService.approveWithdrawal(wdId, currentUser.email, trx);
    refresh();
  };

  const handleRejectWithdrawal = (wdId: string) => {
    const reason = prompt('Enter rejection reason:') || 'Invalid account details';
    nexaService.rejectWithdrawal(wdId, currentUser.email, reason);
    refresh();
  };

  // Registration Bonus workflow
  const handleInitiateBonus = (uidToSearch: string) => {
    const user = nexaService.getUserByUid(uidToSearch.trim());
    if (!user) {
      alert('User not found with UID: ' + uidToSearch);
      return;
    }
    const prevBonus = nexaService.getRegistrationBonusRecord(user.uid);
    setBonusTargetUser(user);
    setBonusHasPrevious(Boolean(prevBonus));
    setShowBonusConfirmModal(true);
  };

  const handleConfirmSendBonus = async () => {
    if (!bonusTargetUser) return;
    const res = await nexaService.sendRegistrationBonus(
      bonusTargetUser.uid,
      bonusAmountInput,
      currentUser.email
    );
    setShowBonusConfirmModal(false);
    if (res.success) {
      alert(`PKR ${bonusAmountInput} Registration Bonus issued to ${bonusTargetUser.uid}!`);
      refresh();
    } else {
      alert(res.error || 'Failed to issue bonus.');
    }
  };

  // Task unlock toggle
  const handleToggleTaskUnlock = (task: DailyTaskItem) => {
    task.is_admin_unlocked = !task.is_admin_unlocked;
    nexaService.updateDailyTask(task);
    refresh();
  };

  // Device lock reset
  const handleResetDevice = (uid: string) => {
    if (confirm(`Reset Android device lock for user ${uid}? They will be able to log in on a new device.`)) {
      nexaService.resetDeviceLock(uid, currentUser.email);
      alert(`Device lock reset for user ${uid}.`);
      refresh();
    }
  };

  // Run Test Suite
  const handleRunTests = async () => {
    setTestRunning(true);
    try {
      const results = await runAllNexaEarnTests();
      setTestResults(results);
    } catch (e: any) {
      console.error('Test execution error:', e);
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-12" key={refreshKey}>
      {/* Admin Top Header & Direct Links */}
      <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00C995]/5 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#092B28] border border-[#00C995]/40 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#00C995]" />
              </div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
                NEXA EARN <span className="text-[#00C995]">Admin Portal</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Logged in as Master Administrator: <span className="font-mono text-[#00C995] font-semibold">{currentUser.email}</span>
            </p>
          </div>

          <button
            onClick={onExitAdmin}
            className="py-2.5 px-4 bg-[#09101E] hover:bg-[#16233B] border border-[#16233B] hover:border-[#00C995]/40 text-xs font-semibold rounded-xl text-slate-200 transition-colors cursor-pointer self-start md:self-auto flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-[#00C995]" />
            <span>Back to User Dashboard</span>
          </button>
        </div>

        {/* 3 Copyable Public / Admin URLs */}
        <div className="mt-6 pt-5 border-t border-[#16233B] grid grid-cols-1 md:grid-cols-3 gap-3 relative">
          <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                User Verification Panel URL
              </span>
              <span className="text-xs text-slate-200 font-mono">/#admin-verify</span>
            </div>
            <button
              onClick={() => handleCopyLink('verify', 'admin-verify')}
              className="p-2 hover:bg-[#16233B] rounded-lg text-[#00C995] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedUrl === 'verify' ? <Check className="w-3.5 h-3.5 text-[#00C995]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'verify' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Registration Bonus Panel URL
              </span>
              <span className="text-xs text-slate-200 font-mono">/#admin-bonus</span>
            </div>
            <button
              onClick={() => handleCopyLink('bonus', 'admin-bonus')}
              className="p-2 hover:bg-[#16233B] rounded-lg text-[#00C995] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedUrl === 'bonus' ? <Check className="w-3.5 h-3.5 text-[#00C995]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'bonus' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Direct Registration-Only URL
              </span>
              <span className="text-xs text-slate-200 font-mono">/#register-direct</span>
            </div>
            <button
              onClick={() => handleCopyLink('direct', 'register-direct')}
              className="p-2 hover:bg-[#16233B] rounded-lg text-[#00C995] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copiedUrl === 'direct' ? <Check className="w-3.5 h-3.5 text-[#00C995]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'direct' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Universal Search Bar */}
      <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 shadow-xl">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
          Universal Search (by UID, WhatsApp, TRX/TID, or Email)
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00C995]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search e.g. NE-100001, 03001234567, TRX982736451, or ali@example.com"
            className="w-full pl-11 pr-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] font-mono transition-colors"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-[#16233B] pt-3">
            <div className="text-xs text-[#00C995] font-bold">Found {searchResults.length} Matching Users:</div>
            {searchResults.map((u) => (
              <div
                key={u.uid}
                className="p-3 rounded-xl bg-[#080E1C] border border-[#16233B] flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-[#00C995] mr-2">{u.uid}</span>
                  <span className="text-white mr-2">{u.email}</span>
                  <span className="text-slate-400 font-mono">{u.whatsapp_number || 'No WhatsApp'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#00C995] font-bold">Rs. {u.balance_pkr.toLocaleString()}</span>
                  <button
                    onClick={() => handleInitiateBonus(u.uid)}
                    className="px-2.5 py-1 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
                  >
                    Send Bonus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verification numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-[#0D1527] border border-[#16233B]">
          <div className="text-[11px] text-slate-400 mb-1">Today Verified Users</div>
          <div className="text-2xl font-bold text-[#00C995] font-mono">{nexaService.getVerificationStats().today}</div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0D1527] border border-[#16233B]">
          <div className="text-[11px] text-slate-400 mb-1">Total Verified Users</div>
          <div className="text-2xl font-bold text-white font-mono">{nexaService.getVerificationStats().total}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#16233B] text-xs">
        {[
          { id: 'verify', label: 'User Verification' },
          { id: 'bonus', label: 'Registration Bonus' },
          { id: 'payments', label: 'Premium Deposits' },
          {
            id: 'withdrawals',
            label: withdrawals.filter((w) => w.status === 'pending').length
              ? `Withdrawals (${withdrawals.filter((w) => w.status === 'pending').length} NEW)`
              : 'Withdrawals',
          },
          { id: 'tasks', label: 'Daily Tasks' },
          { id: 'redeem', label: 'Redeem Codes' },
          { id: 'tests', label: 'Automated Tests (PART 36)' },
          { id: 'logs', label: 'Audit Logs & Ledger' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap font-semibold cursor-pointer transition-all ${
              activeTab === tab.id
                ? 'bg-[#00C995] text-slate-950 font-bold shadow-md shadow-[#00C995]/20'
                : 'text-slate-300 hover:text-white hover:bg-[#0D1527]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: User Verification Panel */}
      {activeTab === 'verify' && (
        <>
        <div className="max-w-2xl mx-auto">
          <HelperLinkCard kind="verify" title="Account Verification link (share with a trusted helper)" />
        </div>
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="font-display font-bold text-lg text-white">
              User Verification Panel ({verifyRequests.length} Requests)
            </h3>
            <span className="text-xs text-slate-400">
              Approving automatically credits PKR 30 referral bonus to referring user.
            </span>
          </div>

          {verifyRequests.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No verification requests found.</p>
          ) : (
            <div className="space-y-3">
              {verifyRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-[#080E1C] border border-[#16233B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#00C995] text-sm">{req.user_uid}</span>
                      <span className="text-white font-medium">{req.email}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          req.status === 'approved'
                            ? 'bg-[#082E28] text-[#00C995] border border-[#00C995]/40'
                            : req.status === 'rejected'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-slate-400 font-mono">
                      WhatsApp: <strong className="text-slate-200">{req.whatsapp_number}</strong> · Submitted: {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveVerification(req.user_uid)}
                        className="px-3.5 py-1.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Credit PKR 30
                      </button>
                      <button
                        onClick={() => handleRejectVerification(req.user_uid)}
                        className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}

      {/* TAB 2: Registration Bonus Panel */}
      {activeTab === 'bonus' && (
        <>
        <div className="max-w-2xl mx-auto">
          <HelperLinkCard kind="bonus" title="Registration Bonus link (share with a trusted helper)" />
        </div>
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#092B28] flex items-center justify-center">
              <Gift className="w-5 h-5 text-[#00C995]" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">
              Instagram Registration Bonus Panel
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Review user UID claims submitted on Instagram and issue one-time 50–500 PKR registration bonuses with confirmation safeguards.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">User UID</label>
              <input
                type="text"
                value={bonusUidInput}
                onChange={(e) => setBonusUidInput(e.target.value)}
                placeholder="e.g. NE-204892"
                className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-[#00C995]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Bonus Amount (PKR 50 to PKR 500)
              </label>
              <input
                type="number"
                min={50}
                max={500}
                value={bonusAmountInput}
                onChange={(e) => setBonusAmountInput(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white font-mono focus:outline-none focus:border-[#00C995]"
              />
            </div>

            <button
              onClick={() => handleInitiateBonus(bonusUidInput)}
              className="w-full py-3 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-xl shadow-lg shadow-[#00C995]/20 cursor-pointer text-sm transition-all"
            >
              Verify User & Prepare Bonus
            </button>
          </div>
        </div>
        </>
      )}

      {/* TAB 3: Membership Payments / Deposits */}
      {activeTab === 'payments' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="font-display font-bold text-lg text-white">
              PKR 500 Premium Membership Deposits
            </h3>
            <span className="text-xs text-slate-400">
              Approval awards PKR 200 commission to qualifying referrer.
            </span>
          </div>

          {membershipPayments.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No deposit submissions found.</p>
          ) : (
            <div className="space-y-3">
              {membershipPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#080E1C] border border-[#16233B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#00C995] text-sm">{p.user_uid}</span>
                      <span className="text-white font-bold">TRX: {p.trx_id}</span>
                      <span className="text-slate-300 font-semibold uppercase">({p.payment_method})</span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      Amount: <strong>PKR {p.amount_pkr}</strong> · Status: <span className="text-amber-400 font-bold uppercase">{p.status}</span> · Date: {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>

                  {p.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprovePayment(p.id)}
                        className="px-3.5 py-1.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Approve (Upgrade & Credit PKR 200)
                      </button>
                      <button
                        onClick={() => handleRejectPayment(p.id)}
                        className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Withdrawals Management */}
      {activeTab === 'withdrawals' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <h3 className="font-display font-bold text-lg text-white mb-4">
            Pending & Completed Withdrawals
          </h3>

          {withdrawals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No withdrawal records found.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-2xl bg-[#080E1C] border border-[#16233B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#00C995]">{w.user_uid}</span>
                      {w.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-extrabold tracking-wide animate-pulse">
                          NEW
                        </span>
                      )}
                      <span className="text-white font-bold">
                        Requested: PKR {w.requested_amount} (Fee: PKR {w.fee_amount})
                      </span>
                      <span className="text-[#00C995] font-mono font-bold">
                        Net: PKR {w.net_payable_amount}
                      </span>
                    </div>
                    <div className="text-slate-400 mt-1">
                      {w.payment_method.toUpperCase()} · Account Title: <strong>{w.account_holder_name}</strong> · Number: <strong className="text-slate-200 font-mono">{w.account_number}</strong>
                    </div>
                  </div>

                  {w.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveWithdrawal(w.id)}
                        className="px-3.5 py-1.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Mark Paid (Enter TRX)
                      </button>
                      <button
                        onClick={() => handleRejectWithdrawal(w.id)}
                        className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg cursor-pointer transition-colors"
                      >
                        Reject & Refund
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        w.status === 'completed'
                          ? 'bg-[#082E28] border border-[#00C995]/50 text-[#00C995]'
                          : 'bg-red-950 border border-red-700 text-red-300'
                      }`}
                    >
                      {w.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Daily Tasks Management */}
      {activeTab === 'tasks' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <h3 className="font-display font-bold text-lg text-white mb-4">
            Daily Task Management & URL Configuration
          </h3>

          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-2xl bg-[#080E1C] border border-[#16233B] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      Task {task.task_number}: {task.title}
                    </span>
                    <span className="text-[#00C995] font-mono font-bold">Reward: PKR {task.reward_pkr}</span>
                    {task.task_number === 1 ? (
                      <span className="text-[10px] bg-[#072421] text-[#00C995] px-2 py-0.5 rounded font-semibold border border-[#00C995]/40">
                        Default Unlocked
                      </span>
                    ) : task.is_admin_unlocked ? (
                      <span className="text-[10px] bg-[#072421] text-[#00C995] px-2 py-0.5 rounded font-semibold border border-[#00C995]/40">
                        Admin Unlocked
                      </span>
                    ) : (
                      <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded font-semibold border border-red-800">
                        Admin Locked
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono truncate max-w-lg">{task.action_url}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const newUrl = prompt('Enter new task action URL:', task.action_url);
                      if (newUrl) {
                        task.action_url = newUrl.trim();
                        nexaService.updateDailyTask(task);
                        refresh();
                      }
                    }}
                    className="px-3 py-1.5 bg-[#10192D] hover:bg-[#16233B] border border-[#16233B] text-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Edit URL
                  </button>
                  {task.task_number > 1 && (
                    <button
                      onClick={() => handleToggleTaskUnlock(task)}
                      className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors ${
                        task.is_admin_unlocked
                          ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60'
                          : 'bg-[#00C995] text-slate-950 hover:bg-[#05DF9F]'
                      }`}
                    >
                      {task.is_admin_unlocked ? 'Lock Task' : 'Unlock for Premium'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Redeem Codes */}
      {activeTab === 'redeem' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-white">
              Redeem Code Generator & Active Codes
            </h3>
            <button
              onClick={() => {
                const codeName = prompt('Enter code name (e.g. FLASH500):');
                const hours = Number(prompt('Enter validity in hours (e.g. 4, 5, or 6):', '5') || 5);
                const maxUses = Number(prompt('Enter maximum claims limit:', '100') || 100);
                if (codeName) {
                  const res = nexaService.createRedeemCode({
                    code: codeName,
                    validHours: hours,
                    maxUses,
                  });
                  if (res.success) alert('Redeem code created!');
                  refresh();
                }
              }}
              className="px-4 py-2 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all"
            >
              + Create New Redeem Code
            </button>
          </div>

          <div className="space-y-3">
            {redeemCodes.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B] flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-[#00C995] text-sm mr-2">{c.code}</span>
                  <span className="text-slate-400">
                    Claims: {c.times_used} / {c.max_uses} · Expires: {new Date(c.expires_at).toLocaleString()}
                  </span>
                </div>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold">Reward: 50–500 PKR</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: Automated Test Suite */}
      {activeTab === 'tests' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display font-black text-xl text-white">
                Automated Production Test Runner (PART 36)
              </h3>
              <p className="text-xs text-slate-400">
                Executes all 28 mandatory requirement tests: referrals, PKR 30 bonus, 5 initial spins (900-1000 PKR), withdrawal fees, device lock, etc.
              </p>
            </div>
            <button
              onClick={handleRunTests}
              disabled={testRunning}
              className="px-5 py-2.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-[#00C995]/20 cursor-pointer flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{testRunning ? 'Running Tests...' : 'Execute All 28 Tests'}</span>
            </button>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2 mt-4 max-h-[500px] overflow-y-auto pr-1 text-xs">
              {testResults.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    t.passed
                      ? 'bg-[#082E28] border-[#00C995]/50 text-emerald-200'
                      : 'bg-red-950/40 border-red-800/60 text-red-200'
                  }`}
                >
                  <span className="font-bold shrink-0">
                    {t.passed ? '✓' : '✗'} Test #{t.id}:
                  </span>
                  <div>
                    <span className="font-semibold block">{t.name}</span>
                    <span className="text-[11px] opacity-80 block">{t.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: Audit Logs & Ledger */}
      {activeTab === 'logs' && (
        <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-xl">
          <h3 className="font-display font-bold text-lg text-white mb-4">
            Immutable Administrative Audit Logs
          </h3>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 text-xs">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-[#080E1C] border border-[#16233B] flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-[#00C995] font-bold mr-2">{log.action}</span>
                  <span className="text-white">Admin: {log.admin_email}</span>
                  <span className="text-slate-400 ml-2">Target: {log.target_id}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonus Confirmation Modal */}
      {showBonusConfirmModal && bonusTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 shadow-2xl relative">
            <h3 className="font-display font-bold text-lg text-white mb-3">
              Confirm Registration Bonus
            </h3>

            <div className="space-y-2 text-xs text-slate-300 mb-5 p-3 rounded-2xl bg-[#070B14] border border-[#16233B]">
              <div className="flex justify-between">
                <span>Target UID:</span>
                <span className="font-mono text-[#00C995] font-bold">{bonusTargetUser.uid}</span>
              </div>
              <div className="flex justify-between">
                <span>Email:</span>
                <span className="text-white">{bonusTargetUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Bonus Amount:</span>
                <span className="font-bold text-[#00C995]">PKR {bonusAmountInput}</span>
              </div>
              <div className="pt-2 border-t border-[#16233B] flex justify-between">
                <span>Previous Bonus Status:</span>
                <span
                  className={`font-bold ${
                    bonusHasPrevious ? 'text-red-400' : 'text-[#00C995]'
                  }`}
                >
                  {bonusHasPrevious ? '⚠️ ALREADY RECEIVED BONUS' : '✓ No Prior Bonus Claimed'}
                </span>
              </div>
            </div>

            {bonusHasPrevious && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
                ⚠️ Warning: This user has already claimed a registration bonus. Proceeding will trigger a duplicate exception.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowBonusConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl bg-[#080E1C] border border-[#16233B] text-slate-300 text-xs font-semibold cursor-pointer hover:bg-[#16233B]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendBonus}
                className="py-2.5 px-4 rounded-xl bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 text-xs font-bold shadow-lg shadow-[#00C995]/20 cursor-pointer transition-all"
              >
                Confirm & Send Bonus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

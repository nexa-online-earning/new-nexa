import React, { useState } from 'react';
import { UserProfile, WithdrawalRecord } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import {
  Wallet,
  Copy,
  Check,
  Crown,
  Shield,
  ShieldCheck,
  Users,
  Sparkles,
  ArrowUpRight,
  Gift,
  Send,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Upload,
  User,
  History,
  CheckCircle2,
  Clock,
  KeyRound,
  FileText,
  TrendingUp,
  Headphones,
  CheckSquare,
  Flame,
  Award,
  Disc,
} from 'lucide-react';

interface DashboardPageProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onNavigateTab: (tab: string) => void;
  onOpenPremiumUpgrade: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentUser,
  onUserUpdated,
  onNavigateTab,
  onOpenPremiumUpgrade,
}) => {
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Redeem code
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<{ text: string; success: boolean } | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  // WhatsApp verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyWhatsAppNumber, setVerifyWhatsAppNumber] = useState(currentUser.whatsapp_number || '');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ text: string; success: boolean } | null>(null);

  const settings = nexaService.getAppSettings();
  const ledger = nexaService.getLedger(currentUser.uid);
  const referrals = nexaService.getReferralsForUser(currentUser.uid);
  const verifiedCount = referrals.filter((r) => r.status === 'verified').length;
  const pendingCount = referrals.filter((r) => r.status === 'pending').length;
  const registrationBonusClaimed = nexaService.getRegistrationBonusRecord(currentUser.uid);

  // Completed withdrawals for live feed
  const allWithdrawals = nexaService.getWithdrawals();
  const completedWithdrawals = allWithdrawals.filter((w) => w.status === 'completed' || w.status === 'pending');

  const referralLink = `${window.location.origin}/#ref=${currentUser.referral_code}`;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        currentUser.avatar_url = reader.result as string;
        nexaService.updateUser(currentUser);
        onUserUpdated({ ...currentUser });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClaimRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemStatus(null);
    if (!redeemCodeInput.trim()) return;

    setRedeemLoading(true);
    const res = await nexaService.claimRedeemCode(currentUser.uid, redeemCodeInput.trim());
    setRedeemLoading(false);

    if (res.success && res.reward) {
      setRedeemStatus({
        text: `Redeem Code Applied! Rs. ${res.reward} credited to your wallet.`,
        success: true,
      });
      setRedeemCodeInput('');
      const updated = nexaService.getUserByUid(currentUser.uid);
      if (updated) onUserUpdated(updated);
    } else {
      setRedeemStatus({
        text: res.error || 'Failed to claim code.',
        success: false,
      });
    }
  };

  const handleWhatsAppVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyMsg(null);
    if (!verifyWhatsAppNumber.trim()) return;

    setVerifyLoading(true);
    const res = await nexaService.submitWhatsAppVerification(currentUser.uid, verifyWhatsAppNumber.trim());
    setVerifyLoading(false);

    if (res.success) {
      setVerifyMsg({
        text: 'Verification request submitted! Join the WhatsApp group to finish review.',
        success: true,
      });
      if (settings.whatsapp_verification_url) {
        window.open(settings.whatsapp_verification_url, '_blank', 'noopener,noreferrer');
      }
      const updated = nexaService.getUserByUid(currentUser.uid);
      if (updated) onUserUpdated(updated);
    } else {
      setVerifyMsg({
        text: res.error || 'Submission failed.',
        success: false,
      });
    }
  };

  const openInstagramBonus = () => {
    window.open(settings.instagram_bonus_url, '_blank', 'noopener,noreferrer');
  };

  const openTelegramSupport = () => {
    window.open(settings.telegram_support_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-24 md:pb-12">
      {/* 1. Registration Bonus Status Card (Exact reference style) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#0B1424] border border-[#142B38] shadow-lg shadow-[#00C995]/5 relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#092D29] border border-[#00C995]/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#00C995]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm sm:text-base text-white">
                  Registration Bonus Active
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                {registrationBonusClaimed
                  ? `Welcome bonus of Rs. ${registrationBonusClaimed.amount_pkr} was successfully credited.`
                  : 'Send UID on Instagram to claim up to Rs. 500 registration bonus.'}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <button
              onClick={openInstagramBonus}
              className="px-2.5 sm:px-3 py-1 rounded-full bg-[#082E28] border border-[#00C995]/50 hover:bg-[#00C995]/20 text-[#00C995] text-xs font-bold font-mono tracking-wide flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>+Rs. 500</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Features Section (8 colorful feature cards matching reference image) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-200 tracking-wide">Quick Features</h2>
          <span className="text-[11px] font-semibold text-[#00C995]">Instant Access</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1: Daily Tasks (Teal with HOT badge) */}
          <div
            onClick={() => onNavigateTab('tasks')}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-[#00C995]/50 flex flex-col items-center text-center cursor-pointer transition-all group relative"
          >
            <span className="absolute -top-1.5 -right-1 text-[8px] font-black px-1.5 py-0.2 rounded-full bg-[#00C995] text-slate-950 uppercase tracking-tight shadow">
              HOT
            </span>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#092B28] text-[#00C995] flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <CheckSquare className="w-6 h-6 text-[#00C995]" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Daily Tasks</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Earn Rs. 15 / task</p>
          </div>

          {/* Card 2: Lucky Spin (Orange with FREE badge) */}
          <div
            onClick={() => onNavigateTab('wheel')}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-[#F97316]/50 flex flex-col items-center text-center cursor-pointer transition-all group relative"
          >
            <span className="absolute -top-1.5 -right-1 text-[8px] font-black px-1.5 py-0.2 rounded-full bg-[#00C995] text-slate-950 uppercase tracking-tight shadow">
              FREE
            </span>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#F97316] text-slate-950 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Disc className="w-6 h-6 text-white" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Lucky Spin</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Win up to Rs. 500</p>
          </div>

          {/* Card 3: Wallet */}
          <div
            onClick={() => onNavigateTab('withdraw')}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-[#00C995]/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#092B28] text-[#00C995] flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Wallet className="w-6 h-6 text-[#00C995]" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Wallet</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Withdraw & History</p>
          </div>

          {/* Card 4: Verification (Blue) */}
          <div
            onClick={() => setShowVerifyModal(true)}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-blue-500/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#1E3A8A]/40 text-blue-400 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Verification</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">
              {currentUser.verification_status === 'verified' ? 'Verified ✓' : 'WhatsApp Review'}
            </p>
          </div>

          {/* Card 5: Redeem Code (Pink/Magenta) */}
          <div
            onClick={() => setShowRedeemModal(true)}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-pink-500/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#831843]/40 text-pink-400 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Gift className="w-6 h-6 text-pink-400" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Redeem Code</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Claim Gift Codes</p>
          </div>

          {/* Card 6: Invite & Earn (Emerald) */}
          <div
            onClick={() => setShowInviteModal(true)}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-[#00C995]/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#064E3B]/50 text-[#00C995] flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Users className="w-6 h-6 text-[#00C995]" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Invite & Earn</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Rs. 30 / Friend</p>
          </div>

          {/* Card 7: Leaderboard (Gold) */}
          <div
            onClick={() => onNavigateTab('leaderboard')}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-amber-500/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#78350F]/40 text-amber-400 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Award className="w-6 h-6 text-amber-400" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Leaderboard</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Top Earners</p>
          </div>

          {/* Card 8: Help Desk (Cyan/Blue) */}
          <div
            onClick={openTelegramSupport}
            className="p-3 sm:p-4 rounded-2xl bg-[#0D1527] hover:bg-[#111C33] border border-[#16233B] hover:border-cyan-500/50 flex flex-col items-center text-center cursor-pointer transition-all group"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#164E63]/40 text-cyan-400 flex items-center justify-center mb-2 shadow-inner group-hover:scale-105 transition-transform">
              <Headphones className="w-6 h-6 text-cyan-400" />
            </div>
            <h4 className="font-bold text-xs sm:text-sm text-white truncate w-full">Help Desk</h4>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate w-full mt-0.5">Telegram Support</p>
          </div>
        </div>
      </div>

      {/* 3. Live Withdrawal Feed Card (Matching reference screenshot) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[#0B1220] border border-[#14233D] shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-[#14233D] mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00C995]" />
            <h3 className="font-bold text-xs sm:text-sm text-white">Live Withdrawal Feed</h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 font-mono">Real-time Payouts</span>
        </div>

        {completedWithdrawals.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            No live withdrawals right now. Start earning and withdraw via Easypaisa or JazzCash!
          </div>
        ) : (
          <div className="space-y-2.5">
            {completedWithdrawals.slice(0, 4).map((w, idx) => (
              <div
                key={w.id || idx}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#00C995] shrink-0 animate-pulse" />
                  <span className="font-medium text-slate-200 truncate">{w.account_holder_name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({w.user_uid})</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold font-mono text-[#00C995]">
                    Rs. {w.net_payable_amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {idx === 0 ? 'Just now' : `${(idx + 1) * 3}m ago`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Membership & Wallet Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Account Status & Upgrade */}
        <div className="p-5 rounded-3xl bg-[#0D1527] border border-[#16233B] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Membership Tier
              </span>
              {currentUser.membership_tier === 'premium' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-[#082E28] border border-[#00C995]/50 text-[#00C995] text-xs font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3 text-[#00C995]" /> Premium Member
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-[#16233B] text-slate-300 text-xs font-semibold">
                  Without Investment
                </span>
              )}
            </div>

            <h3 className="font-display font-black text-xl text-white">
              {currentUser.membership_tier === 'premium'
                ? 'All Premium Features Unlocked'
                : 'Upgrade to Premium Membership'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {currentUser.membership_tier === 'premium'
                ? 'You have full access to daily tasks, higher withdrawal tiers, and premium spins.'
                : 'Pay Rs. 500 once to unlock higher withdrawals, all 4 daily tasks, and premium spins.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#16233B] flex items-center justify-between">
            <div className="text-xs">
              <span className="text-slate-400 block">Available Spins:</span>
              <span className="text-base font-mono font-bold text-[#00C995]">{currentUser.available_spins}</span>
            </div>
            {currentUser.membership_tier !== 'premium' ? (
              <button
                onClick={onOpenPremiumUpgrade}
                className="px-4 py-2 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Upgrade (Rs. 500)
              </button>
            ) : (
              <button
                onClick={() => onNavigateTab('wheel')}
                className="px-4 py-2 bg-[#082E28] border border-[#00C995]/50 text-[#00C995] text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Spin Now →
              </button>
            )}
          </div>
        </div>

        {/* Right: Quick Referral Card */}
        <div className="p-5 rounded-3xl bg-[#0D1527] border border-[#16233B] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Referral Program
              </span>
              <span className="text-xs font-mono font-bold text-[#00C995]">
                {verifiedCount} Verified Friends
              </span>
            </div>

            <h3 className="font-display font-black text-xl text-white">
              Earn Rs. 30 Per Friend
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Share your link. When friends register and verify their WhatsApp, Rs. 30 is credited instantly.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[#16233B]">
            <div className="flex items-center gap-2 p-1.5 bg-[#070B14] rounded-xl border border-[#16233B]">
              <span className="text-xs text-slate-300 font-mono truncate px-2">
                {referralLink}
              </span>
              <button
                onClick={handleCopyReferral}
                className="py-1.5 px-3 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {copiedRef ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRef ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Financial Ledger / Transaction Statement */}
      <div className="p-5 rounded-3xl bg-[#0D1527] border border-[#16233B]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#00C995]" />
            <h3 className="font-display font-bold text-sm sm:text-base text-white">
              Recent Transactions
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Ledger Statement</span>
        </div>

        {ledger.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            No transactions yet. Complete tasks, refer friends, or spin the wheel to earn.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ledger.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-2xl bg-[#09101E] border border-[#131F36] flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5 truncate pr-2">
                  <span className="font-semibold text-slate-200 block truncate">{tx.description}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(tx.created_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-bold text-xs sm:text-sm block ${
                      tx.amount_pkr >= 0 ? 'text-[#00C995]' : 'text-red-400'
                    }`}
                  >
                    {tx.amount_pkr >= 0 ? `+Rs. ${tx.amount_pkr}` : `-Rs. ${Math.abs(tx.amount_pkr)}`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Bal: Rs. {tx.balance_after_pkr.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite & Earn Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#064E3B]/50 border border-[#00C995]/50 flex items-center justify-center mx-auto mb-2">
                <Users className="w-6 h-6 text-[#00C995]" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">Invite & Earn Rewards</h3>
              <p className="text-xs text-slate-400 mt-1">
                Share your referral link with friends. Receive Rs. 30 per verified friend!
              </p>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#080E1C] border border-[#16233B]">
                <span className="text-slate-400">Your Referral Code:</span>
                <span className="font-mono font-bold text-[#00C995] text-sm">{currentUser.referral_code}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#080E1C] border border-[#16233B] space-y-2">
                <span className="text-slate-400 text-[11px] block">Your Share Link:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-200 text-xs truncate select-all">{referralLink}</span>
                  <button
                    onClick={handleCopyReferral}
                    className="px-3 py-1 bg-[#00C995] text-slate-950 rounded-lg text-xs font-bold cursor-pointer shrink-0"
                  >
                    {copiedRef ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-3 rounded-2xl bg-[#080E1C] border border-[#16233B]">
                <span className="text-slate-400 block text-[10px]">Verified Friends</span>
                <span className="text-lg font-bold text-[#00C995] mt-1 block">{verifiedCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#080E1C] border border-[#16233B]">
                <span className="text-slate-400 block text-[10px]">Pending Verification</span>
                <span className="text-lg font-bold text-amber-400 mt-1 block">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Code Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRedeemModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#831843]/40 border border-pink-500/50 flex items-center justify-center mx-auto mb-2">
                <Gift className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">Redeem Promo Code</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter special administrator codes to claim prizes between Rs. 50 and Rs. 500.
              </p>
            </div>

            <form onSubmit={handleClaimRedeemCode} className="space-y-3">
              <input
                type="text"
                required
                value={redeemCodeInput}
                onChange={(e) => setRedeemCodeInput(e.target.value)}
                placeholder="Enter Code (e.g. FLASH500)"
                className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-[#00C995]"
              />

              <button
                type="submit"
                disabled={redeemLoading}
                className="w-full py-2.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                {redeemLoading ? 'Applying...' : 'Claim Code Reward'}
              </button>
            </form>

            {redeemStatus && (
              <p className={`mt-3 text-xs text-center ${redeemStatus.success ? 'text-[#00C995]' : 'text-red-400'}`}>
                {redeemStatus.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Verification Modal Popup */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowVerifyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#092B28] border border-[#00C995]/50 flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-6 h-6 text-[#00C995]" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">
                WhatsApp Account Verification
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Enter your WhatsApp phone number and join our verification group to unlock withdrawals and earn referral bonuses.
              </p>
            </div>

            {verifyMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs ${
                  verifyMsg.success
                    ? 'bg-[#082E28] border border-[#00C995]/50 text-[#00C995]'
                    : 'bg-red-950 border border-red-700 text-red-200'
                }`}
              >
                {verifyMsg.text}
              </div>
            )}

            <form onSubmit={handleWhatsAppVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  required
                  value={verifyWhatsAppNumber}
                  onChange={(e) => setVerifyWhatsAppNumber(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white focus:outline-none focus:border-[#00C995] font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={verifyLoading}
                className="w-full py-3 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-[#00C995]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Submit & Join Verification Group</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

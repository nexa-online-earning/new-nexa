import React, { useState } from 'react';
import { UserProfile, WITHDRAWAL_TIERS, PaymentMethod, WithdrawalRecord } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import { Wallet, ShieldAlert, CheckCircle, Clock, XCircle, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface WithdrawalModalProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onOpenPremiumUpgrade: () => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  currentUser,
  onUserUpdated,
  onOpenPremiumUpgrade,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('easypaisa');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number>(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urduWarning, setUrduWarning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const verifiedReferralsCount = nexaService.getVerifiedReferralsCount(currentUser.uid);
  const isEligibleForWithdrawal = verifiedReferralsCount >= 10 && currentUser.verification_status === 'verified';
  const withdrawalsHistory = nexaService.getWithdrawals(currentUser.uid);
  const activeWithdrawal = withdrawalsHistory.find((w) => w.status === 'pending' || w.status === 'processing');

  const selectedTier = WITHDRAWAL_TIERS.find((t) => t.amount === selectedAmount) || WITHDRAWAL_TIERS[0];

  const handleSelectAmount = (amount: number) => {
    setError(null);
    setUrduWarning(null);

    if (currentUser.membership_tier === 'without_investment' && amount > 42) {
      setUrduWarning('42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔');
      setSelectedAmount(amount);
      return;
    }

    setUrduWarning(null);
    setSelectedAmount(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (activeWithdrawal) {
      setError('You already have an active withdrawal in progress. Please wait for completion.');
      return;
    }

    if (!accountHolder.trim() || !accountNumber.trim()) {
      setError('Please provide valid account holder name and account number.');
      return;
    }

    if (currentUser.membership_tier === 'without_investment' && selectedAmount > 42) {
      setUrduWarning('42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔');
      return;
    }

    if (currentUser.balance_pkr < selectedAmount) {
      setError(`Insufficient balance. Your balance is Rs. ${currentUser.balance_pkr}.`);
      return;
    }

    setLoading(true);

    try {
      const res = await nexaService.requestWithdrawal({
        user_uid: currentUser.uid,
        payment_method: paymentMethod,
        account_holder_name: accountHolder,
        account_number: accountNumber,
        requested_amount: selectedAmount,
      });

      if (!res.success) {
        setError(res.error || 'Failed to submit withdrawal request.');
      } else {
        setSuccessMsg(
          `Withdrawal request for Rs. ${selectedAmount} (Net Rs. ${res.net}) submitted successfully! Awaiting review.`
        );
        const updated = nexaService.getUserByUid(currentUser.uid);
        if (updated) onUserUpdated(updated);
        setAccountHolder('');
        setAccountNumber('');
      }
    } catch (err: any) {
      setError(err?.message || 'Withdrawal failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#092B28] border border-[#00C995]/40 text-[#00C995] text-xs font-semibold mb-2">
          <Wallet className="w-3.5 h-3.5" />
          <span>Easypaisa & JazzCash Instant Payouts</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wide">
          Withdraw <span className="text-[#00C995]">Funds</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md mx-auto">
          Fast, audited payouts directly to your Pakistani mobile wallet.
        </p>
      </div>

      {/* Eligibility Progress Indicator */}
      <div className="mb-6 p-5 rounded-3xl bg-[#0D1527] border border-[#16233B] max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#00C995]" />
            Withdrawal Eligibility Requirement
          </span>
          <span className="text-xs font-mono font-bold text-[#00C995]">
            {verifiedReferralsCount} / 10 Verified Referrals
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#070B14] rounded-full h-2.5 overflow-hidden border border-[#16233B] mb-3">
          <div
            className="bg-[#00C995] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (verifiedReferralsCount / 10) * 100)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>
            Status:{' '}
            {verifiedReferralsCount >= 10 ? (
              <span className="text-[#00C995] font-bold">Unlocked (10+ Referrals)</span>
            ) : (
              <span className="text-amber-400 font-bold">Needs {10 - verifiedReferralsCount} more verified referrals</span>
            )}
          </span>
          <span>
            WhatsApp Verification:{' '}
            {currentUser.verification_status === 'verified' ? (
              <span className="text-[#00C995] font-bold">Verified</span>
            ) : (
              <span className="text-amber-400 font-bold">{currentUser.verification_status}</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-4xl mx-auto">
        {/* Form Container */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 sm:p-7 shadow-xl">
          <h3 className="font-display font-bold text-base text-white mb-4">Request Payout</h3>

          {/* Active Withdrawal Banner if any */}
          {activeWithdrawal && (
            <div className="mb-4 p-4 rounded-2xl bg-[#1C1608] border border-amber-600/50 text-amber-200 text-xs">
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
                <Clock className="w-4 h-4 text-amber-400" />
                Active Withdrawal in Progress
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                You currently have a pending withdrawal of <strong>Rs. {activeWithdrawal.requested_amount}</strong> (Net: Rs. {activeWithdrawal.net_payable_amount}) via {activeWithdrawal.payment_method.toUpperCase()}. Only one active withdrawal is permitted at a time.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* EXACT URDU WARNING IF WITHOUT-INVESTMENT USER PICKS > 42 */}
          {urduWarning && (
            <div className="mb-4 p-4 rounded-2xl bg-[#091B24] border border-[#00C995]/60 text-center animate-in fade-in">
              <p dir="rtl" className="text-sm sm:text-base font-bold text-emerald-300 leading-relaxed tracking-wide font-sans">
                "{urduWarning}"
              </p>
              <button
                type="button"
                onClick={onOpenPremiumUpgrade}
                className="mt-2.5 px-4 py-1.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 text-xs font-bold rounded-lg shadow cursor-pointer transition-colors"
              >
                Upgrade to Premium for Rs. 500
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#082E28] border border-[#00C995]/60 text-emerald-200 text-xs">
              ✓ {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Selection Grid */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Withdrawal Amount & Official Fee Schedule
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WITHDRAWAL_TIERS.map((tier) => {
                  const isSelected = selectedAmount === tier.amount;
                  const isLockedForNonPremium = currentUser.membership_tier === 'without_investment' && tier.amount > 42;

                  return (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => handleSelectAmount(tier.amount)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#082E28] border-[#00C995] ring-1 ring-[#00C995]'
                          : 'bg-[#080E1C] border-[#16233B] hover:border-[#1E304F]'
                      }`}
                    >
                      {isLockedForNonPremium && (
                        <span className="absolute top-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.2 rounded bg-[#00C995]/20 text-[#00C995] uppercase">
                          Premium
                        </span>
                      )}
                      <div className="text-sm font-display font-black text-white">
                        Rs. {tier.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Fee: <span className="text-amber-400">Rs. {tier.fee}</span>
                      </div>
                      <div className="text-[10px] text-[#00C995] font-semibold mt-0.5">
                        Net: Rs. {tier.net.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('easypaisa')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    paymentMethod === 'easypaisa'
                      ? 'bg-[#082E28] border-[#00C995] text-emerald-200'
                      : 'bg-[#080E1C] border-[#16233B] text-slate-400'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00C995]" />
                  <span className="text-xs font-bold">Easypaisa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('jazzcash')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    paymentMethod === 'jazzcash'
                      ? 'bg-[#2A0F14] border-red-500 text-red-200'
                      : 'bg-[#080E1C] border-[#16233B] text-slate-400'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs font-bold">JazzCash</span>
                </button>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Holder Title
              </label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Full name on mobile wallet"
                className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {paymentMethod === 'easypaisa' ? 'Easypaisa' : 'JazzCash'} Mobile Account Number
              </label>
              <input
                type="tel"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="03001234567"
                className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] transition-colors font-mono"
              />
            </div>

            {/* Breakdown Card */}
            <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B] space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Requested Amount:</span>
                <span className="font-mono text-white">Rs. {selectedTier.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Withdrawal Processing Fee:</span>
                <span className="font-mono text-amber-400">- Rs. {selectedTier.fee}</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-1.5 border-t border-[#16233B]">
                <span>Net Payable Amount:</span>
                <span className="font-mono text-[#00C995] text-sm">Rs. {selectedTier.net.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(activeWithdrawal) || !isEligibleForWithdrawal}
              className="w-full py-3 px-4 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-xl shadow-lg shadow-[#00C995]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="text-sm">Submitting...</span>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm">Submit Withdrawal Request</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Withdrawal History */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 sm:p-6">
          <h3 className="font-display font-bold text-base text-white mb-3">Withdrawal History</h3>
          {withdrawalsHistory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No withdrawal records yet.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {withdrawalsHistory.map((w) => (
                <div
                  key={w.id}
                  className="p-3 rounded-2xl bg-[#080E1C] border border-[#16233B] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">
                      Rs. {w.requested_amount.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        w.status === 'completed'
                          ? 'bg-[#082E28] border border-[#00C995]/50 text-[#00C995]'
                          : w.status === 'rejected'
                          ? 'bg-red-950 border border-red-700 text-red-300'
                          : 'bg-amber-950 border border-amber-700 text-amber-300'
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex justify-between">
                    <span>
                      {w.payment_method.toUpperCase()} · {w.account_number}
                    </span>
                    <span className="text-[#00C995] font-mono">Net: Rs. {w.net_payable_amount}</span>
                  </div>

                  {w.admin_trx_reference && (
                    <div className="text-[10px] text-slate-300 font-mono">
                      TRX: {w.admin_trx_reference}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 pt-0.5">
                    {new Date(w.created_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

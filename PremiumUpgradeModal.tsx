import React, { useState } from 'react';
import { UserProfile, PaymentMethod } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import { Crown, Download, Copy, Check, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface PremiumUpgradeModalProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onClose?: () => void;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  currentUser,
  onUserUpdated,
  onClose,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('easypaisa');
  const [trxId, setTrxId] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const settings = nexaService.getAppSettings();

  const activeQr = method === 'easypaisa' ? settings.easypaisa_qr_url : settings.jazzcash_qr_url;
  const activeTitle = method === 'easypaisa' ? settings.easypaisa_account_title : settings.jazzcash_account_title;
  const activeNumber = method === 'easypaisa' ? settings.easypaisa_account_number : settings.jazzcash_account_number;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(activeNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleDownloadQr = () => {
    const a = document.createElement('a');
    a.href = activeQr;
    a.download = `NEXA_EARN_${method.toUpperCase()}_QR.jpg`;
    a.target = '_blank';
    a.click();
  };

  const handleSubmitTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!trxId.trim()) {
      setError('Please enter your TRX/TID transaction ID.');
      return;
    }

    setLoading(true);

    try {
      const res = await nexaService.submitMembershipPayment({
        user_uid: currentUser.uid,
        payment_method: method,
        trx_id: trxId.trim(),
      });

      if (!res.success) {
        setError(res.error || 'Failed to submit payment.');
      } else {
        setSuccess(true);
        const updated = nexaService.getUserByUid(currentUser.uid);
        if (updated) onUserUpdated(updated);
      }
    } catch (err: any) {
      setError(err?.message || 'Submission error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4 py-4">
      <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00C995]/5 relative overflow-hidden">
        {/* Ambient atmospheric gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0284C7]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#092B28] border border-[#00C995]/40 p-0.5 shadow-lg shadow-[#00C995]/20 mb-3">
            <Crown className="w-7 h-7 text-[#00C995]" />
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide">
            Pay 500 PKR and get <span className="text-[#00C995]">Premium Membership</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md mx-auto">
            Unlock all daily tasks, higher withdrawal amounts, premium referral spins, and exclusive redeem codes.
          </p>
        </div>

        {currentUser.membership_tier === 'premium' ? (
          <div className="p-6 rounded-2xl bg-[#082E28] border border-[#00C995]/60 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#00C995] mx-auto mb-2" />
            <h3 className="font-bold text-lg text-white">Your Account is Already Premium!</h3>
            <p className="text-xs text-emerald-200 mt-1">
              You already enjoy all highest tier benefits, unlimited daily tasks, and full withdrawal tiers.
            </p>
          </div>
        ) : success ? (
          <div className="p-6 rounded-2xl bg-[#082E28] border border-[#00C995]/60 text-center animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-[#00C995] mx-auto mb-2" />
            <h3 className="font-bold text-lg text-white">Payment Submitted for Approval!</h3>
            <p className="text-xs text-emerald-200 mt-1">
              Your transaction reference (<strong>{trxId}</strong>) has been recorded as Pending. The administrator will verify and activate your Premium Membership shortly.
            </p>
          </div>
        ) : (
          <div>
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
                ⚠️ {error}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Select Payment Gateway
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('easypaisa')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    method === 'easypaisa'
                      ? 'bg-[#082E28] border-[#00C995] text-white shadow-md'
                      : 'bg-[#080E1C] border-[#16233B] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00C995]" />
                  <span className="text-xs font-bold">Easypaisa (PKR 500)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('jazzcash')}
                  className={`p-3 rounded-2xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    method === 'jazzcash'
                      ? 'bg-[#2A0F14] border-red-500 text-white shadow-md'
                      : 'bg-[#080E1C] border-[#16233B] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs font-bold">JazzCash (PKR 500)</span>
                </button>
              </div>
            </div>

            {/* QR Code and Account Info */}
            <div className="mb-6 p-5 rounded-2xl bg-[#080E1C] border border-[#16233B] flex flex-col sm:flex-row items-center gap-6">
              <div className="relative shrink-0 text-center">
                <img
                  src={activeQr}
                  alt={`${method} QR Code`}
                  referrerPolicy="no-referrer"
                  className="w-36 h-36 rounded-xl object-cover border border-[#16233B] shadow-md mx-auto"
                />
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="mt-2 text-[11px] text-[#00C995] hover:text-[#05DF9F] font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Download QR</span>
                </button>
              </div>

              <div className="w-full space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Account Title</span>
                  <div className="text-sm font-bold text-white mt-0.5">{activeTitle}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    {method.toUpperCase()} Mobile Number
                  </span>
                  <div className="flex items-center justify-between mt-0.5 p-2 bg-[#070B14] rounded-xl border border-[#16233B]">
                    <span className="font-mono text-sm text-[#00C995] font-bold">{activeNumber}</span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      className="text-slate-300 hover:text-[#00C995] p-1 text-xs cursor-pointer flex items-center gap-1"
                    >
                      {copiedAccount ? (
                        <span className="text-[#00C995] flex items-center gap-0.5 font-bold">
                          <Check className="w-3.5 h-3.5" /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#091D24] border border-[#00C995]/30 text-[11px] text-slate-300">
                  💡 Send exactly <strong>PKR 500</strong> to the account above, copy the 11-digit TRX/TID from your SMS/app, and submit below.
                </div>
              </div>
            </div>

            {/* TRX Form */}
            <form onSubmit={handleSubmitTrx} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter TRX ID / TID Reference
                </label>
                <input
                  type="text"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="e.g. 19283746501 or TRX928174"
                  className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] transition-colors font-mono uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-xl shadow-lg shadow-[#00C995]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="text-sm">Verifying Reference...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-sm">Submit Payment for Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

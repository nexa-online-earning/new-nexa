import React, { useState } from 'react';
import { nexaService } from '../services/nexaService';
import { UserProfile } from '../types/nexa';
import { ArrowRight, UserPlus, Lock, Mail, Gift } from 'lucide-react';

interface RegistrationPageProps {
  onRegistered: (user: UserProfile) => void;
  onGoToLogin: () => void;
  initialRefCode?: string;
  isDirectRegistrationOnly?: boolean;
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  onRegistered,
  onGoToLogin,
  initialRefCode = '',
  isDirectRegistrationOnly = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please fill in both Email and Password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await nexaService.registerUser({
        email: trimmedEmail,
        password: password,
        referred_by_code_or_uid: isDirectRegistrationOnly ? undefined : (initialRefCode || undefined),
      });

      if (!res.success || !res.user) {
        setError(res.error || 'Registration failed. Please check details.');
        setLoading(false);
        return;
      }

      onRegistered(res.user);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00C995]/5 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#0284C7]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00C995] text-slate-950 font-black text-xl mb-3 shadow-lg shadow-[#00C995]/30">
            NX
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide">
            NEXA <span className="text-[#00C995]">EARN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isDirectRegistrationOnly ? 'Direct Registration Portal' : 'Create your earning account today'}
          </p>
        </div>

        {/* EXACT URDU PROMOTIONAL MESSAGE - PRESERVED */}
        <div className="mb-6 p-4 rounded-2xl bg-[#091D24] border border-[#00C995]/40 text-center shadow-inner relative">
          <div className="flex items-center justify-center gap-1.5 text-[#00C995] text-xs font-semibold mb-1">
            <Gift className="w-3.5 h-3.5" />
            <span>Special Registration Bonus Offer</span>
          </div>
          <p
            dir="rtl"
            className="text-sm sm:text-base font-medium text-emerald-200 leading-relaxed tracking-wide font-sans py-1 break-words text-center"
          >
            "ابھی اکاؤنٹ بناؤ، انسٹاگرام پر اپنے اکاؤنٹ کی UID سینڈ کریں اور حاصل کریں 50 PKR سے 500 PKR تک کا رجسٹریشن بونس۔"
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Register now, send your UID on Instagram to claim 50–500 PKR registration bonus!
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-start gap-2">
            <span className="font-bold shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] focus:ring-1 focus:ring-[#00C995] transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C995] focus:ring-1 focus:ring-[#00C995] transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Must be at least 6 characters</p>
          </div>

          {/* Submit Register Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 px-4 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-xl shadow-lg shadow-[#00C995]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="text-sm">Creating Account...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span className="text-sm">Register</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#16233B] text-center">
          <p className="text-xs text-slate-400">
            Already have a NEXA EARN account?{' '}
            <button
              onClick={onGoToLogin}
              className="text-[#00C995] font-semibold hover:underline cursor-pointer"
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { nexaService } from '../services/nexaService';
import { UserProfile } from '../types/nexa';
import { Lock, Mail, ArrowRight, ShieldAlert, KeyRound } from 'lucide-react';

interface LoginPageProps {
  onLoggedIn: (user: UserProfile) => void;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoggedIn, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await nexaService.loginUser({
        email,
        password,
      });

      if (!res.success || !res.user) {
        setError(res.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      onLoggedIn(res.user);
    } catch (err: any) {
      setError(err?.message || 'Login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00C995]/5 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#0284C7]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00C995] text-slate-950 font-black text-xl mb-3 shadow-lg shadow-[#00C995]/30">
            NX
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide">
            Sign In to <span className="text-[#00C995]">NEXA EARN</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your wallet, spins, and referral earnings
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/70 border border-red-800/70 text-red-200 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold rounded-xl shadow-lg shadow-[#00C995]/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="text-sm">Signing in...</span>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span className="text-sm">Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Separation: Clearly distinguish Local Sandbox from Live Production */}
        {nexaService.getBackendMode() === 'local_preview' ? (
          <div className="mt-5 pt-4 border-t border-[#16233B]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                🧪 Local Sandbox Mode
              </span>
              <span className="text-[10px] text-slate-500">Preview Testing Only</span>
            </div>
            <div className="text-[11px] text-slate-400 mb-2">Quick Demo Accounts (No real money):</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => quickFill('rrdd8397@gmail.com')}
                className="px-2.5 py-1 rounded-lg bg-[#00C995]/15 border border-[#00C995]/30 text-[#00C995] text-[11px] hover:bg-[#00C995]/25 transition-colors cursor-pointer"
              >
                👑 Admin (rrdd8397@gmail.com)
              </button>
              <button
                type="button"
                onClick={() => quickFill('hamza.khan@example.com')}
                className="px-2.5 py-1 rounded-lg bg-[#16233B] text-slate-200 text-[11px] hover:bg-[#1C2C4A] transition-colors cursor-pointer"
              >
                ⭐ Premium (Hamza)
              </button>
              <button
                type="button"
                onClick={() => quickFill('ali.raza@example.com')}
                className="px-2.5 py-1 rounded-lg bg-[#16233B] text-slate-200 text-[11px] hover:bg-[#1C2C4A] transition-colors cursor-pointer"
              >
                👤 Standard (Ali)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 pt-4 border-t border-[#16233B]">
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <span className="font-bold">🔒</span>
              <span>Production Mode: Authenticating with Supabase PostgreSQL Auth.</span>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 text-center">
          <p className="text-xs text-slate-400">
            Don't have an account yet?{' '}
            <button
              onClick={onGoToRegister}
              className="text-[#00C995] font-semibold hover:underline cursor-pointer"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { UserProfile, WHEEL_SLICES, SpinRecord } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import confetti from 'canvas-confetti';
import { Sparkles, Trophy, History, Info, Gift, CheckCircle, ShieldCheck } from 'lucide-react';

interface SpinWheelProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
}

export const SpinWheel: React.FC<SpinWheelProps> = ({ currentUser, onUserUpdated }) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [recentWin, setRecentWin] = useState<{ amount: number; label: string } | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spinsHistory = nexaService.getSpinsHistory(currentUser.uid);
  const totalSlices = WHEEL_SLICES.length; // 8 slices
  const sliceAngle = 360 / totalSlices; // 45 degrees per slice

  const handleSpin = async () => {
    if (spinning) return;
    setError(null);

    if (currentUser.available_spins <= 0) {
      setError('You have 0 available spins. Refer verified friends or upgrade to Premium to earn spins!');
      return;
    }

    setSpinning(true);
    setRecentWin(null);

    // Call server-authoritative spin execution
    const res = await nexaService.executeSpin(currentUser.uid);
    if (!res.success || res.slice_index === undefined || !res.reward_amount) {
      setError(res.error || 'Spin failed on server.');
      setSpinning(false);
      return;
    }

    const updatedUser = nexaService.getUserByUid(currentUser.uid);
    if (updatedUser) {
      onUserUpdated(updatedUser);
    }

    const targetSlice = res.slice_index;
    const extraRounds = 5 * 360;
    const sliceCenterAngle = targetSlice * sliceAngle + sliceAngle / 2;
    const targetAngle = extraRounds + (360 - sliceCenterAngle);

    const newRotation = rotation + targetAngle;
    setRotation(newRotation);

    setTimeout(() => {
      setSpinning(false);
      setRecentWin({
        amount: res.reward_amount!,
        label: res.slice_label!,
      });

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00C995', '#05DF9F', '#38BDF8', '#F59E0B'],
      });
    }, 4000);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#092B28] border border-[#00C995]/40 text-[#00C995] text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Server-Authoritative Lucky Wheel</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wide">
          Shared 8-Slice <span className="text-[#00C995]">Spin Wheel</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-lg mx-auto">
          Every spin awards real PKR credited straight to your balance. Verified transparent odds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Wheel Section */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-[#00C995]/5">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Available Spins Badge */}
          <div className="mb-4 flex items-center justify-between w-full max-w-xs px-4 py-2 rounded-2xl bg-[#09101E] border border-[#16233B]">
            <span className="text-xs text-slate-300 font-medium">Available Spins:</span>
            <span className="text-lg font-mono font-black text-[#00C995]">{currentUser.available_spins}</span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs text-center w-full max-w-sm">
              {error}
            </div>
          )}

          {/* THE 8-SLICE WHEEL */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 my-2 flex items-center justify-center">
            {/* Top Pointer Indicator in Emerald */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#00C995] drop-shadow-[0_4px_10px_rgba(0,201,149,0.7)]" />

            {/* Rotating SVG Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-[#00C995]/80 shadow-[0_0_35px_rgba(0,201,149,0.35)] overflow-hidden transition-transform ease-out"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: spinning ? '4000ms' : '0ms',
                transitionTimingFunction: 'cubic-bezier(0.12, 0.8, 0.2, 1)',
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {WHEEL_SLICES.map((slice, i) => {
                  const startAngle = (i * 360) / totalSlices;
                  const endAngle = ((i + 1) * 360) / totalSlices;
                  const rad1 = ((startAngle - 90) * Math.PI) / 180;
                  const rad2 = ((endAngle - 90) * Math.PI) / 180;
                  const x1 = 50 + 50 * Math.cos(rad1);
                  const y1 = 50 + 50 * Math.sin(rad1);
                  const x2 = 50 + 50 * Math.cos(rad2);
                  const y2 = 50 + 50 * Math.sin(rad2);

                  const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
                  const midAngle = startAngle + sliceAngle / 2;

                  return (
                    <g key={slice.index}>
                      <path d={pathData} fill={slice.color} stroke="#070B14" strokeWidth="0.8" />
                      <g transform={`rotate(${midAngle}, 50, 50)`}>
                        <text
                          x="50"
                          y="20"
                          fill={slice.textColor}
                          fontSize="4.2"
                          fontWeight="bold"
                          textAnchor="middle"
                          transform={`rotate(-90, 50, 20)`}
                          className="font-display select-none"
                        >
                          {slice.label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center Emerald Pin with NX Logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-[#00C995] border-2 border-slate-950 shadow-xl flex items-center justify-center">
              <span className="font-display font-black text-sm text-slate-950 tracking-tighter">
                NX
              </span>
            </div>
          </div>

          {/* Spin Trigger Button */}
          <button
            onClick={handleSpin}
            disabled={spinning || currentUser.available_spins <= 0}
            className="w-full max-w-xs mt-4 py-3.5 px-6 rounded-2xl bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-display font-extrabold text-base shadow-xl shadow-[#00C995]/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {spinning ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                Spinning Wheel...
              </span>
            ) : (
              <>
                <Gift className="w-5 h-5 text-slate-950" />
                <span>SPIN NOW ({currentUser.available_spins} Left)</span>
              </>
            )}
          </button>

          {/* Recent Win Announcement Card */}
          {recentWin && (
            <div className="mt-4 w-full max-w-xs p-4 rounded-2xl bg-[#072421] border border-[#00C995] text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-[#00C995] font-bold text-xs uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                <Trophy className="w-4 h-4 text-[#00C995]" />
                CONGRATULATIONS!
              </div>
              <div className="text-2xl font-display font-black text-white">
                Won <span className="text-[#00C995]">PKR {recentWin.amount}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Credited directly to your wallet! Current Balance: Rs. {currentUser.balance_pkr.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Side Info & Spin History */}
        <div className="lg:col-span-5 space-y-5">
          {/* Milestone Details Card */}
          <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 sm:p-6">
            <h3 className="font-display font-bold text-base text-white mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#00C995]" />
              Spin Milestone Rewards
            </h3>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 rounded-2xl bg-[#08101E] border border-[#16233B]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#00C995]">10 Referrals Milestone</span>
                  <span className="text-[11px] font-mono text-slate-300">5 Lucky Spins</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Reach 10 verified referrals to unlock 5 spins with combined rewards between PKR 900 and PKR 1,000!
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[#08101E] border border-[#16233B]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#00C995]">Premium Referral Spins</span>
                  <span className="text-[11px] font-mono text-slate-300">1 Spin / Referral</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Premium Members receive 1 spin for every qualifying verified referral. Slices range up to PKR 500!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPolicy(!showPolicy)}
              className="mt-3 text-xs text-[#00C995] hover:underline font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showPolicy ? 'Hide Odds Policy' : 'View Transparent Server Reward Policy'}</span>
            </button>

            {showPolicy && (
              <div className="mt-3 p-3.5 rounded-2xl bg-[#070B14] border border-[#16233B] text-[11px] text-slate-300 space-y-1.5 animate-in fade-in duration-200">
                <div className="font-bold text-white mb-1">Documented Server Probability Policy:</div>
                <div className="flex justify-between border-b border-[#16233B] pb-1">
                  <span>PKR 50 (Standard)</span>
                  <span className="font-mono text-[#00C995]">~80%</span>
                </div>
                <div className="flex justify-between border-b border-[#16233B] pb-1">
                  <span>PKR 60 – PKR 200</span>
                  <span className="font-mono text-slate-300">~19%</span>
                </div>
                <div className="flex justify-between">
                  <span>PKR 500 (Exceptional Prize)</span>
                  <span className="font-mono text-[#00C995] font-bold">~1 in 100</span>
                </div>
              </div>
            )}
          </div>

          {/* Spin History Table */}
          <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 sm:p-6">
            <h3 className="font-display font-bold text-base text-white mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-[#00C995]" />
              Spin History & Rewards
            </h3>
            {spinsHistory.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No spins recorded yet. Spin the wheel to start earning!
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {spinsHistory.slice(0, 10).map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-xl bg-[#08101E] border border-[#16233B] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{s.slice_label}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {s.is_initial_package && ' · Initial Package'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#00C995] text-sm">
                      +PKR {s.reward_amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

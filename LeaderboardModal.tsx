import React, { useState } from 'react';
import { UserProfile, LeaderboardRank } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import confetti from 'canvas-confetti';
import { Trophy, Crown, Medal, Award, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface LeaderboardModalProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onOpenPremiumUpgrade: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUser,
  onUserUpdated,
  onOpenPremiumUpgrade,
}) => {
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; success: boolean } | null>(null);

  const leaderboard = nexaService.getWeeklyLeaderboard(currentUser.uid);
  const settings = nexaService.getAppSettings();

  const myRankObj = leaderboard.find((r) => r.uid === currentUser.uid);
  const myRank = myRankObj ? myRankObj.rank : 99;

  const handleClaim = (rank: number) => {
    setClaiming(true);
    setClaimMsg(null);

    const res = nexaService.claimLeaderboardReward(currentUser.uid, rank);
    setClaiming(false);

    if (res.success && res.reward) {
      setClaimMsg({
        text: `Congratulations! Weekly Rank #${rank} Prize of Rs. ${res.reward} credited to your wallet!`,
        success: true,
      });

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#00C995', '#05DF9F', '#F59E0B', '#38BDF8'],
      });

      const updated = nexaService.getUserByUid(currentUser.uid);
      if (updated) onUserUpdated(updated);
    } else {
      setClaimMsg({
        text: res.error || 'Unable to claim reward.',
        success: false,
      });
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/40">
          <Crown className="w-4 h-4 fill-slate-950" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 flex items-center justify-center font-bold">
          <Medal className="w-4 h-4" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 flex items-center justify-center font-bold">
          <Award className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-[#080E1C] border border-[#16233B] text-slate-300 flex items-center justify-center font-mono font-bold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#092B28] border border-[#00C995]/40 text-[#00C995] text-xs font-semibold mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>Verified Referral Competition</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wide">
          Weekly <span className="text-[#00C995]">Leaderboard</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md mx-auto">
          Top 10 referrers with verified friends earn weekly cash prizes.
        </p>
      </div>

      {/* Current User Standings Card */}
      <div className="mb-6 p-5 rounded-3xl bg-[#0D1527] border border-[#00C995]/40 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#080E1C] border border-[#16233B] flex items-center justify-center">
            <span className="font-display font-black text-lg text-[#00C995]">#{myRank}</span>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold">Your Standing</div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{currentUser.uid}</span>
              {currentUser.membership_tier === 'premium' && (
                <Crown className="w-3.5 h-3.5 text-[#00C995] fill-[#00C995]" />
              )}
            </div>
            <span className="text-[11px] text-slate-400">
              {myRankObj?.verified_referrals_count || 0} Verified Referrals
            </span>
          </div>
        </div>

        {/* Claim or Upgrade Notice */}
        {currentUser.membership_tier === 'premium' ? (
          myRank <= 10 ? (
            <button
              onClick={() => handleClaim(myRank)}
              disabled={claiming}
              className="px-5 py-2.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-[#00C995]/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>Claim Rank #{myRank} Reward</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              Rank in Top 10 to claim rewards
            </span>
          )
        ) : (
          <div className="text-right">
            <div className="text-[11px] text-amber-300 mb-1">
              ⭐ Premium Membership required to claim cash rewards
            </div>
            <button
              onClick={onOpenPremiumUpgrade}
              className="px-3.5 py-1.5 bg-[#082E28] border border-[#00C995]/50 text-[#00C995] text-xs font-semibold rounded-lg hover:bg-[#00C995]/20 transition-colors cursor-pointer"
            >
              Upgrade to Premium
            </button>
          </div>
        )}
      </div>

      {claimMsg && (
        <div
          className={`mb-6 p-4 rounded-2xl text-xs flex items-center justify-between max-w-2xl mx-auto ${
            claimMsg.success
              ? 'bg-[#082E28] border border-[#00C995]/50 text-[#00C995]'
              : 'bg-red-950/70 border border-red-700 text-red-200'
          }`}
        >
          <span>{claimMsg.text}</span>
          <button onClick={() => setClaimMsg(null)} className="text-slate-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Top 10 Leaderboard Table */}
      <div className="bg-[#0D1527] border border-[#16233B] rounded-3xl p-5 sm:p-7 max-w-2xl mx-auto shadow-2xl">
        <h3 className="font-display font-bold text-base text-white mb-4 flex items-center justify-between">
          <span>Weekly Top 10 Rankings</span>
          <span className="text-xs font-mono text-[#00C995] font-semibold">Active Period</span>
        </h3>

        <div className="space-y-2.5">
          {leaderboard.slice(0, 10).map((item) => {
            const reward = settings.leaderboard_rewards[item.rank] || 100;
            const isMe = item.uid === currentUser.uid;

            return (
              <div
                key={item.uid}
                className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isMe
                    ? 'bg-[#082321] border-[#00C995] shadow-md'
                    : 'bg-[#080E1C] border-[#16233B] hover:border-[#1E304F]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getRankBadge(item.rank)}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-white font-mono">
                        {item.uid}
                      </span>
                      {item.membership_tier === 'premium' ? (
                        <Crown className="w-3.5 h-3.5 text-[#00C995] fill-[#00C995]" />
                      ) : (
                        <span className="text-[10px] text-slate-400">Basic</span>
                      )}
                      {isMe && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#00C995] text-slate-950">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {item.verified_referrals_count} Verified Referrals
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs sm:text-sm font-display font-black text-[#00C995] block">
                    Rs. {reward.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Prize Pool</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

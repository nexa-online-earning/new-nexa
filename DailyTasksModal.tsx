import React, { useState } from 'react';
import { UserProfile, DailyTaskItem } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import { CheckCircle2, Lock, ExternalLink, Copy, Check, Sparkles, BarChart2, Tv, Video, MousePointerClick, CheckSquare } from 'lucide-react';

interface DailyTasksModalProps {
  currentUser: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onClose?: () => void;
}

export const DailyTasksModal: React.FC<DailyTasksModalProps> = ({
  currentUser,
  onUserUpdated,
}) => {
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const tasks = nexaService.getDailyTasks();
  const completions = nexaService.getTaskCompletions(currentUser.uid);
  const today = new Date().toISOString().split('T')[0];

  const getTaskIcon = (key: string) => {
    switch (key) {
      case 'poll_completion':
        return <BarChart2 className="w-5 h-5 text-[#00C995]" />;
      case 'watch_ads':
        return <Tv className="w-5 h-5 text-blue-400" />;
      case 'watch_videos':
        return <Video className="w-5 h-5 text-amber-400" />;
      case 'ad_clicks':
        return <MousePointerClick className="w-5 h-5 text-[#00C995]" />;
      default:
        return <CheckSquare className="w-5 h-5 text-[#00C995]" />;
    }
  };

  const handleCopy = (task: DailyTaskItem) => {
    navigator.clipboard.writeText(task.action_url);
    setCopiedTaskId(task.id);
    setTimeout(() => setCopiedTaskId(null), 2000);
  };

  const handleStartTask = (task: DailyTaskItem) => {
    setMessage(null);
    setActionInProgress(task.task_key);

    window.open(task.action_url, '_blank', 'noopener,noreferrer');

    setTimeout(async () => {
      const res = await nexaService.completeDailyTask(currentUser.uid, task.task_key);
      setActionInProgress(null);

      if (res.success && res.reward) {
        setMessage({
          text: `Task Completed! Rs. ${res.reward} has been credited to your wallet.`,
          type: 'success',
        });
        const updated = nexaService.getUserByUid(currentUser.uid);
        if (updated) onUserUpdated(updated);
      } else {
        setMessage({
          text: res.error || 'Failed to complete task.',
          type: 'error',
        });
      }
    }, 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#092B28] border border-[#00C995]/40 text-[#00C995] text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Earn Rs. 15 per Task Every 24 Hours</span>
        </div>
        <h1 className="font-display font-black text-2xl sm:text-4xl text-white tracking-wide">
          Daily <span className="text-[#00C995]">Partner Tasks</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md mx-auto">
          Complete verified sponsor activities to grow your wallet balance.
        </p>

        {currentUser.membership_tier === 'without_investment' && !currentUser.tasks_unlocked_milestone && (
          <div className="mt-3 p-3 rounded-2xl bg-[#081B1A] border border-[#00C995]/40 text-emerald-200 text-xs max-w-md mx-auto">
            ⭐ <span className="font-bold">Without-Investment Milestone:</span> Reach 20 verified referrals to automatically unlock all daily tasks permanently!
          </div>
        )}
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-2xl text-xs flex items-center justify-between max-w-2xl mx-auto ${
            message.type === 'success'
              ? 'bg-[#082E28] border border-[#00C995]/60 text-emerald-200'
              : 'bg-red-950/70 border border-red-700 text-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
        {tasks.map((task) => {
          const isUnlocked = nexaService.isTaskUnlockedForUser(currentUser, task);
          const isCompletedToday = completions.some(
            (c) => c.task_key === task.task_key && c.completion_date === today
          );
          const isWorking = actionInProgress === task.task_key;

          return (
            <div
              key={task.id}
              className={`rounded-3xl p-5 sm:p-6 transition-all border ${
                isUnlocked
                  ? 'bg-[#0D1527] border-[#16233B] hover:border-[#00C995]/40 shadow-xl'
                  : 'bg-[#09101E]/60 border-[#121C30] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#091222] border border-[#16233B] flex items-center justify-center shrink-0">
                    {getTaskIcon(task.task_key)}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-white">{task.title}</h3>
                    <span className="text-[#00C995] text-xs font-mono font-bold">+Rs. {task.reward_pkr}</span>
                  </div>
                </div>

                {/* Status indicator */}
                {isCompletedToday ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00C995] bg-[#072421] border border-[#00C995]/40 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                ) : !isUnlocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-[#080E1C] border border-[#16233B] px-2.5 py-1 rounded-full">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-[#072620] border border-[#00C995]/30 px-2.5 py-1 rounded-full">
                    Available
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-4 leading-relaxed">{task.description}</p>

              {/* Working Copy URL row */}
              <div className="mb-4 p-2 rounded-xl bg-[#070B14] border border-[#16233B] flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
                  {task.action_url}
                </span>
                <button
                  onClick={() => handleCopy(task)}
                  className="p-1.5 text-slate-300 hover:text-[#00C995] hover:bg-[#16233B] rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Copy Task URL"
                >
                  {copiedTaskId === task.id ? (
                    <span className="text-[10px] text-[#00C995] font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Copied
                    </span>
                  ) : (
                    <span className="text-[10px] flex items-center gap-0.5">
                      <Copy className="w-3 h-3" /> Copy Link
                    </span>
                  )}
                </button>
              </div>

              {/* Action Button */}
              {isUnlocked && !isCompletedToday ? (
                <button
                  onClick={() => handleStartTask(task)}
                  disabled={isWorking}
                  className="w-full py-2.5 px-4 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-bold text-xs rounded-xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isWorking ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-slate-950" />
                      <span>Verifying Task Completion...</span>
                    </>
                  ) : (
                    <>
                      <span>Open & Complete Task</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              ) : isCompletedToday ? (
                <button
                  disabled
                  className="w-full py-2 px-4 bg-[#080E1C] text-slate-500 font-medium text-xs rounded-xl border border-[#16233B] cursor-not-allowed"
                >
                  Come back tomorrow
                </button>
              ) : (
                <div className="text-center p-2 rounded-xl bg-[#080E1C] border border-[#16233B] text-[11px] text-slate-400">
                  {currentUser.membership_tier === 'without_investment'
                    ? 'Reach 20 verified referrals or upgrade to Premium'
                    : 'Awaiting admin unlock'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

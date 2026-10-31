import React from 'react';
import { nexaService } from '../services/nexaService';
import { Bell, Shield, Sparkles, Gift, Wallet, Crown } from 'lucide-react';

interface NotificationsModalProps {
  user_uid: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  user_uid,
  onClose,
  onRefresh,
}) => {
  const notifications = nexaService.getNotifications(user_uid);

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.is_read) {
        nexaService.markNotificationRead(n.id);
      }
    });
    onRefresh();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'welcome':
      case 'security':
        return <Shield className="w-4 h-4 text-[#00C995]" />;
      case 'milestone_spins':
      case 'spin_reward':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'referral_bonus':
      case 'bonus_credited':
        return <Gift className="w-4 h-4 text-[#00C995]" />;
      case 'withdrawal_pending':
      case 'withdrawal_completed':
        return <Wallet className="w-4 h-4 text-[#00C995]" />;
      case 'membership_activated':
      case 'premium_commission':
        return <Crown className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-[#00C995]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#16233B]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#092B28] flex items-center justify-center">
              <Bell className="w-4 h-4 text-[#00C995]" />
            </div>
            <h3 className="font-display font-bold text-lg text-white">Notifications</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[#00C995] hover:text-[#05DF9F] font-semibold cursor-pointer"
            >
              Mark all as read
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1 text-xs">
          {notifications.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No notifications yet.</p>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  nexaService.markNotificationRead(notif.id);
                  onRefresh();
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  notif.is_read
                    ? 'bg-[#080E1C] border-[#16233B] opacity-75'
                    : 'bg-[#091F22] border-[#00C995]/50 shadow-md shadow-[#00C995]/10'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#070B14] border border-[#16233B] flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs">{notif.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(notif.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed text-[11px]">{notif.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

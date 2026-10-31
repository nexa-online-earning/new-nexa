export type MembershipTier = 'without_investment' | 'premium';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type PaymentMethod = 'easypaisa' | 'jazzcash';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  whatsapp_number?: string;
  avatar_url?: string;
  membership_tier: MembershipTier;
  verification_status: VerificationStatus;
  referral_code: string;
  referred_by_uid?: string;
  balance_pkr: number;
  total_earned_pkr: number;
  total_withdrawn_pkr: number;
  available_spins: number;
  initial_spins_claimed: boolean;
  tasks_unlocked_milestone: boolean;
  device_id?: string;
  device_model?: string;
  device_registered_at?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferralRecord {
  id: string;
  referrer_uid: string;
  referred_uid: string;
  referred_email: string;
  referred_whatsapp?: string;
  status: 'pending' | 'verified' | 'rejected';
  bonus_credited: boolean;
  bonus_credited_at?: string;
  premium_commission_credited: boolean;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_uid: string;
  email: string;
  whatsapp_number: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface MembershipPayment {
  id: string;
  user_uid: string;
  user_email: string;
  amount_pkr: number;
  payment_method: PaymentMethod;
  trx_id: string;
  screenshot_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface WithdrawalOption {
  amount: number;
  fee: number;
  net: number;
  requiresPremium: boolean;
}

export const WITHDRAWAL_TIERS: WithdrawalOption[] = [
  { amount: 42, fee: 7, net: 35, requiresPremium: false },
  { amount: 210, fee: 5, net: 205, requiresPremium: true },
  { amount: 595, fee: 90, net: 505, requiresPremium: true },
  { amount: 1205, fee: 205, net: 1000, requiresPremium: true },
  { amount: 5500, fee: 500, net: 5000, requiresPremium: true },
];

export interface WithdrawalRecord {
  id: string;
  user_uid: string;
  payment_method: PaymentMethod;
  account_holder_name: string;
  account_number: string;
  requested_amount: number;
  fee_amount: number;
  net_payable_amount: number;
  status: WithdrawalStatus;
  admin_trx_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface SpinSlice {
  index: number;
  amount: number;
  label: string;
  color: string;
  textColor: string;
}

export const WHEEL_SLICES: SpinSlice[] = [
  { index: 0, amount: 50, label: 'PKR 50', color: '#00C995', textColor: '#04101E' },
  { index: 1, amount: 60, label: 'PKR 60', color: '#0B253A', textColor: '#00E5A3' },
  { index: 2, amount: 75, label: 'PKR 75', color: '#059669', textColor: '#FFFFFF' },
  { index: 3, amount: 100, label: 'PKR 100', color: '#0D383D', textColor: '#34D399' },
  { index: 4, amount: 150, label: 'PKR 150', color: '#0284C7', textColor: '#FFFFFF' },
  { index: 5, amount: 200, label: 'PKR 200', color: '#0A4A40', textColor: '#A7F3D0' },
  { index: 6, amount: 300, label: 'PKR 300', color: '#D97706', textColor: '#FFFFFF' },
  { index: 7, amount: 500, label: 'PKR 500 ⭐', color: '#10B981', textColor: '#04101E' },
];

export interface SpinRecord {
  id: string;
  user_uid: string;
  reward_amount: number;
  is_initial_package: boolean;
  spin_index: number;
  slice_label: string;
  created_at: string;
}

export interface DailyTaskItem {
  id: string;
  task_number: number;
  task_key: 'poll_completion' | 'watch_ads' | 'watch_videos' | 'ad_clicks';
  title: string;
  description: string;
  action_url: string;
  reward_pkr: number;
  is_admin_unlocked: boolean;
  is_active: boolean;
}

export interface TaskCompletion {
  id: string;
  user_uid: string;
  task_key: string;
  reward_pkr: number;
  completion_date: string;
  created_at: string;
}

export interface FinancialLedgerEntry {
  id: string;
  user_uid: string;
  transaction_type:
    | 'referral_bonus'
    | 'premium_commission'
    | 'spin_reward'
    | 'redeem_reward'
    | 'registration_bonus'
    | 'task_reward'
    | 'membership_payment'
    | 'withdrawal_request'
    | 'withdrawal_fee'
    | 'payout_completed'
    | 'adjustment';
  amount_pkr: number;
  balance_after_pkr: number;
  related_id?: string;
  description: string;
  created_at: string;
}

export interface RedeemCode {
  id: string;
  code: string;
  activated_at: string;
  expires_at: string;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  reward_mode: string;
  created_at: string;
}

export interface RegistrationBonusRecord {
  id: string;
  user_uid: string;
  amount_pkr: number;
  approved_by: string;
  created_at: string;
}

export interface LeaderboardRank {
  rank: number;
  uid: string;
  email: string;
  verified_referrals_count: number;
  membership_tier: MembershipTier;
  avatar_url?: string;
  isCurrentUser?: boolean;
}

export interface AppNotification {
  id: string;
  user_uid: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface AppConfigSettings {
  apk_download_url: string;
  whatsapp_verification_url: string;
  instagram_bonus_url: string;
  telegram_support_url: string;
  easypaisa_qr_url: string;
  easypaisa_account_title: string;
  easypaisa_account_number: string;
  jazzcash_qr_url: string;
  jazzcash_account_title: string;
  jazzcash_account_number: string;
  leaderboard_rewards: Record<number, number>;
}

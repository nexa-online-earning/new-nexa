-- =====================================================================
-- NEXA EARN - PRODUCTION SUPABASE POSTGRESQL SCHEMA & MIGRATION
-- Single source of truth for users, referrals, verification, memberships,
-- payments, spins, tasks, balances, withdrawals, notifications, leaderboard.
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  whatsapp_number TEXT,
  avatar_url TEXT,
  membership_tier TEXT NOT NULL DEFAULT 'without_investment' CHECK (membership_tier IN ('without_investment', 'premium')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  referral_code TEXT UNIQUE NOT NULL,
  referred_by_uid TEXT REFERENCES public.profiles(uid) ON DELETE SET NULL,
  balance_pkr INTEGER NOT NULL DEFAULT 0 CHECK (balance_pkr >= 0),
  total_earned_pkr INTEGER NOT NULL DEFAULT 0 CHECK (total_earned_pkr >= 0),
  total_withdrawn_pkr INTEGER NOT NULL DEFAULT 0 CHECK (total_withdrawn_pkr >= 0),
  available_spins INTEGER NOT NULL DEFAULT 0 CHECK (available_spins >= 0),
  initial_spins_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  tasks_unlocked_milestone BOOLEAN NOT NULL DEFAULT FALSE,
  device_id TEXT,
  device_model TEXT,
  device_registered_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_profiles_uid ON public.profiles(uid);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp ON public.profiles(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_device_id ON public.profiles(device_id);

-- 2. REFERRALS TABLE
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  referred_uid TEXT NOT NULL UNIQUE REFERENCES public.profiles(uid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  bonus_credited BOOLEAN NOT NULL DEFAULT FALSE,
  bonus_credited_at TIMESTAMPTZ,
  premium_commission_credited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_uid);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- 3. VERIFICATION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  email TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_uid ON public.verification_requests(user_uid);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status);

-- 4. MEMBERSHIPS PAYMENTS TABLE (PKR 500 Deposits for Premium Membership)
CREATE TABLE IF NOT EXISTS public.memberships_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  amount_pkr INTEGER NOT NULL DEFAULT 500,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('easypaisa', 'jazzcash')),
  trx_id TEXT NOT NULL UNIQUE,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_payments_trx ON public.memberships_payments(trx_id);
CREATE INDEX IF NOT EXISTS idx_memberships_payments_uid ON public.memberships_payments(user_uid);

-- 5. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('easypaisa', 'jazzcash')),
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  requested_amount INTEGER NOT NULL CHECK (requested_amount IN (42, 210, 595, 1205, 5500)),
  fee_amount INTEGER NOT NULL CHECK (fee_amount IN (7, 5, 90, 205, 500)),
  net_payable_amount INTEGER NOT NULL CHECK (net_payable_amount IN (35, 205, 505, 1000, 5000)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  admin_trx_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_uid ON public.withdrawals(user_uid);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- 6. SPINS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.spins_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  reward_amount INTEGER NOT NULL CHECK (reward_amount BETWEEN 50 AND 500),
  is_initial_package BOOLEAN NOT NULL DEFAULT FALSE,
  spin_index INTEGER,
  slice_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spins_uid ON public.spins_history(user_uid);

-- 7. DAILY TASKS TABLE
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number INTEGER NOT NULL UNIQUE CHECK (task_number BETWEEN 1 AND 4),
  task_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_url TEXT NOT NULL,
  reward_pkr INTEGER NOT NULL DEFAULT 15,
  is_admin_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Initial Tasks
INSERT INTO public.daily_tasks (task_number, task_key, title, description, action_url, reward_pkr, is_admin_unlocked)
VALUES
(1, 'poll_completion', 'Poll Completion', 'Participate in our partner survey and submit your response.', 'https://example.com/partner-survey-poll', 15, TRUE),
(2, 'watch_ads', 'Watch Ads', 'View sponsored ad unit completely to support the platform.', 'https://example.com/partner-ads-portal', 15, FALSE),
(3, 'watch_videos', 'Watch Videos', 'Stream the promotional video tutorial for 60 seconds.', 'https://example.com/partner-video-stream', 15, FALSE),
(4, 'ad_clicks', 'Ad Clicks', 'Click and explore partner offers for at least 30 seconds.', 'https://example.com/partner-offer-click', 15, FALSE)
ON CONFLICT (task_number) DO NOTHING;

-- 8. TASK COMPLETIONS TABLE
CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  reward_pkr INTEGER NOT NULL,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_uid, task_key, completion_date)
);

CREATE INDEX IF NOT EXISTS idx_task_comp_date ON public.task_completions(user_uid, completion_date);

-- 9. FINANCIAL LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'referral_bonus',
    'premium_commission',
    'spin_reward',
    'redeem_reward',
    'registration_bonus',
    'task_reward',
    'membership_payment',
    'withdrawal_request',
    'withdrawal_fee',
    'payout_completed',
    'adjustment'
  )),
  amount_pkr INTEGER NOT NULL,
  balance_after_pkr INTEGER NOT NULL,
  related_id TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_uid ON public.financial_ledger(user_uid);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.financial_ledger(transaction_type);

-- 10. REDEEM CODES TABLE
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  activated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reward_mode TEXT NOT NULL DEFAULT 'policy_50_500',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redeem_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  code_id UUID NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  reward_pkr INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_uid, code_id)
);

-- 11. REGISTRATION BONUSES TABLE (Instagram UID claims)
CREATE TABLE IF NOT EXISTS public.registration_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL UNIQUE REFERENCES public.profiles(uid) ON DELETE CASCADE,
  amount_pkr INTEGER NOT NULL CHECK (amount_pkr BETWEEN 50 AND 500),
  approved_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. LEADERBOARD REWARD CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.leaderboard_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  reward_pkr INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_uid, week_id)
);

-- 13. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid TEXT NOT NULL REFERENCES public.profiles(uid) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_uid ON public.notifications(user_uid);

-- 14. APPLICATION SETTINGS & ASSETS
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default Settings
INSERT INTO public.app_settings (key, value)
VALUES
  ('apk_download_url', '"https://github.com/nexa-earn/nexa-earn-app/releases/download/v1.0.0/nexa-earn-v1.0.0.apk"'),
  ('whatsapp_verification_url', '"https://chat.whatsapp.com/GHY7exampleVerifyGroup"'),
  ('instagram_bonus_url', '"https://instagram.com/nexaearn_official"'),
  ('telegram_support_url', '"https://t.me/NexaEarnSupportOfficial"'),
  ('easypaisa_qr_url', '"https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600"'),
  ('easypaisa_account_title', '"NEXA EARN OFFICIAL"'),
  ('easypaisa_account_number', '"03401234567"'),
  ('jazzcash_qr_url', '"https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600"'),
  ('jazzcash_account_title', '"NEXA EARN OFFICIAL"'),
  ('jazzcash_account_number', '"03001234567"'),
  ('leaderboard_rewards', '{"1": 1500, "2": 1000, "3": 750, "4": 500, "5": 400, "6": 300, "7": 250, "8": 200, "9": 150, "10": 100}')
ON CONFLICT (key) DO NOTHING;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spins_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view own profile or public leaderboard info, Admin can view/edit all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Public can view leaderboard profile fields" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own avatar and device registration" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Referrals: Referrer can view their referred users
CREATE POLICY "Users view own referrals" ON public.referrals
  FOR SELECT USING (
    referrer_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

-- Verification requests: User can view & create their request; Admin full access
CREATE POLICY "User view own verification request" ON public.verification_requests
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

CREATE POLICY "User create verification request" ON public.verification_requests
  FOR INSERT WITH CHECK (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin manage verification requests" ON public.verification_requests
  FOR ALL USING (public.is_admin());

-- Memberships Payments:
CREATE POLICY "User view own payments" ON public.memberships_payments
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

CREATE POLICY "User submit membership payment" ON public.memberships_payments
  FOR INSERT WITH CHECK (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin manage membership payments" ON public.memberships_payments
  FOR ALL USING (public.is_admin());

-- Withdrawals:
CREATE POLICY "User view own withdrawals" ON public.withdrawals
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

CREATE POLICY "User submit withdrawal" ON public.withdrawals
  FOR INSERT WITH CHECK (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin manage withdrawals" ON public.withdrawals
  FOR ALL USING (public.is_admin());

-- Daily Tasks & completions:
CREATE POLICY "Everyone view active tasks" ON public.daily_tasks
  FOR SELECT USING (true);

CREATE POLICY "Admin manage daily tasks" ON public.daily_tasks
  FOR ALL USING (public.is_admin());

CREATE POLICY "User view own task completions" ON public.task_completions
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

-- Notifications:
CREATE POLICY "User view own notifications" ON public.notifications
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

CREATE POLICY "User update read status of own notifications" ON public.notifications
  FOR UPDATE USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

-- App Settings: Read by all, written only by admin
CREATE POLICY "Anyone read app settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admin modify app settings" ON public.app_settings
  FOR ALL USING (public.is_admin());

-- Financial Ledger:
CREATE POLICY "User view own ledger" ON public.financial_ledger
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

-- Spins history:
CREATE POLICY "User view own spins" ON public.spins_history
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

-- Audit logs: Admin only
CREATE POLICY "Admin view audit logs" ON public.audit_logs
  FOR ALL USING (public.is_admin());

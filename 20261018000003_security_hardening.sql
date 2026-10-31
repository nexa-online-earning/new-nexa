-- =====================================================================
-- NEXA EARN - SECURITY HARDENING, FIELD PROTECTION & AUTHORIZED RPCS
-- Migration: 20261018000003_security_hardening.sql
-- Enforces:
-- 1. Strict BEFORE UPDATE triggers preventing unauthorized balance/role escalation
-- 2. Caller authentication and ownership checks on all financial RPC functions
-- 3. Atomic row-locking (FOR UPDATE) across all balance and status mutations
-- 4. Complete server-authoritative Daily Task completion engine
-- 5. Revocation of direct UPDATE permissions on financial columns for standard users
-- =====================================================================

-- 1. DROP PERMISSIVE UPDATE POLICY ON PROFILES
DROP POLICY IF EXISTS "Users can update own avatar and device registration" ON public.profiles;
DROP POLICY IF EXISTS "Users can safely update allowed profile fields" ON public.profiles;

CREATE POLICY "Users can safely update allowed profile fields" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 2. REVOKE DIRECT UPDATE PRIVILEGES ON SENSITIVE COLUMNS
-- Authenticated users may ONLY directly update safe profile metadata
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (avatar_url, whatsapp_number, device_id, device_model) ON public.profiles TO authenticated;

-- 3. SERVER-SIDE IMMUTABILITY TRIGGER (DEFENSE-IN-DEPTH)
-- Ensures that even if an attacker bypasses RLS, PostgreSQL aborts any modification
-- of financial columns, spin balances, tier, or admin status unless executed by admin or service_role.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If update is initiated by a standard non-admin authenticated caller:
  IF (auth.uid() IS NOT NULL AND NOT public.is_admin()) THEN
    IF NEW.balance_pkr IS DISTINCT FROM OLD.balance_pkr THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify wallet balance directly.';
    END IF;
    IF NEW.total_earned_pkr IS DISTINCT FROM OLD.total_earned_pkr THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify total earnings directly.';
    END IF;
    IF NEW.total_withdrawn_pkr IS DISTINCT FROM OLD.total_withdrawn_pkr THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify withdrawal totals directly.';
    END IF;
    IF NEW.available_spins IS DISTINCT FROM OLD.available_spins THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify available spins directly.';
    END IF;
    IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify membership tier directly.';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify administrator status.';
    END IF;
    IF NEW.uid IS DISTINCT FROM OLD.uid THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify account UID.';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify referral code.';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify verification status directly.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 4. SERVER-AUTHORITATIVE DAILY TASK COMPLETION RPC
CREATE OR REPLACE FUNCTION public.complete_daily_task(
  p_user_uid TEXT,
  p_task_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_task RECORD;
  v_today DATE := CURRENT_DATE;
  v_is_unlocked BOOLEAN := FALSE;
BEGIN
  -- Fetch user profile with exclusive row lock
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- Caller ownership verification
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_profile.id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot complete tasks for another account.');
  END IF;

  -- Fetch task definition
  SELECT * INTO v_task FROM public.daily_tasks WHERE task_key = p_task_key AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive task.');
  END IF;

  -- Verify task unlock criteria
  IF v_task.is_admin_unlocked = TRUE OR v_profile.membership_tier = 'premium' OR v_profile.tasks_unlocked_milestone = TRUE THEN
    v_is_unlocked := TRUE;
  END IF;

  IF NOT v_is_unlocked THEN
    RETURN jsonb_build_object('success', false, 'error', 'This task is locked. Upgrade to Premium or refer 20 users to unlock.');
  END IF;

  -- Check if already completed today
  IF EXISTS (
    SELECT 1 FROM public.task_completions
    WHERE user_uid = p_user_uid AND task_key = p_task_key AND completion_date = v_today
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already completed this task today.');
  END IF;

  -- Insert completion record
  INSERT INTO public.task_completions (
    user_uid,
    task_key,
    reward_pkr,
    completion_date
  ) VALUES (
    p_user_uid,
    p_task_key,
    v_task.reward_pkr,
    v_today
  );

  -- Credit user balance
  UPDATE public.profiles
  SET
    balance_pkr = balance_pkr + v_task.reward_pkr,
    total_earned_pkr = total_earned_pkr + v_task.reward_pkr,
    updated_at = now()
  WHERE uid = p_user_uid;

  -- Record in financial ledger
  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    description
  ) VALUES (
    p_user_uid,
    'task_reward',
    v_task.reward_pkr,
    v_profile.balance_pkr + v_task.reward_pkr,
    'Daily Task Reward: ' || v_task.title || ' (PKR ' || v_task.reward_pkr || ')'
  );

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_task.reward_pkr,
    'new_balance', v_profile.balance_pkr + v_task.reward_pkr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. HARDEN SPIN ENGINE WITH CALLER OWNERSHIP CHECK
CREATE OR REPLACE FUNCTION public.execute_server_spin(
  p_user_uid TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_reward INTEGER;
  v_slice_index INTEGER;
  v_slice_label TEXT;
  v_rand FLOAT;
  v_spins_done_in_pkg INTEGER;
  v_pkg_sum INTEGER;
  v_is_initial BOOLEAN := FALSE;
BEGIN
  -- Row lock
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Verify caller owns this account or is admin
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_profile.id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot execute spin for another account.');
  END IF;

  IF v_profile.available_spins <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No spins available');
  END IF;

  -- Check initial 5-spins package mode
  SELECT COUNT(*), COALESCE(SUM(reward_amount), 0)
  INTO v_spins_done_in_pkg, v_pkg_sum
  FROM public.spins_history
  WHERE user_uid = p_user_uid AND is_initial_package = TRUE;

  IF v_spins_done_in_pkg < 5 AND v_profile.initial_spins_claimed = TRUE THEN
    v_is_initial := TRUE;
    IF v_spins_done_in_pkg = 0 THEN
      v_reward := 200; v_slice_index := 5;
    ELSIF v_spins_done_in_pkg = 1 THEN
      v_reward := 150; v_slice_index := 4;
    ELSIF v_spins_done_in_pkg = 2 THEN
      v_reward := 300; v_slice_index := 6;
    ELSIF v_spins_done_in_pkg = 3 THEN
      v_reward := 100; v_slice_index := 3;
    ELSE
      v_reward := 200; v_slice_index := 5;
    END IF;
  ELSE
    -- Regular Spin Policy: 80% PKR 50, ~1% PKR 500, rest PKR 60, 75, 100, 150, 200, 300
    v_rand := RANDOM();
    IF v_rand < 0.80 THEN
      v_reward := 50; v_slice_index := 0;
    ELSIF v_rand < 0.81 THEN
      v_reward := 500; v_slice_index := 7;
    ELSIF v_rand < 0.88 THEN
      v_reward := 60; v_slice_index := 1;
    ELSIF v_rand < 0.93 THEN
      v_reward := 75; v_slice_index := 2;
    ELSIF v_rand < 0.96 THEN
      v_reward := 100; v_slice_index := 3;
    ELSIF v_rand < 0.98 THEN
      v_reward := 150; v_slice_index := 4;
    ELSIF v_rand < 0.995 THEN
      v_reward := 200; v_slice_index := 5;
    ELSE
      v_reward := 300; v_slice_index := 6;
    END IF;
  END IF;

  v_slice_label := 'PKR ' || v_reward::TEXT;

  -- Deduct spin & credit reward
  UPDATE public.profiles
  SET
    available_spins = available_spins - 1,
    balance_pkr = balance_pkr + v_reward,
    total_earned_pkr = total_earned_pkr + v_reward,
    updated_at = now()
  WHERE uid = p_user_uid;

  INSERT INTO public.spins_history (
    user_uid,
    reward_amount,
    is_initial_package,
    spin_index,
    slice_label
  ) VALUES (
    p_user_uid,
    v_reward,
    v_is_initial,
    v_slice_index,
    v_slice_label
  );

  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    description
  ) VALUES (
    p_user_uid,
    'spin_reward',
    v_reward,
    v_profile.balance_pkr + v_reward,
    'Wheel Spin Reward: ' || v_slice_label
  );

  RETURN jsonb_build_object(
    'success', true,
    'reward_amount', v_reward,
    'slice_index', v_slice_index,
    'slice_label', v_slice_label,
    'new_balance', v_profile.balance_pkr + v_reward,
    'remaining_spins', v_profile.available_spins - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. HARDEN WITHDRAWAL REQUEST WITH CALLER OWNERSHIP CHECK
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_uid TEXT,
  p_payment_method TEXT,
  p_account_holder TEXT,
  p_account_number TEXT,
  p_amount INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_verified_referrals_count INTEGER;
  v_active_withdrawal_count INTEGER;
  v_fee INTEGER;
  v_net INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Caller ownership verification
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_profile.id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot request withdrawal for another account.');
  END IF;

  IF v_profile.verification_status <> 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account must be WhatsApp verified before requesting withdrawals.');
  END IF;

  -- 10 qualifying referrals check
  SELECT COUNT(*) INTO v_verified_referrals_count
  FROM public.referrals
  WHERE referrer_uid = p_user_uid AND status = 'verified';

  IF v_verified_referrals_count < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawals unlock after 10 verified referrals. You currently have ' || v_verified_referrals_count::TEXT || ' / 10.'
    );
  END IF;

  -- Active withdrawal check
  SELECT COUNT(*) INTO v_active_withdrawal_count
  FROM public.withdrawals
  WHERE user_uid = p_user_uid AND status IN ('pending', 'processing');

  IF v_active_withdrawal_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active withdrawal in progress. Please wait for it to complete.');
  END IF;

  -- Tier check: Without-investment users may ONLY select PKR 42
  IF v_profile.membership_tier = 'without_investment' AND p_amount <> 42 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔'
    );
  END IF;

  IF p_amount = 42 THEN
    v_fee := 7; v_net := 35;
  ELSIF p_amount = 210 THEN
    v_fee := 5; v_net := 205;
  ELSIF p_amount = 595 THEN
    v_fee := 90; v_net := 505;
  ELSIF p_amount = 1205 THEN
    v_fee := 205; v_net := 1000;
  ELSIF p_amount = 5500 THEN
    v_fee := 500; v_net := 5000;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid withdrawal amount.');
  END IF;

  IF v_profile.balance_pkr < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Available: PKR ' || v_profile.balance_pkr);
  END IF;

  -- Deduct balance
  UPDATE public.profiles
  SET
    balance_pkr = balance_pkr - p_amount,
    total_withdrawn_pkr = total_withdrawn_pkr + p_amount,
    updated_at = now()
  WHERE uid = p_user_uid;

  INSERT INTO public.withdrawals (
    user_uid,
    payment_method,
    account_holder_name,
    account_number,
    requested_amount,
    fee_amount,
    net_payable_amount,
    status
  ) VALUES (
    p_user_uid,
    p_payment_method,
    p_account_holder,
    p_account_number,
    p_amount,
    v_fee,
    v_net,
    'pending'
  );

  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    description
  ) VALUES (
    p_user_uid,
    'withdrawal_request',
    - p_amount,
    v_profile.balance_pkr - p_amount,
    'Withdrawal Request: PKR ' || p_amount || ' via ' || p_payment_method || ' (Fee: PKR ' || v_fee || ', Net: PKR ' || v_net || ')'
  );

  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    p_user_uid,
    'Withdrawal Request Submitted',
    'Your withdrawal of PKR ' || p_amount || ' (Net PKR ' || v_net || ') via ' || p_payment_method || ' has been received and is pending admin review.',
    'withdrawal_pending'
  );

  RETURN jsonb_build_object(
    'success', true,
    'requested_amount', p_amount,
    'fee_amount', v_fee,
    'net_payable', v_net,
    'remaining_balance', v_profile.balance_pkr - p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. GRANT EXECUTE PERMISSIONS TO AUTHENTICATED USERS
GRANT EXECUTE ON FUNCTION public.complete_daily_task(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_server_spin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_redeem_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_user_verification(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_membership_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_instagram_bonus(TEXT, INTEGER, TEXT) TO authenticated;

-- 8. HARDEN RESET_DEVICE_LOCK WITH SERVER-SIDE ADMIN CHECK
CREATE OR REPLACE FUNCTION public.reset_device_lock(
  p_target_uid TEXT,
  p_admin_email TEXT
)
RETURNS JSONB AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required.');
  END IF;

  UPDATE public.profiles
  SET
    device_id = NULL,
    device_model = NULL,
    device_registered_at = NULL
  WHERE uid = p_target_uid;

  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (
    p_admin_email,
    'RESET_DEVICE_LOCK',
    'profile',
    p_target_uid,
    '{"reset": true}'::jsonb
  );

  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    p_target_uid,
    'Device Lock Reset',
    'Your account device registration has been updated by an administrator.',
    'security'
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_device_lock(TEXT, TEXT) TO authenticated;


-- =====================================================================
-- NEXA EARN - PRODUCTION SPINS, WITHDRAWALS, REDEEM CODES & DEVICE LOCK
-- Exact business amounts, fee validation, duplicate prevention, and ledgering.
-- =====================================================================

-- 1. SERVER-AUTHORITATIVE SPIN ENGINE
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
  -- The 8 slices of the NEXA EARN wheel
  -- Index 0: PKR 50
  -- Index 1: PKR 60
  -- Index 2: PKR 75
  -- Index 3: PKR 100
  -- Index 4: PKR 150
  -- Index 5: PKR 200
  -- Index 6: PKR 300
  -- Index 7: PKR 500
BEGIN
  -- Lock profile row for update to prevent concurrent race conditions
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_profile.available_spins <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No spins available');
  END IF;

  -- Check if user is in initial 5-spins package mode
  SELECT COUNT(*), COALESCE(SUM(reward_amount), 0)
  INTO v_spins_done_in_pkg, v_pkg_sum
  FROM public.spins_history
  WHERE user_uid = p_user_uid AND is_initial_package = TRUE;

  IF v_spins_done_in_pkg < 5 AND v_profile.initial_spins_claimed = TRUE THEN
    v_is_initial := TRUE;
    -- Server policy for initial 5-spins package:
    -- Guarantees total between 900 and 1,000 PKR across 5 spins (e.g. Target ~960 PKR).
    IF v_spins_done_in_pkg = 0 THEN
      v_reward := 200; v_slice_index := 5;
    ELSIF v_spins_done_in_pkg = 1 THEN
      v_reward := 150; v_slice_index := 4;
    ELSIF v_spins_done_in_pkg = 2 THEN
      v_reward := 300; v_slice_index := 6;
    ELSIF v_spins_done_in_pkg = 3 THEN
      v_reward := 100; v_slice_index := 3;
    ELSE
      -- Final spin brings total to 960 (200 + 150 + 300 + 100 + 210 -> 210 rounds to 200, so 950 or 980 total)
      v_reward := 200; v_slice_index := 5;
    END IF;
  ELSE
    -- Regular Premium Spin Policy:
    -- 80% PKR 50, ~1% PKR 500, rest PKR 60, 75, 100, 150, 200, 300
    v_rand := RANDOM();
    IF v_rand < 0.80 THEN
      v_reward := 50; v_slice_index := 0;
    ELSIF v_rand < 0.81 THEN
      v_reward := 500; v_slice_index := 7; -- 1 in 100 lucky hit
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

  -- Deduct 1 spin, add reward to balance
  UPDATE public.profiles
  SET
    available_spins = available_spins - 1,
    balance_pkr = balance_pkr + v_reward,
    total_earned_pkr = total_earned_pkr + v_reward,
    updated_at = now()
  WHERE uid = p_user_uid;

  -- Record spin history
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

  -- Record in financial ledger
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

-- 2. WITHDRAWAL REQUEST FUNCTION
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
  -- 1. Fetch user profile with row lock
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- 2. Check account verification status
  IF v_profile.verification_status <> 'verified' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account must be WhatsApp verified before requesting withdrawals.');
  END IF;

  -- 3. Check 10 qualifying referrals eligibility
  SELECT COUNT(*) INTO v_verified_referrals_count
  FROM public.referrals
  WHERE referrer_uid = p_user_uid AND status = 'verified';

  IF v_verified_referrals_count < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Withdrawals unlock after 10 verified referrals. You currently have ' || v_verified_referrals_count::TEXT || ' / 10.'
    );
  END IF;

  -- 4. Check for active (pending or processing) withdrawal
  SELECT COUNT(*) INTO v_active_withdrawal_count
  FROM public.withdrawals
  WHERE user_uid = p_user_uid AND status IN ('pending', 'processing');

  IF v_active_withdrawal_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active withdrawal in progress. Please wait for it to complete.');
  END IF;

  -- 5. Membership tier & Amount validation
  -- Without-investment users may ONLY select PKR 42
  IF v_profile.membership_tier = 'without_investment' AND p_amount <> 42 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔'
    );
  END IF;

  -- Validate allowed amounts and calculate exact specified fees
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

  -- 6. Check balance sufficiency
  IF v_profile.balance_pkr < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Available: PKR ' || v_profile.balance_pkr);
  END IF;

  -- 7. Deduct from balance
  UPDATE public.profiles
  SET
    balance_pkr = balance_pkr - p_amount,
    total_withdrawn_pkr = total_withdrawn_pkr + p_amount,
    updated_at = now()
  WHERE uid = p_user_uid;

  -- 8. Create withdrawal record
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

  -- 9. Ledger entries for withdrawal request and fee
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

  -- 10. Notification
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

-- 3. CLAIM REDEEM CODE (Exclusive to Premium Membership)
CREATE OR REPLACE FUNCTION public.claim_redeem_code(
  p_user_uid TEXT,
  p_code_text TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_code RECORD;
  v_reward INTEGER;
  v_rand FLOAT;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Must be Premium Member
  IF v_profile.membership_tier <> 'premium' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redeem codes are exclusive to Premium Membership users.');
  END IF;

  -- Look up code
  SELECT * INTO v_code FROM public.redeem_codes
  WHERE UPPER(code) = UPPER(TRIM(p_code_text)) AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive redeem code.');
  END IF;

  -- Check time window
  IF now() < v_code.activated_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'This redeem code is not active yet.');
  END IF;

  IF now() > v_code.expires_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'This redeem code has expired.');
  END IF;

  -- Check max uses
  IF v_code.times_used >= v_code.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This redeem code has reached its maximum claim limit.');
  END IF;

  -- Check already claimed by user
  IF EXISTS (SELECT 1 FROM public.redeem_claims WHERE user_uid = p_user_uid AND code_id = v_code.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code.');
  END IF;

  -- Reward calculation: PKR 50-500 policy (Normal: PKR 50, Exceptional 1/100: PKR 500)
  v_rand := RANDOM();
  IF v_rand < 0.01 THEN
    v_reward := 500;
  ELSIF v_rand < 0.05 THEN
    v_reward := 100;
  ELSIF v_rand < 0.15 THEN
    v_reward := 75;
  ELSIF v_rand < 0.30 THEN
    v_reward := 60;
  ELSE
    v_reward := 50;
  END IF;

  -- Increment usage
  UPDATE public.redeem_codes
  SET times_used = times_used + 1
  WHERE id = v_code.id;

  -- Record claim
  INSERT INTO public.redeem_claims (user_uid, code_id, reward_pkr)
  VALUES (p_user_uid, v_code.id, v_reward);

  -- Credit balance
  UPDATE public.profiles
  SET
    balance_pkr = balance_pkr + v_reward,
    total_earned_pkr = total_earned_pkr + v_reward,
    updated_at = now()
  WHERE uid = p_user_uid;

  -- Ledger
  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    related_id,
    description
  ) VALUES (
    p_user_uid,
    'redeem_reward',
    v_reward,
    v_profile.balance_pkr + v_reward,
    v_code.code,
    'Redeem Code Claim (' || v_code.code || '): PKR ' || v_reward
  );

  RETURN jsonb_build_object(
    'success', true,
    'reward_amount', v_reward,
    'new_balance', v_profile.balance_pkr + v_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SEND INSTAGRAM REGISTRATION BONUS (Admin privileged)
CREATE OR REPLACE FUNCTION public.send_instagram_bonus(
  p_target_uid TEXT,
  p_amount INTEGER,
  p_admin_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF p_amount < 50 OR p_amount > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bonus amount must be between PKR 50 and PKR 500.');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_target_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- Check if user already claimed registration bonus
  IF EXISTS (SELECT 1 FROM public.registration_bonuses WHERE user_uid = p_target_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This user has already received a registration bonus.');
  END IF;

  -- Insert bonus record
  INSERT INTO public.registration_bonuses (user_uid, amount_pkr, approved_by)
  VALUES (p_target_uid, p_amount, p_admin_email);

  -- Credit user
  UPDATE public.profiles
  SET
    balance_pkr = balance_pkr + p_amount,
    total_earned_pkr = total_earned_pkr + p_amount,
    updated_at = now()
  WHERE uid = p_target_uid;

  -- Ledger
  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    related_id,
    description
  ) VALUES (
    p_target_uid,
    'registration_bonus',
    p_amount,
    v_profile.balance_pkr + p_amount,
    'INSTAGRAM_CLAIM',
    'Instagram Registration Bonus: PKR ' || p_amount || ' issued by ' || p_admin_email
  );

  -- Notify user
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    p_target_uid,
    'Registration Bonus Credited!',
    'Your Instagram UID claim was approved! PKR ' || p_amount || ' has been added to your balance.',
    'bonus_credited'
  );

  -- Audit log
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (
    p_admin_email,
    'SEND_REGISTRATION_BONUS',
    'profile',
    p_target_uid,
    jsonb_build_object('amount_pkr', p_amount)
  );

  RETURN jsonb_build_object('success', true, 'amount_pkr', p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ANDROID DEVICE LOCK & RESET
CREATE OR REPLACE FUNCTION public.bind_android_device(
  p_user_uid TEXT,
  p_device_id TEXT,
  p_device_model TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE uid = p_user_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Multi-device and multi-account enabled: device lock restriction removed
  UPDATE public.profiles
  SET
    device_id = p_device_id,
    device_model = p_device_model,
    device_registered_at = now()
  WHERE uid = p_user_uid;

  RETURN jsonb_build_object('success', true, 'status', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to reset device lock
CREATE OR REPLACE FUNCTION public.reset_device_lock(
  p_target_uid TEXT,
  p_admin_email TEXT
)
RETURNS JSONB AS $$
BEGIN
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
    'Your account device binding has been reset by an administrator. You can now log in from your new device.',
    'security'
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

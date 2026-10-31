-- =====================================================================
-- NEXA EARN - PRODUCTION POSTGRESQL STORED PROCEDURES & RPC FUNCTIONS
-- Server-authoritative logic for spins, bonuses, commissions, withdrawals,
-- milestones, device binding, and administrative approvals.
-- =====================================================================

-- 1. Helper to generate a unique random 7-digit UID
CREATE OR REPLACE FUNCTION public.generate_nexa_uid()
RETURNS TEXT AS $$
DECLARE
  new_uid TEXT;
  exists_uid BOOLEAN;
BEGIN
  LOOP
    new_uid := 'NE-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE uid = new_uid) INTO exists_uid;
    IF NOT exists_uid THEN
      RETURN new_uid;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper to generate a unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    new_code := 'NEXA' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO exists_code;
    IF NOT exists_code THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Automatic Profile Creation Trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_uid TEXT;
  assigned_ref_code TEXT;
  referrer_candidate_uid TEXT;
  initial_admin_email TEXT := 'rrdd8397@gmail.com';
  is_first_admin BOOLEAN := FALSE;
BEGIN
  assigned_uid := public.generate_nexa_uid();
  assigned_ref_code := public.generate_referral_code();
  
  -- Check if this user is configured as initial admin
  IF LOWER(NEW.email) = LOWER(initial_admin_email) THEN
    is_first_admin := TRUE;
  END IF;

  -- Extract referral from metadata if provided
  referrer_candidate_uid := NEW.raw_user_meta_data->>'referred_by_uid';

  -- Verify referrer candidate exists and is not self
  IF referrer_candidate_uid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE uid = referrer_candidate_uid) THEN
      referrer_candidate_uid := NULL;
    END IF;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (
    id,
    uid,
    email,
    whatsapp_number,
    referral_code,
    referred_by_uid,
    is_admin
  ) VALUES (
    NEW.id,
    assigned_uid,
    NEW.email,
    NEW.raw_user_meta_data->>'whatsapp_number',
    assigned_ref_code,
    referrer_candidate_uid,
    is_first_admin
  );

  -- Create referral record if referred
  IF referrer_candidate_uid IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_uid, referred_uid, status)
    VALUES (referrer_candidate_uid, assigned_uid, 'pending')
    ON CONFLICT (referred_uid) DO NOTHING;

    -- Notify referrer
    INSERT INTO public.notifications (user_uid, title, message, type)
    VALUES (
      referrer_candidate_uid,
      'New Referral Registered!',
      'User ' || assigned_uid || ' registered via your referral link. Status: Pending Verification.',
      'referral_new'
    );
  END IF;

  -- Welcome Notification
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    assigned_uid,
    'Welcome to NEXA EARN!',
    'Your account has been created with UID: ' || assigned_uid || '. Complete WhatsApp verification to activate full earning features.',
    'welcome'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Admin Function: Approve User Verification
CREATE OR REPLACE FUNCTION public.approve_user_verification(
  target_user_uid TEXT,
  admin_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  target_profile RECORD;
  ref_record RECORD;
  verified_count INTEGER;
  bonus_given BOOLEAN := FALSE;
BEGIN
  -- Get user profile
  SELECT * INTO target_profile FROM public.profiles WHERE uid = target_user_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update verification status
  UPDATE public.profiles
  SET verification_status = 'verified', updated_at = now()
  WHERE uid = target_user_uid;

  -- Update verification requests
  UPDATE public.verification_requests
  SET status = 'approved', reviewed_by = admin_email, reviewed_at = now()
  WHERE user_uid = target_user_uid AND status = 'pending';

  -- Check if user has a referrer and referral is pending
  SELECT * INTO ref_record FROM public.referrals
  WHERE referred_uid = target_user_uid AND status = 'pending';

  IF FOUND AND ref_record.bonus_credited = FALSE THEN
    -- Update referral status to verified and mark bonus credited
    UPDATE public.referrals
    SET status = 'verified', bonus_credited = TRUE, bonus_credited_at = now()
    WHERE id = ref_record.id;

    -- Award PKR 30 referral bonus to referring user
    UPDATE public.profiles
    SET
      balance_pkr = balance_pkr + 30,
      total_earned_pkr = total_earned_pkr + 30,
      updated_at = now()
    WHERE uid = ref_record.referrer_uid;

    -- Get referrer balance for ledger
    INSERT INTO public.financial_ledger (
      user_uid,
      transaction_type,
      amount_pkr,
      balance_after_pkr,
      related_id,
      description
    ) VALUES (
      ref_record.referrer_uid,
      'referral_bonus',
      30,
      (SELECT balance_pkr FROM public.profiles WHERE uid = ref_record.referrer_uid),
      target_user_uid,
      'PKR 30 Referral Bonus for verified user ' || target_user_uid
    );

    bonus_given := TRUE;

    -- Count total verified referrals for the referrer
    SELECT COUNT(*) INTO verified_count
    FROM public.referrals
    WHERE referrer_uid = ref_record.referrer_uid AND status = 'verified';

    -- Check 10 referrals milestone: 5 initial spins
    IF verified_count >= 10 THEN
      UPDATE public.profiles
      SET
        available_spins = available_spins + 5,
        initial_spins_claimed = TRUE
      WHERE uid = ref_record.referrer_uid AND initial_spins_claimed = FALSE;

      IF FOUND THEN
        INSERT INTO public.notifications (user_uid, title, message, type)
        VALUES (
          ref_record.referrer_uid,
          '10 Verified Referrals Milestone!',
          'Congratulations! You unlocked 5 Lucky Spins with prizes up to PKR 1,000!',
          'milestone_spins'
        );
      END IF;
    END IF;

    -- If referrer is Premium, award 1 spin per verified referral
    UPDATE public.profiles
    SET available_spins = available_spins + 1
    WHERE uid = ref_record.referrer_uid AND membership_tier = 'premium';

    -- Check 20 referrals milestone: Unlock daily tasks for without_investment users
    IF verified_count >= 20 THEN
      UPDATE public.profiles
      SET tasks_unlocked_milestone = TRUE
      WHERE uid = ref_record.referrer_uid AND tasks_unlocked_milestone = FALSE;

      IF FOUND THEN
        INSERT INTO public.notifications (user_uid, title, message, type)
        VALUES (
          ref_record.referrer_uid,
          '20 Referrals Milestone Reached!',
          'All Daily Tasks have been automatically unlocked for your account without requiring investment!',
          'milestone_tasks'
        );
      END IF;
    END IF;

    -- Notify referrer about PKR 30
    INSERT INTO public.notifications (user_uid, title, message, type)
    VALUES (
      ref_record.referrer_uid,
      'Referral Verified: PKR 30 Added',
      'Your referral ' || target_user_uid || ' was verified. PKR 30 has been credited to your wallet.',
      'referral_bonus'
    );
  END IF;

  -- Notify target user
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    target_user_uid,
    'Account Verified!',
    'Your WhatsApp verification has been approved. You are now a fully verified member of NEXA EARN.',
    'verification_approved'
  );

  -- Audit log
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (
    admin_email,
    'APPROVE_USER_VERIFICATION',
    'profile',
    target_user_uid,
    jsonb_build_object('bonus_credited', bonus_given)
  );

  RETURN jsonb_build_object('success', true, 'bonus_credited', bonus_given);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin Function: Approve Premium Membership Payment (PKR 500)
CREATE OR REPLACE FUNCTION public.approve_membership_payment(
  payment_uuid UUID,
  admin_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  p_record RECORD;
  ref_uid TEXT;
  referrer_profile RECORD;
BEGIN
  SELECT * INTO p_record FROM public.memberships_payments WHERE id = payment_uuid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF p_record.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already processed');
  END IF;

  -- 1. Update payment status
  UPDATE public.memberships_payments
  SET status = 'approved', reviewed_by = admin_email, reviewed_at = now()
  WHERE id = payment_uuid;

  -- 2. Upgrade user to Premium tier
  UPDATE public.profiles
  SET membership_tier = 'premium', updated_at = now()
  WHERE uid = p_record.user_uid;

  -- 3. Log membership payment in ledger
  INSERT INTO public.financial_ledger (
    user_uid,
    transaction_type,
    amount_pkr,
    balance_after_pkr,
    related_id,
    description
  ) VALUES (
    p_record.user_uid,
    'membership_payment',
    0,
    (SELECT balance_pkr FROM public.profiles WHERE uid = p_record.user_uid),
    p_record.trx_id,
    'Premium Membership Activated via TRX: ' || p_record.trx_id
  );

  -- 4. Check for qualifying referrer to award PKR 200 commission
  SELECT referred_by_uid INTO ref_uid FROM public.profiles WHERE uid = p_record.user_uid;

  IF ref_uid IS NOT NULL THEN
    -- Check if commission already given for this user
    IF NOT EXISTS (
      SELECT 1 FROM public.referrals
      WHERE referrer_uid = ref_uid AND referred_uid = p_record.user_uid AND premium_commission_credited = TRUE
    ) THEN
      -- Award PKR 200 to referrer
      UPDATE public.profiles
      SET
        balance_pkr = balance_pkr + 200,
        total_earned_pkr = total_earned_pkr + 200,
        updated_at = now()
      WHERE uid = ref_uid;

      UPDATE public.referrals
      SET premium_commission_credited = TRUE
      WHERE referrer_uid = ref_uid AND referred_uid = p_record.user_uid;

      -- Ledger for commission
      INSERT INTO public.financial_ledger (
        user_uid,
        transaction_type,
        amount_pkr,
        balance_after_pkr,
        related_id,
        description
      ) VALUES (
        ref_uid,
        'premium_commission',
        200,
        (SELECT balance_pkr FROM public.profiles WHERE uid = ref_uid),
        p_record.trx_id,
        'PKR 200 Premium Referral Commission from user ' || p_record.user_uid
      );

      -- Notify referrer
      INSERT INTO public.notifications (user_uid, title, message, type)
      VALUES (
        ref_uid,
        'Premium Commission: PKR 200 Received!',
        'Your referral ' || p_record.user_uid || ' upgraded to Premium Membership. PKR 200 commission credited to your wallet!',
        'premium_commission'
      );
    END IF;
  END IF;

  -- 5. Notify user
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (
    p_record.user_uid,
    'Welcome to Premium Membership!',
    'Your payment of PKR 500 has been verified. You now enjoy higher withdrawals, premium spins, daily tasks, and redeem codes!',
    'membership_activated'
  );

  -- 6. Audit log
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (
    admin_email,
    'APPROVE_MEMBERSHIP_PAYMENT',
    'memberships_payments',
    p_record.trx_id,
    jsonb_build_object('user_uid', p_record.user_uid, 'amount_pkr', 500)
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- NEXA EARN: security fixes + admin actions + secret helper links
-- Run this file AFTER the first 5 files. Run it ONLY ONCE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CLOSE OPEN DOORS (row security)
-- ---------------------------------------------------------------------
-- Everyone (even logged-out) could read ALL profiles (emails, balances). Remove it.
DROP POLICY IF EXISTS "Public can view leaderboard profile fields" ON public.profiles;

-- Users must not insert withdrawal rows directly (the server function does it).
DROP POLICY IF EXISTS "User submit withdrawal" ON public.withdrawals;

-- Users may only create PENDING requests.
DROP POLICY IF EXISTS "User create verification request" ON public.verification_requests;
CREATE POLICY "User create verification request" ON public.verification_requests
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "User submit membership payment" ON public.memberships_payments;
CREATE POLICY "User submit membership payment" ON public.memberships_payments
  FOR INSERT WITH CHECK (
    status = 'pending' AND amount_pkr = 500
    AND user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid())
  );

-- Tables that had row security ON but no policy at all.
CREATE POLICY "Admin manage redeem codes" ON public.redeem_codes
  FOR ALL USING (public.is_admin());
CREATE POLICY "View own or admin redeem claims" ON public.redeem_claims
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );
CREATE POLICY "View own or admin registration bonuses" ON public.registration_bonuses
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );
CREATE POLICY "View own or admin leaderboard claims" ON public.leaderboard_claims
  FOR SELECT USING (
    user_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid()) OR public.is_admin()
  );

-- ---------------------------------------------------------------------
-- 2. ADMIN-ONLY WRAPPERS (before: ANY user could call these and get
--    free Premium / bonus money)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_user_verification_internal') THEN
    ALTER FUNCTION public.approve_user_verification(TEXT, TEXT) RENAME TO approve_user_verification_internal;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_membership_payment_internal') THEN
    ALTER FUNCTION public.approve_membership_payment(UUID, TEXT) RENAME TO approve_membership_payment_internal;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_instagram_bonus_internal') THEN
    ALTER FUNCTION public.send_instagram_bonus(TEXT, INTEGER, TEXT) RENAME TO send_instagram_bonus_internal;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.approve_user_verification_internal(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_membership_payment_internal(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_instagram_bonus_internal(TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

-- Reject verification (shared by admin + helper link)
CREATE OR REPLACE FUNCTION public._reject_user_verification_internal(p_uid TEXT, p_by TEXT, p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.profiles SET verification_status = 'rejected', updated_at = now()
  WHERE uid = p_uid AND verification_status <> 'verified';
  UPDATE public.verification_requests
  SET status = 'rejected', admin_notes = p_reason, reviewed_by = p_by, reviewed_at = now()
  WHERE user_uid = p_uid AND status = 'pending';
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (p_uid, 'Verification Rejected',
          'Your account verification was rejected. Reason: ' || COALESCE(p_reason, 'Not specified') || '. Please submit again.',
          'verification_rejected');
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (p_by, 'REJECT_USER_VERIFICATION', 'profile', p_uid, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public._reject_user_verification_internal(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._caller_admin_email()
RETURNS TEXT AS $$
DECLARE v_email TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required.';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = auth.uid();
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public._caller_admin_email() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_user_verification(target_user_uid TEXT, admin_email TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN public.approve_user_verification_internal(target_user_uid, public._caller_admin_email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.approve_membership_payment(payment_uuid UUID, admin_email TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN public.approve_membership_payment_internal(payment_uuid, public._caller_admin_email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.send_instagram_bonus(p_target_uid TEXT, p_amount INTEGER, p_admin_email TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN public.send_instagram_bonus_internal(p_target_uid, p_amount, public._caller_admin_email());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_verification(p_user_uid TEXT, p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN public._reject_user_verification_internal(p_user_uid, public._caller_admin_email(), p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_membership_payment(p_payment_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE v_by TEXT := public._caller_admin_email();
BEGIN
  UPDATE public.memberships_payments
  SET status = 'rejected', admin_notes = p_reason, reviewed_by = v_by, reviewed_at = now()
  WHERE id = p_payment_id AND status = 'pending';
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (v_by, 'REJECT_MEMBERSHIP_PAYMENT', 'memberships_payments', p_payment_id::TEXT, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_complete_withdrawal(p_id UUID, p_trx_ref TEXT)
RETURNS JSONB AS $$
DECLARE v_by TEXT := public._caller_admin_email(); w RECORD;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found.'; END IF;
  IF w.status IN ('completed', 'rejected') THEN RAISE EXCEPTION 'Withdrawal already %.', w.status; END IF;
  UPDATE public.withdrawals SET status = 'completed', admin_trx_reference = p_trx_ref, updated_at = now() WHERE id = p_id;
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (w.user_uid, 'Withdrawal Completed!',
          'Your withdrawal of PKR ' || w.requested_amount || ' (Net PKR ' || w.net_payable_amount || ') via ' || w.payment_method || ' has been sent. Ref: ' || COALESCE(p_trx_ref, '-'),
          'withdrawal_completed');
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (v_by, 'APPROVE_WITHDRAWAL', 'withdrawal', p_id::TEXT, jsonb_build_object('net_amount', w.net_payable_amount, 'trx_ref', p_trx_ref));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_id UUID, p_reason TEXT)
RETURNS JSONB AS $$
DECLARE v_by TEXT := public._caller_admin_email(); w RECORD; v_balance INTEGER;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found.'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be rejected.'; END IF;
  UPDATE public.withdrawals SET status = 'rejected', updated_at = now() WHERE id = p_id;
  UPDATE public.profiles
  SET balance_pkr = balance_pkr + w.requested_amount,
      total_withdrawn_pkr = GREATEST(0, total_withdrawn_pkr - w.requested_amount),
      updated_at = now()
  WHERE uid = w.user_uid
  RETURNING balance_pkr INTO v_balance;
  INSERT INTO public.financial_ledger (user_uid, transaction_type, amount_pkr, balance_after_pkr, description)
  VALUES (w.user_uid, 'adjustment', w.requested_amount, v_balance,
          'Withdrawal Rejected & Refunded: PKR ' || w.requested_amount || '. Reason: ' || COALESCE(p_reason, '-'));
  INSERT INTO public.notifications (user_uid, title, message, type)
  VALUES (w.user_uid, 'Withdrawal Rejected',
          'Your withdrawal of PKR ' || w.requested_amount || ' was rejected and refunded. Reason: ' || COALESCE(p_reason, '-'),
          'withdrawal_rejected');
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (v_by, 'REJECT_WITHDRAWAL', 'withdrawal', p_id::TEXT, jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: reset device lock (strict check)
CREATE OR REPLACE FUNCTION public.reset_device_lock(p_target_uid TEXT, p_admin_email TEXT)
RETURNS JSONB AS $$
DECLARE v_by TEXT := public._caller_admin_email();
BEGIN
  UPDATE public.profiles SET device_id = NULL, device_model = NULL, device_registered_at = NULL WHERE uid = p_target_uid;
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (v_by, 'RESET_DEVICE_LOCK', 'profile', p_target_uid, '{"reset": true}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 3. USER ACTIONS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_verification_request(p_whatsapp TEXT)
RETURNS JSONB AS $$
DECLARE p RECORD;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not logged in.'; END IF;
  IF p.verification_status = 'verified' THEN RAISE EXCEPTION 'Account is already verified.'; END IF;
  IF p_whatsapp IS NULL OR length(trim(p_whatsapp)) < 7 THEN RAISE EXCEPTION 'Enter a valid WhatsApp number.'; END IF;
  UPDATE public.profiles SET whatsapp_number = trim(p_whatsapp), verification_status = 'pending', updated_at = now() WHERE id = p.id;
  IF NOT EXISTS (SELECT 1 FROM public.verification_requests WHERE user_uid = p.uid AND status = 'pending') THEN
    INSERT INTO public.verification_requests (user_uid, email, whatsapp_number)
    VALUES (p.uid, p.email, trim(p_whatsapp));
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_referrals_with_info()
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'referrer_uid', r.referrer_uid, 'referred_uid', r.referred_uid,
    'referred_email', pr.email, 'referred_whatsapp', pr.whatsapp_number,
    'status', r.status, 'bonus_credited', r.bonus_credited,
    'bonus_credited_at', r.bonus_credited_at,
    'premium_commission_credited', r.premium_commission_credited,
    'created_at', r.created_at) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.referrals r
  JOIN public.profiles pr ON pr.uid = r.referred_uid
  WHERE public.is_admin()
     OR r.referrer_uid = (SELECT uid FROM public.profiles WHERE id = auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_leaderboard_public()
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'uid', p.uid,
      'email', left(p.email, 2) || '***@' || split_part(p.email, '@', 2),
      'membership_tier', p.membership_tier,
      'avatar_url', p.avatar_url,
      'verified_referrals_count', COUNT(r.id),
      'total_earned_pkr', p.total_earned_pkr) AS x
    FROM public.profiles p
    LEFT JOIN public.referrals r ON r.referrer_uid = p.uid AND r.status = 'verified'
    GROUP BY p.uid, p.email, p.membership_tier, p.avatar_url, p.total_earned_pkr
    ORDER BY COUNT(r.id) DESC, p.total_earned_pkr DESC
    LIMIT 10
  ) t;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------
-- 4. SECRET HELPER LINKS (no login needed, link = permission)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.helper_links (
  kind TEXT PRIMARY KEY CHECK (kind IN ('verify', 'bonus')),
  token TEXT NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.helper_links ENABLE ROW LEVEL SECURITY;  -- no policies: nobody can read it directly
REVOKE ALL ON public.helper_links FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._new_helper_token()
RETURNS TEXT AS $$
  SELECT replace(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');
$$ LANGUAGE sql;
REVOKE ALL ON FUNCTION public._new_helper_token() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._helper_token_ok(p_kind TEXT, p_token TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 32
     OR NOT EXISTS (SELECT 1 FROM public.helper_links WHERE kind = p_kind AND token = p_token) THEN
    RAISE EXCEPTION 'This link is invalid or has been reset by the admin.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public._helper_token_ok(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_helper_links()
RETURNS JSONB AS $$
BEGIN
  PERFORM public._caller_admin_email();
  INSERT INTO public.helper_links (kind, token) VALUES ('verify', public._new_helper_token()) ON CONFLICT (kind) DO NOTHING;
  INSERT INTO public.helper_links (kind, token) VALUES ('bonus', public._new_helper_token()) ON CONFLICT (kind) DO NOTHING;
  RETURN (SELECT jsonb_object_agg(kind, token) FROM public.helper_links);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_rotate_helper_link(p_kind TEXT)
RETURNS TEXT AS $$
DECLARE v_by TEXT := public._caller_admin_email(); v_new TEXT := public._new_helper_token();
BEGIN
  IF p_kind NOT IN ('verify', 'bonus') THEN RAISE EXCEPTION 'Invalid link type.'; END IF;
  INSERT INTO public.helper_links (kind, token, rotated_at) VALUES (p_kind, v_new, now())
  ON CONFLICT (kind) DO UPDATE SET token = EXCLUDED.token, rotated_at = now();
  INSERT INTO public.audit_logs (admin_email, action, target_type, target_id, details)
  VALUES (v_by, 'RESET_HELPER_LINK', 'helper_link', p_kind, '{}'::jsonb);
  RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification helper link
CREATE OR REPLACE FUNCTION public.helper_verify_list(p_token TEXT)
RETURNS JSONB AS $$
BEGIN
  PERFORM public._helper_token_ok('verify', p_token);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_uid', v.user_uid, 'email', v.email,
      'whatsapp_number', v.whatsapp_number, 'created_at', v.created_at)
      ORDER BY v.created_at), '[]'::jsonb)
    FROM public.verification_requests v WHERE v.status = 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.helper_verify_approve(p_token TEXT, p_user_uid TEXT)
RETURNS JSONB AS $$
BEGIN
  PERFORM public._helper_token_ok('verify', p_token);
  RETURN public.approve_user_verification_internal(p_user_uid, 'HELPER_LINK');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.helper_verify_reject(p_token TEXT, p_user_uid TEXT, p_reason TEXT)
RETURNS JSONB AS $$
BEGIN
  PERFORM public._helper_token_ok('verify', p_token);
  RETURN public._reject_user_verification_internal(p_user_uid, 'HELPER_LINK', COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by helper'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Registration bonus helper link
CREATE OR REPLACE FUNCTION public.helper_bonus_lookup(p_token TEXT, p_uid TEXT)
RETURNS JSONB AS $$
DECLARE p RECORD;
BEGIN
  PERFORM public._helper_token_ok('bonus', p_token);
  SELECT uid, membership_tier INTO p FROM public.profiles WHERE uid = upper(trim(p_uid));
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'uid', p.uid, 'membership_tier', p.membership_tier,
    'already_received', EXISTS (SELECT 1 FROM public.registration_bonuses WHERE user_uid = p.uid));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.helper_bonus_send(p_token TEXT, p_uid TEXT, p_amount INTEGER)
RETURNS JSONB AS $$
BEGIN
  PERFORM public._helper_token_ok('bonus', p_token);
  RETURN public.send_instagram_bonus_internal(upper(trim(p_uid)), p_amount, 'HELPER_LINK');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- 5. WHO MAY CALL WHAT (remove default access for "anon" = not logged in)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.complete_daily_task(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_server_spin(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_withdrawal(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_redeem_code(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bind_android_device(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_daily_task(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_server_spin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_redeem_code(TEXT, TEXT) TO authenticated;

-- Admin-only (logged in; the function itself checks is_admin)
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.approve_user_verification(TEXT, TEXT)',
    'public.approve_membership_payment(UUID, TEXT)',
    'public.send_instagram_bonus(TEXT, INTEGER, TEXT)',
    'public.admin_reject_verification(TEXT, TEXT)',
    'public.admin_reject_membership_payment(UUID, TEXT)',
    'public.admin_complete_withdrawal(UUID, TEXT)',
    'public.admin_reject_withdrawal(UUID, TEXT)',
    'public.reset_device_lock(TEXT, TEXT)',
    'public.admin_get_helper_links()',
    'public.admin_rotate_helper_link(TEXT)',
    'public.submit_verification_request(TEXT)',
    'public.get_referrals_with_info()',
    'public.get_leaderboard_public()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Helper-link functions: open to anyone, but useless without the secret token
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.helper_verify_list(TEXT)',
    'public.helper_verify_approve(TEXT, TEXT)',
    'public.helper_verify_reject(TEXT, TEXT, TEXT)',
    'public.helper_bonus_lookup(TEXT, TEXT)',
    'public.helper_bonus_send(TEXT, TEXT, INTEGER)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. FIX: the old "protect profile" trigger also blocked the app's OWN
--    server functions (spin, tasks, withdrawal, redeem) for normal users.
--    Now it only blocks direct edits made by the logged-in user themselves;
--    server functions (which run as the database owner) are allowed.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.balance_pkr IS DISTINCT FROM OLD.balance_pkr
       OR NEW.total_earned_pkr IS DISTINCT FROM OLD.total_earned_pkr
       OR NEW.total_withdrawn_pkr IS DISTINCT FROM OLD.total_withdrawn_pkr
       OR NEW.available_spins IS DISTINCT FROM OLD.available_spins
       OR NEW.membership_tier IS DISTINCT FROM OLD.membership_tier
       OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.uid IS DISTINCT FROM OLD.uid
       OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: protected account fields cannot be edited directly.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

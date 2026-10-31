-- ONE ACCOUNT PER DEVICE
-- Run this file AFTER the first 4 migration files.

-- 1. Backstop: the same device_id can never appear on two profiles.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_device_id
  ON public.profiles(device_id) WHERE device_id IS NOT NULL;

-- 2. Anyone (before signup) can ask: is this device free?
CREATE OR REPLACE FUNCTION public.device_available(p_device_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT p_device_id IS NULL OR p_device_id = ''
         OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE device_id = p_device_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.device_available(TEXT) TO anon, authenticated;

-- 3. Block a second signup from the same device (admin email is exempt).
CREATE OR REPLACE FUNCTION public.check_device_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_device TEXT := NEW.raw_user_meta_data->>'device_id';
BEGIN
  IF v_device IS NOT NULL AND v_device <> ''
     AND LOWER(NEW.email) <> 'rrdd8397@gmail.com'
     AND EXISTS (SELECT 1 FROM public.profiles WHERE device_id = v_device) THEN
    RAISE EXCEPTION 'DEVICE_ALREADY_REGISTERED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS a_check_device_on_signup ON auth.users;
CREATE TRIGGER a_check_device_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_device_on_signup();

-- 4. Save the device on the new profile (fires after the profile is created).
CREATE OR REPLACE FUNCTION public.bind_device_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_device TEXT := NEW.raw_user_meta_data->>'device_id';
BEGIN
  IF v_device IS NOT NULL AND v_device <> ''
     AND LOWER(NEW.email) <> 'rrdd8397@gmail.com' THEN
    UPDATE public.profiles
    SET device_id = v_device,
        device_model = COALESCE(NEW.raw_user_meta_data->>'device_model', 'Unknown'),
        device_registered_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS z_bind_device_on_signup ON auth.users;
CREATE TRIGGER z_bind_device_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bind_device_on_signup();

-- 5. Users must not be able to edit their own device_id (that would free the slot).
REVOKE UPDATE (device_id, device_model) ON public.profiles FROM authenticated;

-- 6. LOGIN RULE: on a phone, only the account that was first created there can log in.
-- Returns TRUE when login is allowed (device is free, or it belongs to this email, or admin).
CREATE OR REPLACE FUNCTION public.device_login_allowed(p_device_id TEXT, p_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    LOWER(COALESCE(p_email, '')) = 'rrdd8397@gmail.com'
    OR p_device_id IS NULL OR p_device_id = ''
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE device_id = p_device_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE device_id = p_device_id AND LOWER(email) = LOWER(p_email)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.device_login_allowed(TEXT, TEXT) TO anon, authenticated;

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Secret helper links: calls to Supabase functions that check a secret token.

export const helperAvailable = () => Boolean(isSupabaseConfigured && supabase);

async function call<T = any>(fn: string, args: Record<string, any>): Promise<T> {
  if (!supabase) throw new Error('Live backend (Supabase) is not configured.');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface PendingVerification {
  user_uid: string;
  email: string;
  whatsapp_number: string;
  created_at: string;
}

export const helperApi = {
  verifyList: (token: string) => call<PendingVerification[]>('helper_verify_list', { p_token: token }),
  verifyApprove: (token: string, uid: string) =>
    call<{ success: boolean; error?: string }>('helper_verify_approve', { p_token: token, p_user_uid: uid }),
  verifyReject: (token: string, uid: string, reason: string) =>
    call<{ success: boolean; error?: string }>('helper_verify_reject', { p_token: token, p_user_uid: uid, p_reason: reason }),
  bonusLookup: (token: string, uid: string) =>
    call<{ found: boolean; uid?: string; membership_tier?: string; already_received?: boolean }>('helper_bonus_lookup', {
      p_token: token,
      p_uid: uid,
    }),
  bonusSend: (token: string, uid: string, amount: number) =>
    call<{ success: boolean; error?: string; amount_pkr?: number }>('helper_bonus_send', {
      p_token: token,
      p_uid: uid,
      p_amount: amount,
    }),
  // admin only (needs admin login)
  adminGetLinks: () => call<{ verify: string; bonus: string }>('admin_get_helper_links', {}),
  adminRotate: (kind: 'verify' | 'bonus') => call<string>('admin_rotate_helper_link', { p_kind: kind }),
};

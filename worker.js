/**
 * NEXA EARN - Cloudflare Production Worker API
 * 
 * Privileged server-authoritative API proxy & backend engine.
 * 
 * SECURITY ENFORCEMENTS:
 * 1. Requires valid Supabase Auth Bearer JWT for all protected actions.
 * 2. Validates user token against Supabase Auth endpoint (/auth/v1/user).
 * 3. Restricts user operations (spins, withdrawals, daily tasks) strictly to the caller's verified UID.
 * 4. Strictly enforces Administrator authorization for privileged endpoints:
 *    - Rejects non-admin requests with 403 Forbidden.
 *    - Verifies is_admin flag from database profiles table and/or verified admin email.
 * 5. Masks internal database connection strings, credentials, and stack traces.
 * 6. Never exposes SUPABASE_SECRET_KEY or service-role keys in responses or client code.
 * 7. Device-lock restriction is completely removed (multiple accounts per mobile allowed).
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Validates Supabase JWT and fetches profile with authorization role
 */
async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      status: 401,
      error: 'Authorization header with Bearer token is required.',
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      authenticated: false,
      status: 401,
      error: 'Empty authorization token provided.',
    };
  }

  const supabaseUrl = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !secretKey) {
    return {
      authenticated: false,
      status: 500,
      error: 'Server configuration error: SUPABASE_URL and SUPABASE_SECRET_KEY must be configured on Cloudflare.',
    };
  }

  try {
    // 1. Verify JWT with Supabase Auth
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey || secretKey,
      },
    });

    if (!authRes.ok) {
      return {
        authenticated: false,
        status: 401,
        error: 'Invalid, expired, or revoked authentication session token.',
      };
    }

    const authUser = await authRes.json();
    if (!authUser || !authUser.id) {
      return {
        authenticated: false,
        status: 401,
        error: 'Could not resolve user session from authentication provider.',
      };
    }

    // 2. Fetch user profile from database using server-side privileged client
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${authUser.id}&select=id,uid,email,whatsapp_number,membership_tier,verification_status,balance_pkr,total_earned_pkr,total_withdrawn_pkr,available_spins,initial_spins_claimed,tasks_unlocked_milestone,is_admin`,
      {
        headers: {
          'apikey': secretKey,
          'Authorization': `Bearer ${secretKey}`,
        },
      }
    );

    if (!profileRes.ok) {
      return {
        authenticated: false,
        status: 500,
        error: 'Database communication error while loading caller profile.',
      };
    }

    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return {
        authenticated: false,
        status: 404,
        error: 'User profile record not found in database.',
      };
    }

    const profile = profiles[0];
    const initialAdminEmail = (env.ADMIN_INITIAL_EMAIL || 'rrdd8397@gmail.com').toLowerCase();
    const userEmail = (authUser.email || profile.email || '').toLowerCase();
    const isAdmin = Boolean(profile.is_admin || (userEmail && userEmail === initialAdminEmail));

    return {
      authenticated: true,
      authUser,
      profile,
      userUid: profile.uid,
      userEmail,
      isAdmin,
    };
  } catch (err) {
    return {
      authenticated: false,
      status: 500,
      error: 'Internal authentication validation failure: ' + (err?.message || 'Unknown error'),
    };
  }
}

/**
 * Invokes a Supabase RPC securely using server credentials
 */
async function callRpc(env, rpcName, params) {
  const supabaseUrl = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      'apikey': secretKey,
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // 2. Health check endpoint (Public)
    if (url.pathname === '/api/health') {
      return jsonResponse({
        status: 'healthy',
        service: 'NEXA EARN Cloudflare API Worker',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        capabilities: [
          'server_authoritative_spins',
          'server_authoritative_tasks',
          'server_authoritative_withdrawals',
          'server_admin_verification',
          'multi_account_per_mobile',
        ],
      });
    }

    // 3. User Identity Verification: GET /api/me
    if (url.pathname === '/api/me' && request.method === 'GET') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      return jsonResponse({
        authenticated: true,
        user: {
          uid: auth.profile.uid,
          email: auth.userEmail,
          membership_tier: auth.profile.membership_tier,
          verification_status: auth.profile.verification_status,
          balance_pkr: auth.profile.balance_pkr,
          available_spins: auth.profile.available_spins,
          is_admin: auth.isAdmin,
        },
      });
    }

    // 4. Server-Side Privileged Spin Execution: POST /api/spin
    // SECURITY: Caller must be authenticated. Users can ONLY spin for their own account.
    if (url.pathname === '/api/spin' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      // Check targeted user_uid: must match caller unless caller is verified admin
      const targetUid = body.user_uid || auth.userUid;
      if (targetUid !== auth.userUid && !auth.isAdmin) {
        return jsonResponse(
          { error: 'Forbidden: You can only execute wheel spins for your own authenticated account.' },
          403
        );
      }

      // Execute atomic server spin RPC
      const rpcResult = await callRpc(env, 'execute_server_spin', { p_user_uid: targetUid });
      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 5. Server-Authoritative Daily Task Completion: POST /api/tasks/complete
    if (url.pathname === '/api/tasks/complete' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON request payload.' }, 400);
      }

      const { task_key } = body;
      if (!task_key) {
        return jsonResponse({ error: 'task_key is required.' }, 400);
      }

      const targetUid = body.user_uid || auth.userUid;
      if (targetUid !== auth.userUid && !auth.isAdmin) {
        return jsonResponse(
          { error: 'Forbidden: You cannot complete daily tasks on behalf of another account.' },
          403
        );
      }

      const rpcResult = await callRpc(env, 'complete_daily_task', {
        p_user_uid: targetUid,
        p_task_key: task_key,
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 6. Server-Authoritative Withdrawal Request: POST /api/withdraw
    if (url.pathname === '/api/withdraw' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON request payload.' }, 400);
      }

      const { payment_method, account_holder, account_number, amount } = body;
      if (!payment_method || !account_holder || !account_number || !amount) {
        return jsonResponse(
          { error: 'All withdrawal fields (payment_method, account_holder, account_number, amount) are required.' },
          400
        );
      }

      const rpcResult = await callRpc(env, 'request_withdrawal', {
        p_user_uid: auth.userUid,
        p_payment_method: payment_method,
        p_account_holder: account_holder,
        p_account_number: account_number,
        p_amount: parseInt(amount, 10),
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 7. Redeem Code Claim: POST /api/redeem
    if (url.pathname === '/api/redeem' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON request payload.' }, 400);
      }

      const { code } = body;
      if (!code) {
        return jsonResponse({ error: 'Redeem code is required.' }, 400);
      }

      const rpcResult = await callRpc(env, 'claim_redeem_code', {
        p_user_uid: auth.userUid,
        p_code: code.trim().toUpperCase(),
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // =========================================================================
    // ADMIN ENDPOINTS (Strict Server-Side Role Enforcement)
    // =========================================================================

    // 8. Admin Verification Check: GET or POST /api/admin/verify
    if (url.pathname === '/api/admin/verify') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }

      if (!auth.isAdmin) {
        return jsonResponse(
          { error: 'Forbidden: Caller does not possess verified administrator authorization.' },
          403
        );
      }

      return jsonResponse({
        success: true,
        is_admin: true,
        email: auth.userEmail,
        uid: auth.userUid,
      });
    }

    // 9. Admin Approve WhatsApp Verification: POST /api/admin/approve-verification
    if (url.pathname === '/api/admin/approve-verification' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }
      if (!auth.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Administrator credentials required.' }, 403);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
      }

      const { target_uid } = body;
      if (!target_uid) {
        return jsonResponse({ error: 'target_uid is required.' }, 400);
      }

      const rpcResult = await callRpc(env, 'approve_user_verification', {
        p_target_uid: target_uid,
        p_admin_email: auth.userEmail,
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 10. Admin Approve Membership Payment: POST /api/admin/approve-membership
    if (url.pathname === '/api/admin/approve-membership' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }
      if (!auth.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Administrator credentials required.' }, 403);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
      }

      const { payment_id } = body;
      if (!payment_id) {
        return jsonResponse({ error: 'payment_id is required.' }, 400);
      }

      const rpcResult = await callRpc(env, 'approve_membership_payment', {
        p_payment_id: payment_id,
        p_admin_email: auth.userEmail,
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 11. Admin Send Instagram Registration Bonus: POST /api/admin/send-bonus
    if (url.pathname === '/api/admin/send-bonus' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (!auth.authenticated) {
        return jsonResponse({ error: auth.error }, auth.status);
      }
      if (!auth.isAdmin) {
        return jsonResponse({ error: 'Forbidden: Administrator credentials required.' }, 403);
      }

      let body = {};
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
      }

      const { target_uid, amount } = body;
      if (!target_uid || !amount) {
        return jsonResponse({ error: 'target_uid and amount are required.' }, 400);
      }

      const rpcResult = await callRpc(env, 'send_instagram_bonus', {
        p_target_uid: target_uid,
        p_bonus_amount: parseInt(amount, 10),
        p_admin_email: auth.userEmail,
      });

      return jsonResponse(rpcResult.data, rpcResult.status);
    }

    // 12. Default 404 for unknown endpoints
    return jsonResponse({ error: `API route '${url.pathname}' not found on NEXA EARN Worker.` }, 404);
  },
};

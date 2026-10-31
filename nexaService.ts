import {
  UserProfile,
  ReferralRecord,
  VerificationRequest,
  MembershipPayment,
  WithdrawalRecord,
  WITHDRAWAL_TIERS,
  WHEEL_SLICES,
  SpinRecord,
  DailyTaskItem,
  TaskCompletion,
  FinancialLedgerEntry,
  RedeemCode,
  RegistrationBonusRecord,
  LeaderboardRank,
  AppNotification,
  AuditLogItem,
  AppConfigSettings,
  PaymentMethod,
} from '../types/nexa';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getDeviceId, getDeviceModel } from '../lib/device';

const STORAGE_KEY_PREFIX = 'nexa_earn_db_';

// Initial default configuration settings
const DEFAULT_SETTINGS: AppConfigSettings = {
  apk_download_url: 'https://github.com/nexa-earn/nexa-earn-app/releases/download/v1.0.0/nexa-earn-v1.0.0.apk',
  whatsapp_verification_url: 'https://chat.whatsapp.com/GHY7exampleVerifyGroup',
  instagram_bonus_url: 'https://instagram.com/nexaearn_official',
  telegram_support_url: 'https://t.me/NexaEarnSupportOfficial',
  easypaisa_qr_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600',
  easypaisa_account_title: 'NEXA EARN OFFICIAL',
  easypaisa_account_number: '03401234567',
  jazzcash_qr_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600',
  jazzcash_account_title: 'NEXA EARN OFFICIAL',
  jazzcash_account_number: '03001234567',
  leaderboard_rewards: {
    1: 1500,
    2: 1000,
    3: 750,
    4: 500,
    5: 400,
    6: 300,
    7: 250,
    8: 200,
    9: 150,
    10: 100,
  },
};

const DEFAULT_TASKS: DailyTaskItem[] = [
  {
    id: 'task-1',
    task_number: 1,
    task_key: 'poll_completion',
    title: 'Poll Completion',
    description: 'Participate in our partner research survey and submit your genuine answers.',
    action_url: 'https://poll.nexaearn.com/daily-survey',
    reward_pkr: 15,
    is_admin_unlocked: true, // Task 1 is unlocked by default
    is_active: true,
  },
  {
    id: 'task-2',
    task_number: 2,
    task_key: 'watch_ads',
    title: 'Watch Ads',
    description: 'View full-length commercial ads to earn sponsor rewards.',
    action_url: 'https://ads.nexaearn.com/watch-daily',
    reward_pkr: 15,
    is_admin_unlocked: false, // Locked until admin unlocks
    is_active: true,
  },
  {
    id: 'task-3',
    task_number: 3,
    task_key: 'watch_videos',
    title: 'Watch Videos',
    description: 'Stream our promotional video spotlight for at least 60 seconds.',
    action_url: 'https://videos.nexaearn.com/stream-spotlight',
    reward_pkr: 15,
    is_admin_unlocked: false, // Locked until admin unlocks
    is_active: true,
  },
  {
    id: 'task-4',
    task_number: 4,
    task_key: 'ad_clicks',
    title: 'Ad Clicks',
    description: 'Click and browse verified partner sponsor landing pages for 30 seconds.',
    action_url: 'https://partner.nexaearn.com/explore-offers',
    reward_pkr: 15,
    is_admin_unlocked: false, // Locked until admin unlocks
    is_active: true,
  },
];

class NexaService {
  private memoryStore = new Map<string, string>();

  public isProductionMode(): boolean {
    return Boolean(isSupabaseConfigured && supabase !== null);
  }

  public getBackendMode(): 'production_supabase' | 'local_preview' {
    return this.isProductionMode() ? 'production_supabase' : 'local_preview';
  }

  private getStorageItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return this.memoryStore.get(key) || null;
      }
    }
    return this.memoryStore.get(key) || null;
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch {
        this.memoryStore.set(key, value);
        return;
      }
    }
    this.memoryStore.set(key, value);
  }

  private removeStorageItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
        return;
      } catch {
        this.memoryStore.delete(key);
        return;
      }
    }
    this.memoryStore.delete(key);
  }

  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = this.getStorageItem(STORAGE_KEY_PREFIX + key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      this.setStorageItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    if (this.isProductionMode()) {
      // Real mode: never use demo data. Remove anything left by an old preview session.
      if (this.getStorageItem(STORAGE_KEY_PREFIX + 'initialized')) this.clearLocalCache();
      return;
    }
    if (!this.getStorageItem(STORAGE_KEY_PREFIX + 'initialized')) {
      // Create initial seed accounts for Local Preview / Sandbox Mode
      const initialUsers: UserProfile[] = [
        {
          id: 'admin-seed-01',
          uid: 'NE-100001',
          email: 'rrdd8397@gmail.com',
          whatsapp_number: '+923001234567',
          avatar_url: '',
          membership_tier: 'premium',
          verification_status: 'verified',
          referral_code: 'NEXAADMIN',
          balance_pkr: 2500,
          total_earned_pkr: 5000,
          total_withdrawn_pkr: 2500,
          available_spins: 10,
          initial_spins_claimed: true,
          tasks_unlocked_milestone: true,
          is_admin: true,
          created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'user-demo-01',
          uid: 'NE-204892',
          email: 'ali.raza@example.com',
          whatsapp_number: '+923459876543',
          avatar_url: '',
          membership_tier: 'without_investment',
          verification_status: 'verified',
          referral_code: 'NEXA78291',
          referred_by_uid: 'NE-100001',
          balance_pkr: 120,
          total_earned_pkr: 120,
          total_withdrawn_pkr: 0,
          available_spins: 5,
          initial_spins_claimed: true,
          tasks_unlocked_milestone: false,
          is_admin: false,
          created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'user-demo-02',
          uid: 'NE-593021',
          email: 'hamza.khan@example.com',
          whatsapp_number: '+923125554433',
          avatar_url: '',
          membership_tier: 'premium',
          verification_status: 'verified',
          referral_code: 'NEXA44912',
          referred_by_uid: 'NE-100001',
          balance_pkr: 650,
          total_earned_pkr: 1150,
          total_withdrawn_pkr: 500,
          available_spins: 3,
          initial_spins_claimed: true,
          tasks_unlocked_milestone: true,
          is_admin: false,
          created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      this.set('users', initialUsers);
      this.set('settings', DEFAULT_SETTINGS);
      this.set('tasks', DEFAULT_TASKS);
      this.set('referrals', [
        {
          id: 'ref-01',
          referrer_uid: 'NE-100001',
          referred_uid: 'NE-204892',
          referred_email: 'ali.raza@example.com',
          referred_whatsapp: '+923459876543',
          status: 'verified',
          bonus_credited: true,
          bonus_credited_at: new Date(Date.now() - 6 * 86400000).toISOString(),
          premium_commission_credited: false,
          created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
        {
          id: 'ref-02',
          referrer_uid: 'NE-100001',
          referred_uid: 'NE-593021',
          referred_email: 'hamza.khan@example.com',
          referred_whatsapp: '+923125554433',
          status: 'verified',
          bonus_credited: true,
          bonus_credited_at: new Date(Date.now() - 13 * 86400000).toISOString(),
          premium_commission_credited: true,
          created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        },
      ]);
      this.set('verification_requests', [
        {
          id: 'v-req-demo',
          user_uid: 'NE-204892',
          email: 'ali.raza@example.com',
          whatsapp_number: '+923459876543',
          status: 'approved',
          reviewed_by: 'rrdd8397@gmail.com',
          reviewed_at: new Date(Date.now() - 6 * 86400000).toISOString(),
          created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        },
      ]);
      this.set('memberships_payments', [
        {
          id: 'pay-demo-01',
          user_uid: 'NE-593021',
          user_email: 'hamza.khan@example.com',
          amount_pkr: 500,
          payment_method: 'easypaisa',
          trx_id: 'TRX982736451',
          status: 'approved',
          reviewed_by: 'rrdd8397@gmail.com',
          reviewed_at: new Date(Date.now() - 13 * 86400000).toISOString(),
          created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        },
      ]);
      this.set('withdrawals', []);
      this.set('spins_history', []);
      this.set('task_completions', []);
      this.set('financial_ledger', [
        {
          id: 'tx-01',
          user_uid: 'NE-100001',
          transaction_type: 'referral_bonus',
          amount_pkr: 30,
          balance_after_pkr: 2300,
          description: 'PKR 30 Referral Bonus for verified user NE-204892',
          created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        },
        {
          id: 'tx-02',
          user_uid: 'NE-100001',
          transaction_type: 'premium_commission',
          amount_pkr: 200,
          balance_after_pkr: 2500,
          related_id: 'TRX982736451',
          description: 'PKR 200 Premium Referral Commission from user NE-593021',
          created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
        },
      ]);
      this.set('redeem_codes', [
        {
          id: 'code-01',
          code: 'NEXAPREMIUM500',
          activated_at: new Date(Date.now() - 3600000).toISOString(),
          expires_at: new Date(Date.now() + 5 * 3600000).toISOString(), // 5 hours validity
          max_uses: 100,
          times_used: 1,
          is_active: true,
          reward_mode: 'policy_50_500',
          created_at: new Date().toISOString(),
        },
      ]);
      this.set('redeem_claims', []);
      this.set('registration_bonuses', []);
      this.set('notifications', [
        {
          id: 'notif-01',
          user_uid: 'NE-100001',
          title: 'System Initialized',
          message: 'Welcome to NEXA EARN administrative console.',
          type: 'system',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);
      this.set('audit_logs', [
        {
          id: 'log-01',
          admin_email: 'system',
          action: 'SYSTEM_BOOTSTRAP',
          target_type: 'system',
          target_id: 'initial',
          details: { status: 'ready', mode: 'dual_mode' },
          created_at: new Date().toISOString(),
        },
      ]);
      this.setStorageItem(STORAGE_KEY_PREFIX + 'initialized', 'true');
    }
  }

  // -------------------------------------------------------------
  // SERVER SYNC (real mode): copies this user's rows (or everything, for admin)
  // from Supabase into the local cache so every screen keeps working.
  // Supabase row-level security decides what each person is allowed to see.
  // -------------------------------------------------------------
  private syncChain: Promise<void> = Promise.resolve();

  public clearLocalCache(): void {
    [
      'users', 'referrals', 'verification_requests', 'memberships_payments', 'withdrawals',
      'spins_history', 'task_completions', 'financial_ledger', 'notifications', 'tasks',
      'settings', 'redeem_codes', 'redeem_claims', 'registration_bonuses', 'audit_logs',
      'leaderboard', 'initialized', 'active_uid',
    ].forEach((k) => this.removeStorageItem(STORAGE_KEY_PREFIX + k));
  }

  public syncFromServer(): Promise<void> {
    if (!this.isProductionMode() || !supabase) return Promise.resolve();
    this.syncChain = this.syncChain.then(() => this.doSync()).catch(() => {});
    return this.syncChain;
  }

  private async doSync(): Promise<void> {
    const sb = supabase;
    if (!sb) return;
    try {
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) return;

      const sel = async (table: string, order: string | null = 'created_at'): Promise<any[] | null> => {
        let q = sb.from(table).select('*');
        if (order) q = q.order(order, { ascending: false });
        const { data, error } = await q.limit(5000);
        return error ? null : (data as any[]);
      };
      const rpc = async (fn: string): Promise<any> => {
        const { data, error } = await sb.rpc(fn);
        return error ? null : data;
      };

      const [profiles, vreq, pays, wd, spins, tasks, comps, ledger, notifs, settingsRows, codes, bonuses, audit, refs, board] =
        await Promise.all([
          sel('profiles'), sel('verification_requests'), sel('memberships_payments'), sel('withdrawals'),
          sel('spins_history'), sel('daily_tasks', 'task_number'), sel('task_completions'), sel('financial_ledger'),
          sel('notifications'), sel('app_settings', null), sel('redeem_codes'), sel('registration_bonuses'),
          sel('audit_logs'), rpc('get_referrals_with_info'), rpc('get_leaderboard_public'),
        ]);

      if (profiles) this.set('users', profiles);
      const emailByUid = new Map<string, string>((profiles || []).map((p: any) => [p.uid, p.email]));
      if (vreq) this.set('verification_requests', vreq);
      if (pays) this.set('memberships_payments', pays.map((r: any) => ({ ...r, user_email: emailByUid.get(r.user_uid) || '' })));
      if (wd) this.set('withdrawals', wd);
      if (spins) this.set('spins_history', spins);
      if (tasks) this.set('tasks', [...tasks].sort((a: any, b: any) => a.task_number - b.task_number));
      if (comps) this.set('task_completions', comps);
      if (ledger) this.set('financial_ledger', ledger);
      if (notifs) this.set('notifications', notifs);
      if (codes) this.set('redeem_codes', codes);
      if (bonuses) this.set('registration_bonuses', bonuses);
      if (audit) this.set('audit_logs', audit);
      if (Array.isArray(refs)) this.set('referrals', refs);
      if (Array.isArray(board)) this.set('leaderboard', board);
      if (settingsRows) {
        const merged: any = { ...DEFAULT_SETTINGS };
        settingsRows.forEach((r: any) => { merged[r.key] = r.value; });
        this.set('settings', merged);
      }
    } catch (e) {
      console.error('Sync error:', e);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('nexa-synced'));
  }

  // Run a server action in the background, then refresh the cache.
  private serverAction(run: () => PromiseLike<{ error: any }>): void {
    void (async () => {
      try {
        const { error } = await run();
        if (error && typeof window !== 'undefined') window.alert(error.message || 'Action failed.');
      } catch (e: any) {
        if (typeof window !== 'undefined') window.alert(e?.message || 'Action failed.');
      }
      await this.syncFromServer();
    })();
  }

  // Call on app start: restores the logged-in user from the Supabase session.
  public async restoreSession(): Promise<UserProfile | null> {
    if (!this.isProductionMode() || !supabase) return this.getCurrentUser();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      this.clearLocalCache();
      return null;
    }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
    if (!profile) return null;
    this.set('users', [profile]);
    this.setCurrentUser(profile.uid);
    await this.syncFromServer();
    return this.getCurrentUser();
  }

  public getCurrentUser(): UserProfile | null {
    const activeUid = this.getStorageItem(STORAGE_KEY_PREFIX + 'active_uid');
    if (!activeUid) {
      if (this.isProductionMode()) return null;
      // Default to demo admin in preview mode if not set
      return this.getUserByEmail('rrdd8397@gmail.com');
    }
    return this.getUserByUid(activeUid);
  }

  public getUserByUid(uid: string): UserProfile | null {
    const users = this.get<UserProfile[]>('users', []);
    return users.find((u) => u.uid === uid) || null;
  }

  public getUserByEmail(email: string): UserProfile | null {
    const users = this.get<UserProfile[]>('users', []);
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public setCurrentUser(uid: string | null): void {
    if (uid) {
      this.setStorageItem(STORAGE_KEY_PREFIX + 'active_uid', uid);
    } else {
      this.removeStorageItem(STORAGE_KEY_PREFIX + 'active_uid');
    }
  }

  // Unique permanent UID generator
  public generateUniqueUid(): string {
    const users = this.get<UserProfile[]>('users', []);
    let uid = '';
    let exists = true;
    while (exists) {
      const num = Math.floor(100000 + Math.random() * 900000);
      uid = `NE-${num}`;
      exists = users.some((u) => u.uid === uid);
    }
    return uid;
  }

  // Unique referral code generator
  public generateUniqueReferralCode(): string {
    const users = this.get<UserProfile[]>('users', []);
    let code = '';
    let exists = true;
    while (exists) {
      const num = Math.floor(10000 + Math.random() * 90000);
      code = `NEXA${num}`;
      exists = users.some((u) => u.referral_code === code);
    }
    return code;
  }

  // Registration Workflow (Dual-Mode: Supabase Auth when configured, Local Preview otherwise)
  public async registerUser(params: {
    email: string;
    password?: string;
    whatsapp?: string;
    referred_by_code_or_uid?: string;
    device_id?: string;
    device_model?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const emailLower = params.email.trim().toLowerCase();

    // 1. Production Mode via Supabase Auth
    if (this.isProductionMode() && supabase) {
      try {
        // One account per device: detect this phone and check it is still free.
        const deviceId = params.device_id || (await getDeviceId());
        const deviceModel = params.device_model || getDeviceModel();
        if (emailLower !== 'rrdd8397@gmail.com') {
          const { data: free } = await supabase.rpc('device_available', { p_device_id: deviceId });
          if (free === false) {
            return {
              success: false,
              error: 'An account has already been created on this mobile. Only one account is allowed per mobile. Please log in with your existing account.',
            };
          }
        }
        params.device_id = deviceId;
        params.device_model = deviceModel;

        let referredByUid: string | undefined = undefined;
        if (params.referred_by_code_or_uid) {
          const refQuery = params.referred_by_code_or_uid.trim().toUpperCase();
          const { data: refProfile } = await supabase
            .from('profiles')
            .select('uid')
            .or(`referral_code.eq.${refQuery},uid.eq.${refQuery}`)
            .maybeSingle();
          if (refProfile) {
            referredByUid = refProfile.uid;
          }
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: emailLower,
          password: params.password || 'TemporaryPassword123!',
          options: {
            data: {
              whatsapp_number: params.whatsapp?.trim() || '',
              referred_by_uid: referredByUid,
              device_id: params.device_id || null,
              device_model: params.device_model || null,
            },
          },
        });

        if (authError) {
          if (/database error saving new user|DEVICE_ALREADY/i.test(authError.message)) {
            return {
              success: false,
              error: 'An account already exists on this mobile, or registration failed. Only one account is allowed per mobile.',
            };
          }
          return { success: false, error: authError.message };
        }

        if (!authData.user) {
          return { success: false, error: 'User registration failed on server.' };
        }

        // Query the profile created by trigger
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile) {
          this.set('users', [profile]);
          this.setCurrentUser(profile.uid);
          await this.syncFromServer();
          return { success: true, user: (this.getUserByUid(profile.uid) || profile) as UserProfile };
        }

        // Construct standard profile object if query returns before trigger finishes
        const tempUid = this.generateUniqueUid();
        const createdUser: UserProfile = {
          id: authData.user.id,
          uid: tempUid,
          email: emailLower,
          whatsapp_number: params.whatsapp?.trim() || '',
          membership_tier: 'without_investment',
          verification_status: 'unverified',
          referral_code: this.generateUniqueReferralCode(),
          referred_by_uid: referredByUid,
          balance_pkr: 0,
          total_earned_pkr: 0,
          total_withdrawn_pkr: 0,
          available_spins: 0,
          initial_spins_claimed: false,
          tasks_unlocked_milestone: false,
          is_admin: emailLower === 'rrdd8397@gmail.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.setCurrentUser(createdUser.uid);
        return { success: true, user: createdUser };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Supabase registration error.' };
      }
    }

    // 2. Local Preview / Test Sandbox Mode
    const users = this.get<UserProfile[]>('users', []);

    // Check duplicate email in local store
    if (users.some((u) => u.email.toLowerCase() === emailLower)) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    let referredByUid: string | undefined = undefined;
    if (params.referred_by_code_or_uid) {
      const refQuery = params.referred_by_code_or_uid.trim().toUpperCase();
      const referrer = users.find(
        (u) => u.referral_code.toUpperCase() === refQuery || u.uid.toUpperCase() === refQuery
      );
      if (referrer) {
        referredByUid = referrer.uid;
      }
    }

    const newUid = this.generateUniqueUid();
    const newRefCode = this.generateUniqueReferralCode();
    const isAdmin = emailLower === 'rrdd8397@gmail.com';

    // Device lock is completely removed: multiple accounts can register on the same device
    const newUser: UserProfile = {
      id: 'usr-' + Date.now() + Math.random().toString(36).substring(2, 6),
      uid: newUid,
      email: emailLower,
      whatsapp_number: params.whatsapp?.trim() || '',
      avatar_url: '',
      membership_tier: 'without_investment',
      verification_status: 'unverified',
      referral_code: newRefCode,
      referred_by_uid: referredByUid,
      balance_pkr: 0,
      total_earned_pkr: 0,
      total_withdrawn_pkr: 0,
      available_spins: 0,
      initial_spins_claimed: false,
      tasks_unlocked_milestone: false,
      device_id: params.device_id,
      device_model: params.device_model || 'Android Mobile',
      device_registered_at: params.device_id ? new Date().toISOString() : undefined,
      is_admin: isAdmin,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    users.push(newUser);
    this.set('users', users);

    // If referred, create pending referral record
    if (referredByUid) {
      const referrals = this.get<ReferralRecord[]>('referrals', []);
      referrals.push({
        id: 'ref-' + Date.now(),
        referrer_uid: referredByUid,
        referred_uid: newUid,
        referred_email: emailLower,
        referred_whatsapp: params.whatsapp?.trim() || '',
        status: 'pending',
        bonus_credited: false,
        premium_commission_credited: false,
        created_at: new Date().toISOString(),
      });
      this.set('referrals', referrals);

      // Add notification to referrer
      this.addNotification({
        user_uid: referredByUid,
        title: 'New Referral Registered!',
        message: `User ${newUid} registered with your link. Status: Pending WhatsApp Verification.`,
        type: 'referral_new',
      });
    }

    // Add welcome notification
    this.addNotification({
      user_uid: newUid,
      title: 'Welcome to NEXA EARN!',
      message: `Your account UID is ${newUid}. Complete WhatsApp verification to unlock earnings!`,
      type: 'welcome',
    });

    this.setCurrentUser(newUid);
    return { success: true, user: newUser };
  }

  // Login Workflow (Dual-Mode & Zero Device Lock Restrictions)
  public async loginUser(params: {
    email: string;
    password?: string;
    device_id?: string;
    device_model?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const emailLower = params.email.trim().toLowerCase();

    // 1. Production Mode via Supabase Auth
    if (this.isProductionMode() && supabase) {
      try {
        // Only the first account created on this mobile can log in here.
        if (emailLower !== 'rrdd8397@gmail.com') {
          const loginDeviceId = params.device_id || (await getDeviceId());
          const { data: allowed } = await supabase.rpc('device_login_allowed', {
            p_device_id: loginDeviceId,
            p_email: emailLower,
          });
          if (allowed === false) {
            return {
              success: false,
              error: 'This mobile is registered with a different account. Only the first account created on this mobile can log in here.',
            };
          }
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password: params.password || 'password123',
        });

        if (authError) {
          return { success: false, error: authError.message };
        }

        if (!authData.user) {
          return { success: false, error: 'Sign in failed.' };
        }

        const { data: profile, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profError || !profile) {
          return { success: false, error: 'Profile not found in database.' };
        }

        this.set('users', [profile]);
        this.setCurrentUser(profile.uid);
        await this.syncFromServer();
        return { success: true, user: (this.getUserByUid(profile.uid) || profile) as UserProfile };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Authentication error.' };
      }
    }

    // 2. Local Preview Mode
    const users = this.get<UserProfile[]>('users', []);
    const user = users.find((u) => u.email.toLowerCase() === emailLower);

    if (!user) {
      return { success: false, error: 'Account not found with this email. Please register.' };
    }

    // Device lock is completely removed: multiple accounts can log in on the same phone.
    if (params.device_id) {
      user.device_id = params.device_id;
      user.device_model = params.device_model || user.device_model || 'Android Mobile';
      user.device_registered_at = new Date().toISOString();
      this.updateUser(user);
    }

    this.setCurrentUser(user.uid);
    return { success: true, user };
  }

  public logoutUser(): void {
    if (this.isProductionMode() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    this.setCurrentUser(null);
    if (this.isProductionMode()) this.clearLocalCache();
  }

  // Safe Profile Update (Protects against client-side tampering of balance, spins, and admin status)
  public updateUser(updatedUser: UserProfile): void {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() =>
        supabase!.from('profiles').update({
          avatar_url: updatedUser.avatar_url ?? null,
          whatsapp_number: updatedUser.whatsapp_number ?? null,
        }).eq('uid', updatedUser.uid)
      );
    }
    const users = this.get<UserProfile[]>('users', []);
    const index = users.findIndex((u) => u.uid === updatedUser.uid);
    if (index !== -1) {
      // In local store, preserve server-authoritative integrity
      const existing = users[index];
      // Allowed mutable user-facing fields: avatar_url, whatsapp_number, device_id, device_model
      existing.avatar_url = updatedUser.avatar_url;
      existing.whatsapp_number = updatedUser.whatsapp_number;
      if (updatedUser.device_id) existing.device_id = updatedUser.device_id;
      if (updatedUser.device_model) existing.device_model = updatedUser.device_model;
      existing.updated_at = new Date().toISOString();
      users[index] = existing;
      this.set('users', users);
    }
  }

  // Internal store updater for tests and authorized engine routines
  public internalUpdateUser(fullUser: UserProfile): void {
    const users = this.get<UserProfile[]>('users', []);
    const index = users.findIndex((u) => u.uid === fullUser.uid);
    if (index !== -1) {
      users[index] = { ...fullUser, updated_at: new Date().toISOString() };
      this.set('users', users);
    }
  }

  // -------------------------------------------------------------
  // SERVER-AUTHORITATIVE WHEEL SPIN ENGINE
  // -------------------------------------------------------------
  public async executeSpin(user_uid: string): Promise<{
    success: boolean;
    reward_amount?: number;
    slice_index?: number;
    slice_label?: string;
    new_balance?: number;
    remaining_spins?: number;
    error?: string;
  }> {
    // 1. Supabase RPC execution in production
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('execute_server_spin', {
          p_user_uid: user_uid,
        });
        if (!error) setTimeout(() => { void this.syncFromServer(); }, 5500);
        if (error) {
          return { success: false, error: error.message };
        }
        return data;
      } catch (err: any) {
        return { success: false, error: err?.message || 'Spin RPC failure.' };
      }
    }

    // 2. Local authoratitive simulation
    const user = this.getUserByUid(user_uid);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (user.available_spins <= 0) {
      return { success: false, error: 'No spins available. Upgrade to Premium or refer friends to earn spins.' };
    }

    const spinsHistory = this.get<SpinRecord[]>('spins_history', []);
    const userSpinsHistory = spinsHistory.filter((s) => s.user_uid === user_uid);
    const initialPackageSpinsDone = userSpinsHistory.filter((s) => s.is_initial_package).length;

    let rewardAmount: number;
    let sliceIndex: number;
    let isInitialPackage = false;

    // Rule: Initial 5-spin package guarantees PKR 900-1,000 across 5 spins
    if (initialPackageSpinsDone < 5 && user.initial_spins_claimed) {
      isInitialPackage = true;
      const initialSpinRewards = [200, 150, 300, 100, 200]; // Sum = 950 PKR
      rewardAmount = initialSpinRewards[initialPackageSpinsDone];
      sliceIndex = WHEEL_SLICES.findIndex((s) => s.amount === rewardAmount);
      if (sliceIndex === -1) sliceIndex = 0;
    } else {
      // Regular Spin Policy: 80% PKR 50, ~1% PKR 500, rest distributed
      const rand = Math.random();
      if (rand < 0.80) {
        rewardAmount = 50;
        sliceIndex = 0;
      } else if (rand < 0.81) {
        rewardAmount = 500;
        sliceIndex = 7;
      } else if (rand < 0.88) {
        rewardAmount = 60;
        sliceIndex = 1;
      } else if (rand < 0.93) {
        rewardAmount = 75;
        sliceIndex = 2;
      } else if (rand < 0.96) {
        rewardAmount = 100;
        sliceIndex = 3;
      } else if (rand < 0.98) {
        rewardAmount = 150;
        sliceIndex = 4;
      } else if (rand < 0.995) {
        rewardAmount = 200;
        sliceIndex = 5;
      } else {
        rewardAmount = 300;
        sliceIndex = 6;
      }
    }

    const sliceLabel = `PKR ${rewardAmount}`;
    user.available_spins -= 1;
    user.balance_pkr += rewardAmount;
    user.total_earned_pkr += rewardAmount;
    this.internalUpdateUser(user);

    // Save spin history
    spinsHistory.push({
      id: 'spin-' + Date.now(),
      user_uid,
      reward_amount: rewardAmount,
      is_initial_package: isInitialPackage,
      spin_index: sliceIndex,
      slice_label: sliceLabel,
      created_at: new Date().toISOString(),
    });
    this.set('spins_history', spinsHistory);

    // Record ledger
    this.addFinancialLedgerEntry({
      user_uid,
      transaction_type: 'spin_reward',
      amount_pkr: rewardAmount,
      balance_after_pkr: user.balance_pkr,
      description: `Wheel Spin Reward: ${sliceLabel}`,
    });

    return {
      success: true,
      reward_amount: rewardAmount,
      slice_index: sliceIndex,
      slice_label: sliceLabel,
      new_balance: user.balance_pkr,
      remaining_spins: user.available_spins,
    };
  }

  // -------------------------------------------------------------
  // SERVER-AUTHORITATIVE WITHDRAWAL ENGINE
  // -------------------------------------------------------------
  public async requestWithdrawal(params: {
    user_uid: string;
    payment_method: PaymentMethod;
    account_holder_name: string;
    account_number: string;
    requested_amount: number;
  }): Promise<{ success: boolean; error?: string; fee?: number; net?: number }> {
    // 1. Supabase RPC in production
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('request_withdrawal', {
          p_user_uid: params.user_uid,
          p_payment_method: params.payment_method,
          p_account_holder: params.account_holder_name,
          p_account_number: params.account_number,
          p_amount: params.requested_amount,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, error: error.message };
        }
        return {
          success: Boolean(data?.success),
          fee: data?.fee_amount,
          net: data?.net_payable,
          error: data?.error,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Withdrawal RPC failure.' };
      }
    }

    // 2. Local authoritative validation
    const user = this.getUserByUid(params.user_uid);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    if (user.verification_status !== 'verified') {
      return {
        success: false,
        error: 'Your account must be WhatsApp verified before requesting withdrawals.',
      };
    }

    // Check 10 qualifying referrals eligibility
    const verifiedReferrals = this.getVerifiedReferralsCount(params.user_uid);
    if (verifiedReferrals < 10) {
      return {
        success: false,
        error: `Withdrawals unlock after 10 verified referrals. You currently have ${verifiedReferrals} / 10.`,
      };
    }

    // Check active withdrawal
    const withdrawals = this.get<WithdrawalRecord[]>('withdrawals', []);
    const hasActive = withdrawals.some(
      (w) => w.user_uid === params.user_uid && (w.status === 'pending' || w.status === 'processing')
    );
    if (hasActive) {
      return {
        success: false,
        error: 'You already have an active withdrawal in progress. Please wait for it to complete.',
      };
    }

    // Tier amount validation: without_investment users can ONLY withdraw 42 PKR
    if (user.membership_tier === 'without_investment' && params.requested_amount !== 42) {
      return {
        success: false,
        error: '42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔',
      };
    }

    // Exact fee structure validation
    const tier = WITHDRAWAL_TIERS.find((t) => t.amount === params.requested_amount);
    if (!tier) {
      return { success: false, error: 'Invalid withdrawal amount requested.' };
    }

    if (user.balance_pkr < params.requested_amount) {
      return { success: false, error: `Insufficient balance. Available: PKR ${user.balance_pkr}` };
    }

    // Deduct balance atomically
    user.balance_pkr -= params.requested_amount;
    user.total_withdrawn_pkr += params.requested_amount;
    this.internalUpdateUser(user);

    const newRecord: WithdrawalRecord = {
      id: 'wd-' + Date.now(),
      user_uid: params.user_uid,
      payment_method: params.payment_method,
      account_holder_name: params.account_holder_name,
      account_number: params.account_number,
      requested_amount: params.requested_amount,
      fee_amount: tier.fee,
      net_payable_amount: tier.net,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    withdrawals.push(newRecord);
    this.set('withdrawals', withdrawals);

    this.addFinancialLedgerEntry({
      user_uid: params.user_uid,
      transaction_type: 'withdrawal_request',
      amount_pkr: -params.requested_amount,
      balance_after_pkr: user.balance_pkr,
      description: `Withdrawal Request: PKR ${params.requested_amount} via ${params.payment_method} (Fee: PKR ${tier.fee}, Net: PKR ${tier.net})`,
    });

    this.addNotification({
      user_uid: params.user_uid,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal of PKR ${params.requested_amount} (Net PKR ${tier.net}) via ${params.payment_method} has been received and is pending admin review.`,
      type: 'withdrawal_pending',
    });

    return {
      success: true,
      fee: tier.fee,
      net: tier.net,
    };
  }

  // -------------------------------------------------------------
  // SERVER-AUTHORITATIVE DAILY TASKS ENGINE
  // -------------------------------------------------------------
  public async completeDailyTask(
    user_uid: string,
    task_key: string
  ): Promise<{ success: boolean; reward?: number; error?: string }> {
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('complete_daily_task', {
          p_user_uid: user_uid,
          p_task_key: task_key,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, error: error.message };
        }
        return data;
      } catch (err: any) {
        return { success: false, error: err?.message || 'Daily task RPC failure.' };
      }
    }

    const user = this.getUserByUid(user_uid);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const tasks = this.get<DailyTaskItem[]>('tasks', DEFAULT_TASKS);
    const task = tasks.find((t) => t.task_key === task_key);
    if (!task) {
      return { success: false, error: 'Task not found.' };
    }

    // Unlock criteria: Task 1 unlocked by default, or admin unlocked, or premium, or 20 referrals milestone
    if (!this.isTaskUnlockedForUser(user, task)) {
      return { success: false, error: 'Task is locked for your membership tier.' };
    }

    const completions = this.get<TaskCompletion[]>('task_completions', []);
    const today = new Date().toISOString().split('T')[0];
    const alreadyDone = completions.some(
      (c) => c.user_uid === user_uid && c.task_key === task_key && c.completion_date === today
    );

    if (alreadyDone) {
      return { success: false, error: 'You have already completed this task today. Try again tomorrow!' };
    }

    // Credit task reward (PKR 15)
    user.balance_pkr += task.reward_pkr;
    user.total_earned_pkr += task.reward_pkr;
    this.internalUpdateUser(user);

    completions.push({
      id: 'tc-' + Date.now(),
      user_uid,
      task_key,
      reward_pkr: task.reward_pkr,
      completion_date: today,
      created_at: new Date().toISOString(),
    });
    this.set('task_completions', completions);

    this.addFinancialLedgerEntry({
      user_uid,
      transaction_type: 'task_reward',
      amount_pkr: task.reward_pkr,
      balance_after_pkr: user.balance_pkr,
      description: `Daily Task Reward: ${task.title} (PKR ${task.reward_pkr})`,
    });

    return {
      success: true,
      reward: task.reward_pkr,
    };
  }

  public isTaskUnlockedForUser(user: UserProfile, task: DailyTaskItem): boolean {
    if (task.task_number === 1) return true;
    if (task.is_admin_unlocked) return true;
    if (user.membership_tier === 'premium') return true;
    if (user.tasks_unlocked_milestone) return true;
    return false;
  }

  // -------------------------------------------------------------
  // REDEEM VOUCHER CODES (Premium Exclusive)
  // -------------------------------------------------------------
  public async claimRedeemCode(
    user_uid: string,
    code_text: string
  ): Promise<{ success: boolean; reward?: number; error?: string }> {
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('claim_redeem_code', {
          p_user_uid: user_uid,
          p_code_text: code_text,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, error: error.message };
        }
        return {
          success: Boolean(data?.success),
          reward: data?.reward_amount,
          error: data?.error,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Redeem code RPC error.' };
      }
    }

    const user = this.getUserByUid(user_uid);
    if (!user) return { success: false, error: 'User not found.' };

    if (user.membership_tier !== 'premium') {
      return { success: false, error: 'Redeem codes are exclusive to Premium Membership users.' };
    }

    const codes = this.get<RedeemCode[]>('redeem_codes', []);
    const normalizedCode = code_text.trim().toUpperCase();
    const codeObj = codes.find((c) => c.code.toUpperCase() === normalizedCode && c.is_active);

    if (!codeObj) {
      return { success: false, error: 'Invalid or inactive redeem code.' };
    }

    const now = new Date();
    if (new Date(codeObj.expires_at) < now) {
      return { success: false, error: 'This redeem code has expired.' };
    }

    if (codeObj.times_used >= codeObj.max_uses) {
      return { success: false, error: 'This redeem code has reached its maximum usage limit.' };
    }

    const claims = this.get<{ id: string; user_uid: string; code: string; reward: number; date: string }[]>(
      'redeem_claims',
      []
    );
    const alreadyClaimed = claims.some((c) => c.user_uid === user_uid && c.code === normalizedCode);
    if (alreadyClaimed) {
      return { success: false, error: 'You have already redeemed this code.' };
    }

    // Policy: PKR 50-500 reward (Regular PKR 50, Lucky PKR 500)
    const rand = Math.random();
    let reward = 50;
    if (rand < 0.01) reward = 500;
    else if (rand < 0.05) reward = 100;
    else if (rand < 0.15) reward = 75;
    else if (rand < 0.30) reward = 60;

    user.balance_pkr += reward;
    user.total_earned_pkr += reward;
    this.internalUpdateUser(user);

    codeObj.times_used += 1;
    this.set('redeem_codes', codes);

    claims.push({
      id: 'claim-' + Date.now(),
      user_uid,
      code: normalizedCode,
      reward,
      date: new Date().toISOString(),
    });
    this.set('redeem_claims', claims);

    this.addFinancialLedgerEntry({
      user_uid,
      transaction_type: 'redeem_reward',
      amount_pkr: reward,
      balance_after_pkr: user.balance_pkr,
      description: `Redeem Code Claim (${normalizedCode}): PKR ${reward}`,
    });

    return { success: true, reward };
  }

  // -------------------------------------------------------------
  // VERIFICATION & REFERRAL BONUS ENGINE
  // -------------------------------------------------------------
  public async approveUserVerification(
    user_uid: string,
    admin_email: string
  ): Promise<{ success: boolean; bonusCredited: boolean; error?: string }> {
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_user_verification', {
          target_user_uid: user_uid,
          admin_email: admin_email,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, bonusCredited: false, error: error.message };
        }
        return { success: true, bonusCredited: Boolean(data?.bonus_credited) };
      } catch (err: any) {
        return { success: false, bonusCredited: false, error: err?.message };
      }
    }

    const user = this.getUserByUid(user_uid);
    if (!user) return { success: false, bonusCredited: false, error: 'User not found.' };

    user.verification_status = 'verified';
    this.internalUpdateUser(user);

    // Update verification request
    const vReqs = this.get<VerificationRequest[]>('verification_requests', []);
    const req = vReqs.find((r) => r.user_uid === user_uid);
    if (req) {
      req.status = 'approved';
      req.reviewed_by = admin_email;
      req.reviewed_at = new Date().toISOString();
      this.set('verification_requests', vReqs);
    }

    let bonusCredited = false;
    const referrals = this.get<ReferralRecord[]>('referrals', []);
    const refRecord = referrals.find((r) => r.referred_uid === user_uid);

    if (refRecord && !refRecord.bonus_credited) {
      refRecord.status = 'verified';
      refRecord.bonus_credited = true;
      refRecord.bonus_credited_at = new Date().toISOString();
      this.set('referrals', referrals);

      // Award PKR 30 referral bonus to referrer
      const referrer = this.getUserByUid(refRecord.referrer_uid);
      if (referrer) {
        referrer.balance_pkr += 30;
        referrer.total_earned_pkr += 30;
        this.internalUpdateUser(referrer);
        bonusCredited = true;

        this.addFinancialLedgerEntry({
          user_uid: referrer.uid,
          transaction_type: 'referral_bonus',
          amount_pkr: 30,
          balance_after_pkr: referrer.balance_pkr,
          description: `PKR 30 Referral Bonus for verified user ${user_uid}`,
        });

        // Check 10 referrals milestone: 5 spins
        const verifiedCount = this.getVerifiedReferralsCount(referrer.uid);
        if (verifiedCount >= 10 && !referrer.initial_spins_claimed) {
          referrer.available_spins += 5;
          referrer.initial_spins_claimed = true;
          this.internalUpdateUser(referrer);
          this.addNotification({
            user_uid: referrer.uid,
            title: '10 Verified Referrals Milestone!',
            message: 'Congratulations! You unlocked 5 Lucky Spins with prizes up to PKR 1,000!',
            type: 'milestone_spins',
          });
        }

        // If referrer is premium, award 1 spin per verified referral
        if (referrer.membership_tier === 'premium') {
          referrer.available_spins += 1;
          this.internalUpdateUser(referrer);
        }

        // Check 20 referrals milestone: Unlock daily tasks
        if (verifiedCount >= 20 && !referrer.tasks_unlocked_milestone) {
          referrer.tasks_unlocked_milestone = true;
          this.internalUpdateUser(referrer);
          this.addNotification({
            user_uid: referrer.uid,
            title: '20 Referrals Milestone Reached!',
            message: 'All Daily Tasks have been automatically unlocked for your account without requiring investment!',
            type: 'milestone_tasks',
          });
        }

        this.addNotification({
          user_uid: referrer.uid,
          title: 'Referral Verified: PKR 30 Added',
          message: `Your referral ${user_uid} was verified. PKR 30 has been credited to your wallet.`,
          type: 'referral_bonus',
        });
      }
    }

    this.addNotification({
      user_uid,
      title: 'Account Verified!',
      message: 'Your WhatsApp verification has been approved. You are now a fully verified member of NEXA EARN.',
      type: 'verification_approved',
    });

    this.addAuditLog({
      admin_email,
      action: 'APPROVE_USER_VERIFICATION',
      target_type: 'profile',
      target_id: user_uid,
      details: { bonus_credited: bonusCredited },
    });

    return { success: true, bonusCredited };
  }

  public rejectUserVerification(user_uid: string, admin_email: string, reason: string): boolean {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.rpc('admin_reject_verification', { p_user_uid: user_uid, p_reason: reason }));
      return true;
    }
    const user = this.getUserByUid(user_uid);
    if (user) {
      user.verification_status = 'rejected';
      this.internalUpdateUser(user);
    }
    const vReqs = this.get<VerificationRequest[]>('verification_requests', []);
    const req = vReqs.find((r) => r.user_uid === user_uid);
    if (req) {
      req.status = 'rejected';
      req.reviewed_by = admin_email;
      req.admin_notes = reason;
      this.set('verification_requests', vReqs);
    }
    this.addAuditLog({
      admin_email,
      action: 'REJECT_USER_VERIFICATION',
      target_type: 'profile',
      target_id: user_uid,
      details: { reason },
    });
    return true;
  }

  // -------------------------------------------------------------
  // MEMBERSHIP UPGRADE & PKR 200 COMMISSION
  // -------------------------------------------------------------
  public async approveMembershipPayment(
    paymentId: string,
    admin_email: string
  ): Promise<{ success: boolean; commissionCredited: boolean; error?: string }> {
    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_membership_payment', {
          payment_uuid: paymentId,
          admin_email: admin_email,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, commissionCredited: false, error: error.message };
        }
        return { success: true, commissionCredited: true };
      } catch (err: any) {
        return { success: false, commissionCredited: false, error: err?.message };
      }
    }

    const payments = this.get<MembershipPayment[]>('memberships_payments', []);
    const pRecord = payments.find((p) => p.id === paymentId);
    if (!pRecord) return { success: false, commissionCredited: false, error: 'Payment not found' };

    pRecord.status = 'approved';
    pRecord.reviewed_by = admin_email;
    this.set('memberships_payments', payments);

    const user = this.getUserByUid(pRecord.user_uid);
    if (user) {
      user.membership_tier = 'premium';
      this.internalUpdateUser(user);
    }

    let commissionCredited = false;
    if (user && user.referred_by_uid) {
      const referrals = this.get<ReferralRecord[]>('referrals', []);
      const ref = referrals.find((r) => r.referrer_uid === user.referred_by_uid && r.referred_uid === user.uid);
      if (ref && !ref.premium_commission_credited) {
        ref.premium_commission_credited = true;
        this.set('referrals', referrals);

        const referrer = this.getUserByUid(user.referred_by_uid);
        if (referrer) {
          referrer.balance_pkr += 200;
          referrer.total_earned_pkr += 200;
          this.internalUpdateUser(referrer);
          commissionCredited = true;

          this.addFinancialLedgerEntry({
            user_uid: referrer.uid,
            transaction_type: 'premium_commission',
            amount_pkr: 200,
            balance_after_pkr: referrer.balance_pkr,
            related_id: pRecord.trx_id,
            description: `PKR 200 Premium Referral Commission from user ${user.uid}`,
          });

          this.addNotification({
            user_uid: referrer.uid,
            title: 'Premium Commission: PKR 200 Received!',
            message: `Your referral ${user.uid} upgraded to Premium Membership. PKR 200 commission credited to your wallet!`,
            type: 'premium_commission',
          });
        }
      }
    }

    this.addAuditLog({
      admin_email,
      action: 'APPROVE_MEMBERSHIP_PAYMENT',
      target_type: 'memberships_payments',
      target_id: pRecord.trx_id,
      details: { user_uid: pRecord.user_uid, amount_pkr: 500 },
    });

    return { success: true, commissionCredited };
  }

  public rejectMembershipPayment(paymentId: string, admin_email: string, reason: string): boolean {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.rpc('admin_reject_membership_payment', { p_payment_id: paymentId, p_reason: reason }));
      return true;
    }
    const payments = this.get<MembershipPayment[]>('memberships_payments', []);
    const pRecord = payments.find((p) => p.id === paymentId);
    if (pRecord) {
      pRecord.status = 'rejected';
      pRecord.reviewed_by = admin_email;
      pRecord.admin_notes = reason;
      this.set('memberships_payments', payments);
    }
    this.addAuditLog({
      admin_email,
      action: 'REJECT_MEMBERSHIP_PAYMENT',
      target_type: 'memberships_payments',
      target_id: paymentId,
      details: { reason },
    });
    return true;
  }

  public async submitMembershipPayment(params: {
    user_uid: string;
    payment_method: PaymentMethod;
    trx_id: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (this.isProductionMode() && supabase) {
      const { error } = await supabase.from('memberships_payments').insert({
        user_uid: params.user_uid,
        amount_pkr: 500,
        payment_method: params.payment_method,
        trx_id: params.trx_id.trim().toUpperCase(),
        status: 'pending',
      });
      if (error) {
        return {
          success: false,
          error: error.code === '23505' ? 'This TRX ID has already been submitted.' : error.message,
        };
      }
      await this.syncFromServer();
      return { success: true };
    }
    const payments = this.get<MembershipPayment[]>('memberships_payments', []);
    if (payments.some((p) => p.trx_id.trim().toUpperCase() === params.trx_id.trim().toUpperCase())) {
      return { success: false, error: 'This TRX ID has already been submitted.' };
    }

    const user = this.getUserByUid(params.user_uid);
    payments.push({
      id: 'pay-' + Date.now(),
      user_uid: params.user_uid,
      user_email: user?.email || '',
      amount_pkr: 500,
      payment_method: params.payment_method,
      trx_id: params.trx_id.trim().toUpperCase(),
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    this.set('memberships_payments', payments);

    return { success: true };
  }

  public async submitWhatsAppVerification(user_uid: string, whatsapp_number: string): Promise<{ success: boolean; error?: string }> {
    if (this.isProductionMode() && supabase) {
      const { error } = await supabase.rpc('submit_verification_request', { p_whatsapp: whatsapp_number });
      if (error) return { success: false, error: error.message };
      await this.syncFromServer();
      return { success: true };
    }
    const user = this.getUserByUid(user_uid);
    if (!user) return { success: false, error: 'User not found' };

    user.whatsapp_number = whatsapp_number;
    user.verification_status = 'pending';
    this.internalUpdateUser(user);

    const vReqs = this.get<VerificationRequest[]>('verification_requests', []);
    vReqs.push({
      id: 'vreq-' + Date.now(),
      user_uid,
      email: user.email,
      whatsapp_number,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    this.set('verification_requests', vReqs);

    return { success: true };
  }

  // -------------------------------------------------------------
  // REGISTRATION BONUS VIA INSTAGRAM UID SUBMISSION
  // -------------------------------------------------------------
  public async sendRegistrationBonus(
    target_uid: string,
    amount_pkr: number,
    admin_email: string
  ): Promise<{ success: boolean; error?: string }> {
    if (amount_pkr < 50 || amount_pkr > 500) {
      return { success: false, error: 'Registration bonus amount must be between 50 and 500 PKR.' };
    }

    if (this.isProductionMode() && supabase) {
      try {
        const { data, error } = await supabase.rpc('send_instagram_bonus', {
          p_target_uid: target_uid,
          p_amount: amount_pkr,
          p_admin_email: admin_email,
        });
        if (!error) await this.syncFromServer();
        if (error) {
          return { success: false, error: error.message };
        }
        return data;
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    }

    const user = this.getUserByUid(target_uid);
    if (!user) return { success: false, error: 'User not found.' };

    const bonuses = this.get<RegistrationBonusRecord[]>('registration_bonuses', []);
    if (bonuses.some((b) => b.user_uid === target_uid)) {
      return { success: false, error: 'This user has already received a registration bonus.' };
    }

    user.balance_pkr += amount_pkr;
    user.total_earned_pkr += amount_pkr;
    this.internalUpdateUser(user);

    bonuses.push({
      id: 'bonus-' + Date.now(),
      user_uid: target_uid,
      amount_pkr,
      approved_by: admin_email,
      created_at: new Date().toISOString(),
    });
    this.set('registration_bonuses', bonuses);

    this.addFinancialLedgerEntry({
      user_uid: target_uid,
      transaction_type: 'registration_bonus',
      amount_pkr,
      balance_after_pkr: user.balance_pkr,
      related_id: 'INSTAGRAM_CLAIM',
      description: `Instagram Registration Bonus: PKR ${amount_pkr} issued by ${admin_email}`,
    });

    this.addNotification({
      user_uid: target_uid,
      title: 'Registration Bonus Credited!',
      message: `Your Instagram UID claim was approved! PKR ${amount_pkr} has been added to your balance.`,
      type: 'bonus_credited',
    });

    this.addAuditLog({
      admin_email,
      action: 'SEND_REGISTRATION_BONUS',
      target_type: 'profile',
      target_id: target_uid,
      details: { amount_pkr },
    });

    return { success: true };
  }

  public getRegistrationBonusRecord(user_uid: string): RegistrationBonusRecord | null {
    const bonuses = this.get<RegistrationBonusRecord[]>('registration_bonuses', []);
    return bonuses.find((b) => b.user_uid === user_uid) || null;
  }

  // -------------------------------------------------------------
  // REPOSITORY GETTERS & ANALYTICS
  // -------------------------------------------------------------
  public getVerifiedReferralsCount(uid: string): number {
    const referrals = this.get<ReferralRecord[]>('referrals', []);
    return referrals.filter((r) => r.referrer_uid === uid && r.status === 'verified').length;
  }

  public getPendingReferralsCount(uid: string): number {
    const referrals = this.get<ReferralRecord[]>('referrals', []);
    return referrals.filter((r) => r.referrer_uid === uid && r.status === 'pending').length;
  }

  public getReferralsForUser(uid: string): ReferralRecord[] {
    const referrals = this.get<ReferralRecord[]>('referrals', []);
    return referrals.filter((r) => r.referrer_uid === uid);
  }

  public getFinancialLedger(uid: string): FinancialLedgerEntry[] {
    const ledger = this.get<FinancialLedgerEntry[]>('financial_ledger', []);
    return ledger.filter((l) => l.user_uid === uid).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  public getSpinsHistory(uid: string): SpinRecord[] {
    const spins = this.get<SpinRecord[]>('spins_history', []);
    return spins.filter((s) => s.user_uid === uid).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  public getTaskCompletions(uid: string): TaskCompletion[] {
    const completions = this.get<TaskCompletion[]>('task_completions', []);
    return completions.filter((c) => c.user_uid === uid);
  }

  public getNotifications(uid: string): AppNotification[] {
    const notifs = this.get<AppNotification[]>('notifications', []);
    return notifs.filter((n) => n.user_uid === uid).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  public markNotificationsRead(uid: string): void {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.from('notifications').update({ is_read: true }).eq('user_uid', uid).eq('is_read', false));
    }
    const notifs = this.get<AppNotification[]>('notifications', []);
    notifs.forEach((n) => {
      if (n.user_uid === uid) n.is_read = true;
    });
    this.set('notifications', notifs);
  }

  public addNotification(notif: { user_uid: string; title: string; message: string; type: string }): void {
    const notifs = this.get<AppNotification[]>('notifications', []);
    notifs.push({
      id: 'notif-' + Date.now(),
      user_uid: notif.user_uid,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    this.set('notifications', notifs);
  }

  public addFinancialLedgerEntry(entry: {
    user_uid: string;
    transaction_type: any;
    amount_pkr: number;
    balance_after_pkr: number;
    related_id?: string;
    description: string;
  }): void {
    const ledger = this.get<FinancialLedgerEntry[]>('financial_ledger', []);
    ledger.push({
      id: 'tx-' + Date.now() + Math.random().toString(36).substring(2, 5),
      user_uid: entry.user_uid,
      transaction_type: entry.transaction_type,
      amount_pkr: entry.amount_pkr,
      balance_after_pkr: entry.balance_after_pkr,
      related_id: entry.related_id,
      description: entry.description,
      created_at: new Date().toISOString(),
    });
    this.set('financial_ledger', ledger);
  }

  public addAuditLog(log: {
    admin_email: string;
    action: string;
    target_type: string;
    target_id: string;
    details?: any;
  }): void {
    const logs = this.get<AuditLogItem[]>('audit_logs', []);
    logs.push({
      id: 'log-' + Date.now(),
      admin_email: log.admin_email,
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      details: log.details,
      created_at: new Date().toISOString(),
    });
    this.set('audit_logs', logs);
  }

  public getAuditLogs(): AuditLogItem[] {
    const logs = this.get<AuditLogItem[]>('audit_logs', []);
    return logs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  public getSettings(): AppConfigSettings {
    return this.get<AppConfigSettings>('settings', DEFAULT_SETTINGS);
  }

  public updateSettings(newSettings: Partial<AppConfigSettings>): void {
    const current = this.getSettings();
    this.set('settings', { ...current, ...newSettings });
  }

  public getAppSettings(): AppConfigSettings {
    return this.getSettings();
  }

  public getLedger(uid: string): FinancialLedgerEntry[] {
    return this.getFinancialLedger(uid);
  }

  public markNotificationRead(notification_id: string): void {
    const notifs = this.get<AppNotification[]>('notifications', []);
    const notif = notifs.find((n) => n.id === notification_id);
    if (notif) {
      notif.is_read = true;
      this.set('notifications', notifs);
    }
  }

  public getDailyTasks(): DailyTaskItem[] {
    return this.get<DailyTaskItem[]>('tasks', DEFAULT_TASKS);
  }

  public updateDailyTask(task: DailyTaskItem): void {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() =>
        supabase!.from('daily_tasks').update({
          action_url: task.action_url,
          is_admin_unlocked: task.is_admin_unlocked,
          is_active: task.is_active,
          reward_pkr: task.reward_pkr,
        }).eq('id', task.id)
      );
      return;
    }
    const tasks = this.getDailyTasks();
    const index = tasks.findIndex((t) => t.id === task.id);
    if (index !== -1) {
      tasks[index] = task;
      this.set('tasks', tasks);
    }
  }

  public getVerificationRequests(): VerificationRequest[] {
    return this.get<VerificationRequest[]>('verification_requests', []).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
  }

  public getMembershipPayments(): MembershipPayment[] {
    return this.get<MembershipPayment[]>('memberships_payments', []).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
  }

  public getWithdrawals(user_uid?: string): WithdrawalRecord[] {
    const withdrawals = this.get<WithdrawalRecord[]>('withdrawals', []);
    const filtered = user_uid ? withdrawals.filter((w) => w.user_uid === user_uid) : withdrawals;
    return filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  public approveWithdrawal(withdrawalId: string, admin_email: string, trxReference: string): boolean {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.rpc('admin_complete_withdrawal', { p_id: withdrawalId, p_trx_ref: trxReference }));
      return true;
    }
    const withdrawals = this.getWithdrawals();
    const w = withdrawals.find((item) => item.id === withdrawalId);
    if (w) {
      w.status = 'completed';
      w.admin_trx_reference = trxReference;
      w.updated_at = new Date().toISOString();
      this.set('withdrawals', withdrawals);

      this.addNotification({
        user_uid: w.user_uid,
        title: 'Withdrawal Completed!',
        message: `Your withdrawal of PKR ${w.requested_amount} (Net PKR ${w.net_payable_amount}) via ${w.payment_method} has been sent. TRX Reference: ${trxReference}`,
        type: 'withdrawal_completed',
      });

      this.addAuditLog({
        admin_email,
        action: 'APPROVE_WITHDRAWAL',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        details: { net_amount: w.net_payable_amount, trx_ref: trxReference },
      });
      return true;
    }
    return false;
  }

  public rejectWithdrawal(withdrawalId: string, admin_email: string, reason: string): boolean {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.rpc('admin_reject_withdrawal', { p_id: withdrawalId, p_reason: reason }));
      return true;
    }
    const withdrawals = this.getWithdrawals();
    const w = withdrawals.find((item) => item.id === withdrawalId);
    if (w && w.status === 'pending') {
      w.status = 'rejected';
      w.updated_at = new Date().toISOString();
      this.set('withdrawals', withdrawals);

      // Refund the balance
      const user = this.getUserByUid(w.user_uid);
      if (user) {
        user.balance_pkr += w.requested_amount;
        user.total_withdrawn_pkr = Math.max(0, user.total_withdrawn_pkr - w.requested_amount);
        this.internalUpdateUser(user);

        this.addFinancialLedgerEntry({
          user_uid: w.user_uid,
          transaction_type: 'adjustment',
          amount_pkr: w.requested_amount,
          balance_after_pkr: user.balance_pkr,
          description: `Withdrawal Rejected & Refunded: PKR ${w.requested_amount}. Reason: ${reason}`,
        });
      }

      this.addNotification({
        user_uid: w.user_uid,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of PKR ${w.requested_amount} was rejected. Funds have been refunded to your wallet. Reason: ${reason}`,
        type: 'withdrawal_rejected',
      });

      this.addAuditLog({
        admin_email,
        action: 'REJECT_WITHDRAWAL',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        details: { reason },
      });
      return true;
    }
    return false;
  }

  public getRedeemCodes(): RedeemCode[] {
    return this.get<RedeemCode[]>('redeem_codes', []);
  }

  public createRedeemCode(params: { code: string; validHours: number; maxUses: number }): {
    success: boolean;
    code?: RedeemCode;
  } {
    if (this.isProductionMode() && supabase) {
      const now = Date.now();
      const row = {
        code: params.code.trim().toUpperCase(),
        activated_at: new Date(now).toISOString(),
        expires_at: new Date(now + params.validHours * 3600000).toISOString(),
        max_uses: params.maxUses,
      };
      this.serverAction(() => supabase!.from('redeem_codes').insert(row));
      return { success: true };
    }
    const codes = this.getRedeemCodes();
    const newCode: RedeemCode = {
      id: 'code-' + Date.now(),
      code: params.code.trim().toUpperCase(),
      activated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + params.validHours * 3600000).toISOString(),
      max_uses: params.maxUses,
      times_used: 0,
      is_active: true,
      reward_mode: 'policy_50_500',
      created_at: new Date().toISOString(),
    };
    codes.push(newCode);
    this.set('redeem_codes', codes);
    return { success: true, code: newCode };
  }

  public getLeaderboard(currentUserUid?: string): LeaderboardRank[] {
    if (this.isProductionMode()) {
      const board = this.get<any[]>('leaderboard', []);
      return board.map((item, idx) => ({
        rank: idx + 1,
        uid: item.uid,
        email: item.email,
        verified_referrals_count: item.verified_referrals_count,
        membership_tier: item.membership_tier,
        avatar_url: item.avatar_url,
        isCurrentUser: currentUserUid ? item.uid === currentUserUid : false,
      }));
    }
    const users = this.get<UserProfile[]>('users', []);
    const ranked = users
      .map((u) => {
        const verifiedRefs = this.getVerifiedReferralsCount(u.uid);
        return {
          uid: u.uid,
          email: u.email,
          membership_tier: u.membership_tier,
          verified_referrals_count: verifiedRefs,
          avatar_url: u.avatar_url,
          total_earned_pkr: u.total_earned_pkr,
        };
      })
      .sort((a, b) => {
        if (b.verified_referrals_count !== a.verified_referrals_count) {
          return b.verified_referrals_count - a.verified_referrals_count;
        }
        return b.total_earned_pkr - a.total_earned_pkr;
      })
      .slice(0, 10);

    return ranked.map((item, idx) => ({
      rank: idx + 1,
      uid: item.uid,
      email: item.email,
      verified_referrals_count: item.verified_referrals_count,
      membership_tier: item.membership_tier,
      avatar_url: item.avatar_url,
      isCurrentUser: currentUserUid ? item.uid === currentUserUid : false,
    }));
  }

  public getWeeklyLeaderboard(currentUserUid?: string): LeaderboardRank[] {
    return this.getLeaderboard(currentUserUid);
  }

  public claimLeaderboardReward(user_uid: string, rank: number): { success: boolean; reward?: number; error?: string } {
    if (this.isProductionMode()) {
      return { success: false, error: 'Leaderboard reward claims are not available yet.' };
    }
    const user = this.getUserByUid(user_uid);
    if (!user) return { success: false, error: 'User not found.' };

    if (user.membership_tier !== 'premium') {
      return { success: false, error: 'Leaderboard cash reward claims require an active Premium Membership.' };
    }

    const rewards = this.getSettings().leaderboard_rewards;
    const reward = rewards[rank] || 100;

    user.balance_pkr += reward;
    user.total_earned_pkr += reward;
    this.internalUpdateUser(user);

    this.addFinancialLedgerEntry({
      user_uid,
      transaction_type: 'adjustment',
      amount_pkr: reward,
      balance_after_pkr: user.balance_pkr,
      description: `Weekly Leaderboard Rank #${rank} Cash Reward: PKR ${reward}`,
    });

    return { success: true, reward };
  }

  // Verification numbers for the admin dashboard
  public getVerificationStats(): { today: number; total: number } {
    const users = this.get<UserProfile[]>('users', []);
    const total = users.filter((u) => u.verification_status === 'verified' && !u.is_admin).length;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const today = this.get<VerificationRequest[]>('verification_requests', []).filter(
      (r) => r.status === 'approved' && r.reviewed_at && new Date(r.reviewed_at).getTime() >= start.getTime()
    ).length;
    return { today, total };
  }

  public searchUsers(query: string): UserProfile[] {
    const users = this.get<UserProfile[]>('users', []);
    const q = query.trim().toLowerCase();
    const payments = this.getMembershipPayments();

    return users.filter((u) => {
      if (u.uid.toLowerCase().includes(q)) return true;
      if (u.email.toLowerCase().includes(q)) return true;
      if (u.whatsapp_number && u.whatsapp_number.toLowerCase().includes(q)) return true;
      if (u.referral_code.toLowerCase().includes(q)) return true;
      // Search by TRX ID
      const userPayments = payments.filter((p) => p.user_uid === u.uid);
      if (userPayments.some((p) => p.trx_id.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  public resetDeviceLock(target_uid: string, admin_email: string): boolean {
    if (this.isProductionMode() && supabase) {
      this.serverAction(() => supabase!.rpc('reset_device_lock', { p_target_uid: target_uid, p_admin_email: admin_email }));
      return true;
    }
    const user = this.getUserByUid(target_uid);
    if (user) {
      user.device_id = undefined;
      user.device_model = undefined;
      user.device_registered_at = undefined;
      this.internalUpdateUser(user);
    }
    this.addAuditLog({
      admin_email,
      action: 'RESET_DEVICE_LOCK',
      target_type: 'profile',
      target_id: target_uid,
      details: { multi_account_allowed: true },
    });
    return true;
  }
}

export const nexaService = new NexaService();

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Gift, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { helperApi, helperAvailable, PendingVerification } from '../services/helperApi';

interface Props {
  kind: 'verify' | 'bonus';
  token: string;
}

const Shell: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="min-h-screen bg-[#070B14] text-slate-100 p-4 sm:p-8">
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-xl bg-[#092B28] flex items-center justify-center">{icon}</div>
        <h1 className="font-bold text-lg text-white">{title}</h1>
      </div>
      <p className="text-[11px] text-slate-500 mb-6">NEXA EARN · Helper access (no login needed)</p>
      {children}
    </div>
  </div>
);

const VerifyHelper: React.FC<{ token: string }> = ({ token }) => {
  const [items, setItems] = useState<PendingVerification[] | null>(null);
  const [error, setError] = useState('');
  const [busyUid, setBusyUid] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await helperApi.verifyList(token));
    } catch (e: any) {
      setError(e.message);
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (uid: string, approve: boolean) => {
    let reason = '';
    if (!approve) {
      reason = window.prompt('Reason for rejection:') || '';
      if (!reason.trim()) return;
    } else if (!window.confirm(`Approve account ${uid}?`)) return;
    setBusyUid(uid);
    setNote('');
    try {
      const r = approve ? await helperApi.verifyApprove(token, uid) : await helperApi.verifyReject(token, uid, reason);
      setNote(r?.success === false ? r.error || 'Failed.' : approve ? `${uid} verified.` : `${uid} rejected.`);
      await load();
    } catch (e: any) {
      setNote(e.message);
    }
    setBusyUid('');
  };

  return (
    <Shell title="Account Verification" icon={<ShieldCheck className="w-5 h-5 text-[#00C995]" />}>
      <button onClick={load} className="mb-4 px-3 py-2 rounded-xl border border-[#16233B] text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
      {error && <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 mb-4">{error}</p>}
      {note && <p className="p-3 rounded-xl bg-[#092B28] border border-[#00C995]/30 text-xs text-[#00E5A3] mb-4">{note}</p>}
      {items === null && <p className="text-sm text-slate-400">Loading…</p>}
      {items && items.length === 0 && !error && <p className="text-sm text-slate-400">No pending verification requests.</p>}
      <div className="space-y-3">
        {items?.map((v) => {
          const wa = (v.whatsapp_number || '').replace(/[^0-9]/g, '');
          return (
            <div key={v.user_uid} className="p-4 rounded-2xl bg-[#0D1527] border border-[#16233B]">
              <div className="text-sm font-mono text-white">{v.user_uid}</div>
              <div className="text-xs text-slate-400 break-all">{v.email}</div>
              <div className="text-xs text-slate-300 mt-1">
                WhatsApp:{' '}
                {wa ? (
                  <a className="text-[#00C995] underline" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                    {v.whatsapp_number}
                  </a>
                ) : (
                  v.whatsapp_number
                )}
              </div>
              <div className="text-[10px] text-slate-500 mb-3">{new Date(v.created_at).toLocaleString()}</div>
              <div className="flex gap-2">
                <button disabled={busyUid === v.user_uid} onClick={() => act(v.user_uid, true)}
                  className="flex-1 py-2 rounded-xl bg-[#00C995] text-slate-950 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4" /> Approve
                </button>
                <button disabled={busyUid === v.user_uid} onClick={() => act(v.user_uid, false)}
                  className="flex-1 py-2 rounded-xl border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
};

const BonusHelper: React.FC<{ token: string }> = ({ token }) => {
  const [uid, setUid] = useState('');
  const [amount, setAmount] = useState(100);
  const [info, setInfo] = useState<{ found: boolean; uid?: string; already_received?: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setError('');
    setMsg('');
    setInfo(null);
    if (!uid.trim()) return;
    setBusy(true);
    try {
      setInfo(await helperApi.bonusLookup(token, uid));
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  const send = async () => {
    if (!info?.uid) return;
    if (amount < 50 || amount > 500) {
      setError('Amount must be between PKR 50 and PKR 500.');
      return;
    }
    if (!window.confirm(`Send PKR ${amount} bonus to ${info.uid}?`)) return;
    setBusy(true);
    setError('');
    try {
      const r = await helperApi.bonusSend(token, info.uid, amount);
      if (r?.success === false) setError(r.error || 'Failed.');
      else {
        setMsg(`PKR ${amount} bonus sent to ${info.uid}.`);
        setInfo(null);
        setUid('');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <Shell title="Registration Bonus" icon={<Gift className="w-5 h-5 text-[#00C995]" />}>
      {error && <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 mb-4">{error}</p>}
      {msg && <p className="p-3 rounded-xl bg-[#092B28] border border-[#00C995]/30 text-xs text-[#00E5A3] mb-4">{msg}</p>}
      <div className="p-5 rounded-2xl bg-[#0D1527] border border-[#16233B] space-y-4">
        <div>
          <label className="block text-xs text-slate-300 mb-1.5">User UID</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="e.g. NE-204892"
            className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white font-mono uppercase" />
        </div>
        <button onClick={check} disabled={busy}
          className="w-full py-2.5 rounded-xl border border-[#00C995]/50 text-[#00C995] text-sm font-bold cursor-pointer disabled:opacity-50">
          Check user
        </button>
        {info && !info.found && <p className="text-xs text-red-300">No user found with this UID.</p>}
        {info?.found && (
          <>
            <p className="text-xs text-slate-300">
              User <span className="font-mono text-white">{info.uid}</span> found.
            </p>
            {info.already_received ? (
              <p className="text-xs text-amber-300">This user has already received a registration bonus.</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-slate-300 mb-1.5">Bonus amount (PKR 50 to 500)</label>
                  <input type="number" min={50} max={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-[#070B14] border border-[#16233B] rounded-xl text-sm text-white font-mono" />
                </div>
                <button onClick={send} disabled={busy}
                  className="w-full py-3 rounded-xl bg-[#00C995] text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-50">
                  Send bonus
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Shell>
  );
};

export const HelperPage: React.FC<Props> = ({ kind, token }) => {
  if (!helperAvailable()) {
    return (
      <Shell title="Helper link" icon={<ShieldCheck className="w-5 h-5 text-[#00C995]" />}>
        <p className="text-sm text-slate-400">This page works only on the live site (Supabase connected).</p>
      </Shell>
    );
  }
  return kind === 'verify' ? <VerifyHelper token={token} /> : <BonusHelper token={token} />;
};

import React, { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Link2 } from 'lucide-react';
import { helperApi, helperAvailable } from '../services/helperApi';

interface Props {
  kind: 'verify' | 'bonus';
  title: string;
}

// Shows a secret link the admin can copy and share with a trusted person.
export const HelperLinkCard: React.FC<Props> = ({ kind, title }) => {
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!helperAvailable()) return;
    helperApi
      .adminGetLinks()
      .then((l) => setToken(l[kind] || ''))
      .catch((e) => setError(e.message));
  }, [kind]);

  if (!helperAvailable()) {
    return (
      <div className="mb-5 p-4 rounded-2xl bg-[#0D1527] border border-[#16233B] text-xs text-slate-400">
        Secret share links work only on the live site (Supabase connected).
      </div>
    );
  }

  const url = token ? `${window.location.origin}/#helper-${kind}=${token}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = async () => {
    if (!window.confirm('Reset this link? The old link will stop working immediately.')) return;
    setBusy(true);
    try {
      setToken(await helperApi.adminRotate(kind));
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="mb-5 p-4 rounded-2xl bg-[#0D1527] border border-[#16233B]">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-[#00C995]" />
        <h4 className="text-sm font-bold text-white">{title}</h4>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Anyone with this link can use this page <b>without login or password</b>. Share it only with someone you
        trust. Press Reset if it leaks.
      </p>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input
          readOnly
          value={url || 'Loading…'}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-2 bg-[#070B14] border border-[#16233B] rounded-xl text-[11px] text-slate-300 font-mono"
        />
        <button
          onClick={copy}
          disabled={!url}
          className="px-3 py-2 rounded-xl bg-[#00C995] text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={reset}
          disabled={busy || !url}
          className="px-3 py-2 rounded-xl border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
};

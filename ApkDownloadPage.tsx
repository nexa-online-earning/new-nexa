import React, { useState } from 'react';
import { UserProfile } from '../types/nexa';
import { nexaService } from '../services/nexaService';
import {
  Download,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface ApkDownloadPageProps {
  currentUser: UserProfile | null;
  onProceedToDashboard: () => void;
}

export const ApkDownloadPage: React.FC<ApkDownloadPageProps> = ({
  currentUser,
  onProceedToDashboard,
}) => {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const settings = nexaService.getAppSettings();
  const rawApkUrl = settings.apk_download_url?.trim() || '';
  const isApkAvailable = Boolean(rawApkUrl && !rawApkUrl.includes('placeholder') && !rawApkUrl.includes('example.com'));

  const handleDownload = () => {
    setDownloadError(null);

    if (!isApkAvailable || !rawApkUrl) {
      setDownloadError(
        'The official NEXA EARN APK package is currently not available yet. Please check back shortly or proceed to use the Web Dashboard below.'
      );
      return;
    }

    setDownloading(true);

    const link = document.createElement('a');
    link.href = rawApkUrl;
    link.setAttribute('download', 'nexa-earn-v1.0.0.apk');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
    }, 2000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-xl bg-[#0D1527] border border-[#16233B] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00C995]/5 relative overflow-hidden">
        {/* Ambient atmospheric gradients */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#00C995]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#0284C7]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header & Logo */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00C995] text-slate-950 font-black text-2xl mb-3 shadow-xl shadow-[#00C995]/30">
            NX
          </div>

          <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-wide">
            Welcome to <span className="text-[#00C995]">NEXA EARN</span>!
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 font-medium">
            Your account has been created successfully.
          </p>
        </div>

        {/* Registered User Credentials Reminder Card */}
        {currentUser && (
          <div className="mb-6 p-4 rounded-2xl bg-[#09101E] border border-[#16233B] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Your Permanent Account UID
              </span>
              <span className="text-base font-mono font-bold text-[#00C995] tracking-wider">
                {currentUser.uid}
              </span>
            </div>
            <div className="text-center sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Registered Email
              </span>
              <span className="text-xs text-white font-medium truncate max-w-[200px] block font-mono">
                {currentUser.email}
              </span>
            </div>
          </div>
        )}

        {/* Prominent APK Download Card */}
        <div className="p-6 rounded-3xl bg-[#091222] border border-[#00C995]/40 text-center mb-6 shadow-xl relative overflow-hidden group">
          <div className="w-16 h-16 rounded-2xl bg-[#092B28] border border-[#00C995]/40 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00C995]/20">
            <Smartphone className="w-8 h-8 text-[#00C995]" />
          </div>

          <h2 className="font-display font-black text-xl text-white mb-1.5">
            NEXA EARN Android App
          </h2>
          <p className="text-xs text-slate-300 mb-5 max-w-sm mx-auto leading-relaxed">
            Get instant access to wheel spins, daily tasks, automatic device security, and fast withdrawal tracking directly on your mobile device.
          </p>

          {/* Download APK Button */}
          {isApkAvailable ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#00C995] hover:bg-[#05DF9F] text-slate-950 font-display font-extrabold text-base rounded-2xl shadow-xl shadow-[#00C995]/30 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <Download className="w-5 h-5 text-slate-950" />
              <span>{downloading ? 'Downloading APK...' : 'Download APK'}</span>
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#1C1608] border border-amber-600/50 text-amber-200 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>The APK is not available yet. Please use the Web Dashboard below.</span>
            </div>
          )}

          {downloadError && (
            <div className="mt-3 p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs">
              {downloadError}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#00C995]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00C995]" />
            <span>Verified Package · Official Release v1.0.0</span>
          </div>
        </div>

        {/* Login Reminder Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-[#09101E] border border-[#16233B] flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#00C995]/20 text-[#00C995] shrink-0 mt-0.5">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white mb-0.5">App Login Credentials</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              After installing the app, please log in using the <strong>same email address and password</strong> you just created during registration.
            </p>
          </div>
        </div>

        {/* Short Android Installation Guide */}
        <div className="mb-6 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-[#00C995]" />
            How to Install the APK on Android
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B]">
              <div className="w-6 h-6 rounded-full bg-[#00C995] text-slate-950 font-black text-xs flex items-center justify-center mb-2">
                1
              </div>
              <h5 className="text-xs font-bold text-white mb-1">Download APK</h5>
              <p className="text-[11px] text-slate-400 leading-normal">
                Click the "Download APK" button above to save the file.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B]">
              <div className="w-6 h-6 rounded-full bg-[#00C995] text-slate-950 font-black text-xs flex items-center justify-center mb-2">
                2
              </div>
              <h5 className="text-xs font-bold text-white mb-1">Allow Unknown Apps</h5>
              <p className="text-[11px] text-slate-400 leading-normal">
                Enable "Install Unknown Apps" in your Android settings if prompted.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#080E1C] border border-[#16233B]">
              <div className="w-6 h-6 rounded-full bg-[#00C995] text-slate-950 font-black text-xs flex items-center justify-center mb-2">
                3
              </div>
              <h5 className="text-xs font-bold text-white mb-1">Log In & Start</h5>
              <p className="text-[11px] text-slate-400 leading-normal">
                Open the installed app and sign in with your email and password.
              </p>
            </div>
          </div>
        </div>

        {/* Secondary: Open Web Dashboard */}
        <div className="pt-4 border-t border-[#16233B] flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-400 text-center sm:text-left">
            Prefer using the browser version?
          </span>
          <button
            onClick={() => {
              window.location.hash = '';
              onProceedToDashboard();
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#10192D] hover:bg-[#16233B] text-slate-200 text-xs font-semibold rounded-xl border border-[#1D2B44] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Web Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

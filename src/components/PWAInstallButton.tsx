import React, {useState} from 'react';
import {Download, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {LIVE_WEBSITE_URL} from '../lib/siteConfig';

interface PWAInstallButtonProps {
  label?: string;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  label = 'Install App',
  compact = false,
}) => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-1.5 text-xs min-h-[36px]' : 'px-4 py-2 text-sm min-h-[40px]'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-1.5 text-xs min-h-[36px]' : 'px-4 py-2 text-sm min-h-[40px]'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>Android App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isIOS ? 'Install on iPhone / iPad' : 'Install MoneyCircle Android App'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isIOS
                ? `Open ${LIVE_WEBSITE_URL} in Safari, tap the Share button in the toolbar, and choose "Add to Home Screen" for full-screen app mode.`
                : `MoneyCircle (${LIVE_WEBSITE_URL}) is a Progressive Web App compatible with Android Chrome & Edge. Tap the browser menu (⋮) and select "Install app" or "Add to Home screen" to launch MoneyCircle as a standalone Android application.`}
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-900 dark:bg-emerald-600 text-white py-2.5 text-sm font-medium hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

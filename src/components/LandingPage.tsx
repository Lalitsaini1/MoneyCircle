import React, {useEffect, useState} from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  HelpCircle,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import {t} from '../lib/i18n';
import {DEFAULT_PLANS} from '../lib/seedData';
import {normalizePublicRoute, type PublicRoutePath} from '../lib/seo';
import {LIVE_WEBSITE_URL} from '../lib/siteConfig';
import type {CoinPackage, DayPlan, Language, ThemeMode} from '../types/models';
import {PWAInstallButton} from './PWAInstallButton';

interface LandingPageProps {
  lang: Language;
  setLang: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  plans: DayPlan[];
  packages: CoinPackage[];
  isAuthenticated: boolean;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenDashboard: () => void;
  currentPath?: string;
  onNavigateRoute?: (path: PublicRoutePath) => void;
}

const HERO_IMG = '/src/assets/images/hero_moneycircle_vault_1795252441688.jpg';
const CIRCLE_IMG = '/src/assets/images/card_reward_circle_1795252441344.jpg';

export const LandingPage: React.FC<LandingPageProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  plans,
  packages,
  isAuthenticated,
  onOpenAuth,
  onOpenDashboard,
  currentPath = '/',
  onNavigateRoute,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [circleImgFailed, setCircleImgFailed] = useState(false);
  const activeRoute = normalizePublicRoute(currentPath);

  useEffect(() => {
    const sectionMap: Record<PublicRoutePath, string> = {
      '/': 'top',
      '/plans': 'plans',
      '/rates': 'rates',
      '/security': 'security',
      '/support': 'support',
    };
    const targetId = sectionMap[activeRoute];
    if (targetId && targetId !== 'top') {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
    }
  }, [activeRoute]);

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: PublicRoutePath,
    sectionId: string,
  ) => {
    if (onNavigateRoute) {
      e.preventDefault();
      onNavigateRoute(path);
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({behavior: 'smooth', block: 'start'});
      }
    }
  };

  const visiblePlans =
    plans.filter((p) => p.isActive).length > 0
      ? plans.filter((p) => p.isActive).sort((a, b) => a.durationDays - b.durationDays)
      : DEFAULT_PLANS.map((p) => ({
          ...p,
          isActive: true,
          createdAt: null as unknown as DayPlan['createdAt'],
          updatedAt: null as unknown as DayPlan['updatedAt'],
        }));

  const conversionRows =
    packages.filter((p) => p.isActive).length > 0
      ? packages.filter((p) => p.isActive).sort((a, b) => a.coins - b.coins)
      : [
          {id: '1', name: 'Unit Parity', coins: 1, priceInr: 1, tagline: 'Base Accounting Unit'},
          {id: '100', name: 'Starter Pack', coins: 100, priceInr: 100, tagline: 'Entry Wallet Pack'},
          {id: '500', name: 'Standard Pack', coins: 500, priceInr: 500, tagline: 'Popular Circle Balance'},
          {id: '1000', name: 'Circle Pro Pack', coins: 1000, priceInr: 1000, tagline: 'Full Horizon Coverage'},
        ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleRouteClick(e, '/', 'top')}
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {t(lang, 'brand')}
          </a>

          {/* Zone 2: 4 Single-line Nav Links */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="/plans"
              onClick={(e) => handleRouteClick(e, '/plans', 'plans')}
              className={`hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === '/plans' ? 'text-slate-950 dark:text-white underline' : ''
              }`}
            >
              {t(lang, 'navPlans')}
            </a>
            <a
              href="/rates"
              onClick={(e) => handleRouteClick(e, '/rates', 'rates')}
              className={`hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === '/rates' ? 'text-slate-950 dark:text-white underline' : ''
              }`}
            >
              {t(lang, 'navRates')}
            </a>
            <a
              href="/security"
              onClick={(e) => handleRouteClick(e, '/security', 'security')}
              className={`hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === '/security' ? 'text-slate-950 dark:text-white underline' : ''
              }`}
            >
              {t(lang, 'navSecurity')}
            </a>
            <a
              href="/support"
              onClick={(e) => handleRouteClick(e, '/support', 'support')}
              className={`hover:text-slate-950 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === '/support' ? 'text-slate-950 dark:text-white underline' : ''
              }`}
            >
              {t(lang, 'navSupport')}
            </a>
          </nav>

          {/* Zone 3: 1 Primary CTA Button */}
          <div className="shrink-0">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={onOpenDashboard}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t(lang, 'openDashboard')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t(lang, 'signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Workspace Toolbar (Language, Theme, Android PWA) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span>{lang === 'hi' ? '1 कॉइन = ₹1 INR' : '1 Coin = ₹1.00 INR'}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'hi' ? 'UPI वेबहुक सत्यापित' : 'UPI Webhook Verified'}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'hi' ? 'वेब और Android PWA' : 'Web & Android PWA'}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lang === 'en'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lang === 'hi'
                    ? 'bg-slate-900 text-white dark:bg-emerald-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                हिंदी
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'light' ? t(lang, 'darkMode') : t(lang, 'lightMode')}</span>
            </button>

            <PWAInstallButton label={t(lang, 'installApp')} compact />
          </div>
        </div>

        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <h1
                className="font-display font-bold tracking-tight text-slate-950 dark:text-white leading-[1.08]"
                style={{fontSize: 'clamp(2.25rem, 4vw, 3.65rem)', textWrap: 'balance'}}
              >
                {t(lang, 'heroTitle')}
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                {t(lang, 'heroSubtitle')}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? onOpenDashboard() : onOpenAuth('register'))}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{isAuthenticated ? t(lang, 'openDashboard') : t(lang, 'heroPrimaryCta')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="/plans"
                  onClick={(e) => handleRouteClick(e, '/plans', 'plans')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 px-6 py-3 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{t(lang, 'heroSecondaryCta')}</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 relative">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMG}
                    alt="MoneyCircle Coin Vault"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white">
                    <Coins className="w-12 h-12 text-emerald-400 mb-3" />
                    <span className="font-display text-lg font-semibold">MoneyCircle Coin Vault</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Key Platform Structure Row */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'रूपांतरण दर' : 'Conversion Parity'}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                1 Coin = ₹1
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {lang === 'hi' ? 'निश्चित लेखा मूल्य' : 'Fixed platform ledger rate'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'डे सर्कल अवधि' : 'Circle Durations'}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                5 – 25 Days
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {lang === 'hi' ? '5, 7, 10, 15, 25 दिन विकल्प' : '5, 7, 10, 15 & 25-day tiers'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'पेमेंट सुरक्षा' : 'Deposit Verification'}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                HMAC + UTR
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {lang === 'hi' ? 'सर्वर वेबहुक सत्यापन' : 'Server-side gateway webhook'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'निकासी सुरक्षा' : 'Withdrawal Protection'}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                Atomic Lock
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {lang === 'hi' ? 'डुप्लिकेट अनुरोध रोकथाम' : 'Single active payout lock'}
              </div>
            </div>
          </div>
        </section>

        {/* Coin Conversion Rates */}
        <section id="rates" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t(lang, 'coinParityTitle')}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                {t(lang, 'coinParitySubtitle')}
              </p>
            </div>

            <div className="mt-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-5">{lang === 'hi' ? 'पैकेज' : 'Package'}</th>
                    <th className="py-3.5 px-5 text-right">{lang === 'hi' ? 'कॉइन्स' : 'Coins'}</th>
                    <th className="py-3.5 px-5 text-right">{lang === 'hi' ? 'मूल्य (INR)' : 'Amount (INR)'}</th>
                    <th className="py-3.5 px-5">{lang === 'hi' ? 'विवरण' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {conversionRows.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-slate-100">
                        {pkg.name}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {pkg.coins.toLocaleString('en-IN')} Coins
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        ₹{pkg.priceInr.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400">
                        {pkg.tagline || 'Authorized UPI Gateway Purchase'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Day Circle Plans */}
        <section id="plans" className="border-t border-slate-200 dark:border-slate-800 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-10">
              <div className="lg:col-span-7">
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t(lang, 'plansSectionTitle')}
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {t(lang, 'plansSectionSubtitle')}
                </p>
              </div>
              <div className="lg:col-span-5">
                <div className="aspect-[4/3] max-h-56 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  {!circleImgFailed ? (
                    <img
                      src={CIRCLE_IMG}
                      alt="MoneyCircle Interlocking Reward Circles"
                      referrerPolicy="no-referrer"
                      onError={() => setCircleImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                      Day Circle Plans
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visiblePlans.map((plan) => (
                <article
                  key={plan.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {plan.durationDays} {lang === 'hi' ? 'दिन' : 'Days'}
                      </span>
                      <span>
                        {lang === 'hi' ? 'पात्रता' : 'Eligibility'}: {plan.eligibility}
                      </span>
                    </div>

                    <h3 className="mt-3 font-display text-lg font-bold text-slate-950 dark:text-white">
                      {lang === 'hi' && plan.nameHi ? plan.nameHi : plan.name}
                    </h3>

                    <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {plan.priceCoins.toLocaleString('en-IN')} Coins{' '}
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                        (₹{plan.priceCoins.toLocaleString('en-IN')})
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === 'hi' && plan.descriptionHi ? plan.descriptionHi : plan.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      <strong className="text-slate-700 dark:text-slate-200">
                        {lang === 'hi' ? 'नियम व शर्तें:' : 'Terms & Conditions:'}
                      </strong>{' '}
                      {plan.terms}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => (isAuthenticated ? onOpenDashboard() : onOpenAuth('register'))}
                    className="mt-5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white py-2.5 text-sm font-medium transition-colors cursor-pointer"
                  >
                    {isAuthenticated
                      ? lang === 'hi'
                        ? 'डैशबोर्ड में चुनें'
                        : 'Enroll in Dashboard'
                      : lang === 'hi'
                        ? 'साइन इन करके जुड़ें'
                        : 'Sign In to Enroll'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Compliance */}
        <section
          id="security"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-14"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t(lang, 'complianceTitle')}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(lang, 'complianceBody')}
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'अधिकृत UPI वेबहुक' : 'Authorized UPI Webhooks'}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'hi'
                    ? 'प्रत्येक जमा ऑर्डर सर्वर पर HMAC-SHA256 हस्ताक्षर और 12-अंकीय UTR द्वारा सत्यापित होता है।'
                    : 'Every deposit order generates an HMAC-SHA256 signed gateway reference and requires verified 12-digit UTR settlement.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'लॉक्ड बैलेंस सुरक्षा' : 'Locked Withdrawal Balances'}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'hi'
                    ? 'निकासी अनुरोध पर कॉइन्स लॉक हो जाते हैं जिससे डुप्लिकेट निकासी रोकी जाती है।'
                    : 'Requested withdrawal amounts move atomically into Locked Coins, preventing double-spend or duplicate requests.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'सख्त भूमिका पृथक्करण' : 'Role-Verified Access'}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'hi'
                    ? 'Firestore सुरक्षा नियम उपयोगकर्ता और एडमिन अनुमतियों को सख्ती से अलग रखते हैं।'
                    : 'Cloud Firestore security rules isolate user PII and strictly guard all administrative settlement controls.'}
                </p>
              </div>

              <div id="support" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <HelpCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'समर्पित हेल्प डेस्क' : 'Integrated Help Desk'}
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'hi'
                    ? 'पेमेंट, निकासी और खाता सहायता के लिए सीधे टिकट खोलें और लाइव उत्तर प्राप्त करें।'
                    : 'Open tracked support tickets for deposits, withdrawals, or account queries with full conversation history.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>© {new Date().getFullYear()} MoneyCircle. {lang === 'hi' ? 'सभी अधिकार सुरक्षित।' : 'All rights reserved.'}</span>
            <span aria-hidden="true">·</span>
            <a
              href={LIVE_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white underline underline-offset-2"
            >
              moneycircle-public.vercel.app
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/plans" onClick={(e) => handleRouteClick(e, '/plans', 'plans')} className="hover:text-slate-900 dark:hover:text-white">
              {t(lang, 'navPlans')}
            </a>
            <a href="/rates" onClick={(e) => handleRouteClick(e, '/rates', 'rates')} className="hover:text-slate-900 dark:hover:text-white">
              {t(lang, 'navRates')}
            </a>
            <a href="/security" onClick={(e) => handleRouteClick(e, '/security', 'security')} className="hover:text-slate-900 dark:hover:text-white">
              {t(lang, 'navSecurity')}
            </a>
            <a href="/support" onClick={(e) => handleRouteClick(e, '/support', 'support')} className="hover:text-slate-900 dark:hover:text-white">
              {t(lang, 'navSupport')}
            </a>
            <span aria-hidden="true">·</span>
            <span>support@moneycircle.app</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

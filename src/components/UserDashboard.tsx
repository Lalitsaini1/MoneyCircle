import React, {useMemo, useState} from 'react';
import {sendEmailVerification, signOut} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Menu,
  Moon,
  QrCode,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sun,
  User as UserIcon,
  Users,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import {QRCodeSVG} from 'qrcode.react';
import {auth, db, handleFirestoreError, makeSafeId, OperationType} from '../lib/firebase';
import {t} from '../lib/i18n';
import {
  buildReferralLink,
  getActiveSiteOrigin,
  getAuthActionCodeSettings,
} from '../lib/siteConfig';
import type {
  AppNotification,
  CoinPackage,
  CoinTransaction,
  DayPlan,
  Deposit,
  Language,
  PlanEnrollment,
  PlatformSettings,
  Referral,
  SupportMessage,
  SupportTicket,
  ThemeMode,
  UserProfile,
  Wallet,
  Withdrawal,
} from '../types/models';
import {PWAInstallButton} from './PWAInstallButton';

export type UserTab =
  | 'overview'
  | 'buy'
  | 'plans'
  | 'withdrawals'
  | 'transactions'
  | 'referrals'
  | 'notifications'
  | 'support'
  | 'profile';

interface UserDashboardProps {
  lang: Language;
  setLang: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  userProfile: UserProfile;
  wallet: Wallet | null;
  plans: DayPlan[];
  enrollments: PlanEnrollment[];
  packages: CoinPackage[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  transactions: CoinTransaction[];
  referrals: Referral[];
  notifications: AppNotification[];
  tickets: SupportTicket[];
  supportMessages: SupportMessage[];
  settings: PlatformSettings;
  isAdmin: boolean;
  onSwitchToAdmin?: () => void;
  onBackToSite: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  userProfile,
  wallet,
  plans,
  enrollments,
  packages,
  deposits,
  withdrawals,
  transactions,
  referrals,
  notifications,
  tickets,
  supportMessages,
  settings,
  isAdmin,
  onSwitchToAdmin,
  onBackToSite,
}) => {
  const [activeTab, setActiveTab] = useState<UserTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Payment / Coin Purchase state
  const [activeOrder, setActiveOrder] = useState<{
    depositId: string;
    orderId: string;
    packageId: string;
    packageName: string;
    coins: number;
    amountInr: number;
    upiUri: string;
    orderToken: string;
  } | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  // Withdrawal state
  const [wdAmount, setWdAmount] = useState('');
  const [wdMethod, setWdMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [wdUpi, setWdUpi] = useState(userProfile.upiId || '');
  const [wdHolder, setWdHolder] = useState(userProfile.bankAccountHolder || '');
  const [wdAccNum, setWdAccNum] = useState(userProfile.bankAccountNumber || '');
  const [wdIfsc, setWdIfsc] = useState(userProfile.bankIfsc || '');
  const [wdBankName, setWdBankName] = useState(userProfile.bankName || '');
  const [wdBusy, setWdBusy] = useState(false);

  // Plan enrollment state
  const [enrollBusyId, setEnrollBusyId] = useState<string | null>(null);

  // Ledger filter
  const [txFilter, setTxFilter] = useState<string>('ALL');

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<SupportTicket['category']>('PAYMENT');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('MEDIUM');
  const [ticketInitialMsg, setTicketInitialMsg] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);

  // Profile form state
  const [profName, setProfName] = useState(userProfile.displayName);
  const [profPhone, setProfPhone] = useState(userProfile.phone || '');
  const [profUpi, setProfUpi] = useState(userProfile.upiId || '');
  const [profHolder, setProfHolder] = useState(userProfile.bankAccountHolder || '');
  const [profAccNum, setProfAccNum] = useState(userProfile.bankAccountNumber || '');
  const [profIfsc, setProfIfsc] = useState(userProfile.bankIfsc || '');
  const [profBank, setProfBank] = useState(userProfile.bankName || '');
  const [profBusy, setProfBusy] = useState(false);

  const emailVerified = auth.currentUser?.emailVerified ?? false;
  const availableCoins = wallet?.availableCoins ?? 0;
  const lockedCoins = wallet?.lockedCoins ?? 0;
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const activePlans = useMemo(
    () => plans.filter((p) => p.isActive).sort((a, b) => a.durationDays - b.durationDays),
    [plans],
  );
  const activePackages = useMemo(
    () => packages.filter((p) => p.isActive).sort((a, b) => a.coins - b.coins),
    [packages],
  );

  const filteredTx = useMemo(() => {
    if (txFilter === 'ALL') return transactions;
    return transactions.filter((tx) => tx.type === txFilter);
  }, [transactions, txFilter]);

  const selectedTicket = useMemo(
    () => tickets.find((tk) => tk.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const selectedTicketMessages = useMemo(
    () =>
      supportMessages
        .filter((m) => m.ticketId === selectedTicketId)
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
    [supportMessages, selectedTicketId],
  );

  const showToast = (type: 'ok' | 'err', text: string) => {
    setBannerMsg({type, text});
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      try {
        await sendEmailVerification(auth.currentUser, getAuthActionCodeSettings('authAction=verified'));
      } catch (verifyErr) {
        if ((verifyErr as {code?: string})?.code === 'auth/unauthorized-continue-uri') {
          await sendEmailVerification(
            auth.currentUser,
            getAuthActionCodeSettings('authAction=verified', getActiveSiteOrigin()),
          );
        } else {
          throw verifyErr;
        }
      }
      showToast('ok', 'Verification email sent. Check your inbox.');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Unable to send email.');
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      showToast('ok', 'Email verified successfully.');
      window.location.reload();
    } else {
      showToast('err', 'Email is not verified yet. Please click the link in your inbox.');
    }
  };

  const handleInitiatePackageOrder = async (pkg: CoinPackage) => {
    if (!emailVerified || userProfile.isBlocked) return;
    if (!settings.gatewayEnabled) {
      showToast('err', 'UPI Payment Gateway is temporarily paused by administrator.');
      return;
    }

    setPayBusy(true);
    setBannerMsg(null);
    try {
      const resp = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          userId: userProfile.uid,
          packageId: pkg.id,
          coins: pkg.coins,
          amountInr: pkg.priceInr,
          upiMerchantId: settings.upiMerchantId,
          upiMerchantName: settings.upiMerchantName,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to create authorized UPI order.');
      }

      const depositId = makeSafeId('dep');
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'deposits', depositId), {
          id: depositId,
          userId: userProfile.uid,
          userEmail: userProfile.email,
          packageId: pkg.id,
          packageName: pkg.name,
          coins: pkg.coins,
          amountInr: pkg.priceInr,
          orderId: data.orderId,
          upiUri: data.upiUri,
          webhookVerified: false,
          status: 'GATEWAY_PENDING',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `deposits/${depositId}`);
      }

      setActiveOrder({
        depositId,
        orderId: data.orderId,
        packageId: pkg.id,
        packageName: pkg.name,
        coins: pkg.coins,
        amountInr: pkg.priceInr,
        upiUri: data.upiUri,
        orderToken: data.orderToken,
      });
      setUtrInput('');
      showToast(
        'ok',
        `Authorized order ${data.orderId} created. Scan QR or open UPI app and enter your 12-digit UTR.`,
      );
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Unable to start payment.');
    } finally {
      setPayBusy(false);
    }
  };

  const handleSubmitUtrWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    const cleanedUtr = utrInput.trim();
    if (!/^\d{12}$/.test(cleanedUtr)) {
      showToast(
        'err',
        'Please enter a valid 12-digit NPCI UTR number. Screenshot-only submissions are not permitted.',
      );
      return;
    }

    setPayBusy(true);
    setBannerMsg(null);
    try {
      const resp = await fetch('/api/payments/webhook', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          orderId: activeOrder.orderId,
          userId: userProfile.uid,
          packageId: activeOrder.packageId,
          amountInr: activeOrder.amountInr,
          utrNumber: cleanedUtr,
          orderToken: activeOrder.orderToken,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.verified) {
        throw new Error(data.error || 'Webhook verification rejected.');
      }

      try {
        await updateDoc(doc(db, 'deposits', activeOrder.depositId), {
          utrNumber: data.utrNumber,
          gatewayRef: data.gatewayRef,
          webhookSignature: data.webhookSignature,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `deposits/${activeOrder.depositId}`);
      }

      setActiveOrder(null);
      setUtrInput('');
      showToast(
        'ok',
        `UTR ${data.utrNumber} signed by gateway (${data.gatewayRef}). Coins will credit upon final settlement verification.`,
      );
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Payment confirmation failed.');
    } finally {
      setPayBusy(false);
    }
  };

  const handleEnrollPlan = async (plan: DayPlan) => {
    if (!emailVerified || userProfile.isBlocked || !wallet) return;
    if (wallet.availableCoins < plan.priceCoins) {
      showToast(
        'err',
        `Insufficient available Coins. Need ${plan.priceCoins} Coins; you have ${wallet.availableCoins}.`,
      );
      return;
    }

    setEnrollBusyId(plan.id);
    setBannerMsg(null);
    try {
      const enrollmentId = makeSafeId('enr');
      const txId = makeSafeId('tx');
      const endsDate = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);
      const newAvail = wallet.availableCoins - plan.priceCoins;

      const batch = writeBatch(db);
      batch.set(doc(db, 'planEnrollments', enrollmentId), {
        id: enrollmentId,
        userId: userProfile.uid,
        planId: plan.id,
        planName: plan.name,
        durationDays: plan.durationDays,
        priceCoins: plan.priceCoins,
        status: 'ACTIVE',
        endsAt: Timestamp.fromDate(endsDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'wallets', userProfile.uid), {
        availableCoins: newAvail,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: userProfile.uid,
        type: 'PLAN_ENROLL',
        amountCoins: -plan.priceCoins,
        balanceAfter: newAvail,
        referenceId: enrollmentId,
        description: `Enrolled in ${plan.name} (${plan.durationDays} Days)`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      showToast('ok', `Enrolled in ${plan.name}. Active for ${plan.durationDays} days.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'planEnrollments');
    } finally {
      setEnrollBusyId(null);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified || userProfile.isBlocked || !wallet) return;
    if (wallet.hasPendingWithdrawal) {
      showToast('err', 'You already have an active withdrawal request in queue.');
      return;
    }

    const amount = Math.floor(Number(wdAmount));
    if (!Number.isFinite(amount) || amount < settings.minWithdrawalCoins || amount > settings.maxWithdrawalCoins) {
      showToast(
        'err',
        `Withdrawal must be between ${settings.minWithdrawalCoins} and ${settings.maxWithdrawalCoins} Coins.`,
      );
      return;
    }
    if (amount > wallet.availableCoins) {
      showToast('err', 'Withdrawal exceeds your available Coin balance.');
      return;
    }
    if (wdMethod === 'UPI' && (!wdUpi.trim() || !wdUpi.includes('@'))) {
      showToast('err', 'Enter a valid UPI ID (e.g. name@okaxis).');
      return;
    }
    if (
      wdMethod === 'BANK' &&
      (!wdHolder.trim() || !wdAccNum.trim() || !wdIfsc.trim() || !wdBankName.trim())
    ) {
      showToast('err', 'Complete all bank account fields before submitting.');
      return;
    }

    setWdBusy(true);
    setBannerMsg(null);
    try {
      const wdId = makeSafeId('wd');
      const txId = makeSafeId('tx');
      const newAvail = wallet.availableCoins - amount;
      const newLocked = wallet.lockedCoins + amount;

      const batch = writeBatch(db);
      const wdPayload: Record<string, unknown> = {
        id: wdId,
        userId: userProfile.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName,
        amountCoins: amount,
        amountInr: amount,
        method: wdMethod,
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (wdMethod === 'UPI') {
        wdPayload.upiId = wdUpi.trim();
      } else {
        wdPayload.bankAccountHolder = wdHolder.trim();
        wdPayload.bankAccountNumber = wdAccNum.trim();
        wdPayload.bankIfsc = wdIfsc.trim().toUpperCase();
        wdPayload.bankName = wdBankName.trim();
      }

      batch.set(doc(db, 'withdrawals', wdId), wdPayload);
      batch.update(doc(db, 'wallets', userProfile.uid), {
        availableCoins: newAvail,
        lockedCoins: newLocked,
        hasPendingWithdrawal: true,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: userProfile.uid,
        type: 'WITHDRAWAL_LOCK',
        amountCoins: -amount,
        balanceAfter: newAvail,
        referenceId: wdId,
        description: `Locked ${amount} Coins for ${wdMethod} withdrawal`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setWdAmount('');
      showToast('ok', `Withdrawal request ${wdId} submitted. ${amount} Coins are now locked.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawals');
    } finally {
      setWdBusy(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified || !ticketSubject.trim() || !ticketInitialMsg.trim()) return;
    setSupportBusy(true);
    try {
      const ticketId = makeSafeId('tkt');
      const msgId = makeSafeId('msg');
      const batch = writeBatch(db);

      batch.set(doc(db, 'supportTickets', ticketId), {
        id: ticketId,
        userId: userProfile.uid,
        userName: userProfile.displayName,
        userEmail: userProfile.email,
        subject: ticketSubject.trim(),
        category: ticketCategory,
        priority: ticketPriority,
        status: 'OPEN',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'supportMessages', msgId), {
        id: msgId,
        ticketId,
        ticketOwnerId: userProfile.uid,
        senderId: userProfile.uid,
        senderRole: 'USER',
        senderName: userProfile.displayName,
        message: ticketInitialMsg.trim(),
        createdAt: serverTimestamp(),
      });

      await batch.commit();
      setTicketSubject('');
      setTicketInitialMsg('');
      setSelectedTicketId(ticketId);
      showToast('ok', 'Support ticket created.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supportTickets');
    } finally {
      setSupportBusy(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setSupportBusy(true);
    try {
      const msgId = makeSafeId('msg');
      await addDoc(collection(db, 'supportMessages'), {
        id: msgId,
        ticketId: selectedTicket.id,
        ticketOwnerId: userProfile.uid,
        senderId: userProfile.uid,
        senderRole: 'USER',
        senderName: userProfile.displayName,
        message: replyText.trim(),
        createdAt: serverTimestamp(),
      });
      setReplyText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'supportMessages');
    } finally {
      setSupportBusy(false);
    }
  };

  const handleCloseTicket = async (ticket: SupportTicket) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticket.id), {
        status: 'CLOSED',
        updatedAt: serverTimestamp(),
      });
      showToast('ok', 'Ticket closed.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${ticket.id}`);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified) return;
    setProfBusy(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName: profName.trim(),
        phone: profPhone.trim(),
        upiId: profUpi.trim(),
        bankAccountHolder: profHolder.trim(),
        bankAccountNumber: profAccNum.trim(),
        bankIfsc: profIfsc.trim().toUpperCase(),
        bankName: profBank.trim(),
        language: lang,
        updatedAt: serverTimestamp(),
      });
      setWdUpi(profUpi.trim());
      setWdHolder(profHolder.trim());
      setWdAccNum(profAccNum.trim());
      setWdIfsc(profIfsc.trim().toUpperCase());
      setWdBankName(profBank.trim());
      showToast('ok', 'Profile & payout preferences saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setProfBusy(false);
    }
  };

  const handleMarkNotifRead = async (n: AppNotification) => {
    if (n.read) return;
    try {
      await updateDoc(doc(db, 'notifications', n.id), {read: true});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${n.id}`);
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const navItems: Array<{id: UserTab; label: string; icon: React.ReactNode; badge?: number}> = [
    {id: 'overview', label: t(lang, 'overview'), icon: <Home className="w-4 h-4" />},
    {id: 'buy', label: t(lang, 'buyCoins'), icon: <Coins className="w-4 h-4" />},
    {id: 'plans', label: t(lang, 'plans'), icon: <CalendarClock className="w-4 h-4" />},
    {id: 'withdrawals', label: t(lang, 'withdrawals'), icon: <WalletIcon className="w-4 h-4" />},
    {id: 'transactions', label: t(lang, 'transactions'), icon: <ArrowLeftRight className="w-4 h-4" />},
    {id: 'referrals', label: t(lang, 'referrals'), icon: <Users className="w-4 h-4" />},
    {id: 'notifications', label: t(lang, 'notifications'), icon: <Bell className="w-4 h-4" />, badge: unreadNotifs},
    {id: 'support', label: t(lang, 'support'), icon: <HelpCircle className="w-4 h-4" />},
    {id: 'profile', label: t(lang, 'profile'), icon: <UserIcon className="w-4 h-4" />},
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onBackToSite}
            className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-white cursor-pointer"
          >
            MoneyCircle
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t(lang, 'userPanel')}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                activeTab === item.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span className="whitespace-nowrap">{item.label}</span>
              </span>
              {item.badge ? (
                <span className="font-mono text-xs font-semibold tabular-nums">{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {isAdmin && onSwitchToAdmin && (
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-2 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t(lang, 'adminPanel')}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {lang === 'en' ? 'हिंदी' : 'English'}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'light' ? t(lang, 'darkMode') : t(lang, 'lightMode')}</span>
            </button>
          </div>

          <PWAInstallButton label={t(lang, 'installApp')} compact />

          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar (<= 56px, well within 15% cap) */}
      <header className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-slate-700 dark:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-display font-bold text-base truncate">MoneyCircle</span>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className="p-2 -mr-2 rounded-lg text-slate-700 dark:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center relative cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifs > 0 && (
            <span className="absolute top-2 right-2 font-mono text-[10px] font-bold text-emerald-600">
              {unreadNotifs}
            </span>
          )}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col p-4 z-10 border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-lg">MoneyCircle</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium min-h-[44px] cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {isAdmin && onSwitchToAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSwitchToAdmin();
                  }}
                  className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-xs font-semibold cursor-pointer"
                >
                  {t(lang, 'adminPanel')}
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 py-2 text-xs font-medium cursor-pointer"
                >
                  {lang === 'en' ? 'हिंदी' : 'English'}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 py-2 text-xs font-medium cursor-pointer"
                >
                  {theme === 'light' ? 'Dark' : 'Light'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs font-medium text-red-600 cursor-pointer"
              >
                {t(lang, 'logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Desktop Breadcrumb & Wallet Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                MoneyCircle / {navItems.find((n) => n.id === activeTab)?.label}
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white mt-0.5">
                {userProfile.displayName}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{userProfile.email}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Code: {userProfile.referralCode}</span>
            </div>
          </div>

          {!emailVerified && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 dark:text-amber-200">
                  {t(lang, 'pendingVerificationBanner')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="px-3 py-1.5 rounded-lg border border-amber-400 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
                >
                  {t(lang, 'resendVerification')}
                </button>
                <button
                  type="button"
                  onClick={handleRefreshVerification}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer"
                >
                  {t(lang, 'refreshStatus')}
                </button>
              </div>
            </div>
          )}

          {userProfile.isBlocked && (
            <div className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-center gap-3 text-sm text-red-800 dark:text-red-200">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{t(lang, 'blockedNotice')}</span>
            </div>
          )}

          {bannerMsg && (
            <div
              className={`rounded-xl border p-4 flex items-center justify-between gap-3 text-sm ${
                bannerMsg.type === 'ok'
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200'
              }`}
            >
              <span>{bannerMsg.text}</span>
              <button
                type="button"
                onClick={() => setBannerMsg(null)}
                className="p-1 rounded hover:bg-black/5 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, 'availableCoins')}
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {availableCoins.toLocaleString('en-IN')}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    ≈ ₹{availableCoins.toLocaleString('en-IN')}.00 INR
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, 'lockedCoins')}
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {lockedCoins.toLocaleString('en-IN')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {wallet?.hasPendingWithdrawal ? 'Pending payout review' : 'No pending lock'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, 'totalPurchased')}
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {(wallet?.totalPurchased ?? 0).toLocaleString('en-IN')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Verified UPI deposits
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {t(lang, 'totalWithdrawn')}
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {(wallet?.totalWithdrawn ?? 0).toLocaleString('en-IN')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Settled payouts
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold">
                      {lang === 'hi' ? 'हाल के लेन-देन' : 'Recent Wallet Activity'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {lang === 'hi' ? 'सभी देखें' : 'View Full Ledger'}
                    </button>
                  </div>
                  {transactions.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-6">
                      {t(lang, 'noRecords')}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.slice(0, 6).map((tx) => (
                        <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {tx.description}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {tx.type} · {tx.createdAt?.toDate?.()?.toLocaleDateString() || 'Pending'}
                            </div>
                          </div>
                          <div
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              tx.amountCoins >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {tx.amountCoins >= 0 ? `+${tx.amountCoins}` : tx.amountCoins} Coins
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold">
                      {lang === 'hi' ? 'सक्रिय डे सर्कल' : 'Active Day Circles'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('plans')}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {lang === 'hi' ? 'प्लान चुनें' : 'Browse Plans'}
                    </button>
                  </div>

                  {enrollments.length === 0 ? (
                    <div className="py-4 text-sm text-slate-500 dark:text-slate-400">
                      No active circle enrollments yet. Visit Day Plans or Buy Coins to begin.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {enrollments.slice(0, 4).map((enr) => (
                        <div
                          key={enr.id}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold">{enr.planName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {enr.durationDays} Days · Ends{' '}
                              {enr.endsAt?.toDate?.()?.toLocaleDateString() || 'Scheduled'}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {enr.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('buy')}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-semibold cursor-pointer"
                    >
                      {t(lang, 'buyCoins')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('withdrawals')}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {t(lang, 'withdrawals')}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB: BUY COINS & UPI PAYMENT */}
          {activeTab === 'buy' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold">
                      {lang === 'hi' ? 'कॉइन पैकेज चुनें (1 कॉइन = ₹1)' : 'Select Coin Package (1 Coin = ₹1)'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Gateway: {settings.gatewayProvider} · Verified via server-side HMAC webhook & 12-digit UTR. Screenshots alone are never credited.
                    </p>
                  </div>
                  <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    Merchant UPI: {settings.upiMerchantId}
                  </div>
                </div>

                {activePackages.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6">
                    No active Coin packages configured yet. An administrator can initialize packages in the Admin Console.
                  </p>
                ) : (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activePackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {pkg.name}
                          </div>
                          <div className="mt-2 font-mono text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                            {pkg.coins.toLocaleString('en-IN')} Coins
                          </div>
                          <div className="mt-1 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            ₹{pkg.priceInr.toLocaleString('en-IN')}.00 INR
                          </div>
                          {pkg.tagline && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{pkg.tagline}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={payBusy || !emailVerified || userProfile.isBlocked}
                          onClick={() => handleInitiatePackageOrder(pkg)}
                          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Pay ₹{pkg.priceInr} via UPI</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Dynamic UPI QR & UTR Webhook Verification Box */}
              {activeOrder && (
                <div className="rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-900 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-slate-200">
                    <QRCodeSVG value={activeOrder.upiUri} size={196} level="M" includeMargin />
                    <span className="mt-2 font-mono text-xs text-slate-700 font-semibold">
                      ₹{activeOrder.amountInr}.00 · {activeOrder.coins} Coins
                    </span>
                  </div>

                  <div className="lg:col-span-8 space-y-4">
                    <div>
                      <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                        Order ID: {activeOrder.orderId}
                      </div>
                      <h3 className="font-display text-lg font-bold mt-1">
                        Complete UPI Payment & Verify UTR
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                        Scan the dynamic QR code with any UPI app (GPay, PhonePe, Paytm, BHIM) or tap Open UPI App on mobile. Then enter your 12-digit NPCI UTR number for server-side webhook signing.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <a
                        href={activeOrder.upiUri}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open UPI App</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(settings.upiMerchantId);
                          showToast('ok', `Copied UPI ID: ${settings.upiMerchantId}`);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy UPI ID ({settings.upiMerchantId})</span>
                      </button>
                    </div>

                    <form onSubmit={handleSubmitUtrWebhook} className="flex flex-col sm:flex-row gap-3 pt-2">
                      <input
                        type="text"
                        required
                        pattern="\d{12}"
                        maxLength={12}
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 12-digit UTR (e.g. 412345678901)"
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="submit"
                        disabled={payBusy}
                        className="rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {payBusy ? 'Verifying...' : 'Verify Payment UTR'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Deposit History Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-base font-bold">Payment & Deposit History</h3>
                </div>
                {deposits.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Package</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">UTR / Gateway Ref</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {deposits.map((dep) => (
                          <tr key={dep.id}>
                            <td className="py-3 px-4 font-mono text-xs">{dep.orderId}</td>
                            <td className="py-3 px-4">{dep.packageName}</td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {dep.coins} Coins (₹{dep.amountInr})
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                              {dep.utrNumber ? `${dep.utrNumber} · ${dep.gatewayRef || ''}` : 'Awaiting UTR'}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">
                              <span
                                className={
                                  dep.status === 'VERIFIED'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : dep.status === 'REJECTED'
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                }
                              >
                                {dep.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: DAY CIRCLE PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Compliance Notice:</strong> {settings.complianceNotice}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {plan.durationDays} Days
                        </span>
                        <span>Available: {availableCoins} Coins</span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-bold">
                        {lang === 'hi' && plan.nameHi ? plan.nameHi : plan.name}
                      </h3>
                      <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
                        {plan.priceCoins} Coins
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {lang === 'hi' && plan.descriptionHi ? plan.descriptionHi : plan.description}
                      </p>
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                        <div>
                          <strong>Eligibility:</strong> {plan.eligibility}
                        </div>
                        <div>
                          <strong>Terms:</strong> {plan.terms}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        enrollBusyId === plan.id ||
                        !emailVerified ||
                        userProfile.isBlocked ||
                        availableCoins < plan.priceCoins
                      }
                      onClick={() => handleEnrollPlan(plan)}
                      className="mt-4 w-full rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white py-2.5 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {enrollBusyId === plan.id
                        ? 'Enrolling...'
                        : availableCoins < plan.priceCoins
                          ? `Need ${plan.priceCoins} Coins`
                          : `Enroll Now (${plan.priceCoins} Coins)`}
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-base font-bold">My Circle Enrollments</h3>
                </div>
                {enrollments.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {enrollments.map((enr) => (
                      <div key={enr.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm">
                        <div>
                          <div className="font-semibold">{enr.planName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {enr.durationDays} Days · Price {enr.priceCoins} Coins · Ends{' '}
                            {enr.endsAt?.toDate?.()?.toLocaleDateString() || ''}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {enr.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-display text-lg font-bold">Request Withdrawal</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Min: {settings.minWithdrawalCoins} Coins · Max: {settings.maxWithdrawalCoins} Coins · Available: {availableCoins} Coins
                </p>

                <form onSubmit={handleWithdrawalSubmit} className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setWdMethod('UPI')}
                      className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                        wdMethod === 'UPI'
                          ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      UPI Payout
                    </button>
                    <button
                      type="button"
                      onClick={() => setWdMethod('BANK')}
                      className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                        wdMethod === 'BANK'
                          ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Bank Transfer
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Withdrawal Amount (Coins / ₹)</label>
                    <input
                      type="number"
                      required
                      min={settings.minWithdrawalCoins}
                      max={settings.maxWithdrawalCoins}
                      value={wdAmount}
                      onChange={(e) => setWdAmount(e.target.value)}
                      placeholder={`${settings.minWithdrawalCoins}`}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono tabular-nums"
                    />
                  </div>

                  {wdMethod === 'UPI' ? (
                    <div>
                      <label className="block text-xs font-medium mb-1">Beneficiary UPI ID</label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={wdUpi}
                        onChange={(e) => setWdUpi(e.target.value)}
                        placeholder="yourname@okaxis"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={wdHolder}
                        onChange={(e) => setWdHolder(e.target.value)}
                        placeholder="Account Holder Name"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                      />
                      <input
                        type="text"
                        required
                        maxLength={34}
                        value={wdAccNum}
                        onChange={(e) => setWdAccNum(e.target.value)}
                        placeholder="Bank Account Number"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          maxLength={16}
                          value={wdIfsc}
                          onChange={(e) => setWdIfsc(e.target.value.toUpperCase())}
                          placeholder="IFSC Code"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono uppercase"
                        />
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={wdBankName}
                          onChange={(e) => setWdBankName(e.target.value)}
                          placeholder="Bank Name"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      wdBusy ||
                      !emailVerified ||
                      userProfile.isBlocked ||
                      Boolean(wallet?.hasPendingWithdrawal)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {wallet?.hasPendingWithdrawal
                        ? 'Active Withdrawal Pending'
                        : wdBusy
                          ? 'Locking Balance...'
                          : t(lang, 'submitWithdrawal')}
                    </span>
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-base font-bold">Withdrawal History</h3>
                </div>
                {withdrawals.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <th className="py-3 px-4">Method & Destination</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Reference / Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {withdrawals.map((wd) => (
                          <tr key={wd.id}>
                            <td className="py-3 px-4">
                              <div className="font-medium">{wd.method}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                {wd.method === 'UPI' ? wd.upiId : `${wd.bankName} · ${wd.bankAccountNumber}`}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                              {wd.amountCoins} Coins (₹{wd.amountInr})
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">
                              <span
                                className={
                                  wd.status === 'PAID'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : wd.status === 'REJECTED'
                                      ? 'text-red-600 dark:text-red-400'
                                      : wd.status === 'APPROVED'
                                        ? 'text-sky-600 dark:text-sky-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                }
                              >
                                {wd.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {wd.payoutReference || wd.adminNote || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold">Coin Transaction Ledger</h2>
                <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {['ALL', 'DEPOSIT', 'PLAN_ENROLL', 'WITHDRAWAL_LOCK', 'WITHDRAWAL_PAID', 'REFERRAL_REWARD'].map(
                    (f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTxFilter(f)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                          txFilter === f
                            ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {f.replace('_', ' ')}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {filteredTx.length === 0 ? (
                <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-right">Balance After</th>
                        <th className="py-3 px-4 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTx.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-3 px-4 font-mono text-xs">{tx.type}</td>
                          <td className="py-3 px-4">{tx.description}</td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-semibold tabular-nums ${
                              tx.amountCoins >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {tx.amountCoins >= 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <ArrowDownLeft className="w-3.5 h-3.5" />+{tx.amountCoins}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                {tx.amountCoins}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {tx.balanceAfter}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-slate-500 dark:text-slate-400">
                            {tx.createdAt?.toDate?.()?.toLocaleString() || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: REFERRALS */}
          {activeTab === 'referrals' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold">Member Referral Program</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Share your referral code or invite link below. Verified referrals earn {settings.referralBonusCoins} bonus Coins once approved.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 font-mono text-sm font-bold">
                      {userProfile.referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(userProfile.referralCode);
                        showToast('ok', `Referral code ${userProfile.referralCode} copied!`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                    {buildReferralLink(userProfile.referralCode)}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const link = buildReferralLink(userProfile.referralCode);
                        navigator.clipboard?.writeText(link);
                        showToast('ok', 'Referral invite link copied!');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const shareUrl = buildReferralLink(userProfile.referralCode);
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: 'Join MoneyCircle',
                              text: `Join MoneyCircle using my referral code ${userProfile.referralCode}`,
                              url: shareUrl,
                            });
                            return;
                          } catch {
                            // User cancelled or share unavailable; fallback to copy
                          }
                        }
                        navigator.clipboard?.writeText(shareUrl);
                        showToast('ok', 'Share link copied to clipboard!');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display text-base font-bold">Referred Members ({referrals.length})</h3>
                </div>
                {referrals.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {referrals.map((ref) => (
                      <div key={ref.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{ref.referredEmail}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            Code: {ref.referralCode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {ref.status} · {ref.rewardCoins} Coins
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">Notifications</h2>
              </div>
              {notifications.length === 0 ? (
                <p className="p-5 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkNotifRead(n)}
                      className={`px-5 py-4 flex items-start justify-between gap-4 cursor-pointer ${
                        !n.read ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-2">
                          <span>{n.title}</span>
                          {!n.read && (
                            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {n.category} · {n.createdAt?.toDate?.()?.toLocaleString() || ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotif(n.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        aria-label="Delete notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: HELP DESK & SUPPORT TICKETS */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <h2 className="font-display text-base font-bold">Open Support Ticket</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {settings.supportEmail} · {settings.supportHours}
                  </p>
                  <form onSubmit={handleCreateTicket} className="mt-4 space-y-3">
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={160}
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="Ticket subject"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value as SupportTicket['category'])}
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
                      >
                        <option value="PAYMENT">Payment / UPI</option>
                        <option value="WITHDRAWAL">Withdrawal</option>
                        <option value="PLAN">Day Circle Plan</option>
                        <option value="ACCOUNT">Account</option>
                        <option value="GENERAL">General</option>
                      </select>
                      <select
                        value={ticketPriority}
                        onChange={(e) => setTicketPriority(e.target.value as SupportTicket['priority'])}
                        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium"
                      >
                        <option value="LOW">Low Priority</option>
                        <option value="MEDIUM">Medium Priority</option>
                        <option value="HIGH">High Priority</option>
                      </select>
                    </div>
                    <textarea
                      required
                      rows={3}
                      maxLength={1500}
                      value={ticketInitialMsg}
                      onChange={(e) => setTicketInitialMsg(e.target.value)}
                      placeholder="Describe your issue (include Order ID or UTR if applicable)..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={supportBusy || !emailVerified}
                      className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {supportBusy ? 'Submitting...' : 'Submit Support Ticket'}
                    </button>
                  </form>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-sm font-bold">
                    My Tickets ({tickets.length})
                  </div>
                  {tickets.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">{t(lang, 'noRecords')}</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {tickets.map((tk) => (
                        <button
                          key={tk.id}
                          type="button"
                          onClick={() => setSelectedTicketId(tk.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer ${
                            selectedTicketId === tk.id ? 'bg-slate-100 dark:bg-slate-800' : ''
                          }`}
                        >
                          <div className="text-sm font-semibold truncate">{tk.subject}</div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                            <span>
                              {tk.category} · {tk.priority}
                            </span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {tk.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[420px]">
                {!selectedTicket ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-sm">
                    <HelpCircle className="w-8 h-8 mb-2 text-slate-400" />
                    Select a support ticket on the left or create a new ticket to chat with the Help Desk.
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-base">{selectedTicket.subject}</h3>
                        <div className="text-xs text-slate-500">
                          {selectedTicket.category} · Status: {selectedTicket.status}
                        </div>
                      </div>
                      {selectedTicket.status !== 'CLOSED' && (
                        <button
                          type="button"
                          onClick={() => handleCloseTicket(selectedTicket)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>

                    <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[360px]">
                      {selectedTicketMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl p-3.5 max-w-[85%] text-sm ${
                            m.senderRole === 'USER'
                              ? 'ml-auto bg-emerald-600 text-white'
                              : 'mr-auto bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          <div className="text-[11px] opacity-80 mb-1 font-medium">
                            {m.senderName} ({m.senderRole})
                          </div>
                          <div className="whitespace-pre-wrap">{m.message}</div>
                        </div>
                      ))}
                    </div>

                    {selectedTicket.status !== 'CLOSED' && (
                      <form
                        onSubmit={handleSendReply}
                        className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2"
                      >
                        <input
                          type="text"
                          required
                          maxLength={1500}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write a reply..."
                          className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={supportBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send</span>
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: PROFILE & PAYOUT SETTINGS */}
          {activeTab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Profile & Payout Preferences</h2>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Phone Number</label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Saved UPI ID</label>
                <input
                  type="text"
                  maxLength={100}
                  value={profUpi}
                  onChange={(e) => setProfUpi(e.target.value)}
                  placeholder="username@okaxis"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500 mb-3">Bank Account Details</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    maxLength={100}
                    value={profHolder}
                    onChange={(e) => setProfHolder(e.target.value)}
                    placeholder="Account Holder Name"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                  <input
                    type="text"
                    maxLength={34}
                    value={profAccNum}
                    onChange={(e) => setProfAccNum(e.target.value)}
                    placeholder="Account Number"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                  />
                  <input
                    type="text"
                    maxLength={16}
                    value={profIfsc}
                    onChange={(e) => setProfIfsc(e.target.value.toUpperCase())}
                    placeholder="IFSC Code"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono uppercase"
                  />
                  <input
                    type="text"
                    maxLength={100}
                    value={profBank}
                    onChange={(e) => setProfBank(e.target.value)}
                    placeholder="Bank Name"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={profBusy || !emailVerified}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {profBusy ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (Thumb Zone) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center">
        {[
          {id: 'overview' as UserTab, label: t(lang, 'overview'), icon: <Home className="w-5 h-5" />},
          {id: 'buy' as UserTab, label: t(lang, 'buyCoins'), icon: <Coins className="w-5 h-5" />},
          {id: 'withdrawals' as UserTab, label: t(lang, 'withdrawals'), icon: <WalletIcon className="w-5 h-5" />},
          {id: 'support' as UserTab, label: t(lang, 'support'), icon: <HelpCircle className="w-5 h-5" />},
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] cursor-pointer ${
              activeTab === tab.id
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium mt-1 truncate max-w-[72px]">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

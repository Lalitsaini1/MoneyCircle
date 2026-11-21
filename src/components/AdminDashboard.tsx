import React, {useMemo, useState} from 'react';
import {signOut} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  Activity,
  Ban,
  CalendarClock,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  RefreshCw,
  Search,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import {auth, db, handleFirestoreError, makeSafeId, OperationType} from '../lib/firebase';
import {t} from '../lib/i18n';
import {seedPlatformCatalogIfEmpty} from '../lib/seedData';
import type {
  AdminRecord,
  AuditLog,
  CoinPackage,
  CoinTransaction,
  DayPlan,
  Deposit,
  Language,
  PlatformSettings,
  Referral,
  SupportMessage,
  SupportTicket,
  ThemeMode,
  UserProfile,
  Wallet,
  Withdrawal,
} from '../types/models';

export type AdminTab =
  | 'overview'
  | 'users'
  | 'deposits'
  | 'withdrawals'
  | 'plans'
  | 'packages'
  | 'referrals'
  | 'support'
  | 'transactions'
  | 'settings'
  | 'audit';

interface AdminDashboardProps {
  lang: Language;
  setLang: (l: Language) => void;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  currentAdmin: UserProfile;
  users: UserProfile[];
  admins: AdminRecord[];
  wallets: Wallet[];
  plans: DayPlan[];
  packages: CoinPackage[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  transactions: CoinTransaction[];
  referrals: Referral[];
  tickets: SupportTicket[];
  supportMessages: SupportMessage[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
  onSwitchToUser: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  currentAdmin,
  users,
  admins,
  wallets,
  plans,
  packages,
  deposits,
  withdrawals,
  transactions,
  referrals,
  tickets,
  supportMessages,
  auditLogs,
  settings,
  onSwitchToUser,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<{type: 'ok' | 'err'; text: string} | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Plan editor state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [planNameHi, setPlanNameHi] = useState('');
  const [planDuration, setPlanDuration] = useState<5 | 7 | 10 | 15 | 25>(5);
  const [planPrice, setPlanPrice] = useState('100');
  const [planReward, setPlanReward] = useState('15');
  const [planDesc, setPlanDesc] = useState('');
  const [planTerms, setPlanTerms] = useState('');
  const [planElig, setPlanElig] = useState('');

  // Package editor state
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgName, setPkgName] = useState('');
  const [pkgCoins, setPkgCoins] = useState('100');
  const [pkgTagline, setPkgTagline] = useState('');

  // Payout ref map for withdrawals
  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});
  const [sigCheckMap, setSigCheckMap] = useState<Record<string, 'VALID' | 'INVALID' | 'NONE'>>({});

  // Support reply state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminReply, setAdminReply] = useState('');

  // Settings editor state
  const [setForm, setSetForm] = useState({
    siteName: settings.siteName,
    upiMerchantId: settings.upiMerchantId,
    upiMerchantName: settings.upiMerchantName,
    gatewayProvider: settings.gatewayProvider,
    gatewayEnabled: settings.gatewayEnabled,
    minWithdrawalCoins: String(settings.minWithdrawalCoins),
    maxWithdrawalCoins: String(settings.maxWithdrawalCoins),
    referralBonusCoins: String(settings.referralBonusCoins),
    supportEmail: settings.supportEmail,
    supportHours: settings.supportHours || '',
    complianceNotice: settings.complianceNotice || '',
  });

  React.useEffect(() => {
    setSetForm({
      siteName: settings.siteName,
      upiMerchantId: settings.upiMerchantId,
      upiMerchantName: settings.upiMerchantName,
      gatewayProvider: settings.gatewayProvider,
      gatewayEnabled: settings.gatewayEnabled,
      minWithdrawalCoins: String(settings.minWithdrawalCoins),
      maxWithdrawalCoins: String(settings.maxWithdrawalCoins),
      referralBonusCoins: String(settings.referralBonusCoins),
      supportEmail: settings.supportEmail,
      supportHours: settings.supportHours || '',
      complianceNotice: settings.complianceNotice || '',
    });
  }, [settings]);

  const walletByUser = useMemo(() => {
    const map = new Map<string, Wallet>();
    for (const w of wallets) map.set(w.userId, w);
    return map;
  }, [wallets]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => !u.isBlocked).length;
    const totalAvailable = wallets.reduce((acc, w) => acc + (w.availableCoins || 0), 0);
    const totalLocked = wallets.reduce((acc, w) => acc + (w.lockedCoins || 0), 0);
    const pendingDeposits = deposits.filter((d) => d.status === 'GATEWAY_PENDING').length;
    const verifiedDepositInr = deposits
      .filter((d) => d.status === 'VERIFIED')
      .reduce((acc, d) => acc + d.amountInr, 0);
    const pendingWithdrawals = withdrawals.filter(
      (w) => w.status === 'PENDING' || w.status === 'APPROVED',
    ).length;
    const paidWithdrawalInr = withdrawals
      .filter((w) => w.status === 'PAID')
      .reduce((acc, w) => acc + w.amountInr, 0);
    const openTickets = tickets.filter((tk) => tk.status !== 'CLOSED' && tk.status !== 'RESOLVED').length;

    return {
      totalUsers,
      activeUsers,
      totalAvailable,
      totalLocked,
      pendingDeposits,
      verifiedDepositInr,
      pendingWithdrawals,
      paidWithdrawalInr,
      openTickets,
    };
  }, [users, wallets, deposits, withdrawals, tickets]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.referralCode.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const selectedTicket = useMemo(
    () => tickets.find((tk) => tk.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const selectedMessages = useMemo(
    () =>
      supportMessages
        .filter((m) => m.ticketId === selectedTicketId)
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)),
    [supportMessages, selectedTicketId],
  );

  const showNotice = (type: 'ok' | 'err', text: string) => setToast({type, text});

  const writeAudit = (
    batch: ReturnType<typeof writeBatch>,
    action: string,
    targetCollection: string,
    targetId: string,
    details: string,
  ) => {
    const logId = makeSafeId('aud');
    batch.set(doc(db, 'auditLogs', logId), {
      id: logId,
      actorId: currentAdmin.uid,
      actorEmail: currentAdmin.email,
      action,
      targetCollection,
      targetId,
      details: details.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  };

  const handleToggleBlockUser = async (u: UserProfile) => {
    if (u.uid === currentAdmin.uid) {
      showNotice('err', 'You cannot block your own active admin account.');
      return;
    }
    setBusyId(u.uid);
    try {
      const nextBlocked = !u.isBlocked;
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', u.uid), {
        isBlocked: nextBlocked,
        updatedAt: serverTimestamp(),
      });
      const notifId = makeSafeId('ntf');
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: u.uid,
        title: nextBlocked ? 'Account Restricted' : 'Account Restored',
        message: nextBlocked
          ? 'Your MoneyCircle account has been temporarily restricted by an administrator.'
          : 'Your MoneyCircle account access has been restored.',
        category: 'SYSTEM',
        read: false,
        createdAt: serverTimestamp(),
      });
      writeAudit(
        batch,
        nextBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
        'users',
        u.uid,
        `${nextBlocked ? 'Blocked' : 'Unblocked'} user ${u.email}`,
      );
      await batch.commit();
      showNotice('ok', `${u.email} ${nextBlocked ? 'blocked' : 'unblocked'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAdminRole = async (u: UserProfile) => {
    const existingAdmin = admins.find((a) => a.uid === u.uid);
    if (u.uid === currentAdmin.uid) {
      showNotice('err', 'Cannot modify your own admin record.');
      return;
    }
    setBusyId(`adm_${u.uid}`);
    try {
      if (existingAdmin) {
        await deleteDoc(doc(db, 'admins', u.uid));
        showNotice('ok', `Removed admin privileges from ${u.email}.`);
      } else {
        await setDoc(doc(db, 'admins', u.uid), {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          grantedBy: currentAdmin.uid,
          createdAt: serverTimestamp(),
        });
        showNotice('ok', `Granted admin privileges to ${u.email}.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${u.uid}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckWebhookSignature = async (dep: Deposit) => {
    if (!dep.utrNumber || !dep.webhookSignature) {
      setSigCheckMap((prev) => ({...prev, [dep.id]: 'NONE'}));
      showNotice('err', 'No UTR or server webhook signature attached to this deposit.');
      return;
    }
    try {
      const resp = await fetch('/api/payments/verify-signature', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          orderId: dep.orderId,
          utrNumber: dep.utrNumber,
          amountInr: dep.amountInr,
          webhookSignature: dep.webhookSignature,
        }),
      });
      const data = await resp.json();
      setSigCheckMap((prev) => ({...prev, [dep.id]: data.valid ? 'VALID' : 'INVALID'}));
      showNotice(
        data.valid ? 'ok' : 'err',
        data.valid
          ? `Server HMAC-SHA256 signature verified for UTR ${dep.utrNumber}.`
          : 'Signature mismatch or invalid webhook receipt.',
      );
    } catch {
      showNotice('err', 'Failed to reach verification endpoint.');
    }
  };

  const handleVerifyCreditDeposit = async (dep: Deposit) => {
    if (dep.status !== 'GATEWAY_PENDING') return;
    if (!dep.utrNumber || !/^\d{12}$/.test(dep.utrNumber)) {
      showNotice('err', 'Cannot credit deposit without a verified 12-digit UTR number.');
      return;
    }
    setBusyId(dep.id);
    try {
      const walletRef = doc(db, 'wallets', dep.userId);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) {
        throw new Error('User wallet not initialized.');
      }
      const wData = walletSnap.data() as Wallet;
      const newAvail = (wData.availableCoins || 0) + dep.coins;
      const newPurchased = (wData.totalPurchased || 0) + dep.coins;

      const batch = writeBatch(db);
      batch.update(doc(db, 'deposits', dep.id), {
        status: 'VERIFIED',
        webhookVerified: true,
        adminNote: `Verified by ${currentAdmin.email}`,
        updatedAt: serverTimestamp(),
      });
      batch.update(walletRef, {
        availableCoins: newAvail,
        totalPurchased: newPurchased,
        updatedAt: serverTimestamp(),
      });

      const txId = makeSafeId('tx');
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: dep.userId,
        type: 'DEPOSIT',
        amountCoins: dep.coins,
        balanceAfter: newAvail,
        referenceId: dep.id,
        description: `UPI Deposit Verified (${dep.orderId} · UTR ${dep.utrNumber})`,
        createdAt: serverTimestamp(),
      });

      const ntfId = makeSafeId('ntf');
      batch.set(doc(db, 'notifications', ntfId), {
        id: ntfId,
        userId: dep.userId,
        title: `${dep.coins} Coins Credited`,
        message: `Your UPI deposit ${dep.orderId} (UTR ${dep.utrNumber}) has been verified and credited.`,
        category: 'PAYMENT',
        read: false,
        createdAt: serverTimestamp(),
      });

      writeAudit(
        batch,
        'VERIFY_DEPOSIT',
        'deposits',
        dep.id,
        `Credited ${dep.coins} Coins to ${dep.userEmail} for UTR ${dep.utrNumber}`,
      );

      await batch.commit();
      showNotice('ok', `Verified ${dep.orderId} and credited ${dep.coins} Coins.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `deposits/${dep.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectDeposit = async (dep: Deposit) => {
    if (dep.status !== 'GATEWAY_PENDING') return;
    setBusyId(dep.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'deposits', dep.id), {
        status: 'REJECTED',
        adminNote: 'Rejected: UTR could not be reconciled.',
        updatedAt: serverTimestamp(),
      });
      const ntfId = makeSafeId('ntf');
      batch.set(doc(db, 'notifications', ntfId), {
        id: ntfId,
        userId: dep.userId,
        title: 'Deposit Rejected',
        message: `Deposit ${dep.orderId} was rejected. Contact Help Desk with bank UTR details if needed.`,
        category: 'PAYMENT',
        read: false,
        createdAt: serverTimestamp(),
      });
      writeAudit(batch, 'REJECT_DEPOSIT', 'deposits', dep.id, `Rejected deposit ${dep.orderId}`);
      await batch.commit();
      showNotice('ok', `Deposit ${dep.orderId} rejected.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `deposits/${dep.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdrawalAction = async (
    wd: Withdrawal,
    action: 'APPROVED' | 'REJECTED' | 'PAID',
  ) => {
    setBusyId(wd.id);
    try {
      const walletRef = doc(db, 'wallets', wd.userId);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) throw new Error('User wallet missing.');
      const wData = walletSnap.data() as Wallet;

      const batch = writeBatch(db);

      if (action === 'APPROVED') {
        batch.update(doc(db, 'withdrawals', wd.id), {
          status: 'APPROVED',
          adminNote: `Approved by ${currentAdmin.email}`,
          updatedAt: serverTimestamp(),
        });
        const ntfId = makeSafeId('ntf');
        batch.set(doc(db, 'notifications', ntfId), {
          id: ntfId,
          userId: wd.userId,
          title: 'Withdrawal Approved',
          message: `Your withdrawal of ${wd.amountCoins} Coins (₹${wd.amountInr}) is approved and queued for payout.`,
          category: 'WITHDRAWAL',
          read: false,
          createdAt: serverTimestamp(),
        });
        writeAudit(batch, 'APPROVE_WITHDRAWAL', 'withdrawals', wd.id, `Approved ${wd.amountCoins} Coins for ${wd.userEmail}`);
      } else if (action === 'REJECTED') {
        const nextAvail = (wData.availableCoins || 0) + wd.amountCoins;
        const nextLocked = Math.max(0, (wData.lockedCoins || 0) - wd.amountCoins);
        batch.update(doc(db, 'withdrawals', wd.id), {
          status: 'REJECTED',
          adminNote: 'Rejected and refunded to available Coins.',
          updatedAt: serverTimestamp(),
        });
        batch.update(walletRef, {
          availableCoins: nextAvail,
          lockedCoins: nextLocked,
          hasPendingWithdrawal: false,
          updatedAt: serverTimestamp(),
        });
        const txId = makeSafeId('tx');
        batch.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: wd.userId,
          type: 'WITHDRAWAL_REFUND',
          amountCoins: wd.amountCoins,
          balanceAfter: nextAvail,
          referenceId: wd.id,
          description: `Withdrawal rejected — ${wd.amountCoins} Coins unlocked`,
          createdAt: serverTimestamp(),
        });
        const ntfId = makeSafeId('ntf');
        batch.set(doc(db, 'notifications', ntfId), {
          id: ntfId,
          userId: wd.userId,
          title: 'Withdrawal Rejected & Refunded',
          message: `${wd.amountCoins} Coins have been returned to your Available balance.`,
          category: 'WITHDRAWAL',
          read: false,
          createdAt: serverTimestamp(),
        });
        writeAudit(batch, 'REJECT_WITHDRAWAL', 'withdrawals', wd.id, `Rejected & refunded ${wd.amountCoins} Coins`);
      } else if (action === 'PAID') {
        const ref = (payoutRefs[wd.id] || `PAYOUT-${Date.now()}`).trim();
        const nextLocked = Math.max(0, (wData.lockedCoins || 0) - wd.amountCoins);
        const nextWithdrawn = (wData.totalWithdrawn || 0) + wd.amountCoins;
        batch.update(doc(db, 'withdrawals', wd.id), {
          status: 'PAID',
          payoutReference: ref,
          adminNote: `Settled by ${currentAdmin.email}`,
          updatedAt: serverTimestamp(),
        });
        batch.update(walletRef, {
          lockedCoins: nextLocked,
          totalWithdrawn: nextWithdrawn,
          hasPendingWithdrawal: false,
          updatedAt: serverTimestamp(),
        });
        const txId = makeSafeId('tx');
        batch.set(doc(db, 'transactions', txId), {
          id: txId,
          userId: wd.userId,
          type: 'WITHDRAWAL_PAID',
          amountCoins: 0,
          balanceAfter: wData.availableCoins || 0,
          referenceId: wd.id,
          description: `Withdrawal Paid (${wd.amountCoins} Coins · Ref ${ref})`,
          createdAt: serverTimestamp(),
        });
        const ntfId = makeSafeId('ntf');
        batch.set(doc(db, 'notifications', ntfId), {
          id: ntfId,
          userId: wd.userId,
          title: 'Withdrawal Paid',
          message: `₹${wd.amountInr} settled via ${wd.method} (Ref: ${ref}).`,
          category: 'WITHDRAWAL',
          read: false,
          createdAt: serverTimestamp(),
        });
        writeAudit(batch, 'MARK_WITHDRAWAL_PAID', 'withdrawals', wd.id, `Paid ${wd.amountCoins} Coins Ref ${ref}`);
      }

      await batch.commit();
      showNotice('ok', `Withdrawal ${wd.id} updated to ${action}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `withdrawals/${wd.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingPlanId || makeSafeId('plan');
    const price = Math.max(1, Math.floor(Number(planPrice)));
    const reward = Math.max(0, Math.floor(Number(planReward)));
    setBusyId('plan_save');
    try {
      const batch = writeBatch(db);
      if (editingPlanId) {
        batch.update(doc(db, 'plans', id), {
          name: planName.trim(),
          nameHi: planNameHi.trim() || planName.trim(),
          durationDays: planDuration,
          priceCoins: price,
          rewardCoins: reward,
          description: planDesc.trim(),
          terms: planTerms.trim(),
          eligibility: planElig.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(doc(db, 'plans', id), {
          id,
          name: planName.trim(),
          nameHi: planNameHi.trim() || planName.trim(),
          durationDays: planDuration,
          priceCoins: price,
          rewardCoins: reward,
          description: planDesc.trim(),
          terms: planTerms.trim(),
          eligibility: planElig.trim(),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      writeAudit(batch, editingPlanId ? 'UPDATE_PLAN' : 'CREATE_PLAN', 'plans', id, `${planName} (${planDuration}d)`);
      await batch.commit();
      setEditingPlanId(null);
      setPlanName('');
      setPlanNameHi('');
      setPlanDesc('');
      setPlanTerms('');
      setPlanElig('');
      showNotice('ok', 'Day Circle Plan saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `plans/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePlanActive = async (p: DayPlan) => {
    try {
      await updateDoc(doc(db, 'plans', p.id), {
        isActive: !p.isActive,
        updatedAt: serverTimestamp(),
      });
      showNotice('ok', `${p.name} ${p.isActive ? 'deactivated' : 'activated'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `plans/${p.id}`);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'plans', id));
      showNotice('ok', 'Plan deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plans/${id}`);
    }
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingPkgId || makeSafeId('pkg');
    const coins = Math.max(1, Math.floor(Number(pkgCoins)));
    setBusyId('pkg_save');
    try {
      if (editingPkgId) {
        await updateDoc(doc(db, 'coinPackages', id), {
          name: pkgName.trim(),
          coins,
          priceInr: coins,
          tagline: pkgTagline.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'coinPackages', id), {
          id,
          name: pkgName.trim(),
          coins,
          priceInr: coins,
          tagline: pkgTagline.trim(),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setEditingPkgId(null);
      setPkgName('');
      setPkgCoins('100');
      setPkgTagline('');
      showNotice('ok', 'Coin package saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coinPackages/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreditReferral = async (ref: Referral) => {
    if (ref.status === 'CREDITED') return;
    setBusyId(ref.id);
    try {
      const walletRef = doc(db, 'wallets', ref.referrerId);
      const wSnap = await getDoc(walletRef);
      if (!wSnap.exists()) throw new Error('Referrer wallet missing.');
      const wData = wSnap.data() as Wallet;
      const bonus = ref.rewardCoins || settings.referralBonusCoins || 25;
      const nextAvail = (wData.availableCoins || 0) + bonus;

      const batch = writeBatch(db);
      batch.update(doc(db, 'referrals', ref.id), {status: 'CREDITED', rewardCoins: bonus});
      batch.update(walletRef, {availableCoins: nextAvail, updatedAt: serverTimestamp()});
      const txId = makeSafeId('tx');
      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        userId: ref.referrerId,
        type: 'REFERRAL_REWARD',
        amountCoins: bonus,
        balanceAfter: nextAvail,
        referenceId: ref.id,
        description: `Referral reward credited for ${ref.referredEmail}`,
        createdAt: serverTimestamp(),
      });
      writeAudit(batch, 'CREDIT_REFERRAL', 'referrals', ref.id, `Credited ${bonus} Coins`);
      await batch.commit();
      showNotice('ok', `Credited ${bonus} referral Coins.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `referrals/${ref.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !adminReply.trim()) return;
    setBusyId('tkt_reply');
    try {
      const msgId = makeSafeId('msg');
      const batch = writeBatch(db);
      batch.set(doc(db, 'supportMessages', msgId), {
        id: msgId,
        ticketId: selectedTicket.id,
        ticketOwnerId: selectedTicket.userId,
        senderId: currentAdmin.uid,
        senderRole: 'ADMIN',
        senderName: `${currentAdmin.displayName} (Support)`,
        message: adminReply.trim(),
        createdAt: serverTimestamp(),
      });
      if (selectedTicket.status === 'OPEN') {
        batch.update(doc(db, 'supportTickets', selectedTicket.id), {
          status: 'IN_PROGRESS',
          updatedAt: serverTimestamp(),
        });
      }
      const ntfId = makeSafeId('ntf');
      batch.set(doc(db, 'notifications', ntfId), {
        id: ntfId,
        userId: selectedTicket.userId,
        title: 'Support Reply Received',
        message: `New response on ticket: "${selectedTicket.subject}"`,
        category: 'SUPPORT',
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      setAdminReply('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supportMessages');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateTicketStatus = async (tk: SupportTicket, status: SupportTicket['status']) => {
    try {
      await updateDoc(doc(db, 'supportTickets', tk.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      showNotice('ok', `Ticket marked ${status}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `supportTickets/${tk.id}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId('save_settings');
    try {
      const minW = Math.max(1, Math.floor(Number(setForm.minWithdrawalCoins)));
      const maxW = Math.max(minW, Math.floor(Number(setForm.maxWithdrawalCoins)));
      const refB = Math.max(0, Math.floor(Number(setForm.referralBonusCoins)));

      const batch = writeBatch(db);
      batch.set(doc(db, 'settings', 'platform'), {
        id: 'platform',
        siteName: setForm.siteName.trim(),
        upiMerchantId: setForm.upiMerchantId.trim(),
        upiMerchantName: setForm.upiMerchantName.trim(),
        gatewayProvider: setForm.gatewayProvider.trim(),
        gatewayEnabled: setForm.gatewayEnabled,
        minWithdrawalCoins: minW,
        maxWithdrawalCoins: maxW,
        referralBonusCoins: refB,
        supportEmail: setForm.supportEmail.trim(),
        supportHours: setForm.supportHours.trim(),
        complianceNotice: setForm.complianceNotice.trim(),
        updatedAt: serverTimestamp(),
      });
      writeAudit(batch, 'UPDATE_SETTINGS', 'settings', 'platform', 'Updated platform payment and support config');
      await batch.commit();
      showNotice('ok', 'Platform settings updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/platform');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = (type: 'deposits' | 'withdrawals' | 'transactions') => {
    let csv = '';
    if (type === 'deposits') {
      csv = 'OrderId,UserEmail,Package,Coins,AmountInr,UTR,Status\n' +
        deposits.map((d) => `${d.orderId},${d.userEmail},"${d.packageName}",${d.coins},${d.amountInr},${d.utrNumber || ''},${d.status}`).join('\n');
    } else if (type === 'withdrawals') {
      csv = 'Id,UserEmail,Method,Coins,AmountInr,Status,PayoutRef\n' +
        withdrawals.map((w) => `${w.id},${w.userEmail},${w.method},${w.amountCoins},${w.amountInr},${w.status},${w.payoutReference || ''}`).join('\n');
    } else {
      csv = 'Id,UserId,Type,AmountCoins,BalanceAfter,Description\n' +
        transactions.map((tx) => `${tx.id},${tx.userId},${tx.type},${tx.amountCoins},${tx.balanceAfter},"${tx.description.replace(/"/g, '')}"`).join('\n');
    }
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneycircle-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const adminNav: Array<{id: AdminTab; label: string; icon: React.ReactNode; count?: number}> = [
    {id: 'overview', label: t(lang, 'overview'), icon: <LayoutDashboard className="w-4 h-4" />},
    {id: 'users', label: t(lang, 'adminUsers'), icon: <Users className="w-4 h-4" />, count: stats.totalUsers},
    {id: 'deposits', label: t(lang, 'adminDeposits'), icon: <Coins className="w-4 h-4" />, count: stats.pendingDeposits},
    {id: 'withdrawals', label: t(lang, 'adminWithdrawals'), icon: <WalletIcon className="w-4 h-4" />, count: stats.pendingWithdrawals},
    {id: 'plans', label: t(lang, 'adminPlans'), icon: <CalendarClock className="w-4 h-4" />},
    {id: 'packages', label: t(lang, 'adminPackages'), icon: <Package className="w-4 h-4" />},
    {id: 'referrals', label: t(lang, 'adminReferrals'), icon: <UserCheck className="w-4 h-4" />},
    {id: 'support', label: t(lang, 'adminSupport'), icon: <HelpCircle className="w-4 h-4" />, count: stats.openTickets},
    {id: 'transactions', label: t(lang, 'transactions'), icon: <FileText className="w-4 h-4" />},
    {id: 'settings', label: t(lang, 'adminSettings'), icon: <SettingsIcon className="w-4 h-4" />},
    {id: 'audit', label: t(lang, 'adminAudit'), icon: <Activity className="w-4 h-4" />},
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-lg font-bold">MoneyCircle</span>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Admin</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {adminNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                activeTab === item.id
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span>{item.label}</span>
              </span>
              {item.count ? (
                <span className="font-mono text-xs font-semibold tabular-nums">{item.count}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            type="button"
            onClick={onSwitchToUser}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {t(lang, 'userPanel')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-medium cursor-pointer"
            >
              {lang === 'en' ? 'हिंदी' : 'English'}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 py-1.5 text-xs font-medium cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 py-2 text-xs font-medium text-red-600 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t(lang, 'logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-display font-bold text-base">MoneyCircle Admin</span>
        <button
          type="button"
          onClick={onSwitchToUser}
          className="text-xs font-semibold text-emerald-600"
        >
          User View
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 bg-white dark:bg-slate-900 h-full p-4 z-10 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold">Admin Console</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-2 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            {adminNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                  activeTab === item.id ? 'bg-slate-900 dark:bg-emerald-600 text-white' : ''
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 md:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500">
                MoneyCircle Admin / {adminNav.find((n) => n.id === activeTab)?.label}
              </div>
              <h1 className="font-display text-2xl font-bold mt-0.5">
                {adminNav.find((n) => n.id === activeTab)?.label}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const seeded = await seedPlatformCatalogIfEmpty(currentAdmin.uid, currentAdmin.email);
                  showNotice(
                    'ok',
                    seeded
                      ? 'Initialized default 5–25 Day plans, Coin packages, and settings.'
                      : 'Default catalog already exists.',
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Seed Default Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportCsv('transactions')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Ledger CSV</span>
              </button>
            </div>
          </div>

          {toast && (
            <div
              className={`rounded-xl border p-4 flex items-center justify-between text-sm ${
                toast.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
              }`}
            >
              <span>{toast.text}</span>
              <button type="button" onClick={() => setToast(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW & REPORTS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs text-slate-500">Registered / Active Users</div>
                  <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
                    {stats.totalUsers} <span className="text-sm text-emerald-600">({stats.activeUsers} active)</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs text-slate-500">Circulating Coins (Avail / Locked)</div>
                  <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
                    {stats.totalAvailable.toLocaleString('en-IN')}{' '}
                    <span className="text-sm text-amber-600">/ {stats.totalLocked.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs text-slate-500">Verified Deposits (INR)</div>
                  <div className="mt-2 font-mono text-2xl font-bold text-emerald-600 tabular-nums">
                    ₹{stats.verifiedDepositInr.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{stats.pendingDeposits} pending review</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                  <div className="text-xs text-slate-500">Settled Withdrawals (INR)</div>
                  <div className="mt-2 font-mono text-2xl font-bold tabular-nums">
                    ₹{stats.paidWithdrawalInr.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{stats.pendingWithdrawals} awaiting payout</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-bold">Financial & Compliance Reports</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Download clean CSV exports for deposits, withdrawal payouts, and wallet ledger entries.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportCsv('deposits')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Deposits CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('withdrawals')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Withdrawals CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportCsv('transactions')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Transactions CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, or referral code..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-sm"
                  />
                </div>
                <div className="text-xs text-slate-500 font-mono">Total: {filteredUsers.length}</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4 text-right">Available / Locked</th>
                      <th className="py-3 px-4">Payout ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers.map((u) => {
                      const w = walletByUser.get(u.uid);
                      const isUserAdmin = admins.some((a) => a.uid === u.uid);
                      return (
                        <tr key={u.uid}>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{u.displayName}</div>
                            <div className="text-xs text-slate-500">
                              {u.email} · {u.referralCode}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {w?.availableCoins ?? 0} / {w?.lockedCoins ?? 0}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-500">
                            {u.upiId || u.bankAccountNumber || 'Not set'}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            <span className={u.isBlocked ? 'text-red-600' : 'text-emerald-600'}>
                              {u.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                            </span>
                            {isUserAdmin && <span className="ml-2 font-mono text-sky-600">ADMIN</span>}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={busyId === u.uid}
                              onClick={() => handleToggleBlockUser(u)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                                u.isBlocked
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
                              }`}
                            >
                              <Ban className="w-3 h-3" />
                              <span>{u.isBlocked ? t(lang, 'unblockUser') : t(lang, 'blockUser')}</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === `adm_${u.uid}`}
                              onClick={() => handleToggleAdminRole(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{isUserAdmin ? 'Revoke Admin' : 'Make Admin'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEPOSITS & UPI VERIFICATION */}
          {activeTab === 'deposits' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">
                  UPI Deposits & Server Webhook Verification
                </h2>
              </div>
              {deposits.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-4">Order / User</th>
                        <th className="py-3 px-4 text-right">Coins / ₹</th>
                        <th className="py-3 px-4">UTR & Signature</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {deposits.map((dep) => {
                        const sigState = sigCheckMap[dep.id];
                        return (
                          <tr key={dep.id}>
                            <td className="py-3 px-4">
                              <div className="font-mono text-xs font-semibold">{dep.orderId}</div>
                              <div className="text-xs text-slate-500">{dep.userEmail}</div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                              {dep.coins} (₹{dep.amountInr})
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              <div>{dep.utrNumber || 'No UTR submitted'}</div>
                              {dep.gatewayRef && (
                                <div className="text-slate-500">{dep.gatewayRef}</div>
                              )}
                              {sigState && (
                                <div
                                  className={
                                    sigState === 'VALID' ? 'text-emerald-600' : 'text-red-600'
                                  }
                                >
                                  HMAC: {sigState}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold">
                              <span
                                className={
                                  dep.status === 'VERIFIED'
                                    ? 'text-emerald-600'
                                    : dep.status === 'REJECTED'
                                      ? 'text-red-600'
                                      : 'text-amber-600'
                                }
                              >
                                {dep.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              {dep.status === 'GATEWAY_PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCheckWebhookSignature(dep)}
                                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                  >
                                    Check HMAC
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === dep.id}
                                    onClick={() => handleVerifyCreditDeposit(dep)}
                                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                  >
                                    {t(lang, 'verifyAndCredit')}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyId === dep.id}
                                    onClick={() => handleRejectDeposit(dep)}
                                    className="rounded-lg border border-red-300 text-red-600 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                  >
                                    {t(lang, 'reject')}
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">Withdrawal Settlement Queue</h2>
              </div>
              {withdrawals.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Payout Details</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Settlement Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {withdrawals.map((wd) => (
                        <tr key={wd.id}>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{wd.userName}</div>
                            <div className="text-xs text-slate-500">{wd.userEmail}</div>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono">
                            {wd.method === 'UPI'
                              ? `UPI: ${wd.upiId}`
                              : `${wd.bankAccountHolder} · ${wd.bankName} · ${wd.bankAccountNumber} (${wd.bankIfsc})`}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                            {wd.amountCoins} Coins (₹{wd.amountInr})
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            <span
                              className={
                                wd.status === 'PAID'
                                  ? 'text-emerald-600'
                                  : wd.status === 'REJECTED'
                                    ? 'text-red-600'
                                    : wd.status === 'APPROVED'
                                      ? 'text-sky-600'
                                      : 'text-amber-600'
                              }
                            >
                              {wd.status}
                            </span>
                            {wd.payoutReference && (
                              <div className="font-mono text-[11px] text-slate-500">{wd.payoutReference}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            {(wd.status === 'PENDING' || wd.status === 'APPROVED') && (
                              <div className="inline-flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Payout UTR/Ref"
                                  value={payoutRefs[wd.id] || ''}
                                  onChange={(e) =>
                                    setPayoutRefs((prev) => ({...prev, [wd.id]: e.target.value}))
                                  }
                                  className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                                />
                                {wd.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    disabled={busyId === wd.id}
                                    onClick={() => handleWithdrawalAction(wd, 'APPROVED')}
                                    className="rounded-lg border border-sky-400 text-sky-700 dark:text-sky-300 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                  >
                                    {t(lang, 'approve')}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={busyId === wd.id}
                                  onClick={() => handleWithdrawalAction(wd, 'PAID')}
                                  className="rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                >
                                  {t(lang, 'markPaid')}
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === wd.id}
                                  onClick={() => handleWithdrawalAction(wd, 'REJECTED')}
                                  className="rounded-lg border border-red-300 text-red-600 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                                >
                                  {t(lang, 'reject')}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* DAY CIRCLE PLANS MANAGEMENT */}
          {activeTab === 'plans' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSavePlan}
                className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <h2 className="font-display text-base font-bold">
                  {editingPlanId ? 'Edit Day Circle Plan' : 'Create Day Circle Plan'}
                </h2>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Plan Name (English)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={planNameHi}
                  onChange={(e) => setPlanNameHi(e.target.value)}
                  placeholder="Plan Name (Hindi optional)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={planDuration}
                    onChange={(e) => setPlanDuration(Number(e.target.value) as 5 | 7 | 10 | 15 | 25)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-sm"
                  >
                    {[5, 7, 10, 15, 25].map((d) => (
                      <option key={d} value={d}>
                        {d} Days
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    min={1}
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    placeholder="Price Coins"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    value={planReward}
                    onChange={(e) => setPlanReward(e.target.value)}
                    placeholder="Loyalty Bonus"
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <textarea
                  required
                  rows={2}
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Description (avoid guaranteed investment claims)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <textarea
                  required
                  rows={2}
                  value={planTerms}
                  onChange={(e) => setPlanTerms(e.target.value)}
                  placeholder="Terms & Conditions"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={planElig}
                  onChange={(e) => setPlanElig(e.target.value)}
                  placeholder="Eligibility criteria"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busyId === 'plan_save'}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold cursor-pointer"
                  >
                    {editingPlanId ? 'Update Plan' : 'Create Plan'}
                  </button>
                  {editingPlanId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlanId(null);
                        setPlanName('');
                        setPlanDesc('');
                        setPlanTerms('');
                        setPlanElig('');
                      }}
                      className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-mono text-emerald-600">
                        {p.durationDays} Days · {p.priceCoins} Coins · {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                      <div className="font-bold text-base mt-0.5">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{p.description}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlanId(p.id);
                          setPlanName(p.name);
                          setPlanNameHi(p.nameHi || '');
                          setPlanDuration(p.durationDays);
                          setPlanPrice(String(p.priceCoins));
                          setPlanReward(String(p.rewardCoins));
                          setPlanDesc(p.description);
                          setPlanTerms(p.terms);
                          setPlanElig(p.eligibility);
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePlanActive(p)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COIN PACKAGES MANAGEMENT */}
          {activeTab === 'packages' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSavePackage}
                className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <h2 className="font-display text-base font-bold">
                  {editingPkgId ? 'Edit Coin Package' : 'Add Coin Package'}
                </h2>
                <input
                  type="text"
                  required
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  placeholder="Package Name"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  required
                  min={1}
                  value={pkgCoins}
                  onChange={(e) => setPkgCoins(e.target.value)}
                  placeholder="Coins (= INR price)"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  value={pkgTagline}
                  onChange={(e) => setPkgTagline(e.target.value)}
                  placeholder="Tagline"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold cursor-pointer"
                >
                  Save Package (1 Coin = ₹1)
                </button>
              </form>

              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">{pkg.name}</div>
                      <div className="font-mono text-sm text-emerald-600">
                        {pkg.coins} Coins = ₹{pkg.priceInr}
                      </div>
                      <div className="text-xs text-slate-500">{pkg.isActive ? 'ACTIVE' : 'INACTIVE'}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'coinPackages', pkg.id), {
                            isActive: !pkg.isActive,
                            updatedAt: serverTimestamp(),
                          });
                        }}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                      >
                        {pkg.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDoc(doc(db, 'coinPackages', pkg.id))}
                        className="p-1.5 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REFERRALS */}
          {activeTab === 'referrals' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">Referral Management</h2>
              </div>
              {referrals.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {referrals.map((ref) => (
                    <div key={ref.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm">
                      <div>
                        <div className="font-medium">{ref.referredEmail}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          Referrer: {ref.referrerId} · Code: {ref.referralCode}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold">
                          {ref.status} ({ref.rewardCoins} Coins)
                        </span>
                        {ref.status === 'PENDING' && (
                          <button
                            type="button"
                            disabled={busyId === ref.id}
                            onClick={() => handleCreditReferral(ref)}
                            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          >
                            Credit Bonus
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADMIN SUPPORT DESK */}
          {activeTab === 'support' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                  Customer Support Tickets ({tickets.length})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
                  {tickets.map((tk) => (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => setSelectedTicketId(tk.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                        selectedTicketId === tk.id ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`}
                    >
                      <div className="font-semibold text-sm truncate">{tk.subject}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex justify-between">
                        <span>{tk.userEmail}</span>
                        <span className="font-mono font-semibold text-emerald-600">{tk.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[460px]">
                {!selectedTicket ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
                    Select a customer ticket to inspect and respond.
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{selectedTicket.subject}</h3>
                        <div className="text-xs text-slate-500">
                          {selectedTicket.userName} ({selectedTicket.userEmail}) · {selectedTicket.priority}
                        </div>
                      </div>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) =>
                          handleUpdateTicketStatus(selectedTicket, e.target.value as SupportTicket['status'])
                        }
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[340px]">
                      {selectedMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl p-3.5 max-w-[85%] text-sm ${
                            m.senderRole === 'ADMIN'
                              ? 'ml-auto bg-slate-900 dark:bg-emerald-600 text-white'
                              : 'mr-auto bg-slate-100 dark:bg-slate-800'
                          }`}
                        >
                          <div className="text-[11px] opacity-75 mb-1">
                            {m.senderName} ({m.senderRole})
                          </div>
                          <div>{m.message}</div>
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleAdminTicketReply}
                      className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2"
                    >
                      <input
                        type="text"
                        required
                        value={adminReply}
                        onChange={(e) => setAdminReply(e.target.value)}
                        placeholder="Reply as Help Desk Admin..."
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={busyId === 'tkt_reply'}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">Platform Transaction Ledger</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">User UID</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Coins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transactions.slice(0, 80).map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2.5 px-4 font-mono text-xs">{tx.type}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{tx.userId.slice(0, 12)}...</td>
                        <td className="py-2.5 px-4">{tx.description}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                          {tx.amountCoins}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">
                  Website, Payment Gateway & Support Settings
                </h2>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Platform Name</label>
                  <input
                    type="text"
                    required
                    value={setForm.siteName}
                    onChange={(e) => setSetForm({...setForm, siteName: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Gateway Provider</label>
                  <input
                    type="text"
                    required
                    value={setForm.gatewayProvider}
                    onChange={(e) => setSetForm({...setForm, gatewayProvider: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Authorized Merchant UPI ID</label>
                  <input
                    type="text"
                    required
                    value={setForm.upiMerchantId}
                    onChange={(e) => setSetForm({...setForm, upiMerchantId: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Merchant Payee Name</label>
                  <input
                    type="text"
                    required
                    value={setForm.upiMerchantName}
                    onChange={(e) => setSetForm({...setForm, upiMerchantName: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Min Withdrawal (Coins)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={setForm.minWithdrawalCoins}
                    onChange={(e) => setSetForm({...setForm, minWithdrawalCoins: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Max Withdrawal (Coins)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={setForm.maxWithdrawalCoins}
                    onChange={(e) => setSetForm({...setForm, maxWithdrawalCoins: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Referral Bonus (Coins)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={setForm.referralBonusCoins}
                    onChange={(e) => setSetForm({...setForm, referralBonusCoins: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Support Email</label>
                  <input
                    type="email"
                    required
                    value={setForm.supportEmail}
                    onChange={(e) => setSetForm({...setForm, supportEmail: e.target.value})}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Support Hours</label>
                <input
                  type="text"
                  value={setForm.supportHours}
                  onChange={(e) => setSetForm({...setForm, supportHours: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Regulatory Compliance Notice</label>
                <textarea
                  rows={2}
                  value={setForm.complianceNotice}
                  onChange={(e) => setSetForm({...setForm, complianceNotice: e.target.value})}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={setForm.gatewayEnabled}
                  onChange={(e) => setSetForm({...setForm, gatewayEnabled: e.target.checked})}
                  className="rounded border-slate-300"
                />
                <span>Enable Authorized UPI Deposit Gateway</span>
              </label>

              <button
                type="submit"
                disabled={busyId === 'save_settings'}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-sm font-semibold cursor-pointer"
              >
                {busyId === 'save_settings' ? 'Saving...' : 'Save Platform Settings'}
              </button>
            </form>
          )}

          {/* AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="font-display text-base font-bold">Immutable Admin Audit Logs</h2>
              </div>
              {auditLogs.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">{t(lang, 'noRecords')}</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                      <div>
                        <div className="font-mono text-xs font-semibold text-emerald-600">
                          {log.action} · {log.targetCollection}/{log.targetId}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{log.details}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>{log.actorEmail}</div>
                        <div>{log.createdAt?.toDate?.()?.toLocaleString() || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

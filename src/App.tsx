import React, {useEffect, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import {AdminDashboard} from './components/AdminDashboard';
import {AuthModal} from './components/AuthModal';
import {LandingPage} from './components/LandingPage';
import {OfflineIndicator} from './components/OfflineIndicator';
import {UserDashboard} from './components/UserDashboard';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  makeSafeId,
  OperationType,
  testFirestoreConnection,
} from './lib/firebase';
import {DEFAULT_PLATFORM_SETTINGS, seedPlatformCatalogIfEmpty} from './lib/seedData';
import type {
  AdminRecord,
  AppNotification,
  AuditLog,
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
} from './types/models';

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [authReady, setAuthReady] = useState(false);
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'landing' | 'user' | 'admin'>('landing');
  const [authModal, setAuthModal] = useState<{open: boolean; mode: 'login' | 'register' | 'forgot'}>({
    open: false,
    mode: 'login',
  });
  const [pendingReferralCode, setPendingReferralCode] = useState<string>('');

  // Public catalog state
  const [plans, setPlans] = useState<DayPlan[]>([]);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    ...DEFAULT_PLATFORM_SETTINGS,
    updatedAt: null as unknown as Timestamp,
  });

  // User-scoped state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [enrollments, setEnrollments] = useState<PlanEnrollment[]>([]);
  const [userDeposits, setUserDeposits] = useState<Deposit[]>([]);
  const [userWithdrawals, setUserWithdrawals] = useState<Withdrawal[]>([]);
  const [userTransactions, setUserTransactions] = useState<CoinTransaction[]>([]);
  const [userReferrals, setUserReferrals] = useState<Referral[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userTickets, setUserTickets] = useState<SupportTicket[]>([]);
  const [userMessages, setUserMessages] = useState<SupportMessage[]>([]);

  // Admin-scoped state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminRecord[]>([]);
  const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [allWithdrawals, setAllWithdrawals] = useState<Withdrawal[]>([]);
  const [allTransactions, setAllTransactions] = useState<CoinTransaction[]>([]);
  const [allReferrals, setAllReferrals] = useState<Referral[]>([]);
  const [allTickets, setAllTickets] = useState<SupportTicket[]>([]);
  const [allMessages, setAllMessages] = useState<SupportMessage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    testFirestoreConnection();

    const unsubPlans = onSnapshot(
      collection(db, 'plans'),
      (snap) => {
        setPlans(snap.docs.map((d) => d.data() as DayPlan));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'plans'),
    );

    const unsubPkgs = onSnapshot(
      collection(db, 'coinPackages'),
      (snap) => {
        setPackages(snap.docs.map((d) => d.data() as CoinPackage));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'coinPackages'),
    );

    return () => {
      unsubPlans();
      unsubPkgs();
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (!user) {
        setIsAdmin(false);
        setUserProfile(null);
        setWallet(null);
        setViewMode('landing');
        setAuthReady(true);
        return;
      }

      try {
        const bootstrapAdmin =
          user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() &&
          user.emailVerified;

        let adminDocExists = false;
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          adminDocExists = adminSnap.exists();
        } catch {
          adminDocExists = false;
        }

        const adminFlag = bootstrapAdmin || adminDocExists;
        setIsAdmin(adminFlag);

        if (user.emailVerified) {
          const userRef = doc(db, 'users', user.uid);
          const walletRef = doc(db, 'wallets', user.uid);
          const [uSnap, wSnap] = await Promise.all([getDoc(userRef), getDoc(walletRef)]);

          if (!uSnap.exists() || !wSnap.exists()) {
            const batch = writeBatch(db);
            const now = serverTimestamp();
            const generatedCode = `MC${user.uid.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;

            if (!uSnap.exists()) {
              batch.set(userRef, {
                uid: user.uid,
                email: user.email || `${user.uid}@moneycircle.app`,
                displayName: (user.displayName || user.email?.split('@')[0] || 'Member').slice(0, 100),
                referralCode: generatedCode,
                ...(pendingReferralCode ? {referredBy: pendingReferralCode} : {}),
                language: lang,
                isBlocked: false,
                role: 'USER',
                createdAt: now,
                updatedAt: now,
              });
              batch.set(doc(db, 'referralCodes', generatedCode), {
                code: generatedCode,
                ownerId: user.uid,
                createdAt: now,
              });
            }

            if (!wSnap.exists()) {
              batch.set(walletRef, {
                userId: user.uid,
                availableCoins: 0,
                lockedCoins: 0,
                totalPurchased: 0,
                totalWithdrawn: 0,
                hasPendingWithdrawal: false,
                updatedAt: now,
              });
            }

            if (!uSnap.exists() && pendingReferralCode) {
              try {
                const refCodeSnap = await getDoc(doc(db, 'referralCodes', pendingReferralCode));
                if (refCodeSnap.exists()) {
                  const ownerId = (refCodeSnap.data() as {ownerId: string}).ownerId;
                  if (ownerId && ownerId !== user.uid) {
                    const refId = makeSafeId('ref');
                    batch.set(doc(db, 'referrals', refId), {
                      id: refId,
                      referrerId: ownerId,
                      referredUserId: user.uid,
                      referredEmail: user.email || 'member@moneycircle.app',
                      referralCode: pendingReferralCode,
                      rewardCoins: 25,
                      status: 'PENDING',
                      createdAt: now,
                    });
                  }
                }
              } catch {
                // Ignore invalid referral code lookup
              }
              setPendingReferralCode('');
            }

            await batch.commit();
          }

          if (adminFlag) {
            await seedPlatformCatalogIfEmpty(user.uid, user.email || BOOTSTRAP_ADMIN_EMAIL);
          }
        }

        setViewMode((prev) => (prev === 'landing' ? (adminFlag ? 'admin' : 'user') : prev));
      } catch (err) {
        console.error('Auth bootstrap error:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubAuth();
  }, [lang, pendingReferralCode]);

  // Authenticated User-Scoped Listeners
  useEffect(() => {
    if (!authReady || !fbUser) return;
    const uid = fbUser.uid;

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'platform'),
        (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as PlatformSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'settings/platform'),
      ),
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`),
      ),
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'wallets', uid),
        (snap) => {
          if (snap.exists()) {
            setWallet(snap.data() as Wallet);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `wallets/${uid}`),
      ),
    );

    const sortByCreatedDesc = <T extends {createdAt?: Timestamp}>(arr: T[]): T[] =>
      [...arr].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    unsubs.push(
      onSnapshot(
        query(collection(db, 'planEnrollments'), where('userId', '==', uid)),
        (snap) => setEnrollments(sortByCreatedDesc(snap.docs.map((d) => d.data() as PlanEnrollment))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'planEnrollments'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'deposits'), where('userId', '==', uid)),
        (snap) => setUserDeposits(sortByCreatedDesc(snap.docs.map((d) => d.data() as Deposit))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'deposits'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'withdrawals'), where('userId', '==', uid)),
        (snap) => setUserWithdrawals(sortByCreatedDesc(snap.docs.map((d) => d.data() as Withdrawal))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'transactions'), where('userId', '==', uid)),
        (snap) => setUserTransactions(sortByCreatedDesc(snap.docs.map((d) => d.data() as CoinTransaction))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'referrals'), where('referrerId', '==', uid)),
        (snap) => setUserReferrals(sortByCreatedDesc(snap.docs.map((d) => d.data() as Referral))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'referrals'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('userId', '==', uid)),
        (snap) => setNotifications(sortByCreatedDesc(snap.docs.map((d) => d.data() as AppNotification))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'supportTickets'), where('userId', '==', uid)),
        (snap) => setUserTickets(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets'),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'supportMessages'), where('ticketOwnerId', '==', uid)),
        (snap) => setUserMessages(snap.docs.map((d) => d.data() as SupportMessage)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'supportMessages'),
      ),
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, fbUser]);

  // Admin-Only Collection Listeners
  useEffect(() => {
    if (!authReady || !fbUser || !isAdmin) return;

    const sortByCreatedDesc = <T extends {createdAt?: Timestamp}>(arr: T[]): T[] =>
      [...arr].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => setAllUsers(sortByCreatedDesc(snap.docs.map((d) => d.data() as UserProfile))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'admins'),
        (snap) => setAllAdmins(snap.docs.map((d) => d.data() as AdminRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'admins'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'wallets'),
        (snap) => setAllWallets(snap.docs.map((d) => d.data() as Wallet)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'wallets'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'deposits'),
        (snap) => setAllDeposits(sortByCreatedDesc(snap.docs.map((d) => d.data() as Deposit))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'deposits'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'withdrawals'),
        (snap) => setAllWithdrawals(sortByCreatedDesc(snap.docs.map((d) => d.data() as Withdrawal))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'transactions'),
        (snap) => setAllTransactions(sortByCreatedDesc(snap.docs.map((d) => d.data() as CoinTransaction))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'referrals'),
        (snap) => setAllReferrals(sortByCreatedDesc(snap.docs.map((d) => d.data() as Referral))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'referrals'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'supportTickets'),
        (snap) => setAllTickets(sortByCreatedDesc(snap.docs.map((d) => d.data() as SupportTicket))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets'),
      ),
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'supportMessages'),
        (snap) => setAllMessages(snap.docs.map((d) => d.data() as SupportMessage)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'supportMessages'),
      ),
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc')),
        (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLog)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'),
      ),
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, fbUser, isAdmin]);

  const fallbackProfile: UserProfile | null = fbUser
    ? userProfile || {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Member',
        referralCode: `MC${fbUser.uid.slice(0, 6).toUpperCase()}`,
        isBlocked: false,
        role: isAdmin ? 'ADMIN' : 'USER',
        createdAt: null as unknown as Timestamp,
        updatedAt: null as unknown as Timestamp,
      }
    : null;

  return (
    <>
      {viewMode === 'admin' && fbUser && isAdmin && fallbackProfile ? (
        <AdminDashboard
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          currentAdmin={fallbackProfile}
          users={allUsers}
          admins={allAdmins}
          wallets={allWallets}
          plans={plans}
          packages={packages}
          deposits={allDeposits}
          withdrawals={allWithdrawals}
          transactions={allTransactions}
          referrals={allReferrals}
          tickets={allTickets}
          supportMessages={allMessages}
          auditLogs={auditLogs}
          settings={settings}
          onSwitchToUser={() => setViewMode('user')}
        />
      ) : viewMode === 'user' && fbUser && fallbackProfile ? (
        <UserDashboard
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          userProfile={fallbackProfile}
          wallet={wallet}
          plans={plans}
          enrollments={enrollments}
          packages={packages}
          deposits={userDeposits}
          withdrawals={userWithdrawals}
          transactions={userTransactions}
          referrals={userReferrals}
          notifications={notifications}
          tickets={userTickets}
          supportMessages={userMessages}
          settings={settings}
          isAdmin={isAdmin}
          onSwitchToAdmin={() => setViewMode('admin')}
          onBackToSite={() => setViewMode('landing')}
        />
      ) : (
        <LandingPage
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          plans={plans}
          packages={packages}
          isAuthenticated={Boolean(fbUser)}
          onOpenAuth={(mode) => setAuthModal({open: true, mode})}
          onOpenDashboard={() => setViewMode(isAdmin ? 'admin' : 'user')}
        />
      )}

      <AuthModal
        isOpen={authModal.open}
        initialMode={authModal.mode}
        lang={lang}
        onClose={() => setAuthModal((prev) => ({...prev, open: false}))}
        onReferralCodeCapture={(code) => setPendingReferralCode(code)}
      />

      <OfflineIndicator />
    </>
  );
}

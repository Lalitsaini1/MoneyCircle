import type {Timestamp} from 'firebase/firestore';

export type Language = 'en' | 'hi';
export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  referralCode: string;
  referredBy?: string;
  upiId?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  language?: Language;
  isBlocked: boolean;
  role: 'USER' | 'ADMIN';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdminRecord {
  uid: string;
  email: string;
  displayName?: string;
  grantedBy?: string;
  createdAt: Timestamp;
}

export interface DayPlan {
  id: string;
  name: string;
  nameHi?: string;
  durationDays: 5 | 7 | 10 | 15 | 25;
  priceCoins: number;
  rewardCoins: number;
  description: string;
  descriptionHi?: string;
  terms: string;
  eligibility: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlanEnrollment {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  durationDays: number;
  priceCoins: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  endsAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  priceInr: number;
  tagline?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Wallet {
  userId: string;
  availableCoins: number;
  lockedCoins: number;
  totalPurchased: number;
  totalWithdrawn: number;
  hasPendingWithdrawal: boolean;
  updatedAt: Timestamp;
}

export interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  packageId: string;
  packageName: string;
  coins: number;
  amountInr: number;
  orderId: string;
  upiUri: string;
  utrNumber?: string;
  gatewayRef?: string;
  webhookSignature?: string;
  webhookVerified: boolean;
  status: 'GATEWAY_PENDING' | 'VERIFIED' | 'REJECTED';
  adminNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amountCoins: number;
  amountInr: number;
  method: 'UPI' | 'BANK';
  upiId?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  payoutReference?: string;
  adminNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL_LOCK'
    | 'WITHDRAWAL_PAID'
    | 'WITHDRAWAL_REFUND'
    | 'PLAN_ENROLL'
    | 'REFERRAL_REWARD'
    | 'ADMIN_ADJUST';
  amountCoins: number;
  balanceAfter: number;
  referenceId?: string;
  description: string;
  createdAt: Timestamp;
}

export interface Referral {
  id: string;
  referrerId: string;
  referredUserId: string;
  referredEmail: string;
  referralCode: string;
  rewardCoins: number;
  status: 'PENDING' | 'CREDITED';
  createdAt: Timestamp;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'PAYMENT' | 'WITHDRAWAL' | 'PLAN' | 'SUPPORT' | 'SYSTEM';
  read: boolean;
  createdAt: Timestamp;
}

export interface PlatformSettings {
  id: string;
  siteName: string;
  upiMerchantId: string;
  upiMerchantName: string;
  gatewayProvider: string;
  gatewayEnabled: boolean;
  minWithdrawalCoins: number;
  maxWithdrawalCoins: number;
  referralBonusCoins: number;
  supportEmail: string;
  supportHours?: string;
  complianceNotice?: string;
  updatedAt: Timestamp;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'PAYMENT' | 'WITHDRAWAL' | 'ACCOUNT' | 'PLAN' | 'GENERAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  ticketOwnerId: string;
  senderId: string;
  senderRole: 'USER' | 'ADMIN';
  senderName: string;
  message: string;
  createdAt: Timestamp;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetCollection: string;
  targetId: string;
  details: string;
  createdAt: Timestamp;
}

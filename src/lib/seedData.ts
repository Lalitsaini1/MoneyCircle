import {collection, doc, getDocs, serverTimestamp, writeBatch} from 'firebase/firestore';
import {db, handleFirestoreError, OperationType} from './firebase';

export const DEFAULT_COIN_PACKAGES = [
  {id: 'pkg_100', name: 'Starter Pack', coins: 100, priceInr: 100, tagline: 'Entry wallet top-up · 1 Coin = ₹1'},
  {id: 'pkg_500', name: 'Standard Pack', coins: 500, priceInr: 500, tagline: 'Popular circle balance · 1 Coin = ₹1'},
  {id: 'pkg_1000', name: 'Circle Pro Pack', coins: 1000, priceInr: 1000, tagline: 'Extended plan coverage · 1 Coin = ₹1'},
  {id: 'pkg_2500', name: 'Patron Pack', coins: 2500, priceInr: 2500, tagline: 'High-capacity wallet pack · 1 Coin = ₹1'},
];

export const DEFAULT_PLANS: Array<{
  id: string;
  name: string;
  nameHi: string;
  durationDays: 5 | 7 | 10 | 15 | 25;
  priceCoins: number;
  rewardCoins: number;
  description: string;
  descriptionHi: string;
  terms: string;
  eligibility: string;
}> = [
  {
    id: 'plan_5d',
    name: '5-Day Sprint Circle',
    nameHi: '5-दिवसीय स्प्रिंट सर्कल',
    durationDays: 5,
    priceCoins: 100,
    rewardCoins: 15,
    description: 'Short-cycle 5-day community reward membership with structured milestone participation.',
    descriptionHi: '5 दिनों का संक्षिप्त सामुदायिक रिवॉर्ड सर्कल प्लान।',
    terms:
      'Membership fee is debited in Coins upon enrollment. Loyalty reward credits are subject to lawful reward pool availability and platform compliance rules. Not a guaranteed investment product.',
    eligibility: 'Verified MoneyCircle members with at least 100 available Coins.',
  },
  {
    id: 'plan_7d',
    name: '7-Day Weekly Circle',
    nameHi: '7-दिवसीय साप्ताहिक सर्कल',
    durationDays: 7,
    priceCoins: 250,
    rewardCoins: 35,
    description: 'One-week structured loyalty circle with daily check-in eligibility and transparent terms.',
    descriptionHi: 'एक सप्ताह का संरचित लॉयल्टी और रिवॉर्ड सर्कल प्लान।',
    terms:
      'Active for 7 calendar days from enrollment. Reward points are funded solely from authorized platform promotional budgets and do not represent fixed interest.',
    eligibility: 'Verified members with active UPI or bank payout profile.',
  },
  {
    id: 'plan_10d',
    name: '10-Day Steady Circle',
    nameHi: '10-दिवसीय स्टेडी सर्कल',
    durationDays: 10,
    priceCoins: 500,
    rewardCoins: 75,
    description: 'Ten-day reward circle designed for regular platform participants and referral contributors.',
    descriptionHi: 'नियमित सदस्यों के लिए 10 दिनों का रिवॉर्ड सर्कल प्लान।',
    terms:
      'Ten-day membership term. Cash redemptions require completed KYC/payout details and compliance review under applicable Indian regulations.',
    eligibility: 'Verified members with minimum 500 available Coins.',
  },
  {
    id: 'plan_15d',
    name: '15-Day Fortnight Circle',
    nameHi: '15-दिवसीय पाक्षिक सर्कल',
    durationDays: 15,
    priceCoins: 750,
    rewardCoins: 120,
    description: 'Mid-length 15-day membership circle offering structured loyalty tier benefits.',
    descriptionHi: '15 दिनों की अवधि वाला मध्यम-अवधि रिवॉर्ड सर्कल प्लान।',
    terms:
      'No guaranteed returns are promised. Rewards are distributed according to published program rules and lawful funding sources.',
    eligibility: 'Verified members in good standing with zero compliance flags.',
  },
  {
    id: 'plan_25d',
    name: '25-Day Horizon Circle',
    nameHi: '25-दिवसीय होराइजन सर्कल',
    durationDays: 25,
    priceCoins: 1000,
    rewardCoins: 200,
    description: 'Full 25-day premier reward circle with priority support desk routing and transparent ledger tracking.',
    descriptionHi: 'प्राथमिकता सहायता और पूर्ण लेजर ट्रैकिंग के साथ 25-दिवसीय प्रीमियर प्लान।',
    terms:
      '25-day loyalty program participation. All redemptions are processed solely through authorized UPI or bank settlement channels after admin verification.',
    eligibility: 'Verified members with 1,000+ available Coins and verified payout profile.',
  },
];

export const DEFAULT_PLATFORM_SETTINGS = {
  id: 'platform',
  siteName: 'MoneyCircle',
  upiMerchantId: 'moneycircle.pay@okaxis',
  upiMerchantName: 'MoneyCircle Rewards Pvt Ltd',
  gatewayProvider: 'MoneyCircle Authorized UPI Gateway',
  gatewayEnabled: true,
  minWithdrawalCoins: 100,
  maxWithdrawalCoins: 50000,
  referralBonusCoins: 25,
  supportEmail: 'support@moneycircle.app',
  supportHours: 'Mon - Sat, 09:30 AM - 06:30 PM IST',
  complianceNotice:
    'MoneyCircle does not promise guaranteed investment returns. Cash rewards are funded through lawful promotional pools and redeemed subject to applicable financial regulations and authorized payment verification.',
};

export async function seedPlatformCatalogIfEmpty(actorId: string, actorEmail: string): Promise<boolean> {
  try {
    const [plansSnap, packagesSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'plans')),
      getDocs(collection(db, 'coinPackages')),
      getDocs(collection(db, 'settings')),
    ]);

    if (!plansSnap.empty && !packagesSnap.empty && !settingsSnap.empty) {
      return false;
    }

    const batch = writeBatch(db);
    const now = serverTimestamp();

    if (plansSnap.empty) {
      for (const plan of DEFAULT_PLANS) {
        batch.set(doc(db, 'plans', plan.id), {
          ...plan,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (packagesSnap.empty) {
      for (const pkg of DEFAULT_COIN_PACKAGES) {
        batch.set(doc(db, 'coinPackages', pkg.id), {
          ...pkg,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (settingsSnap.empty) {
      batch.set(doc(db, 'settings', 'platform'), {
        ...DEFAULT_PLATFORM_SETTINGS,
        updatedAt: now,
      });
    }

    const logId = `audit_seed_${Date.now()}`;
    batch.set(doc(db, 'auditLogs', logId), {
      id: logId,
      actorId,
      actorEmail,
      action: 'INITIALIZE_CATALOG',
      targetCollection: 'settings',
      targetId: 'platform',
      details: 'Initialized default Day Circle plans, Coin packages, and authorized UPI settings.',
      createdAt: now,
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'plans/coinPackages/settings');
  }
}

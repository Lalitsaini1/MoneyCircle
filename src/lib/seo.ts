import type {DayPlan, Language} from '../types/models';

export type PublicRoutePath = '/' | '/plans' | '/rates' | '/security' | '/support';

export interface SeoMetadata {
  title: string;
  description: string;
  robots: string;
  canonicalPath: string;
  imagePath: string;
  locale: string;
  jsonLd: Record<string, unknown>;
}

const HERO_OG_IMAGE = '/src/assets/images/hero_moneycircle_vault_1795252441688.jpg';

const PUBLIC_SEO_COPY: Record<
  Language,
  Record<PublicRoutePath, {title: string; description: string}>
> = {
  en: {
    '/': {
      title: 'MoneyCircle – Reward Circles & Verified Coin Wallet',
      description:
        'Join MoneyCircle Day Circle plans, buy Coins at 1:1 INR parity via verified UPI webhooks, and track withdrawals in real time.',
    },
    '/plans': {
      title: 'Day Circle Plans (5–25 Days) – MoneyCircle',
      description:
        'Explore configurable 5, 7, 10, 15, and 25-Day Circle memberships on MoneyCircle with transparent terms and Coin wallet tracking.',
    },
    '/rates': {
      title: 'Coin Conversion Rates (1 Coin = ₹1) – MoneyCircle',
      description:
        'Check transparent MoneyCircle Coin rates (1 Coin = ₹1 INR), authorized UPI packages, and instant wallet conversion parity today.',
    },
    '/security': {
      title: 'UPI Webhook & Security Architecture – MoneyCircle',
      description:
        'Learn how MoneyCircle secures Coin deposits with HMAC-SHA256 UPI webhooks, 12-digit UTR checks, and locked withdrawal balances.',
    },
    '/support': {
      title: 'Help Desk & Customer Support – MoneyCircle',
      description:
        'Open tracked support tickets, check Help Desk hours, and resolve UPI deposit or withdrawal queries quickly with MoneyCircle.',
    },
  },
  hi: {
    '/': {
      title: 'MoneyCircle – रिवॉर्ड सर्कल और सत्यापित कॉइन वॉलेट',
      description:
        'MoneyCircle डे सर्कल प्लान से जुड़ें, सत्यापित UPI वेबहुक से ₹1 प्रति कॉइन खरीदें और निकासी को लाइव ट्रैक करें।',
    },
    '/plans': {
      title: 'डे सर्कल प्लान्स (5–25 दिन) – MoneyCircle',
      description:
        'पारदर्शी शर्तों और कॉइन वॉलेट ट्रैकिंग के साथ MoneyCircle के 5, 7, 10, 15 और 25-दिवसीय सर्कल प्लान देखें।',
    },
    '/rates': {
      title: 'कॉइन रूपांतरण दरें (1 कॉइन = ₹1) – MoneyCircle',
      description:
        'MoneyCircle पर ₹1 प्रति कॉइन की पारदर्शी दर, अधिकृत UPI पैकेज और वॉलेट मूल्य तालिका की जांच करें।',
    },
    '/security': {
      title: 'UPI वेबहुक और सुरक्षा व्यवस्था – MoneyCircle',
      description:
        'जानें कि MoneyCircle HMAC-SHA256 UPI वेबहुक, 12-अंकीय UTR और लॉक्ड बैलेंस से लेन-देन को कैसे सुरक्षित रखता है।',
    },
    '/support': {
      title: 'हेल्प डेस्क और ग्राहक सहायता – MoneyCircle',
      description:
        'UPI जमा, निकासी या खाते से जुड़े प्रश्नों के समाधान के लिए MoneyCircle हेल्प डेस्क पर सपोर्ट टिकट खोलें।',
    },
  },
};

export function normalizePublicRoute(pathname: string): PublicRoutePath {
  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if (
    cleaned === '/plans' ||
    cleaned === '/rates' ||
    cleaned === '/security' ||
    cleaned === '/support'
  ) {
    return cleaned;
  }
  return '/';
}

export function buildSeoMetadata(params: {
  viewMode: 'landing' | 'user' | 'admin';
  pathname: string;
  lang: Language;
  origin: string;
  plans: DayPlan[];
}): SeoMetadata {
  const {viewMode, pathname, lang, origin, plans} = params;
  const cleanOrigin = origin.replace(/\/+$/, '');

  if (viewMode === 'user') {
    return {
      title:
        lang === 'hi'
          ? 'सदस्य वॉलेट और डैशबोर्ड – MoneyCircle'
          : 'Member Wallet & Dashboard – MoneyCircle',
      description:
        'Manage your MoneyCircle Coin balance, UPI deposits, Day Circle enrollments, withdrawal payouts, and support tickets.',
      robots: 'noindex, nofollow',
      canonicalPath: '/',
      imagePath: HERO_OG_IMAGE,
      locale: lang === 'hi' ? 'hi_IN' : 'en_IN',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'MoneyCircle',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web, Android',
        url: cleanOrigin,
      },
    };
  }

  if (viewMode === 'admin') {
    return {
      title:
        lang === 'hi'
          ? 'एडमिन सेटलमेंट कंसोल – MoneyCircle'
          : 'Admin Settlement Console – MoneyCircle',
      description:
        'Authorized MoneyCircle administrative console for deposit verification, withdrawal settlements, plans, and support operations.',
      robots: 'noindex, nofollow',
      canonicalPath: '/',
      imagePath: HERO_OG_IMAGE,
      locale: lang === 'hi' ? 'hi_IN' : 'en_IN',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'MoneyCircle',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web, Android',
        url: cleanOrigin,
      },
    };
  }

  const route = normalizePublicRoute(pathname);
  const copy = PUBLIC_SEO_COPY[lang][route];
  const activePlans = plans.filter((p) => p.isActive);

  const webAppSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MoneyCircle',
    url: `${cleanOrigin}${route === '/' ? '' : route}`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, Android',
    inLanguage: ['en', 'hi'],
    description: copy.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
  };

  if (route === '/plans' && activePlans.length > 0) {
    webAppSchema.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'MoneyCircle Day Circle Plans',
      itemListElement: activePlans.map((plan, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Service',
          name: plan.name,
          description: plan.description,
          offers: {
            '@type': 'Offer',
            price: String(plan.priceCoins),
            priceCurrency: 'INR',
          },
        },
      })),
    };
  }

  return {
    title: copy.title,
    description: copy.description,
    robots: 'index, follow',
    canonicalPath: route,
    imagePath: HERO_OG_IMAGE,
    locale: lang === 'hi' ? 'hi_IN' : 'en_IN',
    jsonLd: webAppSchema,
  };
}

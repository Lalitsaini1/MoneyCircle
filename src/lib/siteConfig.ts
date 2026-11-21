const rawEnvUrl =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL
    ? String(import.meta.env.VITE_SITE_URL).trim()
    : '';

export const LIVE_WEBSITE_ORIGIN = (
  rawEnvUrl && /^https?:\/\//i.test(rawEnvUrl) && !rawEnvUrl.includes('MY_APP_URL')
    ? rawEnvUrl
    : 'https://moneycircle-public.vercel.app'
).replace(/\/+$/, '');

export const LIVE_WEBSITE_URL = `${LIVE_WEBSITE_ORIGIN}/`;
export const LIVE_SUPPORT_EMAIL = 'support@moneycircle.app';

export function getActiveSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return LIVE_WEBSITE_ORIGIN;
}

export function buildPublicUrl(path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${LIVE_WEBSITE_ORIGIN}${normalized}`;
}

export function buildReferralLink(referralCode: string): string {
  return `${LIVE_WEBSITE_ORIGIN}/?ref=${encodeURIComponent(referralCode.trim().toUpperCase())}`;
}

export function getAuthActionCodeSettings(
  querySuffix = '',
  originOverride?: string,
): {url: string; handleCodeInApp: false} {
  const base = (originOverride || LIVE_WEBSITE_ORIGIN).replace(/\/+$/, '');
  const suffix = querySuffix ? (querySuffix.startsWith('?') ? querySuffix : `?${querySuffix}`) : '';
  return {
    url: `${base}/${suffix}`,
    handleCodeInApp: false,
  };
}

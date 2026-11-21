import {useEffect} from 'react';
import {buildSeoMetadata} from '../lib/seo';
import {getActiveSiteOrigin} from '../lib/siteConfig';
import type {DayPlan, Language} from '../types/models';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, hreflang?: string): void {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) {
      el.setAttribute('hreflang', hreflang);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentSeo(params: {
  viewMode: 'landing' | 'user' | 'admin';
  pathname: string;
  lang: Language;
  plans: DayPlan[];
}) {
  const {viewMode, pathname, lang, plans} = params;

  useEffect(() => {
    const origin = getActiveSiteOrigin();
    const seo = buildSeoMetadata({
      viewMode,
      pathname,
      lang,
      origin,
      plans,
    });

    const baseCanonicalUrl = `${origin}${seo.canonicalPath === '/' ? '/' : seo.canonicalPath}`;
    const canonicalUrl =
      viewMode === 'landing' && lang === 'hi' ? `${baseCanonicalUrl}?lang=hi` : baseCanonicalUrl;
    const imageUrl = `${origin}${seo.imagePath}`;

    document.documentElement.lang = lang;
    document.title = seo.title;

    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'robots', seo.robots);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'MoneyCircle');
    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:locale', seo.locale);
    upsertMeta('property', 'og:image', imageUrl);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    upsertMeta('name', 'twitter:image', imageUrl);

    upsertLink('canonical', canonicalUrl);
    upsertLink('alternate', baseCanonicalUrl, 'en');
    upsertLink('alternate', `${baseCanonicalUrl}?lang=hi`, 'hi');
    upsertLink('alternate', baseCanonicalUrl, 'x-default');

    let ldScript = document.getElementById('moneycircle-jsonld') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.id = 'moneycircle-jsonld';
      ldScript.type = 'application/ld+json';
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(seo.jsonLd);
  }, [viewMode, pathname, lang, plans]);
}

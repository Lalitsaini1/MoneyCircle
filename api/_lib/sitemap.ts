import type {IncomingMessage} from 'node:http';

export interface SitemapRoute {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
}

export const PUBLIC_SITEMAP_ROUTES: SitemapRoute[] = [
  {path: '/', changefreq: 'daily', priority: '1.0'},
  {path: '/plans', changefreq: 'daily', priority: '0.9'},
  {path: '/rates', changefreq: 'weekly', priority: '0.8'},
  {path: '/security', changefreq: 'weekly', priority: '0.8'},
  {path: '/support', changefreq: 'weekly', priority: '0.7'},
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveSiteOrigin(req?: IncomingMessage): string {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl && /^https?:\/\//i.test(appUrl) && !appUrl.includes('MY_APP_URL')) {
    return appUrl.replace(/\/+$/, '');
  }

  if (req) {
    const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
    const hostStr =
      typeof forwardedHost === 'string' && forwardedHost.trim().length > 0
        ? forwardedHost.trim()
        : '';
    const forwardedProto = req.headers['x-forwarded-proto'];
    const defaultProto =
      hostStr.startsWith('localhost') || hostStr.startsWith('127.0.0.1') ? 'http' : 'https';
    const proto =
      typeof forwardedProto === 'string' && forwardedProto.trim().length > 0
        ? forwardedProto.split(',')[0].trim()
        : defaultProto;
    if (hostStr) {
      return `${proto}://${hostStr}`.replace(/\/+$/, '');
    }
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return `https://${vercelProd.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }

  return 'https://moneycircle.vercel.app';
}

export function generateSitemapXml(
  origin: string,
  lastmod = new Date().toISOString().slice(0, 10),
  extraRoutes: SitemapRoute[] = [],
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const routes = [...PUBLIC_SITEMAP_ROUTES, ...extraRoutes];
  const urls = routes
    .map((route) => {
      const normalizedPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
      const loc = escapeXml(`${cleanOrigin}${normalizedPath}`);
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${loc}" />
    <xhtml:link rel="alternate" hreflang="hi" href="${loc}?lang=hi" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${urls}
</urlset>
`;
}

export function generateRobotsTxt(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${cleanOrigin}/sitemap.xml
`;
}

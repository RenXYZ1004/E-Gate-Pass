/*
 * Static SEO build for the existing multi-page site.
 * Vercel functions continue to live in /api; only public static assets are copied to /dist.
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
function normalizeSiteUrl(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('SITE_URL must be a valid public origin, such as https://gatepass.example.edu.');
  if (url.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url.host)) throw new Error('SITE_URL must use HTTPS for public production deployments.');
  return url.origin;
}
const siteCandidate = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
const siteUrl = normalizeSiteUrl(siteCandidate);
if (!siteUrl) {
  throw new Error('SEO build needs SITE_URL. Set SITE_URL to the live production domain in Vercel, or enable Vercel system environment variables so VERCEL_PROJECT_PRODUCTION_URL is available.');
}
const gaId = String(process.env.GA_MEASUREMENT_ID || '').trim();
if (gaId && !/^G-[A-Z0-9]+$/i.test(gaId)) throw new Error('GA_MEASUREMENT_ID must look like G-XXXXXXXXXX or be empty.');
const verification = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
if (verification && !/^[A-Za-z0-9_-]{10,200}$/.test(verification)) throw new Error('GOOGLE_SITE_VERIFICATION contains unexpected characters.');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const staticFiles = [
  'index.html','app.html','newForm.html','tgpForm.html','privacy-policy.html','terms-of-service.html','404.html',
  'manifest.json','sw.js','logo.png','logo.webp','SISC_logo.png','SISC_logo.webp','Southville.webp',
  'PGP_Card_1784540906451.png','PGP_Card_1784540906451.webp','PGP_Card_1784609066593.png','PGP_Card_1784609066593.webp','og-image.jpg'
];
function copyEntry(relative) {
  const from = path.join(ROOT, relative);
  const to = path.join(OUT, relative);
  if (!fs.existsSync(from)) throw new Error('Required public file is missing: ' + relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}
for (const file of staticFiles) copyEntry(file);
for (const dir of ['css','js']) {
  const from = path.join(ROOT, dir);
  if (!fs.existsSync(from)) throw new Error('Required directory is missing: ' + dir);
  fs.cpSync(from, path.join(OUT, dir), { recursive: true });
}
// Required for already-offline-capable face/QR features. These remain static assets.

const htmlFiles = ['index.html','app.html','newForm.html','tgpForm.html','privacy-policy.html','terms-of-service.html','404.html'];
for (const file of htmlFiles) {
  const target = path.join(OUT, file);
  let html = fs.readFileSync(target, 'utf8').replaceAll('__SEO_SITE_URL__', siteUrl).replaceAll('__GA_MEASUREMENT_ID__', gaId);
  if (verification) html = html.replace('<!-- GOOGLE_SITE_VERIFICATION -->\n  <meta name="google-site-verification" content="__GOOGLE_SITE_VERIFICATION__">\n  <!-- /GOOGLE_SITE_VERIFICATION -->', `<meta name="google-site-verification" content="${verification}">`);
  else html = html.replace(/\s*<!-- GOOGLE_SITE_VERIFICATION -->[\s\S]*?<!-- \/GOOGLE_SITE_VERIFICATION -->/g, '');
  fs.writeFileSync(target, html);
}
const robotsTemplate = fs.readFileSync(path.join(ROOT, 'robots.template.txt'), 'utf8');
fs.writeFileSync(path.join(OUT,'robots.txt'), robotsTemplate.replaceAll('__SEO_SITE_URL__',siteUrl));
const today = new Date().toISOString().slice(0,10);
const publicPaths = [
  {path:'/',priority:'1.0'},
  {path:'/privacy-policy',priority:'0.4'},
  {path:'/terms-of-service',priority:'0.3'}
];
const urls = publicPaths.map(item => `  <url>\n    <loc>${siteUrl}${item.path === '/' ? '/' : item.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>yearly</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
fs.writeFileSync(path.join(OUT,'sitemap.xml'),sitemap);
console.log(`SEO build complete: ${siteUrl}; ${gaId ? 'Analytics consent integration configured' : 'Analytics disabled (no Measurement ID)'}; Search Console ${verification ? 'verification tag configured' : 'verification tag not configured'}.`);

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const errors = [];
function assert(condition, message) { if (!condition) errors.push(message); }
const publicPages = [
  ['index.html', 'SISC e-Gatepass | Digital School Exit Pass Portal', 1],
  ['privacy-policy.html', 'Privacy Policy | SISC e-Gatepass', 1],
  ['terms-of-service.html', 'Terms of Service | SISC e-Gatepass', 1]
];
for (const [file, title, h1Count] of publicPages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert((html.match(/<title>/gi) || []).length === 1, `${file}: expected one title`);
  assert(html.includes(`<title>${title}</title>`), `${file}: title mismatch`);
  assert(/<meta\s+name="description"\s+content="[^"]{40,}"/i.test(html), `${file}: missing or short meta description`);
  assert((html.match(/<h1(?:\s|>)/gi) || []).length === h1Count, `${file}: expected ${h1Count} H1`);
  assert(html.includes('rel="canonical"'), `${file}: missing canonical placeholder`);
  assert(html.includes('property="og:image"'), `${file}: missing OG image metadata`);
}
for (const file of ['app.html','newForm.html','tgpForm.html','404.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert(/<meta\s+name="robots"\s+content="noindex/i.test(html), `${file}: must be noindex`);
  if (file !== 'app.html') assert((html.match(/<h1(?:\s|>)/gi) || []).length === 1, `${file}: expected exactly one H1`);
  assert((html.match(/<title>/gi) || []).length === 1, `${file}: expected one unique title tag`);
  assert(/<meta\s+name="description"\s+content="[^"]{40,}"/i.test(html), `${file}: missing or short meta description`);
}
assert(fs.existsSync(path.join(root,'og-image.jpg')), 'Missing OG image');
assert(fs.existsSync(path.join(root,'SISC_logo.webp')), 'Missing WebP school logo');
assert(fs.existsSync(path.join(root,'PGP_Card_1784540906451.webp')), 'Missing WebP sample card A');
assert(fs.existsSync(path.join(root,'PGP_Card_1784609066593.webp')), 'Missing WebP sample card B');
assert(fs.existsSync(path.join(root,'api/contact.js')), 'Missing contact endpoint');
assert(fs.existsSync(path.join(root,'js/contact.js')), 'Missing contact form client script');
assert(fs.existsSync(path.join(root,'build-seo.cjs')), 'Missing SEO build script');
assert(fs.existsSync(path.join(root,'robots.template.txt')), 'Missing robots.txt build template');
assert((fs.readFileSync(path.join(root,'index.html'),'utf8').match(/id="contact-form"/g)||[]).length === 1, 'Homepage must contain one contact form');
assert(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('application/ld+json'), 'Missing organization schema');
if (errors.length) { console.error('SEO checks failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`SEO source checks passed (${publicPages.length} indexable pages; operational pages noindex).`);

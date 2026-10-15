# Homepage redesign audit

## Scope
Updated the public `index.html` homepage, its standalone stylesheet `css/landing.css`, and the small enhancement script `js/landing.js`. The faculty dashboard, login validation, contact-form endpoint, and permanent/temporary application workflows were not intentionally changed.

## Design changes
- Replaced the dark animated/aurora treatment with a light, restrained SISC purple-and-white design, generous spacing, restrained borders, and consistent button styling.
- Changed the hero into a readable two-column introduction with primary/secondary application actions and a small process overview panel.
- Replaced the continuously moving marquee with a static feature strip that is calmer and more accessible.
- Removed pointer-tracked glow, grain overlay, parallax, tilt, title-splitting animations, and scroll-reveal behavior; `landing.js` now only adds a subtle header shadow after scrolling.
- Removed hard-coded usage figures (student count, gate clearance percentage, and checkpoint count) because they may be outdated or unverified.
- Removed sample pass images from the public homepage because the displayed sample data included a prior school year and demo student/pass details. Existing image assets are retained in the project so unrelated app/service-worker references are not broken.
- Restyled the staff-login modal and public contact form to match the lighter design and improved compact header behavior for mobile.
- Preserved existing SEO metadata, JSON-LD, canonical placeholders, consent-gated Analytics behavior, legal-page links, contact form wiring, and primary application destinations.

## Validation completed
- `node scripts/check-syntax.cjs` — passed (46 JavaScript sources and inline scripts parsed).
- `node scripts/check-seo.cjs` — passed (page titles, descriptions, one H1, operational noindex rules, OG/schema and contact form checks).
- `SITE_URL=https://gatepass.example.edu npm run build` — passed as a local build smoke test. The example host was used only for this test and the generated `dist/` directory is excluded from the delivery archive; configure the real production `SITE_URL` in Vercel before deployment.
- Local links and primary form destinations checked against the source tree.

## Not verified live
No production login, live email delivery, Google Sheets access, production-domain preview, or end-to-end school workflow was performed. Review the deployed preview at desktop and mobile widths before promoting it to production.

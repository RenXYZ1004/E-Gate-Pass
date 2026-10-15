# Homepage background update

## What changed
- Converted the supplied campus photo to `Southville.webp` (1920 × 1084, WebP, approximately 166 KB).
- Applied it as the public homepage hero background without stretching, using `background-size: cover` and responsive position adjustments at tablet and mobile breakpoints.
- Added dark green overlays and a restrained SISC-purple highlight to maintain foreground readability against the foliage and sunlit areas.
- Changed the main hero action to white/purple for contrast and the secondary action to a translucent outline.
- Added an image preload to improve initial hero rendering.
- Included the asset in the SEO build output and service-worker static cache.
- Bumped service-worker cache to `pgp-cache-v1.4.14`.

## Files changed
- `Southville.webp` (new optimized image asset)
- `index.html` (hero image preload)
- `css/landing.css` (responsive background, contrast, CTA styling)
- `build-seo.cjs` (copy asset into production `dist`)
- `sw.js` (pre-cache asset and refresh cached application version)
- `HOMEPAGE_REDESIGN.md` (design notes)

## Validation
- SEO build test passed with a temporary test domain.
- JavaScript syntax check passed (46 sources/inline scripts).
- SEO source checks passed.
- Confirmed the built `dist` contains the WebP and that CSS, preload, build config, and service worker all reference the same filename.

The final Vercel deployment must still use the real production `SITE_URL` setting.

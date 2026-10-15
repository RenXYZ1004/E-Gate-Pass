(function () {
  'use strict';
  var idMeta = document.querySelector('meta[name="sisc-ga-measurement-id"]');
  var measurementId = idMeta ? (idMeta.content || '').trim() : '';
  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return;

  var storageKey = 'sisc_analytics_consent_v1';
  var privacyButton = document.getElementById('privacy-settings');
  var banner;
  function readConsent() {
    try { return localStorage.getItem(storageKey) || ''; } catch (_) { return ''; }
  }
  function loadAnalytics() {
    if (window.__siscAnalyticsLoaded) return;
    window.__siscAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: true });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }
  function storeConsent(value) {
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    if (value === 'granted') loadAnalytics();
    else if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    if (banner) { banner.remove(); banner = null; }
    if (privacyButton) privacyButton.hidden = false;
  }
  function showBanner() {
    if (banner) { banner.hidden = false; return; }
    banner = document.createElement('section');
    banner.className = 'privacy-consent-banner';
    banner.setAttribute('aria-label', 'Analytics privacy preference');
    banner.innerHTML = '<div><strong>Privacy preferences</strong><p>Optional analytics help the school understand use of this public information page. Analytics are not loaded unless you allow them. Do not include student or family details in analytics.</p></div><div class="privacy-consent-actions"><button type="button" data-consent="denied" class="consent-secondary">Essential only</button><button type="button" data-consent="granted" class="consent-primary">Allow analytics</button></div>';
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (button) storeConsent(button.getAttribute('data-consent'));
    });
    document.body.appendChild(banner);
  }
  var consent = readConsent();
  if (consent === 'granted') loadAnalytics();
  if (consent !== 'granted' && consent !== 'denied') showBanner();
  if (privacyButton) {
    privacyButton.hidden = false;
    privacyButton.addEventListener('click', function () {
      showBanner();
      if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
})();

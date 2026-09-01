function clean(value) {
  return value == null ? '' : String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRedirectUri(req) {
  const configured = clean(process.env.GOOGLE_REDIRECT_URI);
  if (configured) return configured;
  const host = clean(req.headers && req.headers.host);
  if (!host) throw new Error('Cannot determine the Vercel host. Set GOOGLE_REDIRECT_URI.');
  return `https://${host}/api/oauth-callback`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const code = clean(req.query && req.query.code);
  if (!code) {
    return res.status(400).send(`<h1>Google OAuth Error</h1><p>${escapeHtml((req.query && req.query.error) || 'No authorization code was provided.')}</p>`);
  }

  const clientId = clean(process.env.GMAIL_CLIENT_ID);
  const clientSecret = clean(process.env.GMAIL_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    return res.status(500).send('<h1>OAuth Configuration Error</h1><p>GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be configured in Vercel.</p>');
  }

  let redirectUri;
  try {
    redirectUri = getRedirectUri(req);
  } catch (error) {
    return res.status(500).send(`<h1>OAuth Configuration Error</h1><p>${escapeHtml(error.message)}</p>`);
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Google OAuth error:', data);
      return res.status(502).send(`<h1>Google OAuth Failed</h1><p>${escapeHtml(data.error_description || data.error || 'Google rejected the authorization.')}</p>`);
    }

    if (!data.refresh_token) {
      return res.status(500).send('<h1>No Refresh Token Received</h1><p>Google did not return a refresh token. Revoke the existing authorization for this app and authorize again with consent.</p>');
    }

    // The refresh token is displayed once in the browser so the administrator can
    // copy it to Vercel. It is not written to a file or returned by any other API.
    const token = escapeHtml(data.refresh_token);

    return res.status(200).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Google OAuth Complete</title>
<style>body{margin:0;padding:40px;background:#f5f3f7;font-family:Arial}.box{max-width:760px;margin:40px auto;padding:32px;background:#fff;border-radius:12px}.token{width:100%;min-height:120px;box-sizing:border-box;font-family:monospace}.ok{color:#16803c;font-weight:bold}</style></head>
<body><div class="box"><h1>Google OAuth Authorized</h1><p class="ok">Authorization was successful.</p><p>Copy the refresh token below into Vercel as <strong>GMAIL_REFRESH_TOKEN</strong>. Do not commit it to GitHub.</p><textarea class="token" readonly>${token}</textarea><p>After saving it in Vercel, redeploy the Production deployment.</p></div></body></html>`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(502).send(`<h1>OAuth Server Error</h1><p>${escapeHtml(error.message)}</p>`);
  }
};

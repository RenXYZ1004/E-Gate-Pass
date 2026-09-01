function clean(value) {
  return value == null ? '' : String(value).trim();
}

function getRedirectUri(req) {
  const configured = clean(process.env.GOOGLE_REDIRECT_URI);
  if (configured) return configured;
  const host = clean(req.headers && req.headers.host);
  if (!host) throw new Error('Cannot determine the Vercel host. Set GOOGLE_REDIRECT_URI.');
  return `https://${host}/api/oauth-callback`;
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = clean(process.env.GMAIL_CLIENT_ID);
  if (!clientId) {
    return res.status(500).json({ error: 'GMAIL_CLIENT_ID is not configured.' });
  }

  let redirectUri;
  try {
    redirectUri = getRedirectUri(req);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://mail.google.com/'
  });

  res.writeHead(302, {
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  });
  res.end();
};

const nodemailer = require('nodemailer');
const { rejected } = require('./_lib/request-guard');

const DEFAULT_FROM_NAME = 'Southville Gatepass System';
let cachedToken = null;
let tokenPromise = null;

function clean(value) { return value == null ? '' : String(value).trim(); }
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function parseBody(req) {
  if (!req || !req.body) return {};
  if (typeof req.body === 'object') return req.body;
  const raw = String(req.body);
  try { return JSON.parse(raw); } catch (_) {
    try { return Object.fromEntries(new URLSearchParams(raw).entries()); } catch (_) { return {}; }
  }
}
async function getAccessToken(config) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) return cachedToken.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async function () {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret,
        refresh_token: config.refreshToken, grant_type: 'refresh_token'
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error('Google mail authorization could not be refreshed.');
    cachedToken = { token: data.access_token, expiresAt: Date.now() + Math.max(60000, Number(data.expires_in || 3600) * 1000) };
    return cachedToken.token;
  })().finally(function () { tokenPromise = null; });
  return tokenPromise;
}

module.exports = async function contactHandler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Allow', 'POST');

  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Use POST to send a contact message.' });
  const headers = req.headers || {};
  if (!clean(headers.origin) && !clean(headers.referer)) return res.status(403).json({ success: false, message: 'Please submit the form from the school website.' });
  if (rejected(req, res, { name: 'contact', limit: 5, windowMs: 15 * 60 * 1000 })) return;
  const length = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(length) && length > 20000) return res.status(413).json({ success: false, message: 'Message is too large.' });

  const body = parseBody(req);
  // Quietly accept bot traps without sending mail or revealing the filter.
  if (clean(body.website)) return res.status(200).json({ success: true });
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const topic = clean(body.topic);
  const message = clean(body.message);
  if (!name || name.length > 120) return res.status(400).json({ success: false, message: 'Enter a name of 1–120 characters.' });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!['Gatepass application','Temporary gate pass','Portal access','Other question'].includes(topic)) return res.status(400).json({ success: false, message: 'Choose a valid message topic.' });
  if (message.length < 10 || message.length > 3000) return res.status(400).json({ success: false, message: 'Message must be between 10 and 3,000 characters.' });
  if (/[\r\n]/.test(email)) return res.status(400).json({ success: false, message: 'Invalid email address.' });

  const config = {
    clientId: clean(process.env.GMAIL_CLIENT_ID),
    clientSecret: clean(process.env.GMAIL_CLIENT_SECRET),
    refreshToken: clean(process.env.GMAIL_REFRESH_TOKEN),
    userEmail: clean(process.env.GMAIL_USER_EMAIL),
    fromName: clean(process.env.GMAIL_FROM_NAME) || DEFAULT_FROM_NAME,
    toEmail: clean(process.env.CONTACT_TO_EMAIL)
  };
  const missing = Object.entries(config).filter(([key, value]) => !value && key !== 'fromName').map(([key]) => key);
  if (missing.length) return res.status(503).json({ success: false, message: 'The contact service is not configured yet. Please contact the school office through its published channels.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.toEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.userEmail)) {
    return res.status(503).json({ success: false, message: 'The contact service is not configured correctly.' });
  }

  const plainText = `New SISC e-Gatepass website inquiry\n\nName: ${name}\nEmail: ${email}\nTopic: ${topic}\n\nMessage:\n${message}\n`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SISC Website Inquiry</title></head><body style="margin:0;padding:24px;background:#f5f3f7;font-family:Arial,Helvetica,sans-serif;color:#25212a"><main style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e3dce8;border-radius:12px;padding:28px"><p style="color:#422467;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;font-size:12px">SISC e-Gatepass Contact Form</p><h1 style="font-size:22px;color:#341539">New website inquiry</h1><table style="width:100%;border-collapse:collapse"><tr><th align="left" style="padding:8px;border-bottom:1px solid #eee">Name</th><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(name)}</td></tr><tr><th align="left" style="padding:8px;border-bottom:1px solid #eee">Email</th><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(email)}</td></tr><tr><th align="left" style="padding:8px;border-bottom:1px solid #eee">Topic</th><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(topic)}</td></tr></table><h2 style="font-size:15px">Message</h2><p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(message)}</p><p style="font-size:12px;color:#71687e">Reply to the sender only after checking the message. Do not forward sensitive student data.</p></main></body></html>`;

  try {
    const accessToken = await getAccessToken(config);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { type: 'OAuth2', user: config.userEmail, clientId: config.clientId, clientSecret: config.clientSecret, refreshToken: config.refreshToken, accessToken }
    });
    await transporter.sendMail({
      from: `"${config.fromName.replace(/[\r\n"\\]/g, '').slice(0, 100)}" <${config.userEmail}>`,
      to: config.toEmail,
      replyTo: { name: name.slice(0, 120), address: email },
      subject: `[SISC e-Gatepass] ${topic}`,
      text: plainText,
      html
    });
    return res.status(200).json({ success: true, message: 'Your message has been sent.' });
  } catch (error) {
    console.error('[contact] Failed to deliver message:', error && error.message ? error.message : 'unknown error');
    return res.status(502).json({ success: false, message: 'Your message could not be delivered right now. Please try again later or contact the school office through its published channels.' });
  }
};

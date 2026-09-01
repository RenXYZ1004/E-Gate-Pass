const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { rejected } = require('./_lib/request-guard');

const DEFAULT_FROM_NAME = 'Southville Gatepass System';
const DEFAULT_BASE_URL = 'https://e-gate-pass-theta.vercel.app';
const BRAND = '#341539';
const ACCENT = '#00c9b1';
const INK = '#25212a';
const MUTED = '#68616d';
const BORDER = '#e3dce8';
const PANEL = '#f8f5fa';
const FONT = "Arial, Helvetica, sans-serif";

function clean(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

function formatDate(value) {
  const raw = clean(value);
  if (!raw || raw.toUpperCase() === 'N/A') {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: 'Asia/Manila'
    }).format(new Date());
  }

  // Avoid interpreting YYYY-MM-DD as UTC and accidentally moving the date.
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(date);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: 'Asia/Manila'
    }).format(parsed);
  }

  return raw;
}

function getLogoUrl(req) {
  const configured = clean(process.env.APP_BASE_URL);
  if (configured) return configured.replace(/\/$/, '') + '/SISC_logo.png';

  const host = clean(req.headers && req.headers.host);
  if (host) return `https://${host}/SISC_logo.png`;
  return `${DEFAULT_BASE_URL}/SISC_logo.png`;
}

function decodeAttachment(body) {
  const raw = clean(body.attachment_base64);
  if (!raw) return null;

  const base64 = raw.replace(/^data:image\/[^;]+;base64,/i, '').replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) return null;

  let extension = /\.png$/i.test(clean(body.attachment_name)) ? '.png' : '.jpg';
  let contentType = extension === '.png' ? 'image/png' : 'image/jpeg';
  const nameBase = path.basename(clean(body.attachment_name, 'Permanent_Gate_Pass' + extension));
  const withoutExt = nameBase.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Permanent_Gate_Pass';
  const filename = withoutExt + extension;

  return { buffer, contentType, filename };
}

function detailsTable(rows) {
  return rows.filter(([, value]) => value).map(([label, value]) => `
    <tr>
      <td style="padding:9px 12px 9px 0;font-family:${FONT};font-size:12px;line-height:1.4;color:${MUTED};font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;border-bottom:1px solid ${BORDER};">${escapeHtml(label)}</td>
      <td style="padding:9px 0;font-family:${FONT};font-size:14px;line-height:1.45;color:${INK};font-weight:700;border-bottom:1px solid ${BORDER};">${value}</td>
    </tr>`).join('');
}

function buildShell({ body, preheader, logoUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Southville International School and Colleges</title>
<style>
  body{margin:0!important;padding:0!important;width:100%!important;background:#f5f3f7}
  @media only screen and (max-width:620px){.gp-pad{padding-left:20px!important;padding-right:20px!important}.gp-title{font-size:17px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#f5f3f7;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f3f7;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f5f3f7;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#fff;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;">
<tr><td class="gp-pad" style="padding:22px 28px;background:${BRAND};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="72" style="width:72px;padding-right:14px;vertical-align:middle;">
<img src="${escapeHtml(logoUrl)}" alt="SISC" width="58" height="58" style="display:block;width:58px;height:58px;border:0;border-radius:8px;background:#fff;">
</td>
<td style="vertical-align:middle;">
<h1 class="gp-title" style="margin:0;font-family:${FONT};font-size:20px;line-height:1.25;font-weight:700;color:#fff;">Southville International School and Colleges</h1>
<p style="margin:6px 0 0;font-family:${FONT};font-size:10px;line-height:1.55;color:#e8dfea;">1281 Tropical Ave. Cor. Luxembourg St., BF Homes Int'l., Las Piñas City, Metro Manila, Philippines<br>Tel. Nos. 8825-6374 (PR Office) / 8820-8702 &nbsp;|&nbsp; Mobile No. +63 917 853 2450<br>Fax No. (632) 829-1675</p>
</td></tr></table>
</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${ACCENT};">&nbsp;</td></tr>
<tr><td class="gp-pad" style="padding:30px 32px;">${body}</td></tr>
<tr><td class="gp-pad" style="padding:18px 28px;background:#f8f6f9;border-top:1px solid #e8e2eb;text-align:center;">
<p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.6;color:#77717a;">This is an automated message from the Southville International School and Colleges e-Gatepass System.<br>Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildPgpEmail(data, attachment, logoUrl) {
  const student = escapeHtml(data.studentName);
  const grade = escapeHtml(data.grade || '—');
  const pgpNo = escapeHtml(data.pgpNo || '—');
  const parent = escapeHtml(data.toName || 'Parent/Guardian');

  const body = `
<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};">Dear ${parent},</p>
<p style="margin:0 0 22px;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};">The complete Permanent Gate Pass ID for <strong style="color:${BRAND};">${student}</strong> is attached to this email. Please keep the attached pass on your child's device or print it for use at the gate.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td style="padding:20px 22px;background:${PANEL};border-left:4px solid ${BRAND};border-radius:6px;">
<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${BRAND};">Permanent Gate Pass</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailsTable([
  ['Name', student],
  ['Grade & Section', grade],
  ['PGP No.', `<span style="font-family:'Courier New',monospace;color:${BRAND};letter-spacing:1px;">${pgpNo}</span>`]
])}</table>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:14px 16px;background:#fff8e6;border:1px solid #f3e3b3;border-radius:6px;font-family:${FONT};font-size:13px;line-height:1.6;color:#6b5312;"><strong>Keep this pass private.</strong> The QR code and pass information identify your child at the gate.</td></tr></table>`;

  return {
    subject: `Permanent Gate Pass - ${data.studentName}`,
    preheader: `Permanent Gate Pass for ${data.studentName}. The complete pass is attached.`,
    html: buildShell({ body, preheader: `Permanent Gate Pass for ${data.studentName}. The complete pass is attached.`, logoUrl }),
    text: `Dear ${data.toName || 'Parent/Guardian'},\n\nThe complete Permanent Gate Pass ID for ${data.studentName} is attached to this email.\n\nName: ${data.studentName}\nGrade & Section: ${data.grade || '—'}\nPGP No.: ${data.pgpNo || '—'}\n\nPlease keep the attached pass private.\n`,
    attachments: attachment ? [{ filename: attachment.filename, content: attachment.buffer, contentType: attachment.contentType }] : []
  };
}

function buildExitEmail(data, logoUrl) {
  const student = escapeHtml(data.studentName);
  const parent = escapeHtml(data.toName || 'Parent/Guardian');
  const date = escapeHtml(formatDate(data.exitDate));
  const time = escapeHtml(data.exitTime || '—');
  const gate = escapeHtml(data.gateName || '—');

  const body = `
<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};">Dear ${parent},</p>
<p style="margin:0 0 22px;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};">This is to confirm that <strong style="color:${BRAND};">${student}</strong> has exited the school premises.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;"><tr><td style="padding:20px 22px;background:${PANEL};border-left:4px solid ${BRAND};border-radius:6px;">
<p style="margin:0 0 12px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${BRAND};">Gate Pass Information</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailsTable([
  ['Date', date],
  ['Time', time],
  ['Gate', gate]
])}</table>
</td></tr></table>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.65;color:${MUTED};">No action is required unless you believe this notification was sent in error. Please contact the Student Affairs Office if you need assistance.</p>`;

  return {
    subject: `Gate Pass Notification - ${data.studentName}`,
    preheader: `${data.studentName} exited via ${data.gateName || 'the gate'}.`,
    html: buildShell({ body, preheader: `${data.studentName} exited via ${data.gateName || 'the gate'}.`, logoUrl }),
    text: `Dear ${data.toName || 'Parent/Guardian'},\n\nThis is to confirm that ${data.studentName} has exited the school premises.\n\nDate: ${formatDate(data.exitDate)}\nTime: ${data.exitTime || '—'}\nGate: ${data.gateName || '—'}\n\nNo action is required unless you believe this notification was sent in error.\n`,
    attachments: []
  };
}

function getOAuthConfig() {
  return {
    clientId: clean(process.env.GMAIL_CLIENT_ID),
    clientSecret: clean(process.env.GMAIL_CLIENT_SECRET),
    refreshToken: clean(process.env.GMAIL_REFRESH_TOKEN),
    userEmail: clean(process.env.GMAIL_USER_EMAIL),
    fromName: clean(process.env.GMAIL_FROM_NAME, DEFAULT_FROM_NAME)
  };
}

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // Report Google's code *and* its description. The code is the part that
    // says what to do — invalid_grant means re-mint the token, invalid_client
    // means the id/secret pair is wrong — and reporting only the description
    // threw that away.
    const detail = [data.error, data.error_description].filter(Boolean).join(': ') ||
      'No access token returned.';
    throw new Error(`Google OAuth token refresh failed (HTTP ${response.status}): ${detail}`);
  }
  return data.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // GET ?selftest=1 answers one question — can this deployment obtain a Gmail
  // access token — and sends nothing. A failing send returns 502 with Google's
  // reason inside, but the only way to see it used to be to try to mail a real
  // parent. This separates "is the mail configuration working" from "deliver
  // this message". It never echoes a secret, only whether each variable is set.
  const isSelfTest = req.method === 'GET' &&
    String((req.query && req.query.selftest) || '') === '1';

  if (req.method !== 'POST' && !isSelfTest) {
    return res.status(405).json({ success: false, message: 'POST request required.' });
  }

  // This endpoint sends mail from the school's own address. Without a caller
  // check anyone who knows the URL can do that too. See api/_lib/request-guard.
  if (rejected(req, res, { name: 'email' })) return;

  const config = getOAuthConfig();
  const missing = Object.entries({
    GMAIL_CLIENT_ID: config.clientId,
    GMAIL_CLIENT_SECRET: config.clientSecret,
    GMAIL_REFRESH_TOKEN: config.refreshToken,
    GMAIL_USER_EMAIL: config.userEmail
  }).filter(([, value]) => !value).map(([name]) => name);

  if (isSelfTest) {
    const present = {
      GMAIL_CLIENT_ID: !!config.clientId,
      GMAIL_CLIENT_SECRET: !!config.clientSecret,
      GMAIL_REFRESH_TOKEN: !!config.refreshToken,
      GMAIL_USER_EMAIL: !!config.userEmail
    };

    if (missing.length) {
      return res.status(200).json({
        selftest: true, ok: false, stage: 'configuration', present,
        sender: config.userEmail || null,
        reason: `Missing environment variable(s): ${missing.join(', ')}.`,
        fix: 'Add them in Vercel > Settings > Environment Variables (Production), then redeploy.'
      });
    }

    try {
      await getAccessToken(config);
      return res.status(200).json({
        selftest: true, ok: true, stage: 'oauth', present,
        sender: config.userEmail,
        reason: 'Google issued an access token. The mail configuration is working. No message was sent.'
      });
    } catch (err) {
      const text = (err && err.message) || String(err);
      // Map Google's two usual refusals onto what actually has to change.
      let fix = 'Check the four GMAIL_* values in Vercel, then redeploy.';
      if (/invalid_grant|expired or revoked/i.test(text)) {
        fix = 'The refresh token is no longer valid — it was revoked, or it expired because the ' +
              'Google Cloud OAuth consent screen is still in Testing (tokens last 7 days there). ' +
              'Set the consent screen to Internal, then mint a new token at /api/oauth-start and ' +
              'save it as GMAIL_REFRESH_TOKEN.';
      } else if (/invalid_client|unauthorized_client/i.test(text)) {
        fix = 'GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET do not belong to the same OAuth client, or ' +
              'the secret was reset in Google Cloud Console. Copy both from the same client.';
      }
      return res.status(200).json({
        selftest: true, ok: false, stage: 'oauth', present,
        sender: config.userEmail, reason: text, fix
      });
    }
  }

  if (missing.length) {
    return res.status(500).json({
      success: false,
      message: `Email configuration is incomplete. Missing: ${missing.join(', ')}. Add them to Vercel Environment Variables and redeploy.`
    });
  }

  const body = parseBody(req);
  const toEmail = clean(body.to_email);
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return res.status(400).json({ success: false, message: 'A valid recipient email address is required.' });
  }

  const emailType = clean(body.email_type, 'exit_notification');
  const data = {
    toName: clean(body.to_name, 'Parent/Guardian'),
    toEmail,
    studentName: clean(body.student_name, 'Student'),
    grade: clean(body.grade),
    pgpNo: clean(body.pgp_no),
    gateName: clean(body.gate_name),
    exitTime: clean(body.exit_time),
    exitDate: clean(body.exit_date)
  };

  const attachment = emailType === 'pgp_delivery' ? decodeAttachment(body) : null;
  if (emailType === 'pgp_delivery' && !attachment) {
    return res.status(400).json({ success: false, message: 'The Permanent Gate Pass image attachment is missing or invalid.' });
  }

  const logoUrl = getLogoUrl(req);
  const message = emailType === 'pgp_delivery'
    ? buildPgpEmail(data, attachment, logoUrl)
    : buildExitEmail(data, logoUrl);

  try {
    const accessToken = await getAccessToken(config);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config.userEmail,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: config.refreshToken,
        accessToken
      }
    });

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.userEmail}>`,
      replyTo: config.userEmail,
      to: data.toEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments
    });

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully.',
      recipient: data.toEmail,
      sender: config.userEmail,
      email_type: emailType,
      attached: message.attachments.length > 0,
      messageId: info.messageId
    });
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    return res.status(502).json({
      success: false,
      message: 'Email could not be sent.',
      error: error && error.message ? error.message : String(error)
    });
  }
};

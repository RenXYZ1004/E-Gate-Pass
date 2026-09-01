/**
 * Vercel serverless handler for parent notifications.
 *
 * Supported email_type values:
 *   pgp_delivery      — sends the Permanent Gate Pass as an attachment only
 *   exit_notification — confirms a gate exit
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { rejected } = require('./_lib/request-guard');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function clean(value, fallback = '') {
  const str =
    value === null || value === undefined
      ? ''
      : String(value).trim();

  return str === '' ? fallback : str;
}

/**
 * Decode the Base64 Gate Pass image.
 *
 * The image is NOT displayed inside the email.
 * It is attached as a normal downloadable attachment only.
 */
function decodeCard(rawBase64, fileName) {
  let data = clean(rawBase64);

  if (!data) {
    return null;
  }

  // Accept a full data URI.
  if (data.startsWith('data:')) {
    const comma = data.indexOf(',');

    if (comma !== -1) {
      data = data.slice(comma + 1);
    }
  }

  data = data.replace(/\s+/g, '');

  let buffer;

  try {
    buffer = Buffer.from(data, 'base64');
  } catch (_) {
    return null;
  }

  if (!buffer || buffer.length === 0) {
    return null;
  }

  /*
   * Detect image type.
   */
  let mime = 'image/jpeg';

  // PNG signature
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    mime = 'image/png';
  }

  // JPEG signature
  else if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    mime = 'image/jpeg';
  }

  const wantedExtension =
    mime === 'image/png'
      ? '.png'
      : '.jpg';

  let name = clean(
    fileName,
    'Permanent_Gate_Pass' + wantedExtension
  );

  const currentExtension =
    path.extname(name).toLowerCase();

  if (currentExtension !== wantedExtension) {
    name =
      (path.basename(name, path.extname(name)) ||
        'Permanent_Gate_Pass') +
      wantedExtension;
  }

  return {
    buffer,
    mime,
    name
  };
}

/**
 * Load school logo.
 *
 * The logo is embedded in the email header using CID.
 * It is not presented as a downloadable Gate Pass attachment.
 */
function loadLogo() {
  const candidates = [
    path.join(process.cwd(), 'SISC_logo.png'),
    path.join(__dirname, '..', 'SISC_logo.png'),
    path.join(__dirname, 'SISC_logo.png')
  ];

  for (const file of candidates) {
    try {
      return fs.readFileSync(file);
    } catch (_) {
      // Try next location.
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Design
 * ------------------------------------------------------------------ */

const BRAND = '#341539';
const ACCENT = '#00c9b1';
const INK = '#25212a';
const MUTED = '#68616d';
const HAIRLINE = '#e3dce8';
const PANEL = '#f8f5fa';

const FONT =
  "Arial, 'Helvetica Neue', Helvetica, sans-serif";

const MONO =
  "'Courier New', Courier, monospace";

const P_TEXT =
  `margin:0 0 16px 0;` +
  `font-family:${FONT};` +
  `font-size:15px;` +
  `line-height:1.65;` +
  `color:${INK};`;

const P_SMALL =
  `margin:0;` +
  `font-family:${FONT};` +
  `font-size:13px;` +
  `line-height:1.65;` +
  `color:${MUTED};`;

const P_HEAD =
  `margin:0 0 12px 0;` +
  `font-family:${FONT};` +
  `font-size:13px;` +
  `font-weight:700;` +
  `letter-spacing:0.5px;` +
  `text-transform:uppercase;` +
  `color:${BRAND};`;

/* ------------------------------------------------------------------ *
 * Details table
 * ------------------------------------------------------------------ */

function detailRow(label, value, valueStyle = '') {
  if (!value || !String(value).trim()) {
    return '';
  }

  const labelStyle =
    `padding:9px 12px 9px 0;` +
    `font-family:${FONT};` +
    `font-size:12px;` +
    `line-height:1.4;` +
    `color:${MUTED};` +
    `font-weight:700;` +
    `text-transform:uppercase;` +
    `letter-spacing:0.4px;` +
    `white-space:nowrap;` +
    `vertical-align:top;` +
    `border-bottom:1px solid ${HAIRLINE};`;

  const cellStyle =
    `padding:9px 0;` +
    `font-family:${FONT};` +
    `font-size:14px;` +
    `line-height:1.45;` +
    `color:${INK};` +
    `font-weight:700;` +
    `vertical-align:top;` +
    `border-bottom:1px solid ${HAIRLINE};` +
    valueStyle;

  return `
<tr>
    <td width="132" style="${labelStyle}">
        ${label}
    </td>

    <td style="${cellStyle}">
        ${value}
    </td>
</tr>`;
}

/* ------------------------------------------------------------------ *
 * Numbered instructions
 * ------------------------------------------------------------------ */

function numberedStep(index, text, isLast) {
  const padding =
    isLast
      ? '0'
      : '0 0 10px 0';

  return `
<tr>
    <td
        width="26"
        style="
            padding:${padding};
            font-family:${FONT};
            font-size:14px;
            font-weight:700;
            color:${ACCENT};
            vertical-align:top;
        "
    >
        ${index}.
    </td>

    <td
        style="
            padding:${padding};
            font-family:${FONT};
            font-size:14px;
            line-height:1.55;
            color:${INK};
            vertical-align:top;
        "
    >
        ${text}
    </td>
</tr>`;
}

/* ------------------------------------------------------------------ *
 * Email shell
 * ------------------------------------------------------------------ */

function buildShell(bodyContent, preheader, hasLogo) {
  const logoCell = hasLogo
    ? `
<td
    width="72"
    style="
        width:72px;
        padding:0 14px 0 0;
        vertical-align:middle;
    "
>
    <img
        src="cid:school_logo"
        alt="SISC"
        width="58"
        height="58"
        style="
            display:block;
            width:58px;
            height:58px;
            border:0;
        "
    >
</td>`
    : '';

  return `<!DOCTYPE html>
<html
    xmlns="http://www.w3.org/1999/xhtml"
    lang="en"
>
<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1"
>

<meta
    name="x-apple-disable-message-reformatting"
>

<meta
    name="color-scheme"
    content="light"
>

<meta
    name="supported-color-schemes"
    content="light"
>

<title>
    Southville International School and Colleges
</title>

<!--[if mso]>
<style type="text/css">
    table,
    td,
    p,
    div,
    h1,
    strong {
        font-family: Arial, Helvetica, sans-serif !important;
    }
</style>
<![endif]-->

<style type="text/css">

body {
    margin:0 !important;
    padding:0 !important;
    width:100% !important;
}

img {
    -ms-interpolation-mode:bicubic;
}

@media only screen and (max-width:620px) {

    .gp-pad {
        padding-left:20px !important;
        padding-right:20px !important;
    }

    .gp-name {
        font-size:17px !important;
    }

}

</style>

</head>

<body
    style="
        margin:0;
        padding:0;
        width:100%;
        background-color:#f5f3f7;
    "
>

<!-- Preheader -->

<div
    style="
        display:none;
        max-height:0;
        overflow:hidden;
        mso-hide:all;
        font-size:1px;
        line-height:1px;
        color:#f5f3f7;
    "
>
    ${preheader}
</div>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="#f5f3f7"
    style="
        width:100%;
        background-color:#f5f3f7;
    "
>

<tr>

<td
    align="center"
    style="padding:28px 12px;"
>

<!--[if mso]>
<table
    role="presentation"
    width="640"
    cellpadding="0"
    cellspacing="0"
    border="0"
>
<tr>
<td>
<![endif]-->

<table
    role="presentation"
    width="640"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="#ffffff"
    style="
        width:100%;
        max-width:640px;
        background-color:#ffffff;
        border:1px solid ${HAIRLINE};
        border-radius:10px;
        overflow:hidden;
    "
>

<!-- SCHOOL HEADER -->

<tr>

<td
    class="gp-pad"
    bgcolor="${BRAND}"
    style="
        padding:22px 28px;
        background-color:${BRAND};
        border-radius:10px 10px 0 0;
    "
>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
>

<tr>

${logoCell}

<td
    style="
        vertical-align:middle;
    "
>

<h1
    class="gp-name"
    style="
        margin:0;
        padding:0;
        font-family:${FONT};
        font-size:20px;
        line-height:1.25;
        font-weight:700;
        color:#ffffff;
    "
>
    Southville International School and Colleges
</h1>

<p
    style="
        margin:6px 0 0 0;
        padding:0;
        font-family:${FONT};
        font-size:10px;
        line-height:1.55;
        color:#e8dfea;
    "
>
    1281 Tropical Ave. Cor. Luxembourg St.,
    BF Homes Int'l.,
    Las Pi&ntilde;as City,
    Metro Manila, Philippines
    <br>

    Tel. Nos. 8825-6374 (PR Office) /
    8820-8702
    &nbsp;|&nbsp;
    Mobile No. +63 917 853 2450
</p>

</td>

</tr>

</table>

</td>

</tr>

<!-- ACCENT -->

<tr>

<td
    bgcolor="${ACCENT}"
    height="4"
    style="
        height:4px;
        line-height:4px;
        font-size:0;
        background-color:${ACCENT};
    "
>
    &nbsp;
</td>

</tr>

<!-- CONTENT -->

<tr>

<td
    class="gp-pad"
    style="padding:30px 32px;"
>

${bodyContent}

</td>

</tr>

<!-- FOOTER -->

<tr>

<td
    class="gp-pad"
    bgcolor="#f8f6f9"
    align="center"
    style="
        padding:18px 28px;
        background-color:#f8f6f9;
        border-top:1px solid #e8e2eb;
        border-radius:0 0 10px 10px;
    "
>

<p
    style="
        margin:0;
        font-family:${FONT};
        font-size:11px;
        line-height:1.6;
        color:#77717a;
    "
>
    This is an automated message from the
    Southville International School and Colleges
    e-Gatepass System.
    <br>
    If you think this is a mistake, kindly reply to this email.
</p>

</td>

</tr>

</table>

<!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

</td>

</tr>

</table>

</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * PGP DELIVERY
 *
 * IMPORTANT:
 *
 * The Gate Pass image is NOT displayed inside the email.
 * It is attached as a normal downloadable file only.
 * ------------------------------------------------------------------ */

function buildPgpDelivery(data, card) {
  const student = escapeHtml(data.studentName);
  const parent = escapeHtml(data.parentLabel);
  const grade = escapeHtml(data.grade);
  const pgpNo = escapeHtml(data.pgpNo);

  const attachmentMessage = card
    ? `
<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:22px 0 26px 0;"
>

<tr>

<td
    align="center"
    bgcolor="${PANEL}"
    style="
        padding:24px 20px;
        background-color:${PANEL};
        border:1px solid ${HAIRLINE};
        border-radius:10px;
    "
>

<div
    style="
        font-family:${FONT};
        font-size:11px;
        font-weight:700;
        letter-spacing:1.5px;
        text-transform:uppercase;
        color:${MUTED};
    "
>
    Permanent Gate Pass
</div>

<div
    style="
        margin-top:8px;
        font-family:${FONT};
        font-size:15px;
        line-height:1.5;
        font-weight:700;
        color:${BRAND};
    "
>
    Your Gate Pass is attached to this email.
</div>

<div
    style="
        margin-top:8px;
        font-family:${FONT};
        font-size:12px;
        line-height:1.55;
        color:${MUTED};
    "
>
    Please download the attached file and keep it
    available for presentation at the school gate.
</div>

</td>

</tr>

</table>`
    : `
<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:22px 0 26px 0;"
>

<tr>

<td
    align="center"
    bgcolor="${PANEL}"
    style="
        padding:22px 18px;
        background-color:${PANEL};
        border:1px solid ${HAIRLINE};
        border-radius:10px;
    "
>

<div
    style="
        font-family:${FONT};
        font-size:11px;
        font-weight:700;
        letter-spacing:1.5px;
        text-transform:uppercase;
        color:${MUTED};
    "
>
    Gate Pass
</div>

<div
    style="
        margin-top:8px;
        font-family:${FONT};
        font-size:14px;
        line-height:1.55;
        color:${INK};
    "
>
    The Gate Pass attachment could not be generated.
</div>

<div
    style="
        margin-top:8px;
        font-family:${FONT};
        font-size:12px;
        line-height:1.55;
        color:${MUTED};
    "
>
    Please contact the Student Affairs Office
    for assistance.
</div>

</td>

</tr>

</table>`;

  const rows =
    detailRow('Student', student) +
    detailRow('Grade &amp; Section', grade) +
    detailRow(
      'Pass No.',
      pgpNo,
      `
        font-family:${MONO};
        font-size:15px;
        letter-spacing:1px;
        color:${BRAND};
      `
    );

  const html = `

<p style="${P_TEXT}">
    Dear ${parent},
</p>

<p style="${P_TEXT}">
    The Permanent Gate Pass for
    <strong style="color:${BRAND};">
        ${student}
    </strong>
    has been issued.
</p>

${attachmentMessage}

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0 0 26px 0;"
>

<tr>

<td
    bgcolor="${PANEL}"
    style="
        padding:20px 22px;
        background-color:${PANEL};
        border-left:4px solid ${BRAND};
        border-radius:6px;
    "
>

<p style="${P_HEAD}">
    Pass Details
</p>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
>

${rows}

</table>

</td>

</tr>

</table>

<p style="${P_HEAD}">
    How to use this pass
</p>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0 0 26px 0;"
>

${numberedStep(
  1,
  "Download the attached Gate Pass and save it to your child's phone, or print it and keep it with their school ID.",
  false
)}

${numberedStep(
  2,
  'Present the QR code from the attached Gate Pass to the guard at the gate on exit.',
  false
)}

${numberedStep(
  3,
  'You will receive an email notification each time the pass is used.',
  true
)}

</table>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
>

<tr>

<td
    bgcolor="#fff8e6"
    style="
        padding:14px 16px;
        background-color:#fff8e6;
        border:1px solid #f3e3b3;
        border-radius:6px;
        font-family:${FONT};
        font-size:13px;
        line-height:1.6;
        color:#6b5312;
    "
>

<strong>
    Keep this pass private.
</strong>

The QR code identifies your child at the gate.
If the pass is lost or shared by mistake,
contact the Student Affairs Office so it can
be revoked and reissued.

</td>

</tr>

</table>`;

  const text =
    `Dear ${data.parentLabel},\n\n` +
    `The Permanent Gate Pass for ${data.studentName} has been issued.\n\n` +

    `PASS DETAILS\n` +
    `  Student  : ${data.studentName}\n` +
    (data.grade
      ? `  Grade    : ${data.grade}\n`
      : '') +
    `  Pass No. : ${data.pgpNo}\n\n` +

    (
      card
        ? `The Permanent Gate Pass is attached to this email as ${card.name}.\n\n`
        : `The Gate Pass attachment could not be generated.\n` +
          `Please contact the Student Affairs Office for assistance.\n\n`
    ) +

    `HOW TO USE THIS PASS\n` +
    `  1. Download the attached Gate Pass and save it to your child's phone,\n` +
    `     or print it and keep it with their school ID.\n` +
    `  2. Present the QR code from the attached Gate Pass to the guard at the gate on exit.\n` +
    `  3. You will receive an email notification each time the pass is used.\n\n` +

    `Keep this pass private. The QR code identifies your child at the gate.\n` +
    `If the pass is lost or shared by mistake, contact the Student Affairs Office\n` +
    `so it can be revoked and reissued.\n\n`;

  const preheader = escapeHtml(
    data.pgpNo
      ? `Permanent Gate Pass ${data.pgpNo} has been issued.`
      : 'The Permanent Gate Pass has been issued.'
  );

  return {
    subject:
      `Permanent Gate Pass for ${data.studentName}`,

    html,

    text,

    preheader
  };
}

/* ------------------------------------------------------------------ *
 * EXIT NOTIFICATION
 * ------------------------------------------------------------------ */

function buildExitNotification(data) {
  const student = escapeHtml(data.studentName);
  const parent = escapeHtml(data.parentLabel);

  const rows =
    detailRow(
      'Date',
      escapeHtml(data.exitDate)
    ) +

    detailRow(
      'Time',
      escapeHtml(data.exitTime)
    ) +

    detailRow(
      'Gate',
      escapeHtml(data.gateName)
    );

  const html = `

<p style="${P_TEXT}">
    Dear ${parent},
</p>

<p style="${P_TEXT}">
    This is to confirm that
    <strong style="color:${BRAND};">
        ${student}
    </strong>
    has exited the school premises.
</p>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="margin:0 0 26px 0;"
>

<tr>

<td
    bgcolor="${PANEL}"
    style="
        padding:20px 22px;
        background-color:${PANEL};
        border-left:4px solid ${BRAND};
        border-radius:6px;
    "
>

<p style="${P_HEAD}">
    Exit Details
</p>

<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
>

${rows}

</table>

</td>

</tr>

</table>

<p style="${P_SMALL}">
    No action is required.
    If you believe this notification was sent in error,
    please contact the Student Affairs Office.
</p>`;

  const text =
    `Dear ${data.parentLabel},\n\n` +

    `This is to confirm that ${data.studentName} ` +
    `has exited the school premises.\n\n` +

    `EXIT DETAILS\n` +
    `  Date : ${data.exitDate}\n` +
    `  Time : ${data.exitTime}\n` +
    `  Gate : ${data.gateName}\n\n` +

    `No action is required. If you believe this notification ` +
    `was sent in error, please contact the Student Affairs Office.\n\n`;

  const preheader = escapeHtml(
    `${data.studentName} exited via ${data.gateName}` +
    (
      data.exitTime
        ? ` at ${data.exitTime}`
        : ''
    ) +
    '.'
  );

  return {
    subject:
      `Gate Exit Notification - ${data.studentName}`,

    html,

    text,

    preheader
  };
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

const FOOTER_TEXT =
  '--\n' +
  'This is an automated message from the Southville International School\n' +
  'and Colleges e-Gatepass System. Please do not reply to this email.\n';

/* ------------------------------------------------------------------ *
 * Vercel Handler
 * ------------------------------------------------------------------ */

module.exports = async function handler(req, res) {
  res.setHeader(
    'Content-Type',
    'application/json; charset=utf-8'
  );

  /*
   * Only POST is allowed.
   */
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'POST request required.'
    });
  }

  // Same open-relay exposure as /api/send-email: this handler is reachable at
  // /api/mailer and at /api/send-email.php through the rewrite in vercel.json.
  if (rejected(req, res, { name: 'email' })) return;

  /*
   * Environment variables.
   */
  const clientId =
    process.env.GMAIL_CLIENT_ID || '';

  const clientSecret =
    process.env.GMAIL_CLIENT_SECRET || '';

  const refreshToken =
    process.env.GMAIL_REFRESH_TOKEN || '';

  const userEmail =
    process.env.GMAIL_USER_EMAIL || '';

  const fromName =
    process.env.GMAIL_FROM_NAME ||
    'Southville Gatepass System';

  /*
   * Check configuration.
   */
  const missingEnv = Object.entries({
    GMAIL_CLIENT_ID: clientId,
    GMAIL_CLIENT_SECRET: clientSecret,
    GMAIL_REFRESH_TOKEN: refreshToken,
    GMAIL_USER_EMAIL: userEmail
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingEnv.length > 0) {
    return res.status(500).json({
      success: false,

      message:
        `Email configuration is incomplete: ` +
        `${missingEnv.join(', ')} ` +
        `${missingEnv.length === 1 ? 'is' : 'are'} not set. ` +
        `Add ${missingEnv.length === 1 ? 'it' : 'them'} under ` +
        `Vercel > Settings > Environment Variables, ` +
        `then redeploy.`,

      missing: missingEnv
    });
  }

  /*
   * Read request body.
   */
  let body = req.body || {};

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON request.'
      });
    }
  }

  /*
   * Recipient.
   */
  const toEmail =
    clean(body.to_email);

  if (
    !toEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)
  ) {
    return res.status(400).json({
      success: false,
      message:
        'A valid recipient email address is required.'
    });
  }

  /*
   * Email type.
   */
  const emailType =
    clean(
      body.email_type,
      'exit_notification'
    );

  /*
   * Format exit date.
   *
   * Example:
   * Tuesday, August 25, 2026
   */
  const rawDate =
    clean(body.exit_date);

  let exitDate;

  if (
    rawDate &&
    rawDate !== 'N/A'
  ) {
    const parsed =
      new Date(rawDate);

    if (!Number.isNaN(parsed.getTime())) {
      exitDate =
        parsed.toLocaleDateString(
          'en-US',
          {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        );
    } else {
      exitDate = rawDate;
    }
  } else {
    exitDate =
      new Date().toLocaleDateString(
        'en-US',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }
      );
  }

  /*
   * Normalized data.
   */
  const data = {
    parentLabel:
      clean(
        body.to_name,
        'Parent/Guardian'
      ),

    studentName:
      clean(
        body.student_name,
        'Student'
      ),

    gateName:
      clean(
        body.gate_name,
        'Gate'
      ),

    exitTime:
      clean(body.exit_time),

    exitDate,

    grade:
      clean(body.grade),

    pgpNo:
      clean(body.pgp_no)
  };

  /*
   * PGP attachment.
   *
   * IMPORTANT:
   * The card is decoded only so it can be attached.
   * It is NOT inserted into the HTML.
   */
  const card =
    emailType === 'pgp_delivery'
      ? decodeCard(
          body.attachment_base64,
          body.attachment_name
        )
      : null;

  /*
   * Build email.
   */
  const message =
    emailType === 'pgp_delivery'
      ? buildPgpDelivery(
          data,
          card
        )
      : buildExitNotification(
          data
        );

  /*
   * School logo.
   */
  const logo =
    loadLogo();

  /*
   * Attachments.
   *
   * IMPORTANT:
   *
   * The Gate Pass is attached ONLY ONCE.
   *
   * There is NO:
   *
   *   cid:gatepass_card
   *
   * and NO:
   *
   *   contentDisposition: inline
   *
   * for the Gate Pass.
   */
  const attachments = [];

  /*
   * School logo.
   *
   * This remains an inline CID image because it is part
   * of the email header.
   */
  if (logo) {
    attachments.push({
      filename: 'SISC_logo.png',
      content: logo,
      contentType: 'image/png',
      cid: 'school_logo',
      contentDisposition: 'inline'
    });
  }

  /*
   * Permanent Gate Pass.
   *
   * ONLY a normal downloadable attachment.
   */
  if (card) {
    attachments.push({
      filename: card.name,
      content: card.buffer,
      contentType: card.mime,
      contentDisposition: 'attachment'
    });
  }

  /*
   * Gmail OAuth2 transporter.
   */
  const transporter =
    nodemailer.createTransport({
      service: 'gmail',

      auth: {
        type: 'OAuth2',

        user: userEmail,

        clientId,

        clientSecret,

        refreshToken
      }
    });

  /*
   * Send.
   */
  try {
    await transporter.sendMail({
      from:
        `"${fromName}" <${userEmail}>`,

      to:
        toEmail,

      replyTo:
        `"${fromName}" <${userEmail}>`,

      subject:
        message.subject,

      text:
        message.text +
        FOOTER_TEXT,

      html:
        buildShell(
          message.html,
          message.preheader,
          Boolean(logo)
        ),

      attachments
    });

    return res.status(200).json({
      success: true,

      message:
        'Email sent successfully.',

      recipient:
        toEmail,

      sender:
        userEmail,

      email_type:
        emailType,

      attached:
        Boolean(card)
    });

  } catch (err) {
    console.error(
      'Email send error:',
      err && err.message
    );

    return res.status(502).json({
      success: false,

      message:
        'Email error: ' +
        (
          (err && err.message) ||
          'Unknown error'
        )
    });
  }
};

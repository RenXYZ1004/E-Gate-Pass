# e-Gatepass — Email / SMTP Review & Audit

**Scope:** every file involved in sending mail to `parentEmail`.
**Date:** 2026-08-26
**Method:** static read-through of the mail path, client trigger → transport → Gmail. No code was changed.

---

## 1. Verdict

The automatic parent email **does run on SMTP**. There is no EmailJS code left anywhere in
the application — the only surviving mention of EmailJS is stale prose in `README.md`.

Two independent mailers exist, both speaking SMTP to `smtp.gmail.com` with **OAuth2 / XOAUTH2**
(no password, no app password, no third-party relay):

| Runtime | File | Transport | Auth source |
|---|---|---|---|
| Vercel (production) | `api/mailer.js` | Nodemailer → `smtp.gmail.com:465` (implicit TLS) | Vercel env vars |
| XAMPP / PHP (local) | `api/send-email.php` + `api/PHPMailer/` | PHPMailer → `smtp.gmail.com:587` (STARTTLS) | `api/email-config.php` + `api/gmail-oauth-token.json` |

The system is functionally correct. The problems below are **maintainability and security**
problems, not "it doesn't send" problems.

---

## 2. How the automatic email actually works

### 2.1 The one-URL trick

The browser only ever calls **one** endpoint:

```js
// js/controllers/AppController.js:57
const response = await fetch('./api/send-email.php', { method: 'POST', ... });
```

On XAMPP that path is a real PHP file and Apache executes it. On Vercel there is no PHP
runtime, so `vercel.json` silently redirects the same URL to the Node function:

```json
"rewrites": [
  { "source": "/api/send-email.php", "destination": "/api/mailer" }
]
```

This is why the client never had to change when the backend moved. It is also the single
most confusing thing in the codebase for a new reader: **the file being called is not the
file being executed in production.**

### 2.2 Flow A — exit notification (the "automatic" email)

1. Guard scans a QR / RFID / manual ID at the gate.
2. `AppController.handleScanResult()` renders the result overlay and refreshes the live feed.
3. If the scan was **granted** and the student record has a `parentEmail`
   (`js/controllers/AppController.js:761`), it builds `templateParams`:
   `to_name, to_email, student_name, gate_name, exit_time, exit_date`.
   Note there is **no `email_type`**, so the server defaults to `exit_notification`.
4. `sendParentEmail()` POSTs that JSON to `./api/send-email.php`.
5. On failure (offline, 5xx, network) the params are pushed to a localStorage queue
   (`AppModel.addEmailToQueue`, key `pgp_email_queue`) and retried on the `online` event
   and on every app boot.
6. Server side (`api/mailer.js`):
   - rejects non-POST with 405;
   - refuses to run unless all four env vars are present;
   - validates `to_email` against a simple regex;
   - normalises `exit_date` to `Weekday, Month D, YYYY`;
   - builds the HTML with `buildExitNotification()` + `buildShell()`, plus a plain-text twin;
   - embeds `SISC_logo.png` as a CID inline part (`cid:school_logo`) so it renders even when
     the client blocks remote images — `vercel.json`'s `includeFiles` is what puts that PNG
     in the function bundle;
   - hands everything to Nodemailer.

### 2.3 Flow B — PGP card delivery

`js/controllers/pages/PGPController.js:190-300`, triggered by the per-student
**Email** button or **Bulk Email**:

1. Renders the pass card off-screen (`left:-10000px`), draws the QR, `waitForImages()`.
2. `html2canvas(..., { scale: 2, useCORS: true })` → `toDataURL('image/jpeg', 0.85)` →
   strips the `data:` prefix → raw base64.
3. POSTs with `email_type: 'pgp_delivery'` plus `grade`, `pgp_no`, `attachment_base64`,
   `attachment_name`.
4. Server `decodeCard()` sniffs the real magic bytes (`\x89PNG` / `FFD8FF`), corrects the
   file extension to match, then adds the image **twice**: once inline as
   `cid:gatepass_card` so the card is visible in the body, once as a normal attachment so
   the parent can save or print it.
5. Sleeps 500 ms between students to stay under Gmail's send rate.
6. Failures are collected per-student and shown in a summary — this flow is **not** queued
   offline, unlike Flow A.

### 2.4 The actual SMTP conversation

**Node (production):**

```js
nodemailer.createTransport({
  service: 'gmail',                 // → smtp.gmail.com:465, secure: true
  auth: { type: 'OAuth2', user, clientId, clientSecret, refreshToken }
});
```

Nodemailer's XOAuth2 generator POSTs the refresh token to Google's token endpoint, gets a
~1 h access token, then authenticates the SMTP session with
`AUTH XOAUTH2 <base64 of "user=…^Aauth=Bearer …^A^A">`. Standard SMTP submission from there.

**PHP (local):** the same handshake, written by hand.
`api/GmailOAuthTokenProvider.php` implements PHPMailer's `OAuthTokenProvider` interface;
`getOauth64()` refreshes the access token via cURL when it is missing or within 60 s of
expiry, verifies the returned scope really contains `https://mail.google.com/` (a token
minted for `gmail.send` **cannot** do SMTP — that check exists because it is a real trap),
and returns the base64 XOAUTH2 blob. `send-email.php:540-570` wires it up with
`isSMTP()`, `Host=smtp.gmail.com`, `Port=587`, `AuthType='XOAUTH2'`, `ENCRYPTION_STARTTLS`.

The refresh token itself is minted once by the `oauth-start.php` → Google consent →
`oauth-callback.php` pair, which writes `api/gmail-oauth-token.json` (chmod 0600, and
denied by `api/.htaccess`). Both that file and `api/email-config.php` are gitignored.

### 2.5 Proof there is no EmailJS left

- No `emailjs` SDK `<script>` in `index.html` or `app.html`.
- No `emailjs.send(` / `SERVICE_ID` / `TEMPLATE_ID` / `PUBLIC_KEY` anywhere in `js/`.
- `templateParams` is a leftover *variable name* from the EmailJS era, not a dependency —
  the object is posted as plain JSON to our own endpoint.
- The only hits are `README.md:35`, `README.md:50`, and `README.md:83-86`, which still
  instruct the reader to create an EmailJS account and edit placeholders that no longer exist.

---

## 3. File inventory

| File | Role | Runs on Vercel? |
|---|---|---|
| `js/controllers/AppController.js` | `sendParentEmail()`, offline queue, exit-notification trigger | client |
| `js/controllers/pages/PGPController.js` | card render + `pgp_delivery` trigger, bulk loop | client |
| `js/models/AppModel.js` | `emailQueue` in localStorage | client |
| `vercel.json` | rewrite `.php` → `/api/mailer`, bundles the logo, `maxDuration: 30` | config |
| `api/mailer.js` | **the production mailer** (~590 lines, half of it the HTML template) | ✅ |
| `api/send-email.php` | the XAMPP mailer (~1200 lines, same template again) | ❌ dead code |
| `api/GmailOAuthTokenProvider.php` | XOAUTH2 token provider for PHPMailer | ❌ |
| `api/PHPMailer/` | vendored PHPMailer **7.1.1** | ❌ |
| `api/oauth-start.php` / `api/oauth-callback.php` | one-time consent flow, writes the refresh token | ❌ |
| `api/email-config.example.php` | template for the gitignored real config | — |
| `api/.htaccess` | denies web access to the secret files (Apache only) | ❌ |
| `package.json` | `nodemailer ^6.9.0` — the only runtime dependency | ✅ |

---

## 4. Findings

| # | Severity | Finding |
|---|---|---|
| F1 | **High** | The endpoint is unauthenticated — anyone can send school-branded mail to any address |
| F2 | **High** | `allowed_recipient_domain` exists in PHP but is **not implemented** in the Node mailer |
| F3 | **Medium** | Two full copies of the same 400-line HTML template, kept in sync by hand |
| F4 | **Medium** | `README.md` still documents EmailJS as the email service |
| F5 | **Medium** | No attachment size guard — a large card silently becomes a 413 the client can't parse |
| F6 | **Medium** | Offline queue head-of-line blocks forever on a permanently-failing email |
| F7 | **Medium** | PGP bulk delivery is not queued and not resumable |
| F8 | **Low** | Raw SMTP/OAuth error text is returned to the browser |
| F9 | **Low** | Transporter, logo and access token are rebuilt on every invocation |
| F10 | **Low** | No SMTP timeouts under a 30 s `maxDuration` |
| F11 | **Low** | Recipient display name (`to_name`) is dropped in the Node path |
| F12 | **Low** | `exit_date` fallback uses the server's UTC clock, not Manila time |
| F13 | **Low** | `qr_token` is read and never used in `send-email.php` |
| F14 | **Info** | Verify the Vercel rewrite actually shadows the static `send-email.php` file |

### F1 — The mail endpoint is an open relay for your school's identity (High)

`POST /api/send-email.php` accepts any `to_email`, any `student_name`, any `gate_name`, and
sends it from the school's real Gmail account, with the school's logo, address and phone
number in the header, and "This is an automated message from the … e-Gatepass System" in the
footer. There is no session check, no API key, no origin check, no rate limit.

Anyone who opens DevTools on the deployed site — or simply reads the URL out of the public
JavaScript — can send perfectly convincing mail *as the school* to any parent. It also lets a
stranger burn the Gmail account's daily send quota, which would take the real notifications
down with it.

`credentials: 'same-origin'` on the fetch does nothing here; the server never looks at a cookie.

### F2 — The one guard that exists was not ported (High)

`send-email.php:395-424` implements `allowed_recipient_domain`: it compares the recipient's
domain against the configured one and returns 403 on mismatch. `api/mailer.js` has no
equivalent — the config key isn't even read. So the safety valve is present in the runtime
that is dead and absent from the runtime that is live.

### F3 — The template is duplicated, and the code says so (Medium)

`api/mailer.js:5-7` states the contract plainly: *"The request contract and the rendered
message must stay identical to api/send-email.php — change one, change the other."*

That is roughly 800 lines of near-identical table-based HTML, design tokens, escaping
helpers, date formatting and MIME assembly kept in sync by discipline alone. Each of these
already exists twice: `escapeHtml`/`$esc`, `detailRow`, `numberedStep`, `buildShell`, the
brand colour constants, the card-decoding and extension-fixing logic, the plain-text twin.
The next brand tweak will land in one file and quietly not in the other, and because the PHP
path only runs on someone's laptop, nobody will notice for months.

### F5 — No size guard on the base64 card (Medium)

`html2canvas` at `scale: 2` on a high-DPI card, JPEG q0.85, base64-inflated by 33 %, is
usually a few hundred KB — but it is unbounded, and Vercel rejects request bodies over
~4.5 MB. When that happens the platform returns an **HTML** error page, `response.json()`
throws, and the client reports a generic `Email Api returned HTTP 413`. Neither side checks
the length before sending. `decodeCard()` also uses `Buffer.from(str, 'base64')`, which
silently discards invalid characters instead of failing — unlike the PHP side, which passes
`true` to `base64_decode()` for strict mode.

### F6 — The offline queue can wedge (Medium)

```js
// AppController.js:80-88
while (this.model.emailQueue.length > 0) {
  const params = this.model.emailQueue[0];
  try { await this.sendParentEmail(params); await this.model.removeEmailFromQueue(0); }
  catch (err) { break; }   // ← stops on ANY failure
}
```

`break` is correct for a network outage. It is wrong for a *permanent* failure — a malformed
parent address, a 400 from validation, a revoked OAuth grant. Item 0 fails forever, and every
notification queued behind it is stuck behind it, silently, with no retry counter, no expiry,
and no UI indicating there is a backlog. The queue is also per-browser localStorage, so a
guard switching devices loses it.

### F7 — Bulk PGP delivery has no safety net (Medium)

The bulk loop awaits each send with a 500 ms gap and shows a per-student failure list, but
nothing is persisted. Closing the tab, a laptop sleeping, or a Gmail quota trip halfway
through 300 students leaves no record of who received their pass. The operator's only
recovery is to re-send to everyone, duplicating mail to those who already got it.

### F8 — Error text is echoed to the client (Low)

`api/mailer.js:585-588` returns `'Email error: ' + err.message`. Nodemailer/SMTP errors can
carry the sender address, the SMTP host, Google's rejection reason, and occasionally the
literal server response. Useful in dev; it belongs in `console.error` only, with a generic
message to the browser. The PHP side does the same with `'PHPMailer error: ' . $e->getMessage()`.

### F9 / F10 — Cold-path work and missing timeouts (Low)

Every invocation calls `loadLogo()` (a synchronous disk read of a ~68 KB PNG), constructs a
fresh transporter, and therefore performs a fresh OAuth token refresh round-trip to Google
before the SMTP session even starts. Hoisting the logo buffer and the transporter to module
scope lets warm Vercel invocations reuse both, and lets Nodemailer's XOAuth2 cache do its job.
Related: no `connectionTimeout` / `greetingTimeout` / `socketTimeout` is set, so a stalled SMTP
connection runs into the 30 s `maxDuration` and returns a platform 504 rather than a clean
JSON error the client could queue on.

### F11 / F12 / F13 — Parity drift (Low)

- PHP does `$mail->addAddress($toEmail, $toName)` so the parent sees *"Maria Santos
  &lt;maria@…&gt;"*. Node does `to: toEmail` — the display name is discarded.
- When `exit_date` is absent, Node falls back to `new Date().toLocaleDateString('en-US', …)`
  evaluated in the function's timezone, which is UTC on Vercel. A 5 PM Manila exit would be
  dated the previous day. The client normally sends the date explicitly, so this only bites on
  the fallback path — but it is a real off-by-one waiting for the first request that omits it.
- `send-email.php:325` reads `$qrToken` and never uses it. Dead.

### F14 — Confirm the rewrite really wins (Info)

`api/send-email.php` is still present in the deployed tree, and `vercel.json` `rewrites` are
evaluated *after* the filesystem check. If Vercel served that path as a static asset, the
request would return PHP **source** with a 200 and the client would fail on `response.json()`.
You report that mail sends correctly, so in practice the rewrite is winning — but this is worth
pinning down deliberately rather than relying on. One command settles it:

```bash
curl -s -X POST https://YOUR-DOMAIN/api/send-email.php \
     -H 'Content-Type: application/json' -d '{}' | head -5
```

A JSON body mentioning the recipient email means the function is handling it. Anything
starting with `<?php` means the source file is being served and must be excluded from the
deployment.

---

## 5. PHP ↔ Node parity matrix

| Behaviour | `send-email.php` | `api/mailer.js` |
|---|---|---|
| POST-only 405 | ✅ | ✅ |
| Recipient validation | `FILTER_VALIDATE_EMAIL` | regex |
| `allowed_recipient_domain` | ✅ | ❌ **missing** |
| Placeholder-config detection | ✅ (`YOUR_` checks) | partial (presence only) |
| Scope enforcement (`mail.google.com`) | ✅ twice | ⚠️ implicit |
| Data-URI tolerance on attachment | ✅ | ✅ |
| Magic-byte MIME sniff + extension fix | ✅ | ✅ |
| Strict base64 decode | ✅ | ❌ lenient |
| Inline card + separate attachment | ✅ | ✅ |
| CID logo | ✅ | ✅ |
| Plain-text alternative | ✅ | ✅ |
| Recipient display name | ✅ | ❌ dropped |
| Reply-To | ✅ | ✅ |
| Port / encryption | 587 STARTTLS | 465 implicit TLS |
| Auth | hand-written token provider | Nodemailer XOAuth2 |
| Returns raw error text | ✅ (leak) | ✅ (leak) |

---

## 6. Suggested plan

### Phase 0 — Confirm the ground truth (30 min, no code)

1. Run the `curl` in F14 against production; record whether JSON or PHP source comes back.
2. Confirm the four env vars are set in the Vercel project
   (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`),
   and that the refresh token was minted with the `https://mail.google.com/` scope.
3. Decide, and write down, whether XAMPP/PHP is still a supported deployment for this school.
   Every decision below depends on that answer.

### Phase 1 — Close the security gaps (highest value per line changed)

4. **Authenticate the endpoint (F1).** Cheapest workable option: a shared secret in a
   `GATEPASS_API_KEY` env var, sent by the client as an `X-Api-Key` header, compared with a
   timing-safe equality check. It is not real auth — the key ships in the client bundle — but
   it stops drive-by abuse from anyone who merely knows the URL. If you want it done properly,
   verify the logged-in user's session server-side before sending.
5. **Add a recipient allow-list (F2).** Port `allowed_recipient_domain` to `api/mailer.js`
   reading `ALLOWED_RECIPIENT_DOMAIN`, defaulting to open so nothing breaks on deploy.
6. **Rate-limit.** A per-invocation cap won't survive serverless statelessness; the pragmatic
   version is a per-recipient throttle in the client plus a hard daily counter if/when you add
   a datastore. At minimum, document Gmail's 500/day (2 000 for Workspace) limit next to the
   bulk-email button so an operator doesn't discover it at student 501.
7. **Stop echoing SMTP errors (F8).** Log the detail, return
   `{ success: false, message: 'Email could not be sent.' }` plus a short error code.

### Phase 2 — Kill the duplication (F3)

8. If Phase 0 concluded **Vercel only**: delete `api/send-email.php`,
   `api/GmailOAuthTokenProvider.php`, `api/PHPMailer/`, `api/oauth-*.php`,
   `api/email-config.example.php` and `api/.htaccess`; rename the function to
   `api/send-email.js` and drop the rewrite so the URL and the file finally agree.
   That is ~1 300 lines and a vendored library gone in one commit.
9. If PHP must stay (offline campus LAN, no internet at the gate house): keep it, but stop
   maintaining two templates. Extract the message content — subject, greeting, detail rows,
   step list, footer — into one `api/templates/*.json` data file that both runtimes read and
   render, **or** accept that PHP is frozen and mark it clearly at the top of the file as
   *legacy, feature-frozen, do not add to*. Either is fine. Two live copies is not.
10. Whichever survives, keep the parity matrix in §5 in the repo and tick it on every change.

### Phase 3 — Make delivery trustworthy

11. **Fix the queue (F6).** Add `attempts` and `firstQueuedAt` to each entry; on failure,
    distinguish 4xx (drop, log, surface to the operator) from 5xx/network (retry with
    exponential backoff); move a repeatedly-failing item to the back of the queue instead of
    letting it block; expire after ~24 h; show the pending count somewhere in the UI.
12. **Guard the attachment (F5).** Check `attachmentBase64.length` client-side before POSTing
    (reject above ~3 MB with a clear message and retry at `scale: 1`), and add the same ceiling
    server-side with a proper JSON 413.
13. **Log sends to Sheets (F7).** Write a row per send — student, recipient, type, timestamp,
    outcome — through the existing `SheetsService`. That gives bulk PGP delivery a resumable
    "who already got theirs" record, and gives the office an audit trail for the parent who
    says they were never notified. For a system whose entire purpose is proving a child left
    campus, "the notification was sent" should be a durable fact, not a `console.log`.

### Phase 4 — Polish

14. Hoist the logo buffer and transporter to module scope (F9); add
    `connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000` (F10).
15. Restore the recipient display name: `to: { name: toName, address: toEmail }` (F11).
16. Use an explicit `timeZone: 'Asia/Manila'` in the `exit_date` fallback (F12).
17. Remove the dead `$qrToken` (F13).
18. **Rewrite the README email section (F4)** — this one is free, and it is the reason this
    audit was asked for. Replace the EmailJS rows and the "Create an account on EmailJS" steps
    with: Gmail SMTP + OAuth2, the four Vercel env vars, and (if kept) the `oauth-start.php`
    consent walkthrough for XAMPP.

### Recommended order

`Phase 0 → 4/5/7 (security) → 18 (README) → 8 or 9 (dedupe) → 11/12/13 → the rest.`

Items 4, 5, 7 and 18 are a single afternoon and remove both High findings plus the
documentation lie. Everything after that is cleanup that gets cheaper once there is only one
mailer to change.

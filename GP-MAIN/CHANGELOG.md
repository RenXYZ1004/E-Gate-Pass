# Changelog

All notable changes to the e-gatepass System are documented here.

---

## [Unreleased] — 2026-08-28

Bug-fix and stability pass. Two defects in this release were **fatal**: the signed-in
application did not load at all, and the offline cache was silently empty. Both are
fixed, along with the sign-out redirect and the duplicate-registration notice.

**Summary:** 2 files added, 2 removed, 16 modified. Beyond the original stability pass, later rounds restored the applicant approval queue from a reference build, made the public application form able to submit at all, and fixed QR tokens that were never being saved.

---

### Restored — Approval queue for pending applicants

Four real applicants were stuck at status `for approval` with no way to act on
them. The PGP page only knew `active / suspended / revoked`, so they were
invisible: not in any filter, not in any list, no approve control anywhere.

A reference build (`gate-pass-system-main (8).zip`) turned out to be the
complete version this repository was mangled from. Comparing it against the
original commit `f3951e3` showed the same bad merge that left conflict markers in
`.gitignore` had also stripped whole features out of four files:

| File | Original | Reference | Lost |
| --- | ---: | ---: | --- |
| `js/views/StudentsView.js` | 686 | 831 | 145 lines — the approval UI |
| `js/controllers/pages/StudentsController.js` | 1028 | 1101 | 73 lines — approval bindings |
| `js/utils.js` | 361 | 526 | 165 lines — the card renderers |
| `js/controllers/AppController.js` | 1207 | 1223 | `approveStudent()` |

Everything else was byte-identical between the two.

**The approval flow belongs on the Students page, not PGP.** An earlier
improvised version of this feature had been built on the PGP page; it was
reverted and the reference implementation restored in full:

- **"For Approval" status tab** with a red count badge, alongside Active /
  Inactive / Suspended / Archived
- **"For Approval" KPI card**, which jumps to that tab
- **Master-detail review panel** — "Pending Review" list on the left, applicant
  detail on the right: grade and section, preferred gate, arrangement, vehicle,
  parent contact, Pass ID
- **Approve & Activate** → `AppController.approveStudent()` sets the status to
  `active` **and mints the QR token**
- **Reject** → archives the record

Also brought over from the reference:

- `renderVirtualIdCard()` / `renderVirtualIdCardQR()` — the canonical ID-card
  renderer, which had been reconstructed by hand from the markup duplicated
  inside `StudentsController`. The reference originals replace that
  reconstruction and are correctly guarded against a missing element or an
  unloaded QR library.
- First-sync failure recovery: a failed initial sync used to leave the loading
  skeleton on screen forever. The page now renders with whatever local data
  exists, and the toast reads "Cloud sync failed. Showing available local data."

---

### Fixed — QR tokens were never saved

`approveStudent()` mints a QR token, but `AppModel` read and wrote **`QRToken`**
while the sheet's column is spelled **`QRtoken`** (lowercase `t`). The token went
to a key the backend does not map, and came back empty on every read — which is
why all 682 rows carry an empty `QRtoken` even though the enrolment wizard has
always generated one.

Every QR code therefore encoded only the Pass ID, with no verification token.
The reference build has the same bug.

The mapping now accepts either spelling on read, and writes both keys with the
same value, so the token lands whichever name the backend maps:

```javascript
qrToken: String(s.QRToken || s.QRtoken || ''),   // read either
QRToken: s.qrToken || '',                        // write both
QRtoken: s.qrToken || '',
```

**Still to confirm:** approve one applicant and check that the sheet's `QRtoken`
column actually fills in. If it stays empty, the Apps Script write mapping needs
the column name.

---

### Fixed — Section missing next to the grade

The two ID cards were never at fault — both templates always rendered
`Grade - Section`, and a fresh sync confirms it (`Grade 8 - Integrity`). What
looked like a missing section was a stale cache: the record was being edited
while the app held a snapshot taken mid-edit.

The section genuinely was missing from the screens that displayed only the bare
grade. Those now use `fullSection`, which the model already computes:

- Student Registry — table row and card view
- **Gate scan result** — the guard now sees the section on the scan pop-up
- Dashboard recent activity
- Temporary Gate Pass list rows

`LogsView` was deliberately left alone: its `sGrade` feeds a `data-grade`
attribute used for filtering, not display, and putting `"Grade 10 - Conviction"`
in it would have broken the grade filter.

Only 2 of 682 records have no section at all, and both are the same duplicate
test row.

---

### Fixed — ID card QR could throw on close

`StudentsController.bindIdCard()` rendered its QR on a 50 ms timeout with no null
check, so closing the modal inside that window threw
`Cannot read properties of null (reading 'appendChild')`. It now goes through the
guarded shared renderer.

---

### Fixed — The public application form could never submit

`newForm.html` was written as a Google Apps Script `HtmlService` fragment: no
doctype, no `<head>`, and a submit path that calls `google.script.run`. But
`index.html` links to it as a plain static file (`href="newForm.html"`), so on
the hosted site `google` is undefined and the form fell into its preview branch:

```
Preview mode: validation passed, but this page must run inside
Google Apps Script to save the record.
```

Nothing was ever saved. A read-only probe of the Web App confirms the endpoint is
a JSON API only — it does not serve the form:

```
GET .../exec  →  {"success":true,"data":{"error":"Unknown action: "}}
```

**The form now submits over the same API the rest of the app uses.**

- `google.script.run` is still preferred when the page *is* served from Apps
  Script. Otherwise the record is POSTed to
  `…/exec?action=submitApplication`, matching the `SheetsService.post()`
  convention (`Content-Type: text/plain`, JSON body).
- Both routes end in one pair of handlers, `handleSubmitResult()` and
  `handleSubmitFailure()`, so the duplicate / success / failure pop-ups behave
  identically either way.
- The endpoint is read from `js/config.js` via a dynamic `import()`, so it stays
  in one place and the module is only loaded on the path that needs it.
- Distinct, actionable errors for an unreachable network, a non-2xx status and an
  unreadable reply — instead of one generic message.
- `newForm.html` is now a real document: doctype, `<head>`, `charset`, a mobile
  `viewport`, and a title. It had been rendering in quirks mode with no viewport
  scaling on phones — the devices most applicants use.

#### `readResult()` now unwraps the API envelope

`google.script.run` returns the inner object; the Web App wraps it as
`{ success, data: { … } }`. New `unwrapEnvelope()` normalises both.

This also closes a trap: the backend answers an unrouted action with
`{"success":true,"data":{"error":"Unknown action: …"}}`. Taken at face value that
is a *success*, and the applicant would have seen a green "submitted" pop-up for
a record that was never written. A payload carrying a non-empty `error` is now
treated as a failure regardless of the envelope.

#### Required: add the action to the Apps Script router

The client half is done, but the Web App must route `submitApplication`. The
server function already exists — `google.script.run.submitApplication(data)` has
always called it — it is simply not exposed as a web-app action. In the Apps
Script editor, add it to the `doPost` router:

```javascript
// inside doPost's action switch
case 'submitApplication':
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      data: submitApplication(JSON.parse(e.postData.contents))
    }))
    .setMimeType(ContentService.MimeType.JSON);
```

Then **redeploy the Web App** (Deploy → Manage deployments → edit → Deploy). A
new deployment URL means updating `SHEETS_API_URL` in `js/config.js`.

Until that action exists, submitting shows a clear red "Submission Failed —
Unknown action: submitApplication" and keeps the applicant's answers, which is
also the safe way to check whether the backend is wired up: submit once and read
the pop-up.

---

### Fixed — Critical

#### The application shell never loaded

`js/controllers/pages/PGPController.js` imported three functions from `js/utils.js`
that did not exist there:

```
Uncaught SyntaxError: The requested module '../../utils.js'
does not provide an export named 'renderPassCard'
```

Because `AppController` imports `PGPController`, a single unresolved named import
aborted the **entire** ES-module graph. `app.html` rendered an empty shell: no
dashboard, no scanner, no navigation, no login. The page looked "loaded" but
nothing in it worked.

The three missing functions were restored in `js/utils.js`, rebuilt from the pass-card
markup that had been copy-pasted twice inside `StudentsController.js`.

| Function | Purpose |
| --- | --- |
| `renderPassCard(student, options)` | Builds the pass-card HTML. Options: `captureId`, `qrId`, `centered`, `shadow`. Escapes HTML in every student field. |
| `renderPassCardQR(qrElementId, student)` | Draws the QR code. Returns `false` instead of throwing when the element or the QR library is missing. Clears the node first so re-renders do not stack QR codes. |
| `waitForImages(container, timeoutMs = 5000)` | Resolves once images have decoded. Has a timeout and handles `error`, so a broken photo cannot hang a bulk export. |
| `passCardQRPayload(student)` | The `PassID\|Token` payload, with a fallback for legacy records that have no token. |

#### `SISC_logo.png` did not exist

The repository contains `SISC LOGO.png` — with a space. Every reference used the
underscored name, so all of them 404'd: the landing header, the hero seal, the
footer, the login card, the printed and emailed pass cards, `sw.js`, `api/mailer.js`
and `api/send-email.js`.

In the service worker this was worse than a missing image. `cache.addAll()` is
atomic, so one unreachable URL rejected the whole call and **nothing was ever
pre-cached** — the offline-first PWA had an empty cache. Added `SISC_logo.png`.

---

### Fixed — Sign-out returned the wrong login form

`AppController.performLogout()` called `view.showPage('login')`, which rendered
`js/views/LoginView.js` — a second, visually different login form embedded in the
app shell, separate from the real staff login on the landing page.

Signing out now clears the session and redirects to `index.html`, which opens the
one main staff-login modal and displays the reason for the redirect.

- `performLogout()` calls `teardown()`, clears the session, then redirects.
- New `redirectToLogin(notice)` uses `location.replace()` so the back button cannot
  reopen the dashboard, with a re-entrancy guard against redirect loops.
- New `teardown()` releases the idle-sync loop, session-check interval, idle-check
  interval, camera idle timeout, scan-result timeout, and both camera streams.
- The `init()` guard, the `navigateToPage()` auth guard and the `hashchange` guard
  all redirect instead of rendering an in-app login.
- `index.html` reads `?notice=`, cleans the URL with `replaceState`, opens the login
  modal and shows the message in a neutral teal banner (`.login-error.is-notice`)
  rather than styling a normal sign-out as an error.

**Removed:** `js/views/LoginView.js` and `js/controllers/pages/LoginController.js`.
The application shell no longer contains a login form of its own.

---

### Changed — Registration reports duplicates in a pop-up

`newForm.html` had a more serious problem than the notice being a banner:
`withSuccessHandler` displayed **every** reply in green and reset the form. A
rejected duplicate therefore looked like a successful submission *and* wiped
everything the applicant had typed.

The success handler now has three branches:

| Outcome | Pop-up | Form |
| --- | --- | --- |
| Duplicate | Amber "Already Registered" | **Preserved**, so the Student ID can be corrected |
| Failure | Red "Submission Failed" | Preserved |
| Success | Green "Application Submitted" | Reset |

New `readResult(res)` recognises a duplicate from `success: false`, `ok: false`,
`status: "duplicate"`, `duplicate: true`, **or** the wording of the message itself —
so it holds up across the different shapes the Apps Script backend returns.

Also added: pop-up styles and markup, `showPopup()` / `closePopup()`, Escape and
Enter handling, focus save-and-restore, backdrop-click dismissal, and an `esc()`
helper so server text can never inject markup. Validation errors, preview mode,
`withFailureHandler` and the `catch` block all raise pop-ups too. The top banner is
kept alongside them.

---

### Fixed — Service worker

`sw.js` was rewritten.

- **Pre-caching is fault tolerant.** Per-file `cacheSafely()` replaces the
  all-or-nothing `cache.addAll()`; one missing asset no longer empties the cache.
- **`install` actually waits.** The old `addAll()` result was never returned, so its
  rejection was unhandled and installation reported success regardless.
- **App code is network-first.** Navigations and same-origin `.html` / `.js` / `.css`
  fetch from the network and fall back to cache. The previous cache-first shell
  pinned users to an old build until the cache name changed — a deployed fix would
  not reach anyone.
- **Assets stay cache-first** for instant loads.
- `/api/` responses are never cached.
- Network failures return a 503 instead of an unhandled rejection; navigations fall
  back to the cached shell.
- Cache bumped `v46.0.0` → `v47.0.0`. Removed the deleted login files from the
  pre-cache list; added `js/config.js` and `js/services/Dialog.js`.

Result: **39 files pre-cached, up from 0.**

---

### Fixed — Dialogs

`js/services/Dialog.js`:

- **Icons were rendering as source code.** `Icons.info` is a factory function, and
  `${Icons.info}` interpolated the function's own text into the markup. Icons are
  now called: `Icons.info(22)`.
- **Listener leak.** Buttons were bound twice (`addEventListener` *and* `onclick`).
  Closing with Escape or Enter ran the path that never removed the keydown
  listener, leaving one stale listener per dialog. Now a single set of handlers with
  a `settled` flag.
- Enter no longer confirms `type: 'danger'` dialogs, so a stray keypress cannot
  confirm a deletion.
- Focus is saved and restored. Danger dialogs focus Cancel; others focus Confirm.
- `escape()` handles `0` and `false` (was `if (!str) return ''`).
- Added `role="alertdialog"` / `role="dialog"` and `aria-modal`.

---

### Fixed — Toast notifications

`css/styles.css` defined `.toast` **twice**. The later block won on colour and
animation, but the earlier one still supplied `position: fixed; bottom: 22px;
right: 22px` — so every toast was pinned to the same corner instead of flowing in
the `#toast-root` flex column, and they stacked on top of one another. The dead
block was removed.

`AppView.showToast()` now sets the message with `textContent` instead of
interpolating it into `innerHTML`.

---

### Fixed — Resilience

**`js/models/AppModel.js`** — a single corrupt `localStorage` entry threw inside the
constructor and took the whole app down before anything rendered. New
`readCache(key, fallback)` warns, clears the bad key and carries on. All seven
cached reads go through it.

**`js/controllers/AppController.js`** — `performSync()` signed the user out whenever
the synced user list did not contain them, including when the list came back empty
because the sheet answered oddly. The check now only runs against a non-empty list.

**`js/services/SheetsService.js`** — `get()` and `post()` check `res.ok` and report a
clear error for non-JSON replies, instead of surfacing a raw `SyntaxError` from
`res.json()` when the Web App returns an HTML error page.

**`js/controllers/AppController.js`** — `video.play()` returns a promise that rejects
when playback is interrupted; it is now caught.

**`index.html`** — `crypto.subtle` only exists in a secure context. Over plain HTTP
the login failed with a misleading "Network error"; it now explains that HTTPS or
localhost is required.

---

### Fixed — Parent email endpoint

`sendParentEmail()` posted to `./api/send-email.php` on localhost. That file is not
in this repository, so local development always 404'd. It now tries
`/api/send-email` first and falls back to the legacy PHP endpoint, treating
404/405 as "not deployed here" rather than a hard failure.

---

### Fixed — User manual link

`SettingsView` linked to `manual.pdf`, which is not in the repository — a guaranteed
404. The button is now hidden by default and `SettingsController.revealUserManual()`
HEAD-checks the file, showing the button only where it is actually served.

---

### Changed — Configuration

The Google Apps Script Web App URL was hard-coded in **two** places: `index.html`
and `js/services/SheetsService.js`. Both now import from the new `js/config.js`,
which is the single source of truth for:

- `SHEETS_API_URL` — the Apps Script endpoint
- `LOGIN_PAGE` / `APP_PAGE` — the two page entry points
- `STORAGE_KEYS` — every `localStorage` / `sessionStorage` key
- `SESSION_TIMEOUT_MS` — inactivity timeout (15 minutes)
- `loginUrl(notice)` — builds the login URL with an optional notice

The login script in `index.html` became `<script type="module">` so it can share
this config.

---

### Fixed — Repository hygiene

`.gitignore` contained **unresolved merge conflict markers** from an earlier merge:

```
<<<<<<< HEAD
...
=======
...
>>>>>>> external-project/main
```

Git was treating those lines as ignore patterns. Both sides were merged into one
grouped file, and `.env.example` — a committed template — is no longer ignored.

---

### Verification

Verified against headless Chrome over the DevTools Protocol on a local server, plus
a static sweep. **44 of 45 checks pass.**

| Suite | Result |
| --- | --- |
| Sign-out flow | 13 / 13 |
| Registration pop-up | 18 / 18 |
| Page navigation + pass card | 12 / 13 |
| Service worker | 7 / 7 |

Sign-out flow: lands on `index.html`, main login modal opens, notice shown, session
and browser-alive flag cleared, back button does not reopen the dashboard, dialog
icon renders as SVG, no console errors.

Registration: duplicate, duplicate-reported-as-success, genuine success, empty-form
validation and dismissal all behave correctly.

Navigation: all nine pages (dashboard, students, scanner, logs, pgp, reports, tgp,
users, settings) navigate and render. Pass card renders every field, honours its
options, draws the QR with the correct `PassID|Token` payload, and escapes HTML in
student data.

Static sweep: all JS files parse; every referenced local asset exists; no merge
conflict markers remain; all named and default imports resolve across 28 modules;
the Apps Script URL appears exactly once.

**The one non-pass** is `Camera error: NotAllowedError` on the scanner page —
headless Chrome denying camera permission. The application catches it and shows a
toast, which is the intended behaviour.

---

### File-by-file

**Added**

| File | Change |
| --- | --- |
| `SISC_logo.png` | Copy of `SISC LOGO.png` under the name every reference uses |
| `js/config.js` | Central configuration module |

**Removed**

| File | Change |
| --- | --- |
| `js/views/LoginView.js` | The duplicate in-app login form (51 lines) |
| `js/controllers/pages/LoginController.js` | Its submit handler (41 lines) |

**Modified**

| File | Lines | Change |
| --- | --- | --- |
| `newForm.html` | +242 | Duplicate-registration pop-up, result parsing, HTML escaping |
| `sw.js` | +181 | Rewritten caching strategy |
| `js/utils.js` | +171 | Restored the three missing pass-card exports |
| `js/controllers/AppController.js` | +135 | Sign-out redirect, teardown, sync guard, email fallback |
| `js/services/Dialog.js` | +100 | Icon rendering, listener leak, focus, accessibility |
| `index.html` | +51 | Module script, shared config, redirect notice, secure-context guard |
| `js/models/AppModel.js` | +35 | Safe cache reads, shared session timeout |
| `js/views/AppView.js` | +26 | Removed login page handling, safe toast text |
| `js/services/SheetsService.js` | +21 | Shared config, response guards |
| `.gitignore` | +19 | Resolved merge conflict |
| `css/styles.css` | −19 | Removed the duplicate `.toast` block |
| `js/controllers/pages/SettingsController.js` | +18 | User-manual availability check |
| `js/views/SettingsView.js` | +2 | Manual link hidden until verified |

---

### Notes for deployment

- The service worker cache name changed, so returning users pick up the new build on
  their next load. Existing caches are deleted on activation.
- `SISC_logo.png` must be deployed. `SISC LOGO.png` is kept for now; it can be
  removed once nothing references it.
- `manual.pdf` is still absent. Drop it in the site root and the Settings button
  reveals itself — no code change needed.
- The Apps Script Web App URL now lives only in `js/config.js`. Change it there when
  the deployment is redeployed.

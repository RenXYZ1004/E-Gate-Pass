# e-Gatepass stability and performance audit

## Changes in this release

- **Dashboard timer lifecycle:** clock and sync-age intervals are cleaned up on navigation and app teardown instead of running invisibly on other pages.
- **Storage resilience:** local/session storage access in the model is guarded against quota, privacy-mode, and browser storage exceptions. Optional cache/preferences failures no longer crash model startup.
- **Consistent login API behavior:** the login screen now uses the shared SheetsService wrapper, including its timeout and retry policy, and validates user record fields more defensively.
- **Apps Script request safety:** write actions now require a non-empty POST body. GET requests can no longer trigger write actions that append empty rows or mutate state.
- **Service worker rollout:** cache version incremented so installations switch to the new asset cache on activation.
- **Deployment hard-code removed:** email logo rendering no longer falls back to a stale fixed Vercel project URL; set `APP_BASE_URL` for a stable logo URL.
- **School-year settings centralized:** the current year, pass-ID prefix, dashboard validity label, pass-card expiry label, CSV example, and public application dropdown derive from `js/config.js`. Update `SCHOOL_YEAR_START` once each academic year.

## Important deployment steps

1. Deploy the web files to the existing hosting project.
2. Paste the updated `Code.gs` into the Google Apps Script project and deploy a new version of the existing web-app deployment. Keep the same `/exec` URL when editing the current deployment.
3. In Vercel, set `APP_BASE_URL` to the final HTTPS domain. Ensure Gmail OAuth environment variables and the Blob token remain configured there; do not commit real secrets.
4. Test sign-in, direct page refreshes, QR scanning, student edit/add/archive, temporary passes, exit-log creation, parent email sending, queued email retry, and offline-to-online recovery before live use.

## Findings that need a separate security change

The current architecture still has a **high-priority authorization weakness**: the publicly callable Apps Script `getUsers`/`getAll` actions expose the users dataset to the browser, and the browser performs password comparison. The Apps Script endpoint is also publicly reachable by design. Origin checks and rate limiting on the Vercel email/photo endpoints are not authentication. Proper remediation requires server-side authentication plus authorization on every protected read/write endpoint (or moving staff-facing data access to an authenticated backend). That is an architectural change and is intentionally not silently introduced in this stability patch because it must preserve public student application submission and existing staff workflows.

Other limits: Google Sheets/Apps Script remains the latency and scale bottleneck for full-dataset syncs, especially as scan logs grow. A database migration is the correct long-term performance fix; client-side tuning cannot eliminate the round trip or the full-history payload. Real credentials, camera hardware, production Gmail delivery, and the live sheet could not be tested from this source-only audit.

## Validation performed

- A repeatable `npm run check:syntax` script was added; it parses 43 browser/API/Apps Script/inline-script sources without installing third-party dependencies.
- Apps Script source parses as JavaScript; this does not simulate Google Spreadsheet/Drive services.
- Relative module imports checked: no missing local JavaScript imports found.
- Timezone smoke tests passed for date-only input, a UTC timestamp crossing midnight in Manila, school-local time formatting, and date display.
- Archive integrity check.

The provided source had no dependency lockfile. Regenerating one was attempted but the package registry request timed out in this environment, so no unverified lockfile was added. Run `npm install` locally before deployment to produce a current lockfile.

No live data was changed and no secrets were added.

## Additional consistency improvements

- School-year settings are centralized in `js/config.js`; the public application dropdown and pass labels use the same value.
- The school timezone is centralized as `SCHOOL_TIME_ZONE` in `js/config.js`. Daily counts, log filtering/export, report hours, scanner feed times, and temporary-pass date validation/display now use that timezone rather than each viewer’s device timezone.

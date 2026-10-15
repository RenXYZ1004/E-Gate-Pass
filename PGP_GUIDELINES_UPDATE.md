# Permanent Gate Pass Guidelines Update

## What changed

- Added all seven Permanent Gate Pass guidelines for AY 2026–2027 near the beginning of `newForm.html`, before the applicant proceeds through the form.
- Added a required, unchecked-by-default parent/guardian checkbox immediately before submission.
- The form blocks submission with an inline message if the checkbox is not checked.
- The confirmation text uses the school's requested wording: “By filling up this online form, I/we understand and have read the guidelines in allowing my/our child to secure a Permanent Gate Pass for AY 2026–2027.”
- This is only a front-end requirement. The checkbox has no form field name, its value is not included in the submission payload, and no acceptance value, version, or timestamp is recorded in Google Sheets.
- `Code.gs` no longer validates an acknowledgment payload, creates acknowledgment columns, or writes acknowledgment information. No database schema change is needed. If a prior backend deployment already created acknowledgment columns, this code leaves them untouched and does not populate them.

## Deployment

1. Deploy the updated `newForm.html` with the website through Vercel.
2. Also update `Code.gs` in the existing Apps Script web app and deploy a new version. This is important if the earlier version that required and stored acknowledgment data has already been deployed; that older backend would reject the new form payload until it is replaced. Keep the existing `/exec` URL if possible.
3. Test by attempting to submit without checking the box (submission should be blocked), then checking it (submission should proceed through the existing flow).

## Audit note

The parent/guardian is asked to confirm that the displayed guidelines have been read and understood, but this confirmation is not retained. The application record and pass-generation flow otherwise remain unchanged.

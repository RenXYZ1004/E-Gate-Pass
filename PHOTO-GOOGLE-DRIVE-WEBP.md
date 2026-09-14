# Google Drive WebP photo storage

## What changed
- JPG/PNG uploads are resized to a maximum of 800×800 in the browser.
- Photos are encoded as WebP at about 80% quality.
- The WebP is sent as Base64 in a text/plain request to the Google Apps Script Web App.
- Apps Script saves the file in the Drive folder configured by `PHOTO_FOLDER_ID`.
- PGP and TGP files are separated into `pgp/` and `tgp/` subfolders.
- The filename is stable (`StudentID.webp`), so replacing a photo does not create endless duplicates.
- Google Sheets stores only the resulting public image URL.
- Existing Vercel Blob URLs already stored in the Sheet are left untouched.

## Setup
1. Open the Google Apps Script project that backs the Sheet.
2. Use the updated `Code.gs` (or `app.gs` if that is the deployed script in your project).
3. Confirm `PHOTO_FOLDER_ID` is the Drive folder you want to use.
4. Run `testGetAll` once and grant Drive permissions when Google asks.
5. Deploy a new version of the Web App.
6. Keep the Web App accessible to the users who submit the form.
7. Deploy the Vercel/static site after updating the frontend files.

No Vercel Blob token is required for new photo uploads.


## Configured for your current setup
- Google Sheet ID: `1goM8RJzzA39pgRbtj9Vuv-glTe8tw_JaAqcF6uuKhm4`
- Google Drive photo folder ID: `1D0XZn5jixNEiL0W2IMz0rau-oikqx_3L`
- The Apps Script uses `SpreadsheetApp.openById()` so it is explicitly tied to this Sheet.

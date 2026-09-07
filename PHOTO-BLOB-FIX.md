# Photo → Vercel Blob → Google Sheets fix

Photo storage no longer converts image files to Base64.

Flow now:
1. Browser sends image bytes directly to `/api/upload-photo?studentId=...`.
2. `/api/upload-photo.js` writes those bytes to Vercel Blob.
3. The endpoint returns `blob.url`.
4. The client stores only that URL in the student/TGP record.
5. Google Apps Script writes the URL to the `Photo` column.

Removed:
- Base64 JSON photo uploads.
- Base64 fallback when Blob upload fails.
- Legacy Apps Script `uploadPhoto`/Drive Base64 storage path.
- Google Sheets Base64-size workaround for student photos.

Important deployment step: redeploy both the Vercel project and the updated `Code.gs` Apps Script web app.

# WebP photo storage update

This project now converts student photos to WebP before sending them to Google Drive.

## What changed

- PGP and TGP browser uploads are resized to at most 800 x 800 and encoded as WebP at about 80% quality.
- Dashboard photo compression now emits WebP instead of JPEG.
- `/api/upload-photo` accepts only valid WebP image bytes.
- PGP and TGP photos are separated into `student-photos/pgp/` and `student-photos/tgp/`.
- Each logical photo uses a stable pathname and `allowOverwrite: true`, so replacing a photo does not create another timestamped Blob object.

## If the current Blob store is already full

These code changes reduce future growth, but they do not delete files that already exist. If the current store cannot accept another upload, either:

1. Remove obsolete/duplicate photos from the existing Google Drive store, or
2. Create/connect a new Blob store and replace the Vercel project's `` with the token for that store.

The application code does not need another change when switching stores because `api/upload-photo.js` already reads `` from the environment.

## Main files changed

- `api/upload-photo.js`
- `js/utils.js`
- `js/controllers/pages/TGPController.js`
- `newForm.html`
- `tgpForm.html`

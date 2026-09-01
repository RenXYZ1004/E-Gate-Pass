# E-Gate Pass photo upload fix

## Files
- `api/upload-photo.js` — uploads the student's photo to Vercel Blob.
- `package.json` — includes `@vercel/blob`.

## Vercel environment variable
In the SAME Vercel project that hosts the website, add:

`BLOB_READ_WRITE_TOKEN`

Use the token automatically created by the Vercel Blob store.

Enable it for Production (and Preview if you test Preview deployments).

## Important
The browser calls:

POST /api/upload-photo

with JSON:
{
  "studentId": "...",
  "image": "data:image/jpeg;base64,..."
}

Do not open `/api/upload-photo` directly in the browser and expect an upload. A direct browser visit is a GET request and should return "Method Not Allowed. Use POST."

## Install/deploy
From the project root:

npm install
git add package.json api/upload-photo.js
git commit -m "Fix Vercel Blob student photo upload"
git push

Then redeploy on Vercel.

## Blob store
The store can be Public because the returned photo URL is intended to be displayed in the gatepass/ID.
Do NOT put the Blob token in frontend JavaScript.

# E-Gate Pass photo upload fix

## Files
- `api/upload-photo.js` — uploads the student's photo to Google Drive.
- `package.json` — includes `@vercel/blob`.

## Vercel environment variable
In the SAME Vercel project that hosts the website, add:

``

Use the token automatically created by the Google Drive store.

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
git commit -m "Fix Google Drive student photo upload"
git push

Then redeploy on Vercel.

## Blob store
The store can be Public because the returned photo URL is intended to be displayed in the gatepass/ID.
Do NOT put the Blob token in frontend JavaScript.

IMPORTANT: If you see Unexpected token < / <!DOCTYPE, the browser received an Apps Script HTML page rather than JSON. Deploy the Apps Script as a Web App (Execute as you, Who has access: Anyone), copy its new /exec URL, and put it in js/config.js.

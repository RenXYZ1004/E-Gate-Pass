const { put } = require("@vercel/blob");
const { rejected, allowedOrigins } = require("./_lib/request-guard");

function send(res, status, body) {
  res.status(status).json(body);
}

function sanitizeName(value) {
  return String(value || "student")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "student";
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    const origin = String((req.headers && req.headers.origin) || "");
    if (origin && allowedOrigins(req).has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return send(res, 405, { success: false, error: "Method Not Allowed. Use POST." });
  }

  if (rejected(req, res, { name: "upload" })) return;

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return send(res, 500, { success: false, error: "BLOB_READ_WRITE_TOKEN is not configured in Vercel." });
    }

    const studentId = String((req.query && req.query.studentId) || "").trim();
    const mimeType = String((req.headers && req.headers['content-type']) || '').split(';')[0].trim().toLowerCase();
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (!studentId) {
      return send(res, 400, { success: false, error: "Student ID is required." });
    }
    if (!allowed.has(mimeType)) {
      return send(res, 400, { success: false, error: "Only JPG, PNG, and WebP images are accepted." });
    }

    const buffer = await readRawBody(req);
    const MAX_BYTES = 4 * 1024 * 1024;
    if (!buffer.length) {
      return send(res, 400, { success: false, error: "The uploaded image is empty." });
    }
    if (buffer.length > MAX_BYTES) {
      return send(res, 413, { success: false, error: "Image is too large. Please upload an image under 4 MB." });
    }

    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const safeId = sanitizeName(studentId);
    const pathname = `student-photos/${safeId}-${Date.now()}.${extension}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: mimeType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false
    });

    return send(res, 200, {
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      fileName: pathname.split("/").pop(),
      contentType: mimeType
    });
  } catch (error) {
    console.error("upload-photo error:", error);
    return send(res, 500, { success: false, error: error && error.message ? error.message : "Photo upload failed." });
  }
};

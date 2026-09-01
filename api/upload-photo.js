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

module.exports = async function handler(req, res) {
  // This endpoint is called by the browser with POST + JSON.
  if (req.method === "OPTIONS") {
    // Was "*", which advertised this upload endpoint to every site on the
    // web. Every real caller — the app shell and the application form — is
    // served from this same deployment, so echo the origin only when it is
    // one of ours.
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
    return send(res, 405, {
      success: false,
      error: "Method Not Allowed. Use POST."
    });
  }

  // Writes into the school's Blob store, so it needs the same caller check
  // as the mail endpoints.
  if (rejected(req, res, { name: "upload" })) return;

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return send(res, 500, {
        success: false,
        error: "BLOB_READ_WRITE_TOKEN is not configured in Vercel."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    const studentId = String(body.studentId || "").trim();
    const dataUrl = String(body.imageData || body.image || body.dataUrl || "").trim();

    if (!studentId) {
      return send(res, 400, {
        success: false,
        error: "Student ID is required."
      });
    }

    if (!dataUrl.startsWith("data:image/")) {
      return send(res, 400, {
        success: false,
        error: "Invalid image data."
      });
    }

    const match = dataUrl.match(
      /^data:(image\/(?:jpeg|jpg|png));base64,([A-Za-z0-9+/=\s]+)$/
    );

    if (!match) {
      return send(res, 400, {
        success: false,
        error: "Only JPG/JPEG/PNG images are accepted."
      });
    }

    const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
    const base64 = match[2].replace(/\s/g, "");
    const buffer = Buffer.from(base64, "base64");

    // Keep the request comfortably below Vercel/serverless body limits.
    const MAX_BYTES = 4 * 1024 * 1024;
    if (!buffer.length) {
      return send(res, 400, {
        success: false,
        error: "The uploaded image is empty."
      });
    }

    if (buffer.length > MAX_BYTES) {
      return send(res, 413, {
        success: false,
        error: "Image is too large. Please upload an image under 4 MB."
      });
    }

    const extension = mimeType === "image/png" ? "png" : "jpg";
    const safeId = sanitizeName(studentId);

    // Store photos in a predictable folder. A timestamp prevents accidental
    // overwriting when a student submits again.
    const pathname =
      `student-photos/${safeId}-${Date.now()}.${extension}`;

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

    return send(res, 500, {
      success: false,
      error:
        error && error.message
          ? error.message
          : "Photo upload failed."
    });
  }
};

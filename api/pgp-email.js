const sendEmail = require('./send-email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'POST request required.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'Invalid JSON request.' });
    }
  }

  body.email_type = 'pgp_delivery';
  req.body = body;
  return sendEmail(req, res);
};

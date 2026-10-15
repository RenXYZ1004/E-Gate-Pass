# 🛡️ e-gatepass System

A robust, offline-capable Progressive Web App (PWA) designed for Student Affairs. The **e-gatepass System** streamlines student exit verification, automates parent notifications, and provides a secure, role-based dashboard for school administrators and security personnel.

Built for **SISC**.

---

## 📸 Key Features

### 🔐 Role-Based Access Control (RBAC)
- **Admin**: Full system control, user management, and advanced settings.
- **Secretary**: Student enrollment, Temporary Gate Pass (TGP) issuance, and reporting.
- **Guard**: Access restricted to the live Gate Scanner and exit feed.

### 📶 Offline-First PWA & Cloud Sync
- **Progressive Web App**: Installable on desktop and mobile devices. Works 100% offline using Service Workers and local caching.
- **Cloud Database Engine**: Seamlessly synchronizes data with Google Sheets for secure, centralized storage.
- **Offline Email Queuing**: Automatically queues parent email notifications when offline, sending them in the background once internet connectivity is restored.

### 🎓 Student Enrollment & TGP
- Register students with complete dismissal arrangements (Fetched, Independent, School Bus).
- Upload student photos for secure visual verification.
- Issue Temporary Gate Passes (TGP) for visitors or one-time student exits.

### 📱 Advanced Gate Scanner
- **Camera Scanning**: Point at a student's QR code for instant, contactless verification.
- **USB Scanner Integration**: Native support for USB-based barcode or RFID scanners.
- **Manual Input**: Fallback manual entry using a Student ID or Pass Number.
- **Multi-Gate Support**: Assign scanners to specific campus gates.
- **Live Exit Feed**: Real-time monitoring of all granted and denied exits.

### 📋 Automated Parent Notifications
- Every verified gate exit is timestamped, logged, and securely recorded.
- **Automated Email Alerts** sent immediately to parents/guardians via EmailJS with exact exit times and gate locations.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Structure** | HTML5 (Single Page Application) |
| **Styling** | Vanilla CSS — Dark/Light themes, responsive mobile grids |
| **Logic** | Vanilla JavaScript (ES Modules, MVC Architecture) |
| **Database** | Google Sheets API (Apps Script) |
| **Offline Engine** | Service Worker (`sw.js`) & CacheStorage API |
| **QR Generation** | [qrcodejs](https://github.com/davidshimjs/qrcodejs) |
| **QR Scanning** | [jsQR](https://github.com/cozmo/jsQR) (Localized for offline use) |


---


### Node API dependencies

The Vercel API routes use packages declared in `package.json`. For local setup, run `npm install` once before testing Node API routes. Vercel installs these dependencies during deployment.

### Google Apps Script backend

Use **`Code.gs` only** as the canonical Apps Script backend source. The older `app.gs` copy was removed because it duplicates global entry points such as `doGet`, `doPost`, and `handleRequest`. Apps Script loads all `.gs` files in a project into one shared global scope; file names do not select which backend is active. Keep only one definition of each entry-point function, save the script, and deploy a new Web App version. If you reuse the existing deployment, keep the Web App URL in `js/config.js` unchanged.

## 🚀 Getting Started

### Prerequisites
- A local web server like [XAMPP](https://www.apachefriends.org/) or VS Code Live Server.
- A modern web browser (Chrome, Edge, Safari, or Firefox).

### Installation

1. **Clone the repository** into your server directory (e.g., `htdocs` for XAMPP):
   ```bash
   cd C:\xampp\htdocs
   git clone https://github.com/YOUR_USERNAME/gate-pass-system.git PGP/gate-pass-system
   ```

2. **Access the application**:
   Open your browser and navigate to: `http://localhost/PGP/gate-pass-system/`

3. **Install as App (Optional)**:
   Click the "Install App" icon in your browser's address bar to install **e-gatepass** as a standalone desktop or mobile application.

---

## 🔧 Configuration

### You can use any database

### SMTP Notifications
To enable automated emails:
1. Create an account on Google CLoud Console.
2. Update the 'Environment Details'.


## SEO build and public contact form

The project stays a static multi-page site; server-side rendering is intentionally not introduced because the faculty dashboard and forms are browser-driven and should not be indexed. Vercel runs `node build-seo.cjs` and serves the generated `dist/` directory. The build reads `SITE_URL` first, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`. Set `SITE_URL` in Vercel to the real production origin (for example `https://gatepass.example.edu`) to ensure canonical URLs, Open Graph URLs, `robots.txt`, and `sitemap.xml` use the correct domain.

Optional Search Console verification: add the HTML-tag verification token as `GOOGLE_SITE_VERIFICATION`, then redeploy and click Verify in Search Console. The build omits this tag when the value is empty. Optional Google Analytics: add `GA_MEASUREMENT_ID` only after school approval; the public landing page waits for explicit visitor consent before loading Analytics. The dashboard and application forms do not load Analytics.

The general contact form uses `POST /api/contact`, existing Gmail OAuth credentials (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`) and a recipient inbox set in `CONTACT_TO_EMAIL`. It has server-side validation, HTML escaping, a honeypot, same-site origin checking, and a per-instance rate limit. Configure these environment variables in Vercel before expecting contact emails to send. The rate limit is a deterrent rather than a globally shared limit; use a durable rate-limit service if abuse becomes an issue.

`npm run check:syntax` validates JavaScript syntax; `npm run check:seo` verifies key metadata and noindex policy; `SITE_URL=https://example.edu npm run build` can be used for a local build test (replace with the actual production origin before deployment).

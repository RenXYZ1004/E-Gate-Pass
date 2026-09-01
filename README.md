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
| **Email Service**| [EmailJS](https://www.emailjs.com/) |

---

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

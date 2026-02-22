# SecureVision Stego

SecureVision Stego is a full-stack web app for encrypted image steganography with JWT authentication and a face verification microservice.

## 🚀 Quick Links

- **[Deploy to Production](./DEPLOY_QUICK.md)** - Deploy in 15 minutes (FREE)
- **[Detailed Deployment Guide](./DEPLOYMENT.md)** - Full deployment documentation
- **[MySQL Setup Guide](./server/MYSQL_SETUP.md)** - Database configuration

## Stack
- Frontend: React (Vite) + Tailwind CSS
- Backend: Node.js + Express + **MySQL database** (with CSV fallback)
- Auth: JWT + bcrypt
- Encryption: AES-256-GCM (Node crypto)
- Steganography: PNG LSB encoding
- Face Verification: Python 3.10+ DeepFace microservice

## Database

**MySQL + CSV Fallback Architecture:**
- Primary: MySQL database (`face_verification_db`)
- Fallback: CSV file for offline reliability
- Auto-initialization: Database and tables created on startup
- Automatic sync between MySQL and CSV

**Requires:** MySQL Server running on localhost:3306

👉 **[MySQL Setup Guide](./server/MYSQL_SETUP.md)** - Detailed setup instructions

## Quick Start

### Prerequisites
- Node.js 16+
- Python 3.10+
- MySQL Server (localhost:3306, root:root)

### 1) Server (Node + Express)
```bash
cd server
npm install
copy .env.example .env
# Update .env with MySQL credentials (default: localhost, root, root)
npm run dev
```

### 2) Client (React)
```bash
cd client
npm install
copy .env.example .env
npm run dev
```

### 3) Face Service (Python 3.10+)
```bash
cd face-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001
```

## Environment Variables

### Server (.env)
```
# Port & Storage
PORT=4000
USERS_CSV=./data/users.csv

# Authentication
ADMIN_EMAIL=admin@example.com
JWT_SECRET=replace_with_strong_secret
AES_SECRET=replace_with_32_char_or_longer_secret

# External Services
FACE_SERVICE_URL=http://localhost:5001/verify-face
CLIENT_ORIGIN=http://localhost:5173

# MySQL Database (auto-creates on startup)
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DB=face_verification_db
```

### Client (.env)
```
VITE_API_URL=http://localhost:4000
```

## API Routes

### Auth
- POST /api/auth/register
  - body: { name, email, password }
- POST /api/auth/register-live
  - form-data: name, email, password, image
- POST /api/auth/login
  - body: { email, password }

### Admin (JWT + admin role)
- GET /api/admin/users
  - returns: { users: [...] }
- GET /api/admin/faces/:userId
  - returns: image/jpeg

### Steganography (JWT required)
- POST /api/stego/encode
  - form-data: image (PNG), message
  - returns: stego PNG
- POST /api/stego/decode
  - form-data: image (PNG)
  - returns: { message }
- POST /api/stego/decode-face
  - form-data: image (PNG), live (JPEG)
  - returns: { message, verification }

### Face Verification (JWT required)
- POST /api/face/verify
  - form-data: imageA, imageB
  - returns: { verified, distance, threshold, confidence }
- POST /api/face/register-live
  - form-data: image
  - returns: { message }
- POST /api/face/verify-live
  - form-data: image
  - returns: { verified, distance, threshold, confidence }

## Deployment Guide

1) Build the client
```bash
cd client
npm run build
```

2) Serve the client build with your preferred static host.
3) Run the server with production environment variables.
4) Run the face-service in a separate process or container.
5) Ensure the server can reach the face-service URL and the CSV store path.

## Notes
- PNG images are required for encoding and decoding.
- AES-256-GCM provides confidentiality and integrity for hidden messages.
- Confidence is derived from DeepFace distance; it is not a direct probability.

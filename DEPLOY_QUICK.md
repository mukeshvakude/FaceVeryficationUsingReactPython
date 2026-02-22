# Quick Deployment Steps

## 🚀 For Users Who Want to Decrypt Messages

Once you deploy SecureVision, share this URL with users:
```
https://your-app.vercel.app
```

Users can then:
1. Open the link
2. Go to **"Decode"** page (no login required)
3. Upload the image from email
4. Paste the encryption key from email
5. Click **"Decode"** to see the hidden message

---

## 📦 Deploy in 15 Minutes

### Option 1: Vercel + Render (Easiest)

#### 1. Push to GitHub
```bash
cd d:/PROJECTS/securevision
git init
git add .
git commit -m "Initial deployment"
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/securevision.git
git push -u origin main
```

#### 2. Deploy Backend to Render
- Go to https://render.com/deploy
- Connect GitHub → Select your repo
- Create **Web Service**:
  - Name: `securevision-server`
  - Root Directory: `server`
  - Build: `npm install`
  - Start: `npm start`
  - Add environment variables (see DEPLOYMENT.md)
- Click Deploy
- Copy URL: `https://securevision-server-xxx.onrender.com`

#### 3. Deploy Frontend to Vercel
- Go to https://vercel.com/new
- Import your GitHub repo
- Root Directory: `client`
- Add Environment Variable:
  ```
  VITE_API_URL=https://securevision-server-xxx.onrender.com
  ```
- Click Deploy
- Your app is live! 🎉

#### 4. Share with Users
Send them your Vercel URL:
```
https://securevision-xxx.vercel.app
```

---

## 💰 Costs

**FREE TIER** (sufficient for personal use):
- Vercel: FREE
- Render: FREE (sleeps after 15min inactivity)
- Total: **$0/month**

**PAID** (for production):
- Vercel: FREE (stays free)
- Render: $7/month (24/7 uptime)
- Total: **$7/month**

---

## 📝 Environment Variables

### Server (Render)
```
PORT=4000
JWT_SECRET=generate-random-32-chars
AES_SECRET=generate-random-32-chars
CLIENT_ORIGIN=https://your-vercel-url.vercel.app
EMAIL_SERVICE=gmail
EMAIL_USER=rohanpk021204@gmail.com
EMAIL_PASS=ilewjehtluykisaj
MYSQL_HOST=leave-empty-for-csv-mode
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DB=face_verification_db
FACE_SERVICE_URL=leave-empty-to-disable
```

### Client (Vercel)
```
VITE_API_URL=https://securevision-server-xxx.onrender.com
```

---

## ⚠️ Important

- DO NOT commit `.env` file to GitHub (already in .gitignore)
- Change JWT_SECRET and AES_SECRET for production
- Update CLIENT_ORIGIN to match your Vercel URL
- If you skip Face Service, face verification will be disabled but encode/decode still works

---

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

# 🚀 Deploy SecureVision - Step by Step

## Your Repository
https://github.com/mukeshvakude/FaceVeryficationUsingReactPython

---

## Step 1: Push Latest Changes to GitHub

```bash
cd d:/PROJECTS/securevision
git add .
git commit -m "Add deployment configurations and fix email service"
git push origin main
```

---

## Step 2: Deploy Backend on Render (5 minutes)

### 2.1 Create Account
- Go to https://render.com
- Sign up with your GitHub account

### 2.2 Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Click **"Connect account"** → Authorize GitHub
3. Select repository: `mukeshvakude/FaceVeryficationUsingReactPython`
4. Fill in:
   ```
   Name: securevision-server
   Region: Choose closest to you
   Branch: main
   Root Directory: securevision/server
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free
   ```

### 2.3 Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** for each:

```bash
PORT=4000
NODE_ENV=production
USERS_CSV=./data/users.csv
ADMIN_EMAIL=admin@gmail.com

# Generate random 32-character strings for these:
JWT_SECRET=svs_jwt_7f2c9b4a4d1e44b9a9f2b2d2c1e5a3c7
AES_SECRET=svs_aes_32_chars_or_more_9f3c1a7b2d4e6f8a

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=rohanpk021204@gmail.com
EMAIL_PASS=ilewjehtluykisaj

# Database (leave empty to use CSV mode)
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DB=face_verification_db

# Face Service (leave empty to disable, or add after deploying face service)
FACE_SERVICE_URL=

# Will update this after deploying frontend
CLIENT_ORIGIN=*
```

### 2.4 Deploy
1. Click **"Create Web Service"**
2. Wait 5 minutes for deployment
3. Copy your backend URL (e.g., `https://securevision-server-abc123.onrender.com`)
4. **SAVE THIS URL** - you'll need it for the frontend!

---

## Step 3: Deploy Frontend on Vercel (3 minutes)

### 3.1 Create Account
- Go to https://vercel.com
- Sign up with your GitHub account

### 3.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Click **"Import"** next to `FaceVeryficationUsingReactPython`
3. Configure:
   ```
   Framework Preset: Vite
   Root Directory: securevision/client
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

### 3.3 Add Environment Variable
1. Click **"Environment Variables"**
2. Add:
   ```
   Name: VITE_API_URL
   Value: https://securevision-server-abc123.onrender.com
   ```
   ⚠️ Replace with YOUR actual Render backend URL from Step 2.4

### 3.4 Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes
3. Copy your frontend URL (e.g., `https://securevision-xyz.vercel.app`)

---

## Step 4: Update Backend CORS (2 minutes)

### 4.1 Update Environment Variable
1. Go back to Render dashboard
2. Select your `securevision-server` service
3. Click **"Environment"** in sidebar
4. Find `CLIENT_ORIGIN` variable
5. Change value from `*` to your Vercel URL:
   ```
   https://securevision-xyz.vercel.app
   ```
6. Click **"Save Changes"**
7. Service will automatically redeploy

---

## Step 5: Test Your Deployment ✅

### 5.1 Visit Your App
Open your Vercel URL: `https://securevision-xyz.vercel.app`

### 5.2 Test Registration
1. Click **"Register"**
2. Create an account
3. Login

### 5.3 Test Encode & Email
1. Go to **"Encode"** page
2. Upload an image
3. Enter a message
4. Enter recipient email
5. Click **"Encode & Send Email"**
6. Check your email!

### 5.4 Test Decode
1. Go to **"Decode"** page (no login needed)
2. Upload the image from email
3. Paste the encryption key from email
4. Click **"Decode"**
5. See your hidden message! 🎉

---

## Step 6: Share with Users 📤

### Send this to users who need to decrypt messages:

```
🔐 SecureVision - Decrypt Your Message

1. Visit: https://securevision-xyz.vercel.app
2. Click "Decode" (no login required)
3. Upload the image I sent you via email
4. Paste the encryption key from the email
5. Click "Decode" to reveal the hidden message

No installation required! Works on any device with a browser.
```

---

## Optional: Deploy Face Service (Advanced)

If you want face verification to work:

### On Render:
1. Click **"New +"** → **"Web Service"**
2. Select same repo
3. Configure:
   ```
   Name: securevision-face-service
   Root Directory: securevision/face-service
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: python -m uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add Environment Variable:
   ```
   TF_USE_LEGACY_KERAS=0
   ```
5. Deploy
6. Copy the URL
7. Update your backend's `FACE_SERVICE_URL`:
   ```
   FACE_SERVICE_URL=https://your-face-service.onrender.com/verify-face
   ```

---

## Troubleshooting

### ❌ CORS Error
- Make sure `CLIENT_ORIGIN` in backend matches your Vercel URL exactly
- No trailing slash

### ❌ Backend Not Responding
- Free tier services sleep after 15 minutes
- First request may take 30 seconds to wake up
- This is normal for free tier

### ❌ Email Not Sending
- Check if Gmail App Password is correct (no spaces)
- Check Render logs: Service → Logs

### ❌ Build Failed
- Check Render/Vercel logs for errors
- Make sure all files are committed to GitHub

---

## What You Get (FREE Tier)

✅ Public URL anyone can access
✅ Encode/Decode functionality
✅ Email sending with images
✅ User authentication
✅ Secure encryption
✅ Mobile responsive

⚠️ Limitations on FREE tier:
- Backend sleeps after 15 min inactivity
- First request after sleep takes 30-60 seconds
- 750 hours/month on Render free tier

💰 To remove sleep (optional):
- Upgrade Render to $7/month for 24/7 uptime

---

## Security Reminders

⚠️ **Important:**
- Your `.env` file is already protected (in .gitignore)
- Don't share your Render/Vercel dashboard access
- Change JWT_SECRET and AES_SECRET if you share this publicly
- Consider using a dedicated email for production

---

## Need Help?

- **Render Logs**: Dashboard → Service → Logs tab
- **Vercel Logs**: Dashboard → Project → Deployments → View Function Logs
- **Check Status**: Visit `/api/health` endpoint on your backend

---

## Summary

After deployment, you have 3 URLs:

1. **Frontend**: `https://securevision-xyz.vercel.app` ← Share this
2. **Backend**: `https://securevision-server-abc123.onrender.com` ← API only
3. **Face Service**: (Optional) `https://face-service-abc.onrender.com`

**Share URL #1 with anyone who needs to decrypt your messages!**

---

🎉 **Congratulations!** Your SecureVision app is now live and accessible worldwide!

# SecureVision Deployment Guide

## Deployment Architecture

This guide covers deploying SecureVision to production with all three services:

1. **Client (React)** → Vercel
2. **Server (Node.js + MySQL)** → Render/Railway
3. **Face Service (Python)** → Render/Railway

---

## Option 1: Deploy to Render (Recommended - All-in-One)

### Prerequisites
- GitHub account
- Render account (free at https://render.com)
- Gmail App Password for email features

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/securevision.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy Backend on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `securevision-server`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Add Environment Variables:
   ```
   PORT=4000
   NODE_ENV=production
   JWT_SECRET=<generate-random-32-char-string>
   AES_SECRET=<generate-random-32-char-string>
   CLIENT_ORIGIN=*
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   FACE_SERVICE_URL=<will-add-after-face-service-deployed>
   
   # MySQL (Render provides free PostgreSQL, or upgrade for MySQL)
   MYSQL_HOST=<your-mysql-host>
   MYSQL_USER=<your-mysql-user>
   MYSQL_PASSWORD=<your-mysql-password>
   MYSQL_DB=face_verification_db
   ```

6. Click **"Create Web Service"**
7. Note your backend URL: `https://securevision-server.onrender.com`

### Step 3: Deploy Face Service on Render

1. Click **"New +"** → **"Web Service"**
2. Connect same GitHub repository
3. Configure:
   - **Name**: `securevision-face-service`
   - **Root Directory**: `face-service`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

4. Add Environment Variable:
   ```
   TF_USE_LEGACY_KERAS=0
   ```

5. Click **"Create Web Service"**
6. Note your face service URL: `https://securevision-face-service.onrender.com`

7. **Update Backend**: Go back to your server service and update:
   ```
   FACE_SERVICE_URL=https://securevision-face-service.onrender.com/verify-face
   ```

### Step 4: Deploy Frontend on Vercel

1. Go to https://vercel.com
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variable:
   ```
   VITE_API_URL=https://securevision-server.onrender.com
   ```

6. Click **"Deploy"**
7. Your app will be live at: `https://securevision-xxx.vercel.app`

### Step 5: Update CORS on Backend

Go back to Render → Your server service → Environment Variables:
```
CLIENT_ORIGIN=https://securevision-xxx.vercel.app
```

---

## Option 2: Deploy to Railway (Alternative)

Railway provides both MySQL and hosting in one platform.

### Deploy All Services

1. Go to https://railway.app
2. Create new project from GitHub repo
3. Railway will auto-detect all services
4. Add MySQL database from Railway marketplace
5. Configure environment variables similar to Render

---

## Option 3: Deploy Client to Netlify

Instead of Vercel, you can use Netlify:

1. Go to https://netlify.com
2. Drag & drop your `client` folder OR connect GitHub
3. Configure:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variable**: 
     ```
     VITE_API_URL=https://your-backend-url.onrender.com
     ```

---

## MySQL Database Options

### Option A: Render PostgreSQL (Free)
- Render offers free PostgreSQL
- You'll need to modify code to use PostgreSQL instead of MySQL
- Change `mysql2` to `pg` in package.json

### Option B: PlanetScale (Free MySQL)
1. Go to https://planetscale.com
2. Create free database
3. Get connection string
4. Add to your Render environment variables

### Option C: Railway MySQL
- Railway provides MySQL addon
- Easy integration with your services

### Option D: Use CSV Fallback Only
- Your app already has CSV fallback
- For testing, you can deploy without MySQL
- Set in server .env:
  ```
  MYSQL_HOST=
  MYSQL_USER=
  MYSQL_PASSWORD=
  ```

---

## Testing Your Deployment

1. Visit your Vercel URL: `https://securevision-xxx.vercel.app`
2. Register a new account
3. Test encode/decode functionality
4. Test face verification (if face service is running)
5. Test email sending feature

---

## Environment Variables Summary

### Client (.env)
```
VITE_API_URL=https://your-backend.onrender.com
```

### Server (.env)
```
PORT=4000
NODE_ENV=production
JWT_SECRET=<32-char-random-string>
AES_SECRET=<32-char-random-string>
CLIENT_ORIGIN=https://your-frontend.vercel.app
USERS_CSV=./data/users.csv
ADMIN_EMAIL=admin@example.com

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Database
MYSQL_HOST=your-db-host
MYSQL_USER=your-db-user
MYSQL_PASSWORD=your-db-password
MYSQL_DB=face_verification_db

# Face Service
FACE_SERVICE_URL=https://your-face-service.onrender.com/verify-face
```

### Face Service (.env)
```
TF_USE_LEGACY_KERAS=0
```

---

## Cost Estimate

- **Vercel/Netlify (Frontend)**: FREE
- **Render Free Tier (Backend)**: FREE (spins down after 15 min inactivity)
- **Render Free Tier (Face Service)**: FREE (spins down after 15 min inactivity)
- **PlanetScale (MySQL)**: FREE tier available

**Total**: Can run entirely FREE with some limitations (cold starts)

---

## Upgrading for Production

For better performance:
- **Render**: Upgrade to $7/month for 24/7 uptime
- **Railway**: $5/month including database
- **PlanetScale**: $29/month for production features

---

## Troubleshooting

### Face Service Takes Long Time
- Free tier services "sleep" after 15 minutes
- First request may take 30-60 seconds to wake up
- Consider upgrading to paid tier for instant response

### CORS Errors
- Ensure `CLIENT_ORIGIN` in server matches your Vercel URL exactly
- Don't include trailing slash

### Email Not Working
- Verify Gmail App Password is correct
- Check Render logs for detailed error messages

### Database Connection Failed
- Verify MySQL credentials are correct
- Check if CSV fallback is working (check logs)
- Consider using CSV-only mode for testing

---

## Security Notes

⚠️ **Important**:
- NEVER commit `.env` files to GitHub
- Use environment variables on hosting platforms
- Regenerate JWT_SECRET and AES_SECRET for production
- Use strong MySQL passwords
- Enable 2FA on your deployment accounts

---

## Need Help?

- Check Render logs: Dashboard → Service → Logs
- Check Vercel logs: Dashboard → Deployment → Functions
- GitHub Issues: Report problems in your repo

---

## Share with Users

Once deployed, users can:
1. Visit: `https://securevision-xxx.vercel.app`
2. Register an account
3. Use the **Decode** page to decrypt images
4. No installation required!

Just share your Vercel URL with anyone who needs to decrypt messages.

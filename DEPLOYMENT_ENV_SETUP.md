# 📋 Deployment Environment Setup Guide

**Status:** Ready for Deployment ✅  
**Last Updated:** August 22, 2026

---

## 📌 Overview

This guide centralizes all environment variables needed for deploying InvoiceFlow to production.

### Quick Links
- Backend: `backend/.env.example` → `backend/.env`
- Frontend: `frontend/.env.local.example` → `frontend/.env.local`

---

## 🔐 Security First

### DO NOT COMMIT
- ❌ `backend/.env` - Contains Firebase Admin credentials
- ❌ `frontend/.env.local` - Contains API keys
- ✅ `.env.example` files - These ARE safe to commit

### Protected by .gitignore
```
.env
.env.local
.env.*.local
```

---

## 🏃 Quick Start (Local Development)

### Step 1: Backend Setup

```bash
cd backend
cp .env.example .env
```

Then fill in `.env`:
```env
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173

# Firebase Admin (from service account JSON)
FIREBASE_PROJECT_ID=genesis-ec0bd
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app

# Gemini API
GEMINI_API_KEY=AIzaSy_YOUR_KEY
GEMINI_EXTRACTION_MODEL=gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL=gemini-pro
```

### Step 2: Frontend Setup

```bash
cd frontend
cp .env.local.example .env.local
```

Then fill in `.env.local`:
```env
VITE_FIREBASE_API_KEY=AIzaSyBfaN5KTUXNGfZL2qzzi8nv1qEGAdkZLU
VITE_FIREBASE_AUTH_DOMAIN=genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=197595305755
VITE_FIREBASE_APP_ID=1:197595305755:web:72998a2f5781e2330ca3a

VITE_API_URL=http://localhost:5000/api
```

### Step 3: Run Locally

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Runs on http://localhost:5000

# Terminal 2 - Frontend
cd frontend
npm run dev
# Runs on http://localhost:5173
```

---

## 🚀 Production Deployment

### Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│            DEPLOYMENT PLATFORMS                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Backend (Node.js + Express)                   │
│  ├─ Platform: Render / Railway / Heroku       │
│  ├─ Port: 5000                                │
│  └─ Environment: backend/.env                  │
│                                                 │
│  Frontend (React + Vite)                       │
│  ├─ Platform: Vercel / Render / Netlify      │
│  ├─ Build Command: npm run build              │
│  └─ Environment: frontend/.env.local          │
│                                                 │
│  Database (Firebase Firestore)                 │
│  └─ Google Cloud Platform                      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📋 Environment Variables by Platform

### RENDER (Backend Deployment)

**URL:** https://render.com

**Steps:**

1. Create New Web Service
2. Connect GitHub repository
3. Set Environment Variables:

```
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://your-frontend-domain.com

FIREBASE_PROJECT_ID=genesis-ec0bd
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app

GEMINI_API_KEY=AIzaSy_YOUR_KEY
GEMINI_EXTRACTION_MODEL=gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL=gemini-pro

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@invoiceflow.com
```

4. Build Command:
```bash
npm run build
```

5. Start Command:
```bash
npm start
```

---

### VERCEL (Frontend Deployment)

**URL:** https://vercel.com

**Steps:**

1. Import GitHub repository
2. Set Environment Variables:

```
VITE_FIREBASE_API_KEY=AIzaSyBfaN5KTUXNGfZL2qzzi8nv1qEGAdkZLU
VITE_FIREBASE_AUTH_DOMAIN=genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=197595305755
VITE_FIREBASE_APP_ID=1:197595305755:web:72998a2f5781e2330ca3a

VITE_API_URL=https://your-backend-domain.com/api
```

3. Build Settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

---

### ALTERNATIVE: DOCKER (For Any Platform)

**Dockerfile - Backend**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

**Build & Run:**
```bash
docker build -t invoiceflow-backend .
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  -e FIREBASE_PROJECT_ID=genesis-ec0bd \
  -e FIREBASE_CLIENT_EMAIL=... \
  -e FIREBASE_PRIVATE_KEY=... \
  invoiceflow-backend
```

---

## 🔑 Getting Environment Variable Values

### Firebase Admin SDK Credentials

**Where to Find:**
1. Go to Firebase Console
2. Click ⚙️ Settings (top right)
3. Click "Service Accounts" tab
4. Click "Generate New Private Key"
5. Download JSON file
6. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - Storage bucket from Settings

### Firebase Web Configuration

**Where to Find:**
1. Go to Firebase Console
2. Click ⚙️ Settings
3. Click your Web App
4. Copy config values:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - etc.

### Gemini API Key

**Where to Find:**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key" or "Create API Key in new project"
3. Copy the key (starts with `AIzaSy_`)

### Gmail SMTP

**Where to Find:**
1. Enable "Less secure app access" or "2-Step Verification"
2. Generate App-specific password
3. Use as `SMTP_PASSWORD`

---

## 📊 Environment Variable Reference

### Backend Variables

| Variable | Type | Example | Required | Environment |
|----------|------|---------|----------|-------------|
| `NODE_ENV` | string | `production` | ✅ | All |
| `PORT` | number | `5000` | ✅ | All |
| `CORS_ORIGIN` | string | `https://yourdomain.com` | ✅ | All |
| `FIREBASE_PROJECT_ID` | string | `genesis-ec0bd` | ✅ | All |
| `FIREBASE_CLIENT_EMAIL` | string | `firebase-adminsdk-...` | ✅ | All |
| `FIREBASE_PRIVATE_KEY` | string | `-----BEGIN PRIVATE...` | ✅ | All |
| `FIREBASE_STORAGE_BUCKET` | string | `genesis-ec0bd.firebasestorage.app` | ✅ | All |
| `GEMINI_API_KEY` | string | `AIzaSy_...` | ✅ | Dev/Prod |
| `GEMINI_EXTRACTION_MODEL` | string | `gemini-pro-vision` | ✅ | All |
| `GEMINI_CATEGORIZATION_MODEL` | string | `gemini-pro` | ✅ | All |
| `SMTP_HOST` | string | `smtp.gmail.com` | ❌ | Prod |
| `SMTP_PORT` | number | `587` | ❌ | Prod |
| `SMTP_USER` | string | `email@gmail.com` | ❌ | Prod |
| `SMTP_PASSWORD` | string | `app-password` | ❌ | Prod |
| `SMTP_FROM_EMAIL` | string | `noreply@app.com` | ❌ | Prod |

### Frontend Variables

| Variable | Type | Example | Required | Environment |
|----------|------|---------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | string | `AIzaSy_...` | ✅ | All |
| `VITE_FIREBASE_AUTH_DOMAIN` | string | `project.firebaseapp.com` | ✅ | All |
| `VITE_FIREBASE_PROJECT_ID` | string | `genesis-ec0bd` | ✅ | All |
| `VITE_FIREBASE_STORAGE_BUCKET` | string | `project.firebasestorage.app` | ✅ | All |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | string | `197595305755` | ✅ | All |
| `VITE_FIREBASE_APP_ID` | string | `1:197595305755:web:...` | ✅ | All |
| `VITE_API_URL` | string | `https://api.yourdomain.com/api` | ✅ | All |

---

## ✅ Pre-Deployment Checklist

### Security
- [ ] No `.env` files committed to Git
- [ ] All secrets stored in deployment platform
- [ ] Firebase private key properly escaped (`\n` for newlines)
- [ ] API keys have appropriate restrictions

### Firebase Configuration
- [ ] Firebase project created and configured
- [ ] Email/Password authentication enabled
- [ ] Service account created with private key
- [ ] Firestore database created
- [ ] Cloud Storage bucket created
- [ ] Security rules set (if not using defaults)

### Backend
- [ ] `NODE_ENV=production`
- [ ] All `FIREBASE_*` variables set
- [ ] All `GEMINI_*` variables set
- [ ] `CORS_ORIGIN` points to frontend domain
- [ ] `PORT` set correctly
- [ ] `npm run build` succeeds
- [ ] `npm start` runs without errors

### Frontend
- [ ] All `VITE_FIREBASE_*` variables set
- [ ] `VITE_API_URL` points to backend
- [ ] `npm run build` succeeds
- [ ] Built files optimized for production
- [ ] No secrets in component code

### Testing
- [ ] Backend API responds to requests
- [ ] Frontend loads and renders
- [ ] Firebase authentication works
- [ ] File uploads work
- [ ] Invoice processing works

---

## 🐛 Troubleshooting

### Issue: Firebase "Permission Denied"
**Solution:**
- Check `FIREBASE_PRIVATE_KEY` is properly escaped
- Verify service account has required permissions
- Check Firebase security rules

### Issue: Gemini API "Invalid Key"
**Solution:**
- Ensure key starts with `AIzaSy_`
- Verify API is enabled in Google Cloud Console
- Check key has correct permissions

### Issue: CORS Errors
**Solution:**
- Update `CORS_ORIGIN` to match frontend domain
- Include protocol (https:// or http://)
- Check frontend is making requests to correct backend URL

### Issue: Email Not Sending
**Solution:**
- Verify SMTP credentials are correct
- Enable "Less secure app access" for Gmail
- Use app-specific password for Gmail
- Check firewall allows port 587/465

---

## 📚 Additional Resources

- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- Render Deployment: https://render.com/docs
- Vercel Deployment: https://vercel.com/docs
- Gemini API: https://ai.google.dev/gemini-api/docs
- Environment Variables: https://12factor.net/config

---

## 🎯 Deployment Workflow

```bash
# 1. Prepare local environment
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in values

# 2. Test locally
cd backend && npm run dev
cd frontend && npm run dev

# 3. Build for production
cd backend && npm run build
cd frontend && npm run build

# 4. Push to GitHub
git add .
git commit -m "Prepare for deployment"
git push origin frontend_backend_integration

# 5. Deploy to Render (backend)
# Set env vars in Render dashboard
# Deploy from Git

# 6. Deploy to Vercel (frontend)
# Set env vars in Vercel dashboard
# Deploy from Git

# 7. Verify production
# Test frontend at https://your-frontend.com
# Test backend at https://your-backend.com/api
```

---

## 📞 Support

For issues, check:
1. `.env` file has all required variables
2. Values match Firebase/Google Cloud Console
3. No extra spaces or quotes in values
4. Private key is properly escaped with `\n`

---

**Status:** ✅ Ready for deployment!

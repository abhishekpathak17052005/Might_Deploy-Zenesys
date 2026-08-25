# 🔐 Security & Environment Setup Guide

This document explains how secrets and environment variables are organized securely.

---

## 📋 Overview

**Core Principle**: All secrets are kept in **backend `.env` file only**. Frontend contains only public values.

### What Goes Where

```
🔒 Backend (.env) - SECRETS ONLY
├── Firebase Admin SDK Private Key
├── Gemini API Key
├── OCR API Key
├── Firebase Service Account Credentials
└── All sensitive configuration

🔓 Frontend (.env.local) - PUBLIC VALUES ONLY
├── Firebase Web API Key (public)
├── Firebase Project ID
├── Backend API URL
└── No secrets or sensitive data
```

---

## 🔐 Backend Environment (.env)

**Location**: `backend/.env` (in .gitignore)

### All Secrets Centralized Here

```env
# Sensitive: Firebase Admin SDK
FIREBASE_PROJECT_ID=genesis-ec0bd
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Sensitive: AI Services
GEMINI_API_KEY=your-api-key

# Sensitive: OCR Services
OCR_SPACE_API_KEY=your-api-key
```

### Why Only in Backend?

1. **Backend controls all external API calls**
   - Frontend never calls Gemini, OCR, or Firebase Admin directly
   - Backend is the only interface to these services

2. **Secrets never exposed to client**
   - Even if frontend code is decompiled, no secrets leak
   - Private keys stay on server

3. **Single source of truth**
   - Easier to rotate secrets
   - Simpler audit trail
   - Better security posture

---

## 🔓 Frontend Environment (.env.local)

**Location**: `frontend/.env.local` (in .gitignore)

### Public Values Only

```env
# Public: Backend URL (can be changed per deployment)
VITE_API_URL=http://localhost:5000/api

# Public: Firebase Web SDK (public by design)
VITE_FIREBASE_API_KEY=AIzaSyBfaN5KT...
VITE_FIREBASE_PROJECT_ID=genesis-ec0bd
```

### Why These Are OK

1. **Firebase Web API Key is public**
   - Designed to be public in web apps
   - Protected by Firebase security rules
   - No sensitive data exposed

2. **Backend URL is configurable**
   - Not a secret, can change per environment
   - Sent to browser anyway

3. **Browser Console Shows These Anyway**
   - Any network tab inspection reveals backend URL
   - Firebase config is visible in page source
   - No harm in having these as env vars

---

## 🛡️ Security Checklist

### ✅ Do This

- [x] Keep `.env` files in `.gitignore`
- [x] Never commit actual `.env` files
- [x] Use `.env.example` for reference
- [x] Rotate secrets regularly
- [x] Use Render Dashboard environment variables for production
- [x] Use unique secrets per environment
- [x] Log all secret access attempts

### ❌ Don't Do This

- [ ] Commit `.env` files to Git
- [ ] Commit Firebase private keys anywhere
- [ ] Commit API keys in code
- [ ] Share secrets via chat or email
- [ ] Use same secrets across environments
- [ ] Check secrets into version control

---

## 🚀 Development Setup

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and add your actual secrets
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with YOUR backend URL and public Firebase config
```

### 3. Verify

```bash
# Backend should read .env
npm start  # Backend at http://localhost:5000

# Frontend should read .env.local
npm run dev  # Frontend at http://localhost:5173
```

---

## 🌐 Production Deployment

### On Render Dashboard

#### Backend Service Environment Variables

```
NODE_ENV                    production
PORT                        5000
CORS_ORIGIN                 https://invoice-flow-frontend.onrender.com
FIREBASE_PROJECT_ID         [from backend/.env]
FIREBASE_CLIENT_EMAIL       [from backend/.env]
FIREBASE_PRIVATE_KEY        [from backend/.env]
FIREBASE_STORAGE_BUCKET     [from backend/.env]
GEMINI_API_KEY              [from backend/.env]
GEMINI_EXTRACTION_MODEL     gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL gemini-pro
OCR_SPACE_API_KEY           [from backend/.env]
```

#### Frontend Service Environment Variables

```
VITE_API_URL                      https://invoice-flow-backend.onrender.com/api
VITE_FIREBASE_API_KEY             [from frontend/.env.local]
VITE_FIREBASE_AUTH_DOMAIN         genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID          genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET      genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID 197595305755
VITE_FIREBASE_APP_ID              1:197595305755:web:72998a2f5781e2330ca3a
```

### Steps

1. **Backend on Render**
   - Connect GitHub repo
   - Set root to `backend`
   - Copy all `.env` values into Render environment variables
   - Do NOT commit `.env` file

2. **Frontend on Render**
   - Connect GitHub repo
   - Set root to `frontend`
   - Copy only public values from `.env.local`
   - Set `VITE_API_URL` to production backend URL

---

## 🔄 Rotating Secrets

### When to Rotate

- [ ] Monthly security review
- [ ] If someone leaves the team
- [ ] After suspected breach
- [ ] Whenever a developer leaves

### How to Rotate

1. **Generate new secrets** from respective services
2. **Update in `.env` file** locally
3. **Test locally** that everything works
4. **Update in Render Dashboard** for production
5. **Verify production** is still working
6. **Document rotation** in audit log

---

## 🔍 Audit & Monitoring

### What to Monitor

1. **Git History**
   ```bash
   git log --all --full-history -- ".env"
   ```
   Should show `.env` never committed

2. **Environment Variables in Render**
   - Check Render Dashboard periodically
   - Verify no stale secrets
   - Monitor access logs

3. **API Usage**
   - Monitor Gemini API usage
   - Track OCR API calls
   - Review Firebase operations

---

## ✨ Best Practices

### 1. Use Different Secrets Per Environment

```
Development:  .env (local only)
Staging:      Render staging secrets
Production:   Render production secrets
```

### 2. Document Secrets Location

```
├── backend/.env                 ← Actual secrets (in .gitignore)
├── backend/.env.example         ← Reference template
├── frontend/.env.local          ← Public values (in .gitignore)
└── frontend/.env.example        ← Reference template
```

### 3. Access Control

- Only developers need `.env` access
- Ops team manages Render secrets
- Rotate secrets on team changes
- Use different secrets per person if possible

### 4. Incident Response

If secrets leak:
1. Immediately rotate affected secrets
2. Update in all environments
3. Review logs for abuse
4. Document in security log
5. Notify team

---

## 🆘 Troubleshooting

### Backend Can't Connect to Firebase

**Check**: `backend/.env` has valid `FIREBASE_PRIVATE_KEY`
- Ensure quotes are correct
- Check `\n` for line breaks
- Verify no extra characters

### Frontend Shows Blank Page

**Check**: `frontend/.env.local` has valid `VITE_API_URL`
- Should start with http:// or https://
- No trailing slash
- Should be accessible from browser

### API Key Errors in Logs

**Check**: All `.env` variables are set
```bash
cd backend
npm start  # Watch for missing env var warnings
```

---

## 📚 References

- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Google Gemini API](https://ai.google.dev/)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)


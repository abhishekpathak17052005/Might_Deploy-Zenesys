# Deployment Guide - InvoiceFlow

This guide explains how to deploy both the backend API and frontend application to Render.com.

## Prerequisites

- GitHub account with the repository access
- Render.com account (free tier available)
- All secrets and environment variables configured

## Backend Deployment (Render.com)

### Step 1: Deploy Backend Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `invoice-flow-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`

### Step 2: Configure Environment Variables

Add these environment variables in Render Dashboard:

```
NODE_ENV=production
PORT=5000
GEMINI_API_KEY=[Your Gemini API Key]
GEMINI_EXTRACTION_MODEL=gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL=gemini-pro
CORS_ORIGIN=https://invoice-flow-frontend.onrender.com
FIREBASE_PROJECT_ID=genesis-ec0bd
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=[Your Firebase Private Key]
FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
```

### Step 3: Deploy

Click **Deploy** and wait for the build to complete.

**Note the Backend URL**: `https://invoice-flow-backend.onrender.com`

---

## Frontend Deployment (Render.com)

### Step 1: Deploy Frontend Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `invoice-flow-frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `frontend`

### Step 2: Configure Environment Variables

Add these environment variables in Render Dashboard:

```
VITE_API_URL=https://invoice-flow-backend.onrender.com/api
VITE_FIREBASE_API_KEY=AIzaSyBfaN5KTUXNGfZL2qzzi8nv1qEGAdkZLU
VITE_FIREBASE_AUTH_DOMAIN=genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=197595305755
VITE_FIREBASE_APP_ID=1:197595305755:web:72998a2f5781e2330ca3a
```

### Step 3: Deploy

Click **Deploy** and wait for the build to complete.

**Frontend URL**: `https://invoice-flow-frontend.onrender.com`

---

## Authentication & Testing

### Test Login Credentials

```
Procurement Officer:
Email: procurement@demo.com
Password: [From Firebase Console]

Finance Manager:
Email: finance@demo.com
Password: [From Firebase Console]
```

### Test Flow

1. Visit: `https://invoice-flow-frontend.onrender.com`
2. Login with demo credentials
3. Access appropriate dashboard:
   - Procurement → `/procurement/dashboard`
   - Finance → `/finance/dashboard`
4. Navigate through invoices and review pages

---

## API Endpoints Reference

### Health Check
- `GET /api/health` - Backend health check
- `GET /api/health/firebase` - Firebase connection check

### Authentication
- `GET /api/auth/me` - Get current user info

### Finance Operations
- `GET /api/finance/review` - Get invoices for finance review
- `GET /api/finance/invoices/:id` - Get invoice details
- `POST /api/invoices/:id/approve` - Approve invoice
- `POST /api/invoices/:id/reject` - Reject invoice

### Procurement Operations
- `GET /api/procurement/dashboard` - Get procurement dashboard data
- `POST /api/invoices/upload` - Upload invoice document
- `POST /api/invoices/:id/extract` - Extract invoice data

---

## Troubleshooting

### Frontend Not Loading
- Check `VITE_API_URL` points to correct backend URL
- Verify Firebase configuration in environment variables
- Check browser console for CORS errors

### Backend Connection Failed
- Verify `CORS_ORIGIN` includes frontend URL
- Check backend logs in Render Dashboard
- Ensure all Firebase credentials are set correctly

### API Calls Failing
- Check backend is running: `GET /api/health`
- Verify Firebase token in localStorage
- Check network tab in browser DevTools

---

## Monitoring

### Backend Logs
- Go to service in Render Dashboard
- Click **Logs** tab
- Monitor for errors and API calls

### Frontend Performance
- Use browser DevTools Network tab
- Check API response times
- Monitor Firebase token refresh

---

## Maintenance

### Database Backups
- Firestore is managed by Google Firebase
- Automatic backups handled by Firebase

### Updating Code
- Push to GitHub
- Render auto-deploys from main branch
- Manual redeploy available in Dashboard if needed

---

## Cost Optimization

- Both services on Render free tier
- Firestore free tier: 1GB storage, 50K reads/day
- For production, upgrade to paid plans as needed

---

## Next Steps

1. Deploy backend first (takes ~5 minutes)
2. Deploy frontend second
3. Test authentication flow
4. Verify all pages load and connect to API
5. Monitor logs for any errors


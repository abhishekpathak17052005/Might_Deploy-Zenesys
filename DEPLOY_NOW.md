# 🚀 Deploy InvoiceFlow Online - Quick Start

All pages are now ready to be deployed online with backend connectivity. Follow these steps to get everything running.

## 📋 What You Need

1. **Render.com Account** (free tier available) - [Sign up here](https://render.com)
2. **GitHub Access** - Repository already connected
3. **API Keys** - Already configured:
   - ✅ Firebase credentials
   - ✅ Gemini API key
   - ✅ Cloud Storage bucket

---

## 🔧 Step 1: Deploy Backend API (5 minutes)

### On Render Dashboard:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Search for `Might_Deploy-Zenesys` repository
4. Click **"Connect"**

### Configure Backend Service:

```
Name:                 invoice-flow-backend
Environment:          Node
Root Directory:       backend
Build Command:        npm install
Start Command:        npm start
Plan:                 Free
```

### Add Environment Variables:

```
NODE_ENV              production
PORT                  5000
GEMINI_API_KEY        [Your Gemini API key]
GEMINI_EXTRACTION_MODEL      gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL  gemini-pro
CORS_ORIGIN           https://invoice-flow-frontend.onrender.com
FIREBASE_PROJECT_ID   genesis-ec0bd
FIREBASE_CLIENT_EMAIL firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY  [Your Firebase private key]
FIREBASE_STORAGE_BUCKET genesis-ec0bd.firebasestorage.app
```

### Deploy

Click **"Create Web Service"** and wait for build to complete (~3 minutes)

**Note the URL**: `https://invoice-flow-backend.onrender.com`

---

## 🎨 Step 2: Deploy Frontend (5 minutes)

### On Render Dashboard:

1. Click **"New +"** → **"Web Service"** again
2. Select same repository
3. Click **"Connect"**

### Configure Frontend Service:

```
Name:                 invoice-flow-frontend
Environment:          Node
Root Directory:       frontend
Build Command:        npm install && npm run build
Start Command:        npm start
Plan:                 Free
```

### Add Environment Variables:

```
VITE_API_URL                       https://invoice-flow-frontend.onrender.com/api
VITE_FIREBASE_API_KEY              [Your Firebase API key]
VITE_FIREBASE_AUTH_DOMAIN          genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID           genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET       genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID  197595305755
VITE_FIREBASE_APP_ID               1:197595305755:web:72998a2f5781e2330ca3a
```

### Deploy

Click **"Create Web Service"** and wait for build to complete (~3 minutes)

**Your App URL**: `https://invoice-flow-frontend.onrender.com`

---

## ✅ Testing Your Deployment

### 1. Check Backend Health
```
https://invoice-flow-backend.onrender.com/api/health
```

Should return:
```json
{
  "success": true,
  "data": {
    "message": "Backend is running",
    "timestamp": "2026-08-22T..."
  }
}
```

### 2. Check Firebase Connection
```
https://invoice-flow-backend.onrender.com/api/health/firebase
```

### 3. Login to Frontend

1. Visit: `https://invoice-flow-frontend.onrender.com`
2. Login with:
   - **Email**: `ap17052005@gmail.com`
   - **Password**: `Demo@12345`

### 4. Test Pages

#### Finance Manager Role
- Dashboard: `https://invoice-flow-frontend.onrender.com/finance/dashboard`
- Review Queue: `https://invoice-flow-frontend.onrender.com/finance/review`
- Invoice Review: `https://invoice-flow-frontend.onrender.com/finance/invoices/INV-001`

#### Procurement Officer Role
- Dashboard: `https://invoice-flow-frontend.onrender.com/procurement/dashboard`
- Submit Invoice: `https://invoice-flow-frontend.onrender.com/procurement/invoices/new`
- My Invoices: `https://invoice-flow-frontend.onrender.com/procurement/invoices`

---

## 🔗 Connected Pages & Endpoints

All pages now connected to live backend:

### Frontend Pages
- ✅ Login
- ✅ Finance Dashboard
- ✅ Finance Review Queue
- ✅ Invoice Detail & Review
- ✅ Procurement Dashboard
- ✅ Invoice Upload
- ✅ My Submissions

### Backend APIs
- ✅ `/api/health` - Health check
- ✅ `/api/auth/me` - Current user
- ✅ `/api/finance/review` - Finance queue
- ✅ `/api/finance/invoices/:id` - Invoice details
- ✅ `/api/invoices/:id/approve` - Approve invoice
- ✅ `/api/invoices/:id/reject` - Reject invoice
- ✅ `/api/procurement/dashboard` - Procurement stats
- ✅ `/api/invoices/upload` - Upload invoice
- ✅ `/api/invoices/:id/extract` - Extract data

---

## 📊 Real-Time Features

Once deployed, you can:

### For Finance Manager
1. See real invoice data in dashboard
2. Review pending invoices
3. Check verification results
4. Approve/reject with comments
5. View risk analysis

### For Procurement Officer
1. Upload invoice documents
2. Track processing status
3. View finance review queue
4. See approval status

### Data Integration
- Firebase Firestore for data storage
- Cloud Storage for documents
- Gemini AI for extraction
- Real-time status updates

---

## 🐛 Troubleshooting

### Frontend Shows Blank Page
- Check browser console (F12)
- Verify `VITE_API_URL` is correct
- Check Network tab - API calls should go to backend

### API Calls Failing
- Backend logs: Render Dashboard → service → Logs
- Check CORS_ORIGIN matches frontend URL
- Verify Firebase credentials are correct

### Build Failed
- Check build logs in Render
- Frontend build: `npm install && npm run build`
- Backend build: `npm install`

### Login Not Working
- Verify Firebase credentials
- Check auth token in localStorage
- Try incognito mode

---

## 📈 Monitoring

### Backend Performance
1. Render Dashboard → invoice-flow-backend → Metrics
2. Check CPU, memory usage
3. Monitor logs for errors

### Frontend Performance
1. Browser DevTools → Network tab
2. Check API response times
3. Monitor Firebase token refresh

---

## 🔄 Updates & Redeployment

### Auto-Deploy
Push changes to GitHub → Render auto-deploys

### Manual Redeploy
1. Render Dashboard → service
2. Click **"Manual Deploy"** → **"Deploy Latest Commit"**

---

## 📝 Environment Files Reference

### Backend (.env.production)
```
NODE_ENV=production
PORT=5000
GEMINI_API_KEY=***
CORS_ORIGIN=https://invoice-flow-frontend.onrender.com
FIREBASE_* (set via Render Dashboard)
```

### Frontend (.env.production)
```
VITE_API_URL=https://invoice-flow-backend.onrender.com/api
VITE_FIREBASE_*=*** (all Firebase config)
```

---

## ✨ What's Connected

- ✅ Frontend talks to Backend API
- ✅ Backend authenticates with Firebase
- ✅ Data stored in Firestore
- ✅ Documents in Cloud Storage
- ✅ AI extraction via Gemini
- ✅ Real-time invoice processing
- ✅ Risk analysis & verification
- ✅ Approval workflow

---

## 🎯 Next Steps

1. ✅ Deploy backend first (takes ~5 min)
2. ✅ Deploy frontend second (takes ~5 min)
3. ✅ Test login with demo credentials
4. ✅ Verify API connections work
5. ✅ Test invoice approval workflow

**Estimated Total Time**: 15-20 minutes to full deployment ✨


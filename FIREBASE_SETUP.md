# Firebase Setup Guide for Might_Deploy-Zenesys

**Status:** Ready for Authentication Setup

---

## ✅ What We've Done

1. ✅ Created Firebase Web App configuration file (`frontend/src/lib/firebase.ts`)
2. ✅ Created environment template (`frontend/.env.local.example`)
3. ✅ Verified .gitignore protection (`.env*.local` ignored)
4. ✅ Installed Firebase SDK ready

---

## 📋 Next Steps: Firebase Authentication Setup

### Step 1: Get to Firebase Console

In the Firebase setup screen you're seeing, click **"Continue to the console"**

This takes you to: `https://console.firebase.google.com/`

---

### Step 2: Enable Email/Password Authentication

1. In Firebase Console, click your project
2. Left sidebar → **Build** → **Authentication**
3. Click **Get started** (if not already done)
4. Click **Email/Password** sign-in method
5. Toggle **Enable** (switch to ON)
6. Click **Save**

---

### Step 3: Create Demo Users

Once Email/Password is enabled, click the **Users** tab.

Create two users:

**User 1: Procurement Officer**
```
Email: procurement@demo.com
Password: Demo@12345
```

**User 2: Finance Manager**
```
Email: finance@demo.com
Password: Demo@12345
```

---

### Step 4: Get Your Firebase Configuration

1. In Firebase Console, go to **Project Settings** (⚙️ icon)
2. Scroll down to **Your apps**
3. Find **Web App** (should show your app name)
4. Click the code icon `</>` next to it
5. Copy the config object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy_...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123xyz"
};
```

---

### Step 5: Add Firebase Config to Frontend

**Create file:** `frontend/.env.local`

(Copy from `.env.local.example` and fill in your actual values)

```env
VITE_FIREBASE_API_KEY=AIzaSy_YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123xyz

VITE_API_URL=http://localhost:5000/api
```

**⚠️ Important:** Do NOT commit `.env.local` to GitHub (already in .gitignore ✅)

---

### Step 6: Install Firebase SDK

From project root:

```bash
cd frontend
npm install firebase
```

---

### Step 7: Add User Roles to Firebase

**Option A: Firestore (Recommended)**

After users are created in Authentication:

1. Go to **Firestore Database** → **Create database**
2. Create collection: `users`
3. Add documents:

**Document 1:** `procurement@demo.com`
```json
{
  "email": "procurement@demo.com",
  "role": "PROCUREMENT_OFFICER",
  "name": "Procurement Officer",
  "createdAt": "2024-08-22"
}
```

**Document 2:** `finance@demo.com`
```json
{
  "email": "finance@demo.com",
  "role": "FINANCE_MANAGER",
  "name": "Finance Manager",
  "createdAt": "2024-08-22"
}
```

---

**Option B: Custom Claims (Advanced)**

Use Firebase CLI:

```bash
firebase auth:import users.json --hash-algo=scrypt --rounds=8 --mem-cost=14
```

---

## 🔗 Authentication Flow

```
┌────────────────┐
│  Frontend      │
│  (React)       │
└────────────────┘
        ↓
    [Login Form]
    Email: procurement@demo.com
    Password: Demo@12345
        ↓
┌────────────────┐
│  Firebase Auth │
│  (Browser)     │
└────────────────┘
        ↓
    [Generate ID Token]
    Token contains: uid, email, custom claims
        ↓
┌────────────────────────────────────────┐
│  API Request to Backend                │
│  Authorization: Bearer {idToken}       │
└────────────────────────────────────────┘
        ↓
┌────────────────┐
│  Backend       │
│  (Express)     │
└────────────────┘
        ↓
    [verifyFirebaseToken middleware]
    Validates token with Firebase Admin SDK
    Extracts: uid, email, role
        ↓
    [requireRole middleware]
    Checks: Is user PROCUREMENT_OFFICER or FINANCE_MANAGER?
        ↓
┌────────────────────────┐
│  Route Handler         │
│  req.user.role = role  │
└────────────────────────┘
```

---

## 🔐 Security Notes

### Frontend (.env.local)
- ✅ Safe to include API Key
- ✅ Safe to include Auth Domain
- ✅ This is "public" in the browser anyway
- ✅ Protected by .gitignore (not in GitHub)

### Backend (.env)
- ✅ NEVER put Frontend API Key here
- ✅ NEVER put Firebase Web Config here
- ✅ Keep Admin SDK JSON separate
- ✅ Admin SDK only on backend

---

## 🧪 Testing Authentication

Once everything is set up:

### Test User Login
```
Email: procurement@demo.com
Password: Demo@12345
```

### Expected Result
- ✅ User logged in
- ✅ Firebase ID token generated
- ✅ Can call protected API endpoints
- ✅ Role-based access enforced

---

## 🐛 Troubleshooting

### Issue: "Firebase is not initialized"
- Solution: Ensure `firebase.ts` is imported in your layout/root component
- Check: `import { auth, db, storage } from "@/lib/firebase"`

### Issue: "Authentication is disabled"
- Solution: Go to Firebase Console → Authentication → Email/Password → Enable

### Issue: "Invalid credentials"
- Solution: Double-check email/password for demo users (exact match required)

### Issue: "CORS errors"
- Solution: Frontend .env has wrong VITE_API_URL
- Check: Should be `http://localhost:5000/api` for local dev

---

## 📊 Firebase Free Tier Limits

- ✅ 50,000 authentications per day
- ✅ 1 GB Cloud Storage
- ✅ 1 GB Firestore storage
- ✅ Good for development and testing

---

## 🚀 Next: Connect Frontend to Backend

Once Firebase Auth is working:

1. Create login component
2. Get Firebase ID token
3. Send in Authorization header
4. Backend verifies token
5. Routes check role

---

## 📝 Files Created

- ✅ `frontend/src/lib/firebase.ts` - Firebase initialization
- ✅ `frontend/.env.local.example` - Configuration template
- ✅ `FIREBASE_SETUP.md` - This guide

---

## ✅ Checklist

- [ ] Click "Continue to the console" in Firebase setup
- [ ] Enable Email/Password authentication
- [ ] Create two demo users
- [ ] Get Firebase Web Configuration
- [ ] Fill `.env.local` with values
- [ ] Run `npm install firebase` in frontend
- [ ] Test login with demo credentials
- [ ] Verify backend receives ID token
- [ ] Test role-based access

---

**Ready to proceed?** Follow the steps above and send me a screenshot when you reach the Email/Password authentication screen!


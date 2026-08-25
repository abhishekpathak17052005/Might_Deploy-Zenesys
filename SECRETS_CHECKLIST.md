# 🔐 Secrets Management Checklist

Complete guide to ensuring all secrets are properly centralized and protected.

---

## ✅ Current Status

### Backend (.env)
```
✅ FIREBASE_PROJECT_ID           → Backend only
✅ FIREBASE_CLIENT_EMAIL         → Backend only
✅ FIREBASE_PRIVATE_KEY          → Backend only (MOST SENSITIVE)
✅ FIREBASE_STORAGE_BUCKET       → Backend only
✅ GEMINI_API_KEY                → Backend only
✅ GEMINI_EXTRACTION_MODEL       → Backend only
✅ GEMINI_CATEGORIZATION_MODEL   → Backend only
✅ OCR_SPACE_API_KEY             → Backend only
✅ CORS_ORIGIN                   → Backend only
✅ NODE_ENV                      → Backend only
✅ PORT                          → Backend only
```

### Frontend (.env.local)
```
✅ VITE_API_URL                      → Public (backend URL)
✅ VITE_FIREBASE_API_KEY             → Public (Firebase Web key)
✅ VITE_FIREBASE_AUTH_DOMAIN         → Public
✅ VITE_FIREBASE_PROJECT_ID          → Public
✅ VITE_FIREBASE_STORAGE_BUCKET      → Public
✅ VITE_FIREBASE_MESSAGING_SENDER_ID → Public
✅ VITE_FIREBASE_APP_ID              → Public
```

### Version Control (.gitignore)
```
✅ .env (all environments)
✅ .env.local
✅ .env.*.local
✅ node_modules/
✅ dist/
✅ .DS_Store
```

---

## 🚀 Deployment Checklist

### Before Deploying to Production

- [ ] All secrets in `backend/.env` (never in `frontend/.env.local`)
- [ ] `.env` files in `.gitignore`
- [ ] No secrets in Git history
- [ ] `.env.example` files created for reference
- [ ] Backend .env.example doesn't have actual secrets
- [ ] Frontend .env.example doesn't have secrets

### Backend Deployment

- [ ] Firebase credentials set in Render Dashboard
- [ ] Gemini API key set in Render Dashboard
- [ ] OCR API key set in Render Dashboard
- [ ] CORS_ORIGIN points to production frontend URL
- [ ] NODE_ENV=production
- [ ] PORT configured correctly
- [ ] Backend builds and runs successfully
- [ ] `npm start` command works

### Frontend Deployment

- [ ] VITE_API_URL points to production backend
- [ ] Firebase Web config correct
- [ ] No secrets in .env.local
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Frontend builds without errors

---

## 📋 Daily Operations

### Security Checks

- [ ] No `.env` files in Git (check weekly)
  ```bash
  git log --all --full-history -- ".env"
  # Should return nothing
  ```

- [ ] No hardcoded secrets in code (check monthly)
  ```bash
  grep -r "AIzaSy" src/        # Should not find Firebase key
  grep -r "AQ.Ab8" src/        # Should not find Gemini key
  ```

- [ ] Environment variables set on Render (check on deployment)
  - Render Dashboard → each service → Environment variables
  - Verify all required vars are present

### Rotation Schedule

- [ ] Monthly: Review all secrets
- [ ] Quarterly: Rotate secrets not in use
- [ ] On team changes: Immediately rotate
- [ ] On suspected breach: Immediately rotate

---

## 🆘 If Secrets Leak

### Immediate Actions (First 5 Minutes)

1. [ ] Stop all deployments
2. [ ] Revoke leaked secrets in their respective services
   - Firebase: Delete service account, create new one
   - Gemini: Regenerate API key
   - OCR: Regenerate API key
3. [ ] Update all environment variables
4. [ ] Restart services on Render
5. [ ] Verify systems still working

### Follow-up (Within 1 Hour)

1. [ ] Check service logs for any misuse
2. [ ] Document what happened
3. [ ] Update team about incident
4. [ ] Check Firebase logs for unauthorized access
5. [ ] Verify no data was exfiltrated

### Post-Incident (Within 1 Day)

1. [ ] Review Git history for how leak happened
2. [ ] Add additional .gitignore entries if needed
3. [ ] Add pre-commit hooks to prevent future leaks
4. [ ] Update security documentation
5. [ ] Team training on secrets management

---

## 🛡️ Security Best Practices

### Development Environment

```bash
# Never do this:
echo "GEMINI_API_KEY=xxx" >> .env
git add .env
git push

# Always do this:
cp backend/.env.example backend/.env
# Edit .env with actual secrets
# .env is in .gitignore automatically
git add .env.example  # Only the example!
git push
```

### Production Environment

```
Use Render Dashboard for ALL secrets:
1. Never paste secrets in code
2. Set env vars in Render UI
3. Use different secrets per environment
4. Document where each secret comes from
5. Audit access to Render dashboard
```

### Code Review

Before merging any PR:
- [ ] No .env files added/modified
- [ ] No hardcoded API keys
- [ ] No Firebase credentials in code
- [ ] No secrets in commit messages
- [ ] No secrets in strings or logs

---

## 📊 Secrets Audit

### What Lives Where

| Secret | Backend | Frontend | .gitignore | Render |
|--------|---------|----------|-----------|--------|
| Firebase Private Key | ✅ .env | ❌ | ✅ | ✅ |
| Gemini API Key | ✅ .env | ❌ | ✅ | ✅ |
| OCR API Key | ✅ .env | ❌ | ✅ | ✅ |
| Firebase Web Key | ❌ | ✅ .env.local | ✅ | ✅ |
| Backend URL | ❌ | ✅ .env.local | ✅ | ✅ |

### Access Control

| Role | Can Access |
|------|-----------|
| Frontend Developer | .env.example, frontend/.env.local, documentation |
| Backend Developer | backend/.env, backend/.env.example, all docs |
| DevOps | Render Dashboard environment variables |
| Security | Audit logs, Render dashboard access logs |

---

## ✨ Prevention Measures

### Git Hooks (Optional)

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if git diff --cached | grep -E "FIREBASE_PRIVATE_KEY|GEMINI_API_KEY|AQ\."; then
    echo "❌ ERROR: Detected potential secret in commit"
    echo "Remove secret before committing"
    exit 1
fi
```

### Environment Validation

Backend startup should verify:
```typescript
if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Missing FIREBASE_PROJECT_ID in .env");
}
if (!process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY in .env");
}
if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in .env");
}
```

---

## 📚 Documentation Reference

### Files Created for Security

```
✅ .gitignore              → Protects all .env files
✅ backend/.env            → All backend secrets (LOCAL ONLY)
✅ backend/.env.example    → Template without secrets
✅ backend/.env.production → Template for production
✅ frontend/.env.local     → Public values only (LOCAL ONLY)
✅ frontend/.env.example   → Template for frontend
✅ frontend/.env.production → Template for production
✅ SECURITY_ENV_SETUP.md   → Detailed guide
✅ SECRETS_CHECKLIST.md    → This file
```

---

## 🎯 Next Steps

1. **Before First Deployment**
   - [ ] Verify all secrets in backend/.env
   - [ ] Verify frontend/.env.local has NO secrets
   - [ ] Test locally that everything works
   - [ ] Verify .gitignore protects .env files

2. **First Render Deployment**
   - [ ] Set all backend/.env values in Render
   - [ ] Set frontend/.env.local values in Render
   - [ ] Verify connection works
   - [ ] Check Render logs for secret access

3. **Ongoing**
   - [ ] Monthly: Review audit logs
   - [ ] Quarterly: Rotate secrets
   - [ ] On team changes: Update access

---

## ✅ Final Verification

Run these commands to verify setup:

```bash
# Check .env files are ignored
git check-ignore backend/.env
git check-ignore frontend/.env.local
# Should output the file paths (meaning they're ignored)

# Check no secrets in Git
git log --all --full-history -- "*.env"
# Should return nothing

# Check no secrets in code
grep -r "AQ\." src/ || echo "✅ No Gemini keys found"
grep -r "AIzaSy" src/ || echo "✅ No Firebase keys found"

# Check .env.example exists
ls backend/.env.example frontend/.env.example
# Should show both files exist
```

---

## 🔒 Security Certifications

This setup follows:
- ✅ OWASP Secrets Management
- ✅ 12-Factor App methodology
- ✅ CWE-798 (Use of Hard-Coded Credentials)
- ✅ NIST cybersecurity framework


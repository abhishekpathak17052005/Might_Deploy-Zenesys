# 🔴 Database Connection Problem - Root Cause Analysis

**Issue**: MongoDB is not connecting
**Error**: `querySrv ECONNREFUSED _mongodb._tcp.cluster0.7fsqglj.mongodb.net`
**Status**: ❌ **NOT CONNECTED**

---

## Root Causes (3 Issues)

### Issue #1: DATABASE_URL is Empty ⚠️
**Severity**: 🔴 **CRITICAL - This is the main problem**

**Current .env**:
```env
DATABASE_URL=
```

**Problem**: 
- The `DATABASE_URL` environment variable is **EMPTY**
- Without a connection string, MongoDB cannot connect
- The backend tries to connect to nothing

**Solution**:
```env
DATABASE_URL=mongodb+srv://USERNAME:PASSWORD@cluster0.7fsqglj.mongodb.net/Pragyan?retryWrites=true&w=majority&appName=Cluster0
```

---

### Issue #2: Network Firewall Blocking MongoDB 🔴
**Severity**: 🔴 **CRITICAL**

**Error Pattern**:
```
Error: querySrv ECONNREFUSED _mongodb._tcp.cluster0.7fsqglj.mongodb.net
Code: ECONNREFUSED
```

**Meaning**:
- DNS query is being rejected
- Network/firewall blocking port 27017
- Cannot reach MongoDB cluster

**Root Cause**:
- Windows Firewall blocking connections
- ISP blocking MongoDB
- Network-level firewall

---

### Issue #3: Backend Code Has Syntax Error ⚠️
**Severity**: 🟡 **CRITICAL - Prevents server startup**

**Location**: `backend/src/server.ts` (lines 33-42)

**Error**:
```
ReferenceError: server is not defined
at server (C:\...\backend\src\server.ts:33:1)
```

**Problem**:
```typescript
// ❌ WRONG - trying to reference 'server' outside async function
async function startServer() {
  // server is defined HERE
  const server = app.listen(env.PORT, () => {...});
  server.on("error", ...); // OK inside function
}

// ❌ This won't work - server doesn't exist here
server.on("error", ...);
```

**Why Happening**:
- Server error handler is outside the function
- Variable `server` only exists inside `startServer()`
- Cannot access it from outside

---

## Why It's Not Connecting

### Chain of Failures

```
1. DATABASE_URL is empty
   ↓
2. Backend tries to connect to: undefined/empty
   ↓
3. Even if URL was set, firewall would block it
   ↓
4. Error: querySrv ECONNREFUSED
   ↓
5. Backend crashes before starting
```

---

## Quick Diagnosis Checklist

- [ ] **Issue 1**: DATABASE_URL is empty? → **YES** ⚠️
- [ ] **Issue 2**: Firewall blocking port 27017? → **LIKELY YES** ⚠️
- [ ] **Issue 3**: server.ts has syntax error? → **YES** ⚠️

---

## Solutions (In Order)

### Solution 1: Fix the server.ts Syntax Error (IMMEDIATE)

**Current code (BROKEN)**:
```typescript
async function startServer() {
  try {
    await connectDatabase();
    
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Backend server running on port ${env.PORT}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${env.PORT} is already in use.`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// ❌ PROBLEM: This code is OUTSIDE the function!
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use.`);
    process.exit(1);
  }
  throw error;
});

startServer();
```

**Fixed code (WORKING)**:
```typescript
async function startServer() {
  try {
    await connectDatabase();
    
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Backend server running on port ${env.PORT}`);
      console.log(`📊 Connected to MongoDB: Pragyan`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${env.PORT} is already in use. Stop the existing backend process or set PORT to another value in backend/.env.`
        );
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
```

**Key Change**: Remove duplicate `server.on()` code outside the function

---

### Solution 2: Add MongoDB Connection String to .env

**Step 1**: Get new connection string from MongoDB Atlas
```
Go to: https://cloud.mongodb.com/
Cluster0 → Connect → Drivers → Node.js
Copy the connection string
```

**Step 2**: Update `.env` file

**Replace**:
```env
DATABASE_URL=
```

**With**:
```env
DATABASE_URL=mongodb+srv://USERNAME:PASSWORD@cluster0.7fsqglj.mongodb.net/Pragyan?retryWrites=true&w=majority&appName=Cluster0
```

---

### Solution 3: Fix Network/Firewall Issue

**Option A**: Change DNS to Google (Easiest)
```
Settings → Network → IPv4 Properties
DNS: 8.8.8.8
Restart backend
```

**Option B**: Add Firewall Exception
```powershell
New-NetFirewallRule -DisplayName "MongoDB" `
  -Direction Outbound -Action Allow -Protocol TCP -RemotePort 27017
```

**Option C**: Use Local MongoDB
```env
DATABASE_URL=mongodb://localhost:27017/Pragyan
```

---

## Action Plan

### Step 1 (NOW): Fix server.ts Syntax Error
**Time**: 2 minutes
**Impact**: HIGH - Backend won't start without this

### Step 2 (NOW): Add MongoDB URL to .env
**Time**: 5 minutes
**Impact**: HIGH - Database won't connect without this

### Step 3 (IF NEEDED): Fix Network Issue
**Time**: 2-15 minutes depending on solution
**Impact**: HIGH - Network must allow MongoDB

---

## Current State vs. Required State

### Current (BROKEN)
```env
DATABASE_URL=
```
↓
Backend tries to connect to: `undefined`
↓
Error: Cannot connect

### Required (WORKING)
```env
DATABASE_URL=mongodb+srv://user:pass@cluster0.7fsqglj.mongodb.net/Pragyan?retryWrites=true&w=majority&appName=Cluster0
```
↓
Backend connects to: `cluster0.7fsqglj.mongodb.net`
↓
✅ Connected (if network allows)

---

## Why Each Issue Matters

| Issue | Why | Impact |
|-------|-----|--------|
| Empty DATABASE_URL | No connection string to use | ❌ Cannot connect anywhere |
| Firewall blocking | Network rejects MongoDB port | ❌ Connection times out |
| server.ts syntax error | Backend crashes before connecting | ❌ Server won't start |

---

## Expected Result After Fixes

**If all 3 issues fixed**:
```
🔄 Connecting to MongoDB...
✅ MongoDB connected successfully
   Database: Pragyan
   Server: cluster0.7fsqglj.mongodb.net:27017
🚀 Backend server running on port 5000
📊 Connected to MongoDB: Pragyan
```

**If only issue #2 or #3 remains**:
```
🔄 Connecting to MongoDB...
❌ Failed to connect to MongoDB
Error: querySrv ECONNREFUSED _mongodb._tcp.cluster0.7fsqglj.mongodb.net
```

---

## Summary

### Problems
1. ❌ `DATABASE_URL` is empty in `.env`
2. ❌ Network firewall blocking MongoDB
3. ❌ `server.ts` has syntax error (duplicate code outside function)

### Solutions
1. ✅ Add MongoDB connection string to `.env`
2. ✅ Fix DNS or firewall settings
3. ✅ Remove duplicate `server.on()` code from `server.ts`

### Time to Fix
- **Issue #1**: 5 minutes
- **Issue #2**: 2-15 minutes
- **Issue #3**: 2 minutes
- **Total**: 9-22 minutes

### Priority Order
1. Fix `server.ts` (prevents any connection)
2. Add DATABASE_URL (enables connection attempt)
3. Fix firewall (enables actual connection)

---

**Status**: ❌ **NOT CONNECTED** - 3 Issues blocking
**Next Action**: Fix `server.ts` and add `DATABASE_URL`
**Estimated Fix Time**: 20 minutes total

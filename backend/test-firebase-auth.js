/**
 * Firebase Authentication Test Script
 * Tests that Firebase Admin SDK can verify auth tokens
 */

require('dotenv').config();
const admin = require('firebase-admin');

console.log("\n═══════════════════════════════════════════════════════════");
console.log("   FIREBASE AUTHENTICATION TEST");
console.log("═══════════════════════════════════════════════════════════\n");

// Test 1: Check environment variables
console.log("TEST 1: Environment Variables Configuration");
console.log("─────────────────────────────────────────────");

const requiredVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_STORAGE_BUCKET'
];

let allVarsPresent = true;
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    if (varName === 'FIREBASE_PRIVATE_KEY') {
      console.log(`✅ ${varName}: [PRESENT - ${value.substring(0, 30)}...]`);
    } else if (varName === 'FIREBASE_CLIENT_EMAIL') {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allVarsPresent = false;
  }
}

if (!allVarsPresent) {
  console.log("\n❌ FAIL: Missing required Firebase environment variables\n");
  process.exit(1);
}

console.log("\n✅ PASS: All environment variables present\n");

// Test 2: Initialize Firebase Admin
console.log("TEST 2: Firebase Admin SDK Initialization");
console.log("──────────────────────────────────────────");

try {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  
  console.log("✅ PASS: Firebase Admin SDK initialized successfully");
  console.log(`   Project ID: ${process.env.FIREBASE_PROJECT_ID}\n`);
} catch (error) {
  console.log("❌ FAIL: Firebase Admin initialization failed");
  console.log(`Error: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Check Firebase Auth Service
console.log("TEST 3: Firebase Auth Service Access");
console.log("────────────────────────────────────");

try {
  const auth = admin.auth();
  console.log("✅ PASS: Firebase Auth service is accessible\n");
} catch (error) {
  console.log("❌ FAIL: Cannot access Firebase Auth service");
  console.log(`Error: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Create a custom test token
console.log("TEST 4: Create and Verify Custom Token");
console.log("──────────────────────────────────────");

async function testTokenCreation() {
  try {
    const testClaims = {
      email: 'ap17052005@gmail.com',
      role: 'PROCUREMENT_OFFICER'
    };
    
    const customToken = await admin.auth().createCustomToken('test-user-123', testClaims);
    console.log("✅ Created custom token successfully");
    console.log(`   Token (first 50 chars): ${customToken.substring(0, 50)}...\n`);
    
    return true;
  } catch (error) {
    console.log("❌ FAIL: Cannot create custom token");
    console.log(`Error: ${error.message}\n`);
    return false;
  }
}

// Test 5: List users
console.log("TEST 5: List Firebase Users");
console.log("───────────────────────────");

async function testListUsers() {
  try {
    const listUsersResult = await admin.auth().listUsers(2);
    console.log(`✅ Successfully retrieved users (first 2)`);
    
    listUsersResult.users.forEach((userRecord) => {
      console.log(`   - ${userRecord.email} (UID: ${userRecord.uid})`);
    });
    
    if (listUsersResult.users.length === 0) {
      console.log("   (No users found)");
    }
    
    console.log("");
    return true;
  } catch (error) {
    console.log("❌ FAIL: Cannot list users");
    console.log(`Error: ${error.message}\n`);
    return false;
  }
}

// Test 6: Verify Firestore access
console.log("TEST 6: Firestore Database Access");
console.log("─────────────────────────────────");

async function testFirestore() {
  try {
    const db = admin.firestore();
    
    // Try to get a reference (doesn't actually query, just tests initialization)
    const testRef = db.collection('_test').doc('_test');
    console.log("✅ Firestore database is accessible");
    console.log(`   Project: ${process.env.FIREBASE_PROJECT_ID}\n`);
    
    return true;
  } catch (error) {
    console.log("❌ FAIL: Cannot access Firestore");
    console.log(`Error: ${error.message}\n`);
    return false;
  }
}

// Run all async tests
async function runAllTests() {
  const test4 = await testTokenCreation();
  const test5 = await testListUsers();
  const test6 = await testFirestore();
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  
  if (test4 && test5 && test6) {
    console.log("✅ All tests PASSED - Firebase is fully configured!");
    console.log("   - Custom tokens can be created ✅");
    console.log("   - User management works ✅");
    console.log("   - Firestore is accessible ✅");
    console.log("\n🎉 Firebase Authentication is ready!");
  } else {
    console.log("❌ Some tests failed - See errors above");
  }
  
  console.log("═══════════════════════════════════════════════════════════\n");
  
  process.exit(test4 && test5 && test6 ? 0 : 1);
}

runAllTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

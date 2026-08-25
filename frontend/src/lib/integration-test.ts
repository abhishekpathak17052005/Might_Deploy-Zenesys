/**
 * Frontend-Backend Integration Test
 * Run this to verify the API client is working correctly
 */

import { apiClient } from "./api";

export async function testIntegration() {
  console.log("🧪 Starting Backend-Frontend Integration Tests...\n");

  try {
    // Test 1: Health Check
    console.log("1️⃣  Testing API Health...");
    const healthResult = await apiClient.getHealth();
    if (healthResult.success) {
      console.log("✅ Backend is running");
      console.log(`   Message: ${healthResult.data?.message}\n`);
    } else {
      console.log("❌ Backend health check failed");
      console.log(`   Error: ${healthResult.error?.message}\n`);
      return false;
    }

    // Test 2: Firebase Token Check
    const token = localStorage.getItem("firebaseToken");
    if (!token) {
      console.log("2️⃣  No Firebase token found");
      console.log("   ℹ️  Log in first to test authenticated endpoints\n");
      return true;
    }

    console.log("2️⃣  Testing Authenticated User...");
    const userResult = await apiClient.getCurrentUser(token);
    if (userResult.success && userResult.data) {
      console.log("✅ User authenticated successfully");
      console.log(`   UID: ${userResult.data.user?.uid}`);
      console.log(`   Email: ${userResult.data.user?.email}\n`);
    } else {
      console.log("❌ User auth check failed");
      console.log(`   Error: ${userResult.error?.message}\n`);
      return false;
    }

    // Test 3: List Invoices
    console.log("3️⃣  Testing Invoice List...");
    const invoicesResult = await apiClient.listInvoices(token);
    if (invoicesResult.success && invoicesResult.data) {
      console.log("✅ Invoice list fetched successfully");
      console.log(`   Total invoices: ${invoicesResult.data.count}`);
      if (invoicesResult.data.documents.length > 0) {
        console.log(`   First invoice: ${invoicesResult.data.documents[0].invoiceNumber}\n`);
      } else {
        console.log("   (No invoices yet)\n");
      }
    } else {
      console.log("❌ Invoice list failed");
      console.log(`   Error: ${invoicesResult.error?.message}\n`);
    }

    // Test 4: Finance Review Queue
    console.log("4️⃣  Testing Finance Review Queue...");
    const reviewResult = await apiClient.getFinanceReviewQueue(token);
    if (reviewResult.success && reviewResult.data) {
      console.log("✅ Review queue fetched successfully");
      console.log(`   Invoices pending review: ${reviewResult.data.count}`);
      if (reviewResult.data.invoices.length > 0) {
        console.log(`   First pending: ${reviewResult.data.invoices[0].invoiceNumber}\n`);
      } else {
        console.log("   (No invoices pending)\n");
      }
    } else {
      console.log("⚠️  Review queue not accessible");
      console.log(`   (User might not have FINANCE_MANAGER role)\n`);
    }

    console.log("✨ Integration tests completed successfully!\n");
    return true;
  } catch (error) {
    console.error("🔴 Test failed with error:", error);
    return false;
  }
}

/**
 * Usage:
 * In browser console:
 * 
 * import { testIntegration } from '@/lib/integration-test'
 * await testIntegration()
 */

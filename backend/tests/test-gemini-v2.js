/**
 * Gemini API Test - Version 2
 * Uses v1 API endpoint instead of v1beta
 */

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("\n═══════════════════════════════════════════════════════════");
console.log("   GEMINI API TEST v2 - Using Different Endpoints");
console.log("═══════════════════════════════════════════════════════════\n");

if (!GEMINI_API_KEY) {
  console.log("❌ FAIL: GEMINI_API_KEY is not set");
  process.exit(1);
}

console.log("✅ API Key found\n");

// Test with different API endpoints
const endpoints = [
  {
    name: "v1beta (generateContent)",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    payload: {
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
      contents: [{
        role: "user",
        parts: [{ text: "Return JSON: {\"test\": \"ok\"}" }]
      }]
    }
  },
  {
    name: "v1 (generateContent)",
    url: "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
    payload: {
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
      contents: [{
        role: "user",
        parts: [{ text: "Return JSON: {\"test\": \"ok\"}" }]
      }]
    }
  },
  {
    name: "v1beta (Gemini 1.0)",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro:generateContent",
    payload: {
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
      contents: [{
        role: "user",
        parts: [{ text: "Return JSON: {\"test\": \"ok\"}" }]
      }]
    }
  },
  {
    name: "v1 (Gemini 1.0)",
    url: "https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent",
    payload: {
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
      contents: [{
        role: "user",
        parts: [{ text: "Return JSON: {\"test\": \"ok\"}" }]
      }]
    }
  }
];

async function testEndpoint(endpoint) {
  try {
    const response = await fetch(`${endpoint.url}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(endpoint.payload)
    });

    console.log(`${endpoint.name}`);
    console.log(`  Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok) {
      console.log(`  ✅ SUCCESS`);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`  Response: ${text ? text.substring(0, 50) : 'No text'}`);
    } else if (data.error) {
      console.log(`  ❌ ERROR: ${data.error.message}`);
    } else {
      console.log(`  ❌ FAILED`);
    }
    console.log();

    return response.ok;
  } catch (error) {
    console.log(`${endpoint.name}`);
    console.log(`  ❌ Network Error: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  let successCount = 0;

  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) successCount++;
  }

  console.log("═══════════════════════════════════════════════════════════");
  if (successCount > 0) {
    console.log(`✅ API is working with at least one endpoint!`);
    console.log(`   Working endpoints: ${successCount}/${endpoints.length}`);
  } else {
    console.log("❌ No endpoints working - Check API key or restrictions");
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});


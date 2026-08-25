/**
 * Test script to verify Gemini API configuration and connectivity
 * Tests both OCR (extraction) and AI (categorization) capabilities
 */

import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const EXTRACTION_MODEL = process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-1.5-flash";
const CATEGORIZATION_MODEL = process.env.GEMINI_CATEGORIZATION_MODEL ?? "gemini-1.5-flash";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
  details?: string;
}

const results: TestResult[] = [];

// Test 1: Check if API key is configured
function testApiKeyConfiguration(): void {
  if (!GEMINI_API_KEY) {
    results.push({
      name: "API Key Configuration",
      status: "FAIL",
      message: "GEMINI_API_KEY environment variable is not set"
    });
    return;
  }

  if (GEMINI_API_KEY.length < 10) {
    results.push({
      name: "API Key Configuration",
      status: "WARN",
      message: "GEMINI_API_KEY appears to be invalid (too short)",
      details: `API Key length: ${GEMINI_API_KEY.length} characters`
    });
    return;
  }

  results.push({
    name: "API Key Configuration",
    status: "PASS",
    message: "GEMINI_API_KEY is properly configured",
    details: `API Key: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 5)}`
  });
}

// Test 2: Test Gemini API connectivity with a simple prompt
async function testApiConnectivity(): Promise<void> {
  if (!GEMINI_API_KEY) {
    results.push({
      name: "API Connectivity",
      status: "FAIL",
      message: "Skipped - API Key not configured"
    });
    return;
  }

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}/${EXTRACTION_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Return JSON: {\"status\": \"ok\", \"test\": \"connectivity\"}"
              }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      results.push({
        name: "API Connectivity",
        status: "PASS",
        message: "Successfully connected to Gemini API",
        details: `Response status: ${response.status}`
      });
    } else {
      results.push({
        name: "API Connectivity",
        status: "FAIL",
        message: `API returned error status: ${response.status}`,
        details: await response.text()
      });
    }
  } catch (error) {
    results.push({
      name: "API Connectivity",
      status: "FAIL",
      message: `Network error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test 3: Test OCR capability with a mock document
async function testOcrCapability(): Promise<void> {
  if (!GEMINI_API_KEY) {
    results.push({
      name: "OCR Capability",
      status: "FAIL",
      message: "Skipped - API Key not configured"
    });
    return;
  }

  try {
    // Create a simple test image (1x1 pixel PNG)
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    const response = await fetch(`${GEMINI_API_ENDPOINT}/${EXTRACTION_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Extract any text from this image. Return JSON: {\"text\": \"...\", \"has_content\": true/false}"
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: buffer.toString("base64")
                }
              }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        results.push({
          name: "OCR Capability",
          status: "PASS",
          message: "Gemini successfully processed image for OCR",
          details: `Response: ${text.substring(0, 100)}...`
        });
      } else {
        results.push({
          name: "OCR Capability",
          status: "WARN",
          message: "API responded but returned empty text"
        });
      }
    } else {
      results.push({
        name: "OCR Capability",
        status: "FAIL",
        message: `API error: ${response.status}`,
        details: await response.text()
      });
    }
  } catch (error) {
    results.push({
      name: "OCR Capability",
      status: "FAIL",
      message: `Error testing OCR: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test 4: Test AI categorization capability
async function testCategorizationCapability(): Promise<void> {
  if (!GEMINI_API_KEY) {
    results.push({
      name: "AI Categorization",
      status: "FAIL",
      message: "Skipped - API Key not configured"
    });
    return;
  }

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}/${CATEGORIZATION_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Categorize this invoice expense.",
                  "Allowed categories: OFFICE_SUPPLIES, TRAVEL, MEALS, UTILITIES, SOFTWARE, HARDWARE, CONSULTING, OTHER",
                  "Return strict JSON only: {\"category\":\"...\",\"confidence\":0..1,\"reason\":\"...\"}.",
                  "Vendor: ABC Office Supplies",
                  "Items: Printer paper, Ink cartridge, Desk organizer"
                ].join("\n")
              }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        try {
          const parsed = JSON.parse(text);
          results.push({
            name: "AI Categorization",
            status: "PASS",
            message: "Gemini successfully categorized invoice",
            details: `Category: ${parsed.category}, Confidence: ${parsed.confidence}`
          });
        } catch {
          results.push({
            name: "AI Categorization",
            status: "WARN",
            message: "API responded but returned invalid JSON",
            details: text.substring(0, 100)
          });
        }
      } else {
        results.push({
          name: "AI Categorization",
          status: "WARN",
          message: "API responded but returned empty text"
        });
      }
    } else {
      results.push({
        name: "AI Categorization",
        status: "FAIL",
        message: `API error: ${response.status}`,
        details: await response.text()
      });
    }
  } catch (error) {
    results.push({
      name: "AI Categorization",
      status: "FAIL",
      message: `Error testing categorization: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test 5: Verify model configuration
function testModelConfiguration(): void {
  results.push({
    name: "Model Configuration",
    status: "PASS",
    message: "Models are configured",
    details: `Extraction: ${EXTRACTION_MODEL}, Categorization: ${CATEGORIZATION_MODEL}`
  });
}

// Main test runner
async function runTests(): Promise<void> {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("   GEMINI API TEST SUITE - OCR & AI Verification");
  console.log("═══════════════════════════════════════════════════════════\n");

  testApiKeyConfiguration();
  testModelConfiguration();
  await testApiConnectivity();
  await testOcrCapability();
  await testCategorizationCapability();

  // Print results
  console.log("\n───────────────────────────────────────────────────────────");
  console.log("TEST RESULTS");
  console.log("───────────────────────────────────────────────────────────\n");

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  results.forEach((result) => {
    const icon = result.status === "PASS" ? "✅" : result.status === "FAIL" ? "❌" : "⚠️";
    console.log(`${icon} ${result.name}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    console.log();

    if (result.status === "PASS") passCount++;
    if (result.status === "FAIL") failCount++;
    if (result.status === "WARN") warnCount++;
  });

  console.log("───────────────────────────────────────────────────────────");
  console.log(`Summary: ${passCount} PASS | ${warnCount} WARN | ${failCount} FAIL`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});


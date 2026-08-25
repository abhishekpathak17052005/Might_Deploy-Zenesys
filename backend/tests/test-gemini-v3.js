/**
 * Gemini API Test - Version 3
 * Tests if key is valid by listing available models
 */

require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("\n═══════════════════════════════════════════════════════════");
console.log("   GEMINI API TEST v3 - Key Validation & Model Discovery");
console.log("═══════════════════════════════════════════════════════════\n");

if (!GEMINI_API_KEY) {
  console.log("❌ FAIL: GEMINI_API_KEY is not set");
  process.exit(1);
}

console.log("✅ API Key found");
console.log(`Key: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 5)}\n`);

async function listModels() {
  console.log("TEST 1: List Available Models");
  console.log("─────────────────────────────");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`,
      { method: "GET" }
    );

    console.log(`Status: ${response.status}`);

    const data = await response.json();

    if (response.ok && data.models) {
      console.log(`✅ SUCCESS - Found ${data.models.length} models:\n`);
      
      data.models.forEach(model => {
        // Only show models we care about
        if (model.name.includes('gemini') || model.name.includes('flash') || model.name.includes('pro')) {
          console.log(`  • ${model.displayName}`);
          console.log(`    Name: ${model.name}`);
          console.log(`    Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}\n`);
        }
      });

      return data.models;
    } else {
      console.log(`❌ ERROR: ${data.error?.message || 'Unknown error'}\n`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}\n`);
    return [];
  }
}

async function testWithAvailableModel(models) {
  if (models.length === 0) {
    console.log("TEST 2: Generate Content");
    console.log("────────────────────────");
    console.log("⚠️  SKIPPED - No models available\n");
    return;
  }

  // Find first available model that supports generateContent
  const model = models.find(m => m.supportedGenerationMethods?.includes('generateContent'));
  
  if (!model) {
    console.log("TEST 2: Generate Content");
    console.log("────────────────────────");
    console.log("⚠️  SKIPPED - No models support generateContent\n");
    return;
  }

  console.log("TEST 2: Generate Content");
  console.log("────────────────────────");
  console.log(`Testing with model: ${model.displayName}\n`);

  try {
    const modelPath = model.name.split('/')[1]; // Extract model name from "models/gemini-..."
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/${model.name}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0
          },
          contents: [{
            role: "user",
            parts: [{
              text: "Return JSON: {\"status\": \"ok\", \"test\": \"connection\"}"
            }]
          }]
        })
      }
    );

    console.log(`Status: ${response.status}`);

    const data = await response.json();

    if (response.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ SUCCESS - API is working!\n`);
      console.log(`Response: ${text}\n`);
      return true;
    } else {
      console.log(`❌ ERROR: ${data.error?.message || 'Unknown error'}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}\n`);
    return false;
  }
}

async function testOCR(models) {
  const model = models.find(m => m.supportedGenerationMethods?.includes('generateContent'));
  
  if (!model) {
    console.log("TEST 3: OCR Test (Image Processing)");
    console.log("────────────────────────────────────");
    console.log("⚠️  SKIPPED - No suitable model found\n");
    return;
  }

  console.log("TEST 3: OCR Test (Image Processing)");
  console.log("────────────────────────────────────");

  try {
    // 1x1 pixel PNG
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/${model.name}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0
          },
          contents: [{
            role: "user",
            parts: [
              { text: "Extract text from this image. Return JSON: {\"text\": \"...\", \"success\": true}" },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: pngBuffer.toString("base64")
                }
              }
            ]
          }]
        })
      }
    );

    console.log(`Status: ${response.status}`);

    const data = await response.json();

    if (response.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ SUCCESS - OCR works!\n`);
      console.log(`Response: ${text.substring(0, 150)}...\n`);
      return true;
    } else {
      console.log(`❌ ERROR: ${data.error?.message || 'Unknown error'}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  const models = await listModels();
  const testGenerate = await testWithAvailableModel(models);
  const testOcrResult = await testOCR(models);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  
  if (testGenerate) {
    console.log("✅ API KEY IS VALID AND WORKING");
    console.log("✅ Generation (AI) - WORKING");
    if (testOcrResult) {
      console.log("✅ OCR/Image - WORKING");
    } else {
      console.log("⚠️  OCR/Image - NEEDS TESTING WITH REAL INVOICE");
    }
  } else {
    console.log("❌ API KEY ISSUE - Check restrictions or permissions");
  }

  console.log("═══════════════════════════════════════════════════════════\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});


/**
 * MongoDB Connection Test
 * Verifies the database URL is working correctly
 */

const mongoose = require("mongoose");

async function testMongoDBConnection() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not found in .env");
    process.exit(1);
  }

  console.log("🧪 Testing MongoDB Connection...\n");
  console.log("Database URL:", databaseUrl.substring(0, 50) + "...\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(databaseUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });

    console.log("✅ Successfully connected to MongoDB!");
    console.log("   Server:", mongoose.connection.host);
    console.log("   Database:", mongoose.connection.name);
    console.log("   Port:", mongoose.connection.port);
    console.log("   State:", mongoose.connection.readyState === 1 ? "Connected" : "Disconnected");

    // Test database operations
    console.log("\n📊 Testing Database Operations...");

    // Create a test collection
    const testSchema = new mongoose.Schema({
      name: String,
      testDate: { type: Date, default: Date.now },
    });

    const TestModel = mongoose.model("ConnectionTest", testSchema);

    // Insert test document
    const testDoc = new TestModel({ name: "MongoDB Connection Test" });
    await testDoc.save();
    console.log("✅ Successfully inserted test document");

    // Read test document
    const foundDoc = await TestModel.findById(testDoc._id);
    console.log("✅ Successfully retrieved test document:", foundDoc.name);

    // Delete test document
    await TestModel.deleteOne({ _id: testDoc._id });
    console.log("✅ Successfully deleted test document");

    // Disconnect
    await mongoose.disconnect();

    console.log("\n🎉 All MongoDB tests passed!");
    console.log("Database connection is working correctly ✓\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ MongoDB Connection Failed");
    console.error("Error:", error.message);

    if (error.message.includes("ENOTFOUND")) {
      console.error("\n💡 Hint: Check if MongoDB cluster is accessible");
    } else if (error.message.includes("authentication")) {
      console.error("\n💡 Hint: Check username and password in DATABASE_URL");
    } else if (error.message.includes("connect ETIMEDOUT")) {
      console.error("\n💡 Hint: Network timeout - check internet connection");
    }

    process.exit(1);
  }
}

// Require dotenv to load .env file
require("dotenv").config({ path: ".env" });

testMongoDBConnection();

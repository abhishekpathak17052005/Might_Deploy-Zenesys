/**
 * MongoDB Connection Diagnostic Tool
 * Helps troubleshoot connection issues
 */

const dns = require("dns");
const net = require("net");

require("dotenv").config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL;

async function testDNS() {
  console.log("🔍 Testing DNS Resolution...\n");
  
  return new Promise((resolve) => {
    dns.resolveSrv("_mongodb._tcp.cluster0.7fsqglj.mongodb.net", (err, servers) => {
      if (err) {
        console.log("❌ DNS Resolution Failed");
        console.log("   Error:", err.message);
        console.log("   This means MongoDB Atlas cannot be reached\n");
        resolve(false);
      } else {
        console.log("✅ DNS Resolution Successful");
        console.log("   Servers found:", servers.length);
        servers.forEach((server, i) => {
          console.log(`   ${i + 1}. ${server.name}:${server.port}`);
        });
        console.log();
        resolve(true);
      }
    });
  });
}

async function testConnection() {
  console.log("🔍 Testing Network Connection...\n");
  
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "cluster0.7fsqglj.mongodb.net",
      port: 27017,
      timeout: 5000,
    });

    socket.on("connect", () => {
      console.log("✅ Network Connection Successful");
      console.log("   Can reach MongoDB server on port 27017\n");
      socket.destroy();
      resolve(true);
    });

    socket.on("error", (err) => {
      console.log("❌ Network Connection Failed");
      console.log("   Error:", err.message);
      console.log("   Code:", err.code);
      console.log("\n   Possible causes:");
      if (err.code === "ECONNREFUSED") {
        console.log("   - Network/Firewall is blocking MongoDB connection");
        console.log("   - Check if you're behind a corporate firewall");
        console.log("   - Check MongoDB Atlas IP whitelist settings");
      } else if (err.code === "ENOTFOUND") {
        console.log("   - DNS cannot resolve MongoDB server");
        console.log("   - Check your internet connection");
      } else if (err.code === "ETIMEDOUT") {
        console.log("   - Connection timeout (slow network)");
        console.log("   - Check your internet connection");
      }
      console.log();
      resolve(false);
    });

    socket.on("timeout", () => {
      console.log("❌ Connection Timeout");
      console.log("   Network is too slow to reach MongoDB\n");
      socket.destroy();
      resolve(false);
    });
  });
}

async function checkEnv() {
  console.log("📋 Checking Environment Configuration...\n");
  
  if (!databaseUrl) {
    console.log("❌ DATABASE_URL is not set in .env");
    console.log("   Fix: Add DATABASE_URL to backend/.env\n");
    return false;
  }

  console.log("✅ DATABASE_URL is set");
  console.log("   Format:", databaseUrl.substring(0, 60) + "...");
  
  // Check for username/password
  if (!databaseUrl.includes("@")) {
    console.log("❌ Missing credentials in DATABASE_URL");
    console.log("   Format should be: mongodb+srv://user:password@host/...\n");
    return false;
  }

  console.log("✅ Credentials format looks correct\n");
  return true;
}

async function runDiagnostics() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     MongoDB Connection Diagnostic Tool                ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const envOk = await checkEnv();
  if (!envOk) {
    console.log("❌ Fix environment configuration before testing connection");
    process.exit(1);
  }

  const dnsOk = await testDNS();
  const connOk = await testConnection();

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║                    Diagnosis Summary                   ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const allGood = envOk && dnsOk && connOk;

  if (allGood) {
    console.log("✅ All checks passed!");
    console.log("   Your network can reach MongoDB Atlas");
    console.log("   You should be able to connect successfully\n");
    process.exit(0);
  } else {
    console.log("❌ One or more checks failed");
    console.log("\n🔧 Troubleshooting Steps:");
    console.log("   1. Check your internet connection");
    console.log("   2. Disable VPN/Proxy if using one");
    console.log("   3. Check MongoDB Atlas IP whitelist:");
    console.log("      - Log in to MongoDB Atlas");
    console.log("      - Go to Network Access");
    console.log("      - Add your IP address to whitelist");
    console.log("   4. Verify DATABASE_URL credentials:");
    console.log("      - Username and password are correct");
    console.log("      - Database name exists");
    console.log("   5. Check corporate firewall allows port 27017\n");
    process.exit(1);
  }
}

runDiagnostics().catch((error) => {
  console.error("Diagnostic error:", error.message);
  process.exit(1);
});

import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;

/**
 * Connect to MongoDB
 */
export async function connectDatabase() {
  if (isConnected) {
    console.log("📊 Using existing MongoDB connection");
    return;
  }

  const databaseUrl =
    env.DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.MONGODB_URI ||
    (process.env.NODE_ENV !== "production" ? "mongodb://localhost:27017/InvoiceFlow" : undefined);

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    console.log("🔄 Connecting to MongoDB...");

    const isTls =
      databaseUrl.includes("mongodb+srv://") ||
      databaseUrl.includes("tls=true") ||
      databaseUrl.includes("ssl=true");

    const connection = await mongoose.connect(databaseUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      ...(isTls ? { tls: true, tlsInsecure: false } : {}),
      retryWrites: true,
    });

    isConnected = true;

    console.log("✅ MongoDB connected successfully");
    console.log(`   Database: ${connection.connection.name}`);
    console.log(`   Server: ${connection.connection.host}:${connection.connection.port}`);

    // Set up connection event handlers
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected");
      isConnected = false;
    });

    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error);
      isConnected = false;
    });

    return connection;
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB");
    console.error("Error:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("✅ MongoDB disconnected");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error);
    throw error;
  }
}

/**
 * Check database connection status
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get database connection stats
 */
export function getDatabaseStats() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.models).length,
  };
}

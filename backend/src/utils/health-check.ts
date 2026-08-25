import { firestore, storage } from "../config/firebase";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    firestore: boolean;
    storage: boolean;
    memory: MemoryStatus;
  };
}

interface MemoryStatus {
  heapUsed: number;
  heapTotal: number;
  external: number;
  percentUsed: number;
}

/**
 * Comprehensive health check for backend services
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const checks = {
    firestore: false,
    storage: false,
    memory: getMemoryStatus()
  };

  try {
    // Check Firestore connection
    await firestore.collection("_health").limit(1).get();
    checks.firestore = true;
  } catch (error) {
    console.error("Firestore health check failed:", error);
  }

  try {
    // Check Cloud Storage connection
    const bucket = storage.bucket();
    await bucket.exists();
    checks.storage = true;
  } catch (error) {
    console.error("Cloud Storage health check failed:", error);
  }

  const allHealthy = checks.firestore && checks.storage;
  const degraded = (checks.firestore || checks.storage) && !allHealthy;

  return {
    status: allHealthy ? "healthy" : degraded ? "degraded" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks
  };
}

function getMemoryStatus(): MemoryStatus {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
  };
}

/**
 * Monitor for memory leaks
 */
export function startMemoryMonitoring(thresholdPercent: number = 90) {
  setInterval(() => {
    const memStatus = getMemoryStatus();
    if (memStatus.percentUsed > thresholdPercent) {
      console.warn(`⚠️  High memory usage: ${memStatus.percentUsed}%`, memStatus);
    }
  }, 60000); // Check every minute
}

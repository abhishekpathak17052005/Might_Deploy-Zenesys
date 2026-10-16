import mongoose from "mongoose";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: boolean;
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
  let dbHealthy = false;
  try {
    // 1 = connected, 2 = connecting
    dbHealthy = mongoose.connection.readyState === 1;
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  const checks = {
    database: dbHealthy,
    memory: getMemoryStatus()
  };

  return {
    status: dbHealthy ? "healthy" : "degraded",
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

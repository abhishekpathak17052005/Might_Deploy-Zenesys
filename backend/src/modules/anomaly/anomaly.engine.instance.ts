import { AnomalyEngine } from "./anomaly.engine";

/**
 * Singleton instance of the anomaly engine.
 * This instance is used throughout the application for anomaly evaluation.
 * All 10 rules are loaded by default.
 */
export const anomalyEngine = new AnomalyEngine();

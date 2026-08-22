import { Router } from "express";
import { ZodError } from "zod";
import { sendError, sendSuccess } from "../../utils/apiResponse";
import { anomalyEvaluateRequestSchema } from "./anomaly.schemas";
import { mergeAnomalyConfig } from "./anomaly.config";
import { parseDate } from "./anomaly.helpers";
import { anomalyEngine } from "./anomaly.engine.instance";

export const anomalyRouter = Router();

anomalyRouter.post("/evaluate", async (req, res) => {
  try {
    const parsed = anomalyEvaluateRequestSchema.parse(req.body);
    const currentDate = parseDate(parsed.currentDate) ?? new Date();
    const result = await anomalyEngine.evaluate({
      invoice: parsed.invoice,
      vendor: parsed.vendor,
      purchaseOrder: parsed.purchaseOrder,
      historicalInvoices: parsed.historicalInvoices,
      recentInvoices: parsed.recentInvoices,
      ruleConfig: mergeAnomalyConfig(),
      currentDate
    });

    return sendSuccess(res, result);
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, "INVALID_ANOMALY_CONTEXT", "Invalid anomaly evaluation payload", 400, error.issues);
    }
    console.error("anomaly.evaluate.failed", { error: error instanceof Error ? error.message : error });
    return sendError(res, "ANOMALY_EVALUATION_FAILED", "Unable to evaluate anomaly context", 500);
  }
});

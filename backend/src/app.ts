import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { API_PREFIX } from "./config/constants";
import { env, isProduction } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";
import { notFoundMiddleware } from "./middleware/notFound.middleware";
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware";
import { inputSanitizerMiddleware } from "./middleware/input-sanitizer.middleware";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware";
import { router } from "./routes";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: isProduction ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) : env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(requestLoggerMiddleware);
app.use(inputSanitizerMiddleware);
app.use(API_PREFIX, rateLimitMiddleware(15 * 60 * 1000, 300));

app.use(API_PREFIX, router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

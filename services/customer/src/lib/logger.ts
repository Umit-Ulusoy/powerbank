import pino from "pino";

import { env } from "../config/env.js";
import { getCorrelationId } from "./request-context.js";

const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined;

export const loggerOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      // Common sensitive fields
      "password",
      "token",
      "secret",
      "apiKey",
      "api_key",
      "accessToken",
      "refreshToken",
      "access_token",
      "refresh_token",
      "connectionString",
      "DATABASE_URL",

      // Nested HTTP credentials
      "*.authorization",
      "*.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "err.config.headers.authorization",
    ],
    remove: true,
  },
  mixin() {
    const correlationId = getCorrelationId();

    return correlationId ? { correlationId } : {};
  },
};

export const logger = pino(
  loggerOptions,
  transport ? pino.transport(transport) : undefined
);
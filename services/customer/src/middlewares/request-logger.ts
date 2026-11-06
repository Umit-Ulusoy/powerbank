import type { RequestHandler } from "express";

import { logger } from "../lib/logger.js";

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const startTime = performance.now();
  let isLogged = false;

  const logCompletion = () => {
    if (isLogged) return;

    isLogged = true;

    const duration = Math.max(0, performance.now() - startTime);
    const statusCode = res.statusCode;

    const logLevel =
      statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    logger[logLevel]({
      msg: "Request completed",
      method: req.method,
      path: req.route?.path ?? "<unmatched>",
      statusCode,
      duration: Math.round(duration),
    });
  };

  res.on("finish", logCompletion);

  res.on("close", () => {
    if (isLogged || res.writableEnded) return;

    isLogged = true;

    logger.warn({
      msg: "Request connection closed prematurely",
      method: req.method,
      path: req.route?.path ?? "<unmatched>",
      duration: Math.round(Math.max(0, performance.now() - startTime)),
    });
  });

  next();
};
import type { ErrorRequestHandler } from "express";
import { z, ZodError } from "zod";

import { AppError } from "../errors/app-error.js";
import { logger } from "../lib/logger.js";
import { errorResponse } from "../http/api-response.js";

const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";
  let details: Record<string, string[]> | null = null;

  if (err instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed.";

    const { fieldErrors } = z.flattenError(
      err as ZodError<Record<string, unknown>>,
    );

    details = Object.fromEntries(
      Object.entries(fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined,
      ),
    );
  } else if (err instanceof AppError && err.isOperational) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;

    const errors = err.getErrors();
    details = Object.keys(errors).length > 0 ? errors : null;
  }

  if (err instanceof ZodError) {
    logger.warn(
      { err, statusCode, code },
      "Request validation failed",
    );
  } else if (err instanceof AppError && err.isOperational) {
    logger.warn(
      { err, statusCode, code },
      "Operational request error",
    );
  } else {
    logger.error(
      { err, statusCode, code },
      "Unhandled request error",
    );
  }

  res.status(statusCode).json(
    errorResponse({
      code,
      message,
      details,
    }),
  );
};

export default errorHandler;
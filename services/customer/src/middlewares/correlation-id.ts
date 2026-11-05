import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

import { requestContext } from "../lib/request-context.js";

const CORRELATION_ID_HEADER = "x-correlation-id";
const CORRELATION_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

function resolveCorrelationId(value: string | undefined): string {
  if (!value || !CORRELATION_ID_PATTERN.test(value)) {
    return randomUUID();
  }

  return value;
}

export const correlationIdMiddleware: RequestHandler = (
  req,
  res,
  next
) => {
  const incomingCorrelationId = req.get(CORRELATION_ID_HEADER);

  const correlationId = resolveCorrelationId(incomingCorrelationId);

  res.setHeader(CORRELATION_ID_HEADER, correlationId);

  requestContext.run({ correlationId }, next);
};
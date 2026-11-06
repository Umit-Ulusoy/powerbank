import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { getCorrelationId } from "../../../src/lib/request-context.js";
import { correlationIdMiddleware } from "../../../src/middlewares/correlation-id.js";

function createMocks(incomingCorrelationId?: string) {
  const req = {
    get: vi.fn().mockReturnValue(incomingCorrelationId),
  } as unknown as Request;

  const res = {
    setHeader: vi.fn(),
  } as unknown as Response;

  const next = vi.fn();

  return { req, res, next };
}

describe("Correlation ID Middleware", () => {
  it("should preserve a valid incoming correlation ID", () => {
    const correlationId = "request-123_abc:xyz.1";

    const { req, res, next } = createMocks(correlationId);

    correlationIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "x-correlation-id",
      correlationId
    );

    expect(getCorrelationId()).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("should generate a UUID when the correlation ID is missing", () => {
    const { req, res, next } = createMocks();

    correlationIdMiddleware(req, res, next);

    const generatedId = vi.mocked(res.setHeader).mock.calls[0][1];

    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it("should generate a UUID when the correlation ID is empty", () => {
    const { req, res, next } = createMocks("");

    correlationIdMiddleware(req, res, next);

    const generatedId = vi.mocked(res.setHeader).mock.calls[0][1];

    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it.each([
    "invalid correlation ID",
    "request\ninjected",
    "request\r\ninjected",
    "a".repeat(129),
  ])("should generate a UUID for an invalid correlation ID: %s", (value) => {
    const { req, res, next } = createMocks(value);

    correlationIdMiddleware(req, res, next);

    const generatedId = vi.mocked(res.setHeader).mock.calls[0][1];

    expect(generatedId).not.toBe(value);

    expect(generatedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it("should make the resolved correlation ID available in the request context", () => {
    const correlationId = "request-123";

    const { req, res, next } = createMocks(correlationId);

    next.mockImplementation(() => {
      expect(getCorrelationId()).toBe(correlationId);
    });

    correlationIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("should use the generated correlation ID in the request context", () => {
    const { req, res, next } = createMocks();

    next.mockImplementation(() => {
      const contextId = getCorrelationId();
      const responseId = vi.mocked(res.setHeader).mock.calls[0][1];

      expect(contextId).toBe(responseId);
    });

    correlationIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
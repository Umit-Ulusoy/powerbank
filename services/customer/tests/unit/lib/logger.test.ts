import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestLoggerMiddleware } from "../../../src/middlewares/request-logger.js";
import { logger } from "../../../src/lib/logger.js";

vi.mock("../../../src/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createRequest(
  options: {
    method?: string;
    routePath?: string;
  } = {}
): Request {
  return {
    method: options.method ?? "GET",
    route: options.routePath
      ? { path: options.routePath }
      : undefined,
  } as unknown as Request;
}

function createResponse(
  options: {
    statusCode?: number;
    writableEnded?: boolean;
  } = {}
): Response & EventEmitter {
  const response = new EventEmitter();

  Object.assign(response, {
    statusCode: options.statusCode ?? 200,
    writableEnded: options.writableEnded ?? false,
  });

  return response as Response & EventEmitter;
}

describe("Request Logger Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log successful requests at info level", () => {
    const req = createRequest({ routePath: "/customers" });
    const res = createResponse({ statusCode: 200 });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    res.emit("finish");

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        method: "GET",
        path: "/customers",
        statusCode: 200,
        duration: expect.any(Number),
      })
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should log client errors at warn level", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 404 });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("finish");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        statusCode: 404,
      })
    );

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should log server errors at error level", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 500 });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("finish");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        statusCode: 500,
      })
    );

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should log prematurely closed connections at warn level", () => {
    const req = createRequest({ routePath: "/transfers" });
    const res = createResponse({ writableEnded: false });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("close");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request connection closed prematurely",
        method: "GET",
        path: "/transfers",
        duration: expect.any(Number),
      })
    );

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should not log a completed request more than once", () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);

    res.emit("finish");
    res.writableEnded = true;
    res.emit("close");

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should not log a close event when the response has already ended", () => {
    const req = createRequest();
    const res = createResponse({ writableEnded: true });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("close");

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should use the matched route path instead of the raw request URL", () => {
    const req = createRequest({ routePath: "/customers/:customerId" });
    const res = createResponse();
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("finish");

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/customers/:customerId",
      })
    );
  });

  it("should use an unmatched placeholder when no route matches", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 404 });
    const next = vi.fn();

    requestLoggerMiddleware(req, res, next);
    res.emit("finish");

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "<unmatched>",
        statusCode: 404,
      })
    );
  });
});
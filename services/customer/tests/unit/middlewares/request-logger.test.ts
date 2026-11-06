import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../../src/lib/logger.js";
import { requestLoggerMiddleware } from "../../../src/middlewares/request-logger.js";

function createMockRequest(method: string, path: string): Request {
  return {
    method,
    path,
    route: undefined,
  } as unknown as Request;
}

function createMockResponse(): Response & EventEmitter {
  const res = new EventEmitter() as Response & EventEmitter;
  res.statusCode = 200;
  res.writableEnded = false;

  return res;
}

describe("Request Logger Middleware", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(() => undefined as any);
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined as any);
    errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log completed 2xx request with finish event", async () => {
    const req = createMockRequest("GET", "/users");
    const res = createMockResponse();
    res.statusCode = 200;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;
    res.emit("finish");

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        method: "GET",
        path: "<unmatched>",
        statusCode: 200,
      })
    );

    const call = infoSpy.mock.calls[0][0];

    expect(call.duration).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(call.duration)).toBe(true);
  });

  it("should log 4xx response with warn level", async () => {
    const req = createMockRequest("GET", "/nonexistent");
    const res = createMockResponse();
    res.statusCode = 404;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;
    res.emit("finish");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        statusCode: 404,
      })
    );
  });

  it("should log 5xx response with error level", async () => {
    const req = createMockRequest("POST", "/process");
    const res = createMockResponse();
    res.statusCode = 500;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;
    res.emit("finish");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request completed",
        statusCode: 500,
      })
    );
  });

  it("should log premature connection closure", async () => {
    const req = createMockRequest("GET", "/data");
    const res = createMockResponse();
    res.writableEnded = false;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.emit("close");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "Request connection closed prematurely",
        method: "GET",
      })
    );
  });

  it("should not log duplicate completion logs", async () => {
    const req = createMockRequest("GET", "/test");
    const res = createMockResponse();
    res.statusCode = 200;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;

    res.emit("finish");
    res.emit("finish");
    res.emit("close");

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("should use route path when available", async () => {
    const req = {
      method: "GET",
      path: "/users/123",
      route: { path: "/users/:id" },
    } as unknown as Request;

    const res = createMockResponse();
    res.statusCode = 200;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;
    res.emit("finish");

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/users/:id",
      })
    );
  });

  it("should log <unmatched> for routes without route definition", async () => {
    const req = createMockRequest("GET", "/some/dynamic/path/123");
    const res = createMockResponse();
    res.statusCode = 200;

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    res.writableEnded = true;
    res.emit("finish");

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "<unmatched>",
      })
    );
  });

  it("should measure duration with non-negative values", async () => {
    const req = createMockRequest("GET", "/test");
    const res = createMockResponse();

    const nextCalled = new Promise<void>((resolve) => {
      requestLoggerMiddleware(req, res, resolve);
    });

    await nextCalled;

    await new Promise((resolve) => setTimeout(resolve, 20));

    res.writableEnded = true;
    res.emit("finish");

    expect(infoSpy).toHaveBeenCalled();

    const call = infoSpy.mock.calls[0][0];

    expect(call.duration).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(call.duration)).toBe(true);
  });
});

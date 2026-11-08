import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { z } from "zod";

import { AppError } from "../../../src/errors/app-error.js";
import { logger } from "../../../src/lib/logger.js";
import errorHandler from "../../../src/middlewares/error-handler.js";

vi.mock("../../../src/lib/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

describe("Error Handler", () => {
  let req: Record<string, never>;
  let res: MockResponse;
  let next: ReturnType<typeof vi.fn>;

  const invokeHandler = (error: unknown) => {
    errorHandler(error, req as never, res, next);
  };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {};

    res = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as MockResponse;

    next = vi.fn();
  });

  describe("ZodError", () => {
    it("should return 400 with validation error details", () => {
      const schema = z.object({
        email: z.email(),
        password: z.string().min(8),
      });

      const result = schema.safeParse({
        email: "invalid-email",
        password: "123",
      });

      if (result.success) {
        throw new Error("Expected validation to fail.");
      }

      invokeHandler(result.error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed.",
            details: expect.objectContaining({
              email: expect.any(Array),
              password: expect.any(Array),
            }),
          },
        }),
      );

      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should return empty details for root-level validation errors", () => {
      const schema = z
        .object({ a: z.string(), b: z.string() })
        .refine((value) => value.a === value.b, {
          message: "a and b must match",
        });

      const result = schema.safeParse({ a: "x", b: "y" });

      if (result.success) {
        throw new Error("Expected validation to fail.");
      }

      invokeHandler(result.error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed.",
            details: {},
          },
        }),
      );
    });
  });

  describe("AppError", () => {
    it("should preserve status code, error code and message for operational errors", () => {
      const error = new AppError(
        "Customer not found.",
        404,
        "CUSTOMER_NOT_FOUND",
      );

      invokeHandler(error);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "CUSTOMER_NOT_FOUND",
            message: "Customer not found.",
            details: null,
          },
        }),
      );

      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("should include grouped error details in the response", () => {
      const error = new AppError(
        "Validation failed.",
        400,
        "VALIDATION_FAILED",
        [
          { field: "email", message: "Invalid email address." },
          { field: "email", message: "Email is required." },
          { field: "password", message: "Password is too short." },
        ],
      );

      invokeHandler(error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed.",
            details: {
              email: [
                "Invalid email address.",
                "Email is required.",
              ],
              password: ["Password is too short."],
            },
          },
        }),
      );
    });

    it("should normalize non-operational errors to a generic 500 response", () => {
      const error = new AppError(
        "Database connection failed.",
        503,
        "DATABASE_UNAVAILABLE",
        [],
        false,
      );

      invokeHandler(error);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          data: null,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
            details: null,
          },
        }),
      );

      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("Unexpected errors", () => {
    it("should return a generic 500 response for regular errors", () => {
      const error = new Error("Unexpected database error.");

      invokeHandler(error);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
            details: null,
          },
        }),
      );

      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should handle non-Error thrown values", () => {
      invokeHandler("Something went wrong.");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
            details: null,
          },
        }),
      );

      expect(logger.error).toHaveBeenCalledOnce();
    });
  });

  describe("Response handling", () => {
    it("should forward the error when response headers have already been sent", () => {
      res.headersSent = true;

      const error = new Error("Response already started.");

      invokeHandler(error);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
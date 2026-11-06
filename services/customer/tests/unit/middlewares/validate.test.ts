
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { validate } from "../../../src/middlewares/validate.js";

describe("validate middleware", () => {
  const createRequest = (body: unknown = {}, query: unknown = {}) =>
    ({
      body,
      query,
    }) as unknown as Request;

  const createResponse = () => ({} as Response);

  const createNext = () => vi.fn<NextFunction>();

  describe("body validation", () => {
    it("should validate body and assign transformed data to req.validated.body", async () => {
      const schema = z.object({
        name: z.string().trim(),
        age: z.coerce.number(),
      });

      const req = createRequest({
        name: "  John Doe  ",
        age: "25",
      });

      const next = createNext();

      await validate({ body: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();

      expect(req.validated?.body).toEqual({
        name: "John Doe",
        age: 25,
      });
    });

    it("should forward ZodError when body validation fails", async () => {
      const schema = z.object({
        name: z.string().min(3),
      });

      const req = createRequest({
        name: "Jo",
      });

      const next = createNext();

      await validate({ body: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
      expect(req.validated).toBeUndefined();
    });
  });

  describe("query validation", () => {
    it("should validate query and assign transformed data to req.validated.query", async () => {
      const schema = z.object({
        page: z.coerce.number().int().positive().default(1),
        search: z.string().trim().optional(),
      });

      const req = createRequest({}, {
        page: "2",
        search: "  customer  ",
      });

      const next = createNext();

      await validate({ query: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();

      expect(req.validated?.query).toEqual({
        page: 2,
        search: "customer",
      });
    });

    it("should forward ZodError when query validation fails", async () => {
      const schema = z.object({
        page: z.coerce.number().int().positive(),
      });

      const req = createRequest({}, {
        page: "-1",
      });

      const next = createNext();

      await validate({ query: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
      expect(req.validated).toBeUndefined();
    });
  });

  describe("combined validation", () => {
    it("should validate body and query together", async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      const querySchema = z.object({
        page: z.coerce.number().int().positive(),
      });

      const req = createRequest(
        { name: "John" },
        { page: "3" }
      );

      const next = createNext();

      await validate({
        body: bodySchema,
        query: querySchema,
      })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();

      expect(req.validated).toEqual({
        body: {
          name: "John",
        },
        query: {
          page: 3,
        },
      });
    });

    it("should not continue when body validation fails", async () => {
      const bodySchema = z.object({
        name: z.string().min(3),
      });

      const querySchema = z.object({
        page: z.coerce.number(),
      });

      const req = createRequest(
        { name: "Jo" },
        { page: "2" }
      );

      const next = createNext();

      await validate({
        body: bodySchema,
        query: querySchema,
      })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
      expect(req.validated).toBeUndefined();
    });

    it("should not continue when query validation fails", async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      const querySchema = z.object({
        page: z.coerce.number().positive(),
      });

      const req = createRequest(
        { name: "John" },
        { page: "-1" }
      );

      const next = createNext();

      await validate({
        body: bodySchema,
        query: querySchema,
      })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
      expect(req.validated).toBeUndefined();
    });
  });

  describe("asynchronous validation", () => {
    it("should support asynchronous refinements", async () => {
      const schema = z.object({
        email: z.string().refine(async (email) => {
          return email === "available@example.com";
        }),
      });

      const req = createRequest({
        email: "available@example.com",
      });

      const next = createNext();

      await validate({ body: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();

      expect(req.validated?.body).toEqual({
        email: "available@example.com",
      });
    });

    it("should forward ZodError when asynchronous refinement fails", async () => {
      const schema = z.object({
        email: z.string().refine(async (email) => {
          return email === "available@example.com";
        }),
      });

      const req = createRequest({
        email: "taken@example.com",
      });

      const next = createNext();

      await validate({ body: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
      expect(req.validated).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should forward unexpected errors to next", async () => {
      const unexpectedError = new Error("Unexpected validation error");

      const schema = z.string().refine(() => {
        throw unexpectedError;
      });

      const req = createRequest("test");
      const next = createNext();

      await validate({ body: schema })(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(unexpectedError);
      expect(req.validated).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should continue when no schemas are provided", async () => {
      const req = createRequest();
      const next = createNext();

      await validate({})(req, createResponse(), next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith();
      expect(req.validated).toEqual({});
    });
  });
});

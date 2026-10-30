
import express, {
  type ErrorRequestHandler,
} from "express";

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    meta: {},
    data: {
      status: "ok",
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    meta: {},
    data: null,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested endpoint was not found.",
    },
  });
});

// Global error handler
const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("Unhandled request error:", error);

  res.status(500).json({
    success: false,
    meta: {},
    data: null,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};

app.use(errorHandler);

export default app;

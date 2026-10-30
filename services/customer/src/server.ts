import "dotenv/config";
import { createServer, type Server } from "node:http";

import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

let server: Server | undefined;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  await prisma.$connect();

  server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(env.PORT, () => {
      server!.removeListener("error", reject);
      resolve();
    });
  });

  console.info(`Customer service listening on port ${env.PORT}`);
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.info(`Received ${signal}. Shutting down gracefully...`);

  if (!server) {
    await prisma.$disconnect();
    return;
  }

  server.close(async (error) => {
    try {
      await prisma.$disconnect();

      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
        return;
      }

      console.info("Customer service shut down successfully.");
    } catch (disconnectError) {
      console.error("Database disconnect failed:", disconnectError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch(async (error: unknown) => {
  console.error("Failed to start Customer service:", error);

  try {
    await prisma.$disconnect();
  } catch (disconnectError) {
    console.error("Database disconnect failed:", disconnectError);
  }

  process.exitCode = 1;
});
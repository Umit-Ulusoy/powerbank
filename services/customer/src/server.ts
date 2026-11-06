
import "dotenv/config";
import { createServer, type Server } from "node:http";

import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import {
  channelManager,
  connectionManager,
  registerTopologyRecovery,
  setupTopology,
} from "./lib/rabbitmq/index.js";

let server: Server | undefined;
let isShuttingDown = false;

async function startServer(): Promise<void> {
  await prisma.$connect();

  if (isShuttingDown) {
    throw new Error("Application is shutting down");
  }

  registerTopologyRecovery();

  await connectionManager.connect();

  if (isShuttingDown) {
    throw new Error("Application is shutting down");
  }

  await setupTopology();

  if (isShuttingDown) {
    throw new Error("Application is shutting down");
  }

  const httpServer = createServer(app);
  server = httpServer;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);

    httpServer.listen(env.PORT, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  logger.info({
    msg: "Customer service listening",
    port: env.PORT,
  });
}

async function cleanup(): Promise<void> {
  const cleanupTasks = [
    {
      name: "HTTP server",
      execute: async () => {
        if (!server) return;

        const httpServer = server;
        server = undefined;

        if (!httpServer.listening) return;

        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      },
    },
    {
      name: "RabbitMQ channels",
      execute: () => channelManager.closeAll(),
    },
    {
      name: "RabbitMQ connection",
      execute: () => connectionManager.close(),
    },
    {
      name: "Prisma",
      execute: () => prisma.$disconnect(),
    },
  ];

  const results = await Promise.allSettled(
    cleanupTasks.map(async (task) => {
      try {
        await task.execute();
        logger.info({ msg: "Cleanup completed", task: task.name });
      } catch (error) {
        logger.error({
          msg: "Cleanup failed",
          task: task.name,
          err: error,
        });
        throw error;
      }
    })
  );

  if (results.some((result) => result.status === "rejected")) {
    process.exitCode = 1;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info({ msg: "Shutting down gracefully", signal });

  await cleanup();

  if (process.exitCode !== 1) {
    logger.info("Customer service shut down successfully");
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startServer().catch(async (error: unknown) => {
  logger.fatal({
    msg: "Failed to start Customer service",
    err: error,
  });

  isShuttingDown = true;

  await cleanup();

  process.exitCode = 1;
});

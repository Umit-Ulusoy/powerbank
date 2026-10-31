
import type { Channel, Connection } from "amqplib/callback_api";

import { env } from "../../config/env.js";
import { channelManager } from "./channels.js";
import { connectionManager } from "./connection.js";

/**
 * Setup RabbitMQ topology (exchanges, queues, bindings).
 * This is called during initial startup and after successful reconnects.
 */
export async function setupTopology(): Promise<void> {
  console.info("Setting up RabbitMQ topology...");

  await setupExchanges();

  console.info("RabbitMQ topology setup complete");
}

/**
 * Register topology setup for automatic recovery after reconnects.
 * This should be called once during application initialization.
 */
export function registerTopologyRecovery(): void {
  connectionManager.registerTopologySetup(async (connection: Connection) => {
    console.info("Recovering RabbitMQ topology after reconnect...");
    await setupTopologyWithConnection(connection);
  });
}

/**
 * Setup exchanges.
 */
async function setupExchanges(): Promise<void> {
  const channel = await channelManager.getTopologyChannel();

  await new Promise<void>((resolve, reject) => {
    channel.assertExchange(
      env.RABBITMQ_EXCHANGE,
      "topic",
      {
        durable: true,
        autoDelete: false,
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });

  console.info(`Exchange '${env.RABBITMQ_EXCHANGE}' asserted successfully`);
}

/**
 * Setup topology using a specific connection (for reconnect scenario).
 */
async function setupTopologyWithConnection(
  connection: Connection
): Promise<void> {
  const channel = await new Promise<Channel>((resolve, reject) => {
    connection.createChannel((error, createdChannel) => {
      if (error) {
        reject(error);
      } else if (createdChannel) {
        resolve(createdChannel);
      } else {
        reject(new Error("RabbitMQ returned an empty topology channel"));
      }
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      channel.assertExchange(
        env.RABBITMQ_EXCHANGE,
        "topic",
        {
          durable: true,
          autoDelete: false,
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });

    console.info(
      `Exchange '${env.RABBITMQ_EXCHANGE}' recovered successfully after reconnect`
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      channel.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

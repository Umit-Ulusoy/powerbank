
import { connect, type Connection } from "amqplib/callback_api";

import { env } from "../../config/env.js";

type TopologySetupCallback = (connection: Connection) => Promise<void>;

class RabbitMQConnectionManager {
  private connection: Connection | null = null;
  private pendingConnection: Connection | null = null;
  private connectionPromise: Promise<Connection> | null = null;

  private isShuttingDown = false;
  private connectionGeneration = 0;

  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;

  private readonly MAX_RECONNECT_DELAY_MS = 30000;
  private readonly INITIAL_RECONNECT_DELAY_MS = 1000;
  private readonly JITTER_MS = 500;

  private topologySetupCallback: TopologySetupCallback | null = null;
  private onConnectionClose: (() => void) | null = null;

  /**
   * Register a callback to setup topology after successful reconnection.
   */
  registerTopologySetup(callback: TopologySetupCallback): void {
    this.topologySetupCallback = callback;
  }

  async connect(): Promise<Connection> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isShuttingDown) {
      throw new Error("Cannot connect: application is shutting down");
    }

    const generation = ++this.connectionGeneration;
    const connectionPromise = this.createConnection(generation);

    this.connectionPromise = connectionPromise;

    try {
      const connection = await connectionPromise;

      if (
        this.isShuttingDown ||
        generation !== this.connectionGeneration ||
        this.connectionPromise !== connectionPromise
      ) {
        await this.closeConnection(connection);

        throw new Error(
          "RabbitMQ connection became stale or application is shutting down"
        );
      }

      this.connection = connection;
      this.pendingConnection = null;

      return connection;
    } catch (error) {
      if (this.connectionPromise === connectionPromise) {
        this.connectionPromise = null;
      }

      throw error;
    }
  }

  private async createConnection(
    generation: number
  ): Promise<Connection> {
    console.info("Connecting to RabbitMQ...");

    try {
      const connection = await new Promise<Connection>((resolve, reject) => {
        connect(env.RABBITMQ_URL, (error, conn) => {
          if (error) {
            reject(error);
          } else {
            resolve(conn);
          }
        });
      });

      if (
        this.isShuttingDown ||
        generation !== this.connectionGeneration
      ) {
        await this.closeConnection(connection);

        throw new Error(
          "RabbitMQ connection completed after shutdown or became stale"
        );
      }

      this.pendingConnection = connection;

      console.info("RabbitMQ connected successfully");

      connection.on("error", (error: Error) => {
        console.error("RabbitMQ connection error:", error.message);
      });

      connection.on("close", () => {
        console.warn("RabbitMQ connection closed");
        this.handleConnectionClose(connection, generation);
      });

      // Recover topology after reconnection.
      if (this.reconnectAttempts > 0 && this.topologySetupCallback) {
        try {
          await this.topologySetupCallback(connection);
        } catch (topologyError) {
          console.error(
            "Failed to setup topology after reconnect:",
            topologyError instanceof Error
              ? topologyError.message
              : String(topologyError)
          );

          await this.closeConnection(connection);

          throw topologyError;
        }
      }

      if (
        this.isShuttingDown ||
        generation !== this.connectionGeneration
      ) {
        await this.closeConnection(connection);

        throw new Error(
          "RabbitMQ connection became unavailable during initialization"
        );
      }

      this.reconnectAttempts = 0;

      return connection;
    } catch (error) {
      console.error(
        "Failed to connect to RabbitMQ:",
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  private handleConnectionClose(
    connection: Connection,
    generation: number
  ): void {
    // Ignore close events from stale connections.
    if (
      generation !== this.connectionGeneration ||
      (this.connection !== connection &&
        this.pendingConnection !== connection)
    ) {
      return;
    }

    this.connection = null;
    this.pendingConnection = null;
    this.connectionPromise = null;

    // Invalidate operations associated with this connection.
    this.connectionGeneration++;

    if (this.onConnectionClose) {
      this.onConnectionClose();
    }

    if (!this.isShuttingDown) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId || this.isShuttingDown) {
      return;
    }

    const baseDelay = Math.min(
      this.INITIAL_RECONNECT_DELAY_MS *
        Math.pow(2, this.reconnectAttempts),
      this.MAX_RECONNECT_DELAY_MS
    );

    const jitter = Math.random() * this.JITTER_MS;
    const delay = Math.min(
      baseDelay + jitter,
      this.MAX_RECONNECT_DELAY_MS
    );

    this.reconnectAttempts++;

    console.info(
      `Scheduling reconnect to RabbitMQ in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})...`
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;

      if (this.isShuttingDown) {
        return;
      }

      this.connect().catch((error) => {
        console.error(
          "Reconnection attempt failed:",
          error instanceof Error ? error.message : String(error)
        );

        // A failed connection attempt does not necessarily emit "close".
        // Explicitly schedule the next retry.
        this.scheduleReconnect();
      });
    }, delay);
  }

  private async closeConnection(connection: Connection): Promise<void> {
    await new Promise<void>((resolve) => {
      connection.close((error) => {
        if (error) {
          console.error(
            "Error closing RabbitMQ connection:",
            error.message
          );
        }

        resolve();
      });
    });
  }

  async close(): Promise<void> {
    this.isShuttingDown = true;

    // Invalidate any ongoing connection attempt.
    this.connectionGeneration++;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    const connectionToClose =
      this.connection ?? this.pendingConnection;

    this.connection = null;
    this.pendingConnection = null;

    if (connectionToClose) {
      await this.closeConnection(connectionToClose);
      console.info("RabbitMQ connection closed successfully");
    }

    // Wait briefly for an ongoing connection attempt to settle.
    const pendingConnectionPromise = this.connectionPromise;

    if (pendingConnectionPromise) {
      let timeoutId: NodeJS.Timeout | undefined;

      try {
        await Promise.race([
          pendingConnectionPromise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("Connection timeout during shutdown")),
              5000
            );
          }),
        ]);
      } catch {
        // Connection errors and timeout are expected during shutdown.
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    this.connection = null;
    this.pendingConnection = null;
    this.connectionPromise = null;
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection !== null;
  }

  setConnectionCloseHandler(handler: () => void): void {
    this.onConnectionClose = handler;
  }
}

export const connectionManager = new RabbitMQConnectionManager();

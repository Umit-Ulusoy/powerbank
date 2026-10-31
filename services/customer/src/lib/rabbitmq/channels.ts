
import type {
  Channel,
  ConfirmChannel,
  Connection,
} from "amqplib/callback_api";

import { connectionManager } from "./connection.js";

type ChannelCreation<T extends Channel> = {
  channel: T;
  connection: Connection;
  generation: number;
};

class RabbitMQChannelManager {
  private publisherChannel: ConfirmChannel | null = null;
  private topologyChannel: Channel | null = null;

  private publisherChannelPromise: Promise<
    ChannelCreation<ConfirmChannel>
  > | null = null;

  private topologyChannelPromise: Promise<
    ChannelCreation<Channel>
  > | null = null;

  private isShuttingDown = false;
  private connectionGeneration = 0;

  private readonly closedChannels = new WeakSet<Channel>();

  constructor() {
    connectionManager.setConnectionCloseHandler(() => {
      this.handleConnectionClose();
    });
  }

  /**
   * Get or create publisher ConfirmChannel for publishing messages.
   */
  async getPublisherChannel(): Promise<ConfirmChannel> {
    if (this.publisherChannel) {
      return this.publisherChannel;
    }

    if (this.publisherChannelPromise) {
      return this.resolvePublisherChannel(this.publisherChannelPromise);
    }

    if (this.isShuttingDown) {
      throw new Error("Cannot create channel: shutting down");
    }

    const creationPromise = this.createPublisherChannel();
    this.publisherChannelPromise = creationPromise;

    try {
      return await this.resolvePublisherChannel(creationPromise);
    } catch (error) {
      if (this.publisherChannelPromise === creationPromise) {
        this.publisherChannelPromise = null;
      }

      throw error;
    }
  }

  private async resolvePublisherChannel(
    creationPromise: Promise<ChannelCreation<ConfirmChannel>>
  ): Promise<ConfirmChannel> {
    const created = await creationPromise;

    if (
      this.publisherChannelPromise !== creationPromise ||
      !this.isCurrentCreation(created)
    ) {
      await this.closeChannel(created.channel, "publisher");

      throw new Error(
        "Publisher channel creation became stale or application is shutting down"
      );
    }

    this.publisherChannel = created.channel;

    return created.channel;
  }

  private async createPublisherChannel(): Promise<
    ChannelCreation<ConfirmChannel>
  > {
    const connection = await connectionManager.connect();
    const generation = this.connectionGeneration;

    if (this.isShuttingDown || connectionManager.getConnection() !== connection) {
      throw new Error("Cannot create publisher channel: connection is unavailable");
    }

    console.info("Creating publisher ConfirmChannel...");

    const channel = await new Promise<ConfirmChannel>((resolve, reject) => {
      connection.createConfirmChannel((error, ch) => {
        if (error) {
          reject(error);
        } else {
          resolve(ch);
        }
      });
    });

    const created = { channel, connection, generation };

    if (!this.isCurrentCreation(created)) {
      await this.closeChannel(channel, "publisher");

      throw new Error("Publisher channel creation completed on a stale connection");
    }

    channel.on("error", (error: Error) => {
      console.error("Publisher channel error:", error.message);
    });

    channel.on("close", () => {
      console.warn("Publisher channel closed");
      this.closedChannels.add(channel);

      if (this.publisherChannel === channel) {
        this.publisherChannel = null;
        this.publisherChannelPromise = null;
      }
    });

    console.info("Publisher ConfirmChannel created successfully");

    return created;
  }

  /**
   * Get or create topology Channel for exchange/queue management.
   */
  async getTopologyChannel(): Promise<Channel> {
    if (this.topologyChannel) {
      return this.topologyChannel;
    }

    if (this.topologyChannelPromise) {
      return this.resolveTopologyChannel(this.topologyChannelPromise);
    }

    if (this.isShuttingDown) {
      throw new Error("Cannot create channel: shutting down");
    }

    const creationPromise = this.createTopologyChannel();
    this.topologyChannelPromise = creationPromise;

    try {
      return await this.resolveTopologyChannel(creationPromise);
    } catch (error) {
      if (this.topologyChannelPromise === creationPromise) {
        this.topologyChannelPromise = null;
      }

      throw error;
    }
  }

  private async resolveTopologyChannel(
    creationPromise: Promise<ChannelCreation<Channel>>
  ): Promise<Channel> {
    const created = await creationPromise;

    if (
      this.topologyChannelPromise !== creationPromise ||
      !this.isCurrentCreation(created)
    ) {
      await this.closeChannel(created.channel, "topology");

      throw new Error(
        "Topology channel creation became stale or application is shutting down"
      );
    }

    this.topologyChannel = created.channel;

    return created.channel;
  }

  private async createTopologyChannel(): Promise<ChannelCreation<Channel>> {
    const connection = await connectionManager.connect();
    const generation = this.connectionGeneration;

    if (this.isShuttingDown || connectionManager.getConnection() !== connection) {
      throw new Error("Cannot create topology channel: connection is unavailable");
    }

    console.info("Creating topology Channel...");

    const channel = await new Promise<Channel>((resolve, reject) => {
      connection.createChannel((error, ch) => {
        if (error) {
          reject(error);
        } else {
          resolve(ch);
        }
      });
    });

    const created = { channel, connection, generation };

    if (!this.isCurrentCreation(created)) {
      await this.closeChannel(channel, "topology");

      throw new Error("Topology channel creation completed on a stale connection");
    }

    channel.on("error", (error: Error) => {
      console.error("Topology channel error:", error.message);
    });

    channel.on("close", () => {
      console.warn("Topology channel closed");
      this.closedChannels.add(channel);

      if (this.topologyChannel === channel) {
        this.topologyChannel = null;
        this.topologyChannelPromise = null;
      }
    });

    console.info("Topology Channel created successfully");

    return created;
  }

  private isCurrentCreation<T extends Channel>(
    created: ChannelCreation<T>
  ): boolean {
    return (
      !this.isShuttingDown &&
      created.generation === this.connectionGeneration &&
      connectionManager.getConnection() === created.connection &&
      !this.closedChannels.has(created.channel)
    );
  }

  /**
   * Handle connection close - invalidate all existing channel references.
   */
  private handleConnectionClose(): void {
    console.info("Cleaning up channels due to connection close");

    this.connectionGeneration++;

    this.publisherChannel = null;
    this.topologyChannel = null;
    this.publisherChannelPromise = null;
    this.topologyChannelPromise = null;
  }

  private async closeChannel(
    channel: Channel,
    name: string
  ): Promise<void> {
    if (this.closedChannels.has(channel)) {
      return;
    }

    await new Promise<void>((resolve) => {
      channel.close((error) => {
        if (error) {
          console.error(`Error closing ${name} channel:`, error.message);
        }

        resolve();
      });
    });
  }

  async closeAll(): Promise<void> {
    this.isShuttingDown = true;

    const publisherChannel = this.publisherChannel;
    const topologyChannel = this.topologyChannel;

    this.publisherChannel = null;
    this.topologyChannel = null;

    this.publisherChannelPromise = null;
    this.topologyChannelPromise = null;

    const closePromises: Promise<void>[] = [];

    if (publisherChannel) {
      closePromises.push(
        this.closeChannel(publisherChannel, "publisher")
      );
    }

    if (topologyChannel) {
      closePromises.push(
        this.closeChannel(topologyChannel, "topology")
      );
    }

    await Promise.allSettled(closePromises);

    console.info("RabbitMQ channel cleanup completed");
  }
}

export const channelManager = new RabbitMQChannelManager();

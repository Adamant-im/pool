import RewardDistributor from './distribute_rewards.js';

import { log } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';

class QueueNode {
  /**
   * Creates a queue node for a forged block.
   * @param {object} value Forged block queued for reward distribution
   */
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class BlockParser {
  /**
   * Creates an in-memory FIFO queue for forged blocks awaiting parsing.
   */
  constructor() {
    this.queue = {};
    this.length = 0;

    this.tail = null;
    this.head = null;

    this.isLocked = false;
  }

  get isEmpty() {
    return this.length === 0;
  }

  /**
   * Checks whether a block id is already queued.
   * @param {string|number} blockId Block id returned by the ADAMANT node API
   * @returns {boolean} Whether the block is already queued
   */
  queued(blockId) {
    return !!this.queue[blockId];
  }

  /**
   * Adds a forged block to the queue unless it is already queued.
   * @param {object} block Forged block returned by the ADAMANT node API
   * @returns {void}
   */
  enqueue(block) {
    const { id } = block;

    if (!this.queued(id)) {
      const node = new QueueNode(block);

      if (this.head) {
        this.tail.next = id;
      } else {
        this.head = node;
      }

      this.tail = node;

      this.queue[id] = node;
      this.length += 1;
    }
  }

  /**
   * Removes and returns the next queued block.
   * @returns {object|undefined} Next block when the queue is not empty
   */
  dequeue() {
    if (!this.isEmpty) {
      const { value: block } = this.head;

      delete this.queue[block.id];

      const nextHead = this.queue[this.head.next];

      if (nextHead) {
        this.head = nextHead;
      } else {
        this.head = null;
        this.tail = null;
      }

      this.length -= 1;

      return block;
    }
  }

  /**
   * Parses queued blocks sequentially while preventing overlapping runs.
   * @returns {Promise<void>}
   */
  async run() {
    if (!this.isEmpty && !this.isLocked) {
      this.isLocked = true;

      const block = this.dequeue();

      try {
        await this.parse(block);
      } catch (error) {
        const errorTemplate = `Error while processing block ${block.id} (height ${block.height})`;

        log.error(`${errorTemplate}: ${error}`);
      }

      this.isLocked = false;

      return this.run();
    }
  }

  /**
   * Saves a new block or retries reward distribution for an unprocessed block.
   * @param {object} block Forged block returned by the ADAMANT node API
   * @returns {Promise<void>}
   */
  async parse(block) {
    const { id, height } = block;

    let savedBlock;
    try {
      savedBlock = await mongo.blocksCollection.findOne({ id });
    } catch (error) {
      log.error(`Failed to parse block ${id} at height ${height}: ${error}`);
      return;
    }

    if (savedBlock) {
      if (!savedBlock.processed) {
        log.info(`Re-trying to distribute rewards for block ${id} (height ${height})…`);

        const rewardDistributor = new RewardDistributor({
          ...block,
          ...savedBlock,
        });

        await rewardDistributor.distribute();
      }
    } else {
      log.info(`New block forged: ${id} (height ${height}).`);

      try {
        await mongo.blocksCollection.insertOne({
          ...block,
          processed: false,
          rewardedAddresses: [],
        });
      } catch (error) {
        log.error(`Failed to parse block ${id} at height ${height}: ${error}`);
        return;
      }

      log.info(
          `Forged block successfully stored: ${id} (height ${height}). Distributing rewards…`,
      );

      const rewardDistributor = new RewardDistributor({
        ...block,
        processed: false,
        rewardedAddresses: [],
      });

      await rewardDistributor.distribute();
    }
  }
}

export default BlockParser;

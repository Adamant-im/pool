import RewardDistributor from './distribute_rewards.js';

import { log } from '../helpers/index.js';
import mongo from '../repository/mongodb/index.js';

class QueueNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class BlockParser {
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

  queued(blockId) {
    return !!this.queue[blockId];
  }

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

  async run() {
    if (!this.isEmpty && !this.isLocked) {
      this.isLocked = true;

      const block = this.dequeue();

      try {
        await this.parse(block);
      } catch (error) {
        const errorTemplate = `Error while processing ${block.id} (height ${block.height})`;

        log.error(`${errorTemplate}: ${error}`);
      }

      this.isLocked = false;

      return this.run();
    }
  }

  async parse(block) {
    const { id, height } = block;

    const rewardDistributor = new RewardDistributor(block);

    let savedBlock;
    try {
      savedBlock = await mongo.blocksCollection.findOne({ id });
    } catch (error) {
      log.error(`Failed to parse block ${id} with height ${height}: ${error}`);
      return;
    }

    if (savedBlock) {
      if (!savedBlock.processed) {
        log.info(`Re-trying to distribute rewards for block ${id} (height ${height})…`);

        await rewardDistributor.distribute();
      }
    } else {
      log.info(`New block forged: ${id} (height ${height}).`);

      try {
        await mongo.blocksCollection.insertOne(block);
      } catch (error) {
        log.error(`Failed to parse block ${id} with height ${height}: ${error}`);
        return;
      }

      log.info(
          `Block successfully saved: ${id} (height ${height}). Distributing rewards…`,
      );

      await rewardDistributor.distribute();
    }
  }
}

export default BlockParser;

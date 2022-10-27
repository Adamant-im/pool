import RewardDistributor from './distribute_rewards.js';

import {dbBlocks} from '../helpers/DB.js';
import {log} from '../helpers/index.js';

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
    const {id} = block;

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
      const {value: block} = this.head;

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
    const {id} = block;

    const savedBlock = await dbBlocks.findOne({id});

    const rewardDistributer = new RewardDistributor(block);

    if (savedBlock) {
      if (!savedBlock.processed) {
        log.info(`Re-trying to distribute rewards for block ${block.id} (height ${block.height})…`);

        return rewardDistributer.distribute();
      }
    } else {
      log.info(`New block forged: ${block.id} (height ${block.height}).`);

      const insertBlock = await dbBlocks.insert(block);

      if (insertBlock) {
        log.info(
            `Block successfully saved: ${block.id} (height ${block.height}). Distributing rewards…`,
        );

        return rewardDistributer.distribute();
      } else {
        log.warn(`Failed to save block ${block.id} (height ${block.height}).`);
      }
    }
  }
}

export default BlockParser;

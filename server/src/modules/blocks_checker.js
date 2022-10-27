import BlockParser from './block_parser.js';

import {api, config, log} from '../helpers/index.js';
import {UPDATE_BLOCKS_INTERVAL} from '../helpers/const.js';

const blockParser = new BlockParser();

async function getBlocks() {
  try {
    // FIX ME: use generatorPublicKey parameter instead of filtering
    const blocks = await api.get('blocks', {limit: 100});

    if (blocks.success) {
      const delegateBlocks = blocks.data.blocks.filter(
          (block) => block.generatorPublicKey === config.publicKey,
      );

      delegateBlocks.forEach((block) => blockParser.enqueue(block));

      blockParser.run();
    } else {
      log.warn(`Failed to get blocks. ${blocks.errorMessage}.`);
    }
  } catch (error) {
    log.error(`Error while checking new blocks: ${error}`);
  }
}

export default () => {
  getBlocks();
  if (process.env.NODE_ENV !== 'test') {
    setInterval(getBlocks, UPDATE_BLOCKS_INTERVAL);
  }
};

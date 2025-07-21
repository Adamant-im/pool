import BlockParser from './block_parser.js';

import {api, config, log} from '../helpers/index.js';
import {UPDATE_BLOCKS_INTERVAL} from '../helpers/const.js';

const blockParser = new BlockParser();

async function getBlocks() {
  try {
    const getBlocksResponse = await api.getBlocks({limit: 100, generatorPublicKey: config.publicKey});

    if (getBlocksResponse.success) {
      getBlocksResponse.blocks.forEach((block) => blockParser.enqueue(block));

      blockParser.run();
    } else {
      log.warn(`Failed to get blocks. ${getBlocksResponse.errorMessage}.`);
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

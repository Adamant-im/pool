import BlockParser from './block_parser.js';

import { UPDATE_BLOCKS_INTERVAL } from '../defines.js';

import { adamantApiClient, config, log } from '../helpers/index.js';

const blockParser = new BlockParser();

async function getBlocks() {
  try {
    const getBlocksResponse = await adamantApiClient.getBlocks({ limit: 100, generatorPublicKey: config.publicKey });

    if (getBlocksResponse.success) {
      getBlocksResponse.blocks.forEach((block) => blockParser.enqueue(block));

      await blockParser.run();
    } else {
      log.warn(`Failed to get blocks. ${getBlocksResponse.errorMessage}.`);
    }
  } catch (error) {
    log.error(`Error while checking new blocks: ${error}`);
  }
}

export default async () => {
  console.log('Getting blocks');
  await getBlocks();
  setInterval(async () => {
    await getBlocks();
  }, UPDATE_BLOCKS_INTERVAL);
};

import BlockParser from './block_parser.js';

import { adamantApiClient, config, log } from '../helpers/index.js';

const blockParser = new BlockParser();

async function checkBlocks() {
  try {
    const getBlocksResponse = await adamantApiClient.getBlocks({ limit: 100, generatorPublicKey: config.publicKey });

    if (getBlocksResponse.success) {
      const { blocks } = getBlocksResponse;
      blocks.forEach((block) => blockParser.enqueue(block));

      await blockParser.run();
    } else {
      log.warn(`Failed to get blocks. ${getBlocksResponse.errorMessage}.`);
    }
  } catch (error) {
    log.error(`Error while checking new blocks: ${error}`);
  }
}

export default checkBlocks;

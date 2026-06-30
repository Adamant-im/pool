import BlockParser from './block_parser.js';

import { adamantApiClient, config, log } from '../helpers/index.js';

const blockParser = new BlockParser();

/**
 * Fetches recent delegate blocks and passes them through the reward parser queue.
 * @returns {Promise<void>}
 */
async function checkBlocks() {
  try {
    const getBlocksResponse = await adamantApiClient.getBlocks({ limit: 100, generatorPublicKey: config.publicKey });

    if (getBlocksResponse.success) {
      const { blocks } = getBlocksResponse;

      log.debug(`Fetched ${blocks.length} forged blocks for delegate ${config.address}.`);

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

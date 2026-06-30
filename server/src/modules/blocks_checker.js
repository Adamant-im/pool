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

      log.debug(`Fetched last ${blocks.length} blocks forged by delegate ${config.address}.`);

      blocks.forEach((block) => blockParser.enqueue(block));

      await blockParser.run();
    } else {
      log.warn(`Failed to get blocks forged by delegate ${config.address}. ${getBlocksResponse.errorMessage}.`);
    }
  } catch (error) {
    log.error(`Error while checking blocks forged by delegate ${config.address}: ${error}`);
  }
}

export default checkBlocks;

import {jest} from '@jest/globals';
import {dbBlocks} from '../../src/helpers/DB.js';

const mockDistribute = jest.fn();

jest.unstable_mockModule('../../src/modules/distribute_rewards.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => {
    return {distribute: mockDistribute};
  }),
}));

const BlockParser = (await import('../../src/modules/block_parser.js')).default;
const RewardDistributor = (await import('../../src/modules/distribute_rewards.js')).default;

beforeEach(() => {
  RewardDistributor.mockClear();
  mockDistribute.mockClear();
});

describe('BlockParser', () => {
  const blockParser = new BlockParser();

  it('should enqueue all blocks', () => {
    for (let id = 0; id < 3; id += 1) {
      blockParser.enqueue({id});
    }

    expect(blockParser.length).toBe(3);
    expect(blockParser.head.value.id).toBe(0);
    expect(blockParser.tail.value.id).toBe(2);
  });

  it('should dequeue a block', () => {
    const headNode = blockParser.dequeue();

    expect(headNode.id).toBe(0);
    expect(blockParser.length).toBe(2);
    expect(blockParser.head.value.id).toBe(1);
    expect(blockParser.tail.value.id).toBe(2);
  });
});

describe('blockParser.parse', () => {
  beforeEach(() => {
    dbBlocks.data = {values: []};
    return dbBlocks.write();
  });

  const blockParser = new BlockParser();
  const id = 1;

  it('should not distribute rewards for processed block', async () => {
    await dbBlocks.insert({id, processed: true});

    await blockParser.parse({id});

    expect(RewardDistributor).toHaveBeenCalledTimes(1);
    expect(mockDistribute).toHaveBeenCalledTimes(0);
  });

  it('should distribute rewards for not processed block', async () => {
    await dbBlocks.insert({id});

    await blockParser.parse({id});

    expect(RewardDistributor).toHaveBeenCalledTimes(1);
    expect(mockDistribute).toHaveBeenCalledTimes(1);
  });

  it('should save new block to DB and distribute', async () => {
    const savedBlockBeforeParsing = await dbBlocks.findOne({id});

    await blockParser.parse({id});

    const savedBlockAfterParsing = await dbBlocks.findOne({id});

    expect(RewardDistributor).toHaveBeenCalledTimes(1);
    expect(mockDistribute).toHaveBeenCalledTimes(1);
    expect(savedBlockBeforeParsing).toBeUndefined();
    expect(savedBlockAfterParsing.id).toBe(id);
  });
});

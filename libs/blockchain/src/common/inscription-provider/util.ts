
import { Errors, OracleError } from 'libs/errors/errors';
import { WithHeight } from './types';


export class BlockheightOutOfSyncError extends OracleError {
  constructor(expectedHeight: number, actualHeight: number) {
    super(Errors.INDEXER_BLOCKHEIGHT_OUT_OF_SYNC(expectedHeight, actualHeight));
  }
}

/**
 * Helper function that retries a delegate function call if its only a single
 * block behind.
 */
export async function BlockheightAwareRetry<T>(
  blockheight: number,
  delegate: () => Promise<WithHeight<T>>,
  triesLeft = 2,
  delayMs = 5000
): Promise<WithHeight<T>> {

  const attempt = await delegate();

  // did we successfully get a response within the expected blockheight range?
  if (attempt.block_height >= blockheight) {
    return attempt;
  }

  // more than 1 block behind? bail
  if (attempt.block_height < blockheight - 1) {
    throw new BlockheightOutOfSyncError(blockheight, attempt.block_height);
  }

  // just one block behind? try again

  // any retry attempts left?
  if (triesLeft <= 0) {
    throw new BlockheightOutOfSyncError(blockheight, attempt.block_height);
  }

  // retry in 5s (ord indexers are usually pretty quick)
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return BlockheightAwareRetry(blockheight, delegate, triesLeft - 1, delayMs);
}

import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger';

/**
 * Runs a set of operations in a MongoDB transaction session.
 * Automatically aborts on failure and commits on success.
 * If the database deployment is a standalone MongoDB (doesn't support replica sets),
 * it falls back to running the function without a transaction session.
 */
export async function runInTransaction<T>(
  fn: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  let session: ClientSession | null = null;
  
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (error: any) {
    logger.warn(
      `Could not start MongoDB transaction session (Likely standalone DB). Running operations without transaction. Details: ${error.message}`
    );
    return fn(null);
  }

  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error: any) {
    logger.error(`Transaction aborted due to error: ${error.message}`);
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError: any) {
        logger.error(`Failed to abort transaction: ${abortError.message}`);
      }
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

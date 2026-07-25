import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('connect', () => {
  logger.info('Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Connected successfully.');
});

redisClient.on('error', (err) => {
  logger.error(`Redis Client Error: ${err.message}`);
});

redisClient.on('end', () => {
  logger.warn('Redis client connection closed.');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
  } catch (error: any) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
    // Do not crash the app if Redis is missing, but log error.
    // In production, we might want to crash, but for local/dev fallback, we handle gracefully.
  }
};
